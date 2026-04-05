export const MODEL_FILENAME = 'gemma-4-E2B-it-Q3_K_M.gguf';

export const MODEL_URL =
  'https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q3_K_M.gguf';

export const MODEL_SIZE_MB = 2540;

export const LLM_CONFIG = {
  n_ctx: 2048,
  n_batch: 1024,
  n_threads: 6,
  use_mlock: true,
  flash_attn_type: 'auto' as const,
  cache_type_k: 'q8_0' as const,
  cache_type_v: 'q8_0' as const,
} as const;

export const CHAT_CONFIG = {
  temperature: 0.7,
  top_p: 0.9,
  top_k: 30,
  max_tokens: 512,
  stop: ['<turn|>'],
  maxContextMessages: 8,
} as const;

export const MOOD_LEVELS = [
  { level: 1, label: 'Awful', emoji: '😣' },
  { level: 2, label: 'Bad', emoji: '😞' },
  { level: 3, label: 'Okay', emoji: '😐' },
  { level: 4, label: 'Good', emoji: '🙂' },
  { level: 5, label: 'Great', emoji: '😄' },
] as const;

export const QUICK_PROMPTS = [
  'I need to vent',
  'Help me relax',
  'Gratitude check-in',
  'Talk through anxiety',
  'Celebrate a win',
] as const;

export const DAILY_QUOTES = [
  '"The soul usually knows what to do to heal itself. The challenge is to silence the mind."',
  '"You don\'t have to control your thoughts. You just have to stop letting them control you."',
  '"Almost everything will work again if you unplug it for a few minutes, including you."',
  '"Feelings are just visitors. Let them come and go."',
  '"The present moment is filled with joy and happiness. If you are attentive, you will see it."',
  '"You are allowed to be both a masterpiece and a work in progress simultaneously."',
  '"Breathe. Let go. And remind yourself that this very moment is the only one you know you have for sure."',
] as const;

export const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export const MOOD_FACTORS = [
  'Morning exercise',
  '7+ hours sleep',
  'Time with friends',
  'Time outdoors',
  'Meditation',
  'Good meal',
  'Creative work',
  'Reading',
] as const;
