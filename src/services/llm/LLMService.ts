import { AppState, AppStateStatus } from 'react-native';
import {
  initLlama,
  LlamaContext,
  type RNLlamaOAICompatibleMessage,
  type TokenData,
  type NativeCompletionResult,
} from 'llama.rn';
import { getModelPath, isModelDownloaded } from './ModelDownloader';
import ConversationManager from './ConversationManager';
import { SYSTEM_PROMPTS } from './PromptTemplates';
import { LLM_CONFIG, CHAT_CONFIG } from '../../utils/constants';
import { Message } from '../../types/chat';

type ModelStatus =
  | 'not_downloaded'
  | 'downloading'
  | 'downloaded'
  | 'loading'
  | 'ready'
  | 'error';

type StatusListener = (status: ModelStatus) => void;

/**
 * Extract only the final answer from model output.
 * Gemma 4 with thinking outputs: <channel>thought...thinking...<channel>actual response
 * We strip everything up to and including the last <channel> marker.
 */
export function extractFinalAnswer(text: string): string {
  // Match various <channel> patterns the model may emit
  const markers = /<channel[l]?>/gi;
  let lastIdx = -1;
  let match: RegExpExecArray | null;
  while ((match = markers.exec(text)) !== null) {
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx > 0) {
    return text.substring(lastIdx).trim();
  }
  // No channel markers — return as-is but strip any leading thinking artifacts
  return text.replace(/^(Thinking Process:[\s\S]*?\n\n)/i, '').trim();
}

class LLMService {
  private context: LlamaContext | null = null;
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
  private statusListeners: StatusListener[] = [];
  private _status: ModelStatus = 'not_downloaded';
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly IDLE_TIMEOUT_MS = 5 * 60 * 1000;

  /** True while a chat/complete call is in progress. */
  public isGenerating: boolean = false;

  get status(): ModelStatus {
    return this._status;
  }

  private setStatus(status: ModelStatus): void {
    this._status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  async initialize(onProgress?: (progress: number) => void): Promise<void> {
    if (this.context) return;

    const downloaded = await isModelDownloaded();
    if (!downloaded) {
      this.setStatus('not_downloaded');
      throw new Error('Model not downloaded. Download it first.');
    }

    this.setStatus('loading');

    try {
      const modelPath = getModelPath();

      this.context = await initLlama(
        {
          model: modelPath,
          n_ctx: LLM_CONFIG.n_ctx,
          n_batch: LLM_CONFIG.n_batch,
          n_threads: LLM_CONFIG.n_threads,
          n_gpu_layers: 0,
          use_mlock: LLM_CONFIG.use_mlock,
          flash_attn_type: LLM_CONFIG.flash_attn_type,
          cache_type_k: LLM_CONFIG.cache_type_k,
          cache_type_v: LLM_CONFIG.cache_type_v,
        },
        onProgress,
      );

      this.setStatus('ready');
      this.setupAppStateListener();
      this.resetIdleTimer();
    } catch (error) {
      this.setStatus('error');
      throw error;
    }
  }

  isReady(): boolean {
    return this.context !== null && this._status === 'ready';
  }

  /**
   * Run a chat completion with raw streaming token callback.
   * Tokens include thinking — caller is responsible for filtering.
   */
  async chat(
    messages: Message[],
    onToken: (token: string) => void,
    systemPrompt: string = SYSTEM_PROMPTS.therapist,
  ): Promise<string> {
    if (!this.context) {
      throw new Error('Model not loaded. Call initialize() first.');
    }

    this.resetIdleTimer();
    this.isGenerating = true;

    try {
      const formattedMessages = ConversationManager.buildChatContext(
        messages,
        systemPrompt,
      );

      const result = await this.context.completion(
        {
          messages: formattedMessages,
          temperature: CHAT_CONFIG.temperature,
          top_p: CHAT_CONFIG.top_p,
          top_k: CHAT_CONFIG.top_k,
          n_predict: CHAT_CONFIG.max_tokens,
          stop: [...CHAT_CONFIG.stop],
          enable_thinking: false,
        },
        (data: TokenData) => {
          if (data.token) {
            onToken(data.token);
          }
        },
      );

      this.resetIdleTimer();
      return extractFinalAnswer(result.text);
    } finally {
      this.isGenerating = false;
    }
  }

  /**
   * One-shot completion (journal reflection, mood insight).
   * Returns only the final answer with thinking stripped.
   */
  async complete(
    systemPrompt: string,
    userMessage: string,
    onToken?: (token: string) => void,
  ): Promise<string> {
    if (!this.context) {
      throw new Error('Model not loaded. Call initialize() first.');
    }

    this.resetIdleTimer();
    this.isGenerating = true;

    try {
      const messages = ConversationManager.buildOneShotContext(
        systemPrompt,
        userMessage,
      );

      const result = await this.context.completion(
        {
          messages,
          temperature: CHAT_CONFIG.temperature,
          top_p: CHAT_CONFIG.top_p,
          top_k: CHAT_CONFIG.top_k,
          n_predict: 256,
          stop: [...CHAT_CONFIG.stop],
          enable_thinking: false,
        },
        onToken
          ? (data: TokenData) => {
              if (data.token) onToken(data.token);
            }
          : undefined,
      );

      this.resetIdleTimer();
      return extractFinalAnswer(result.text);
    } finally {
      this.isGenerating = false;
    }
  }

  async stopCompletion(): Promise<void> {
    if (this.context) {
      await this.context.stopCompletion();
    }
  }

  async release(): Promise<void> {
    this.clearIdleTimer();
    if (this.context) {
      await this.context.release();
      this.context = null;
    }
    this.setStatus('downloaded');
  }

  async cleanup(): Promise<void> {
    this.clearIdleTimer();
    this.removeAppStateListener();
    if (this.context) {
      await this.context.release();
      this.context = null;
    }
    this.statusListeners = [];
  }

  // ── AppState lifecycle ──

  private setupAppStateListener(): void {
    if (this.appStateSubscription) return;
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange,
    );
  }

  private removeAppStateListener(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }

  private handleAppStateChange = async (nextState: AppStateStatus) => {
    if (nextState === 'background' || nextState === 'inactive') {
      if (this.isGenerating) {
        console.log('[LLMService] App backgrounded — skipping release (generation in progress)');
        return;
      }
      if (this.context) {
        console.log('[LLMService] App backgrounded — releasing model context');
        await this.release();
      }
    }
  };

  // ── Idle timer ──

  private resetIdleTimer(): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(async () => {
      if (this.context) {
        console.log('[LLMService] Idle timeout — releasing model context');
        await this.release();
      }
    }, LLMService.IDLE_TIMEOUT_MS);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }
}

export default new LLMService();
