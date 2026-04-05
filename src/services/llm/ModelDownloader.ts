import RNFS from 'react-native-fs2';
import {
  setConfig,
  createDownloadTask,
  getExistingDownloadTasks,
  type DownloadTask,
} from '@kesha-antonov/react-native-background-downloader';
import { MODEL_FILENAME, MODEL_URL, MODEL_SIZE_MB } from '../../utils/constants';

const MODELS_DIR = `${RNFS.DocumentDirectoryPath}/models`;
const DOWNLOAD_TASK_ID = 'mindsafe-model-download';

let activeTask: DownloadTask | null = null;

// Configure the background downloader once
let configured = false;
function ensureConfigured() {
  if (configured) return;
  configured = true;
  setConfig({
    progressInterval: 1000,
    isLogsEnabled: false,
    showNotificationsEnabled: true,
  });
}

export function getModelPath(): string {
  return `${MODELS_DIR}/${MODEL_FILENAME}`;
}

export async function isModelDownloaded(): Promise<boolean> {
  return RNFS.exists(getModelPath());
}

export async function getModelFileSize(): Promise<number> {
  const path = getModelPath();
  if (await RNFS.exists(path)) {
    const stat = await RNFS.stat(path);
    return Number(stat.size);
  }
  return 0;
}

export function getExpectedModelSizeMB(): number {
  return MODEL_SIZE_MB;
}

/**
 * Download the AI model with background support.
 * Continues downloading even when app is backgrounded.
 * Shows a system notification with progress on Android.
 */
export async function downloadModel(
  onProgress: (percent: number) => void,
): Promise<string> {
  const filePath = getModelPath();

  // Already downloaded
  if (await RNFS.exists(filePath)) {
    onProgress(100);
    return filePath;
  }

  // Ensure models directory exists
  if (!(await RNFS.exists(MODELS_DIR))) {
    await RNFS.mkdir(MODELS_DIR);
  }

  ensureConfigured();

  // Check if there's an existing download we can resume
  const existingTasks = await getExistingDownloadTasks();
  const existing = existingTasks.find((t) => t.id === DOWNLOAD_TASK_ID);

  if (existing && (existing.state === 'DOWNLOADING' || existing.state === 'PAUSED')) {
    console.log(`[ModelDownloader] Resuming existing download (${existing.state})`);
    return attachToTask(existing, onProgress, filePath);
  }

  // Start a new download
  console.log(`[ModelDownloader] Starting new background download: ${MODEL_URL}`);

  const task = createDownloadTask({
    id: DOWNLOAD_TASK_ID,
    url: MODEL_URL,
    destination: filePath,
  });

  activeTask = task;
  task.start();

  return attachToTask(task, onProgress, filePath);
}

/**
 * Attach progress/done/error handlers to a download task and return a promise.
 */
function attachToTask(
  task: DownloadTask,
  onProgress: (percent: number) => void,
  filePath: string,
): Promise<string> {
  activeTask = task;

  return new Promise<string>((resolve, reject) => {
    task
      .begin(({ expectedBytes }) => {
        console.log(
          `[ModelDownloader] Download started. Size: ${(expectedBytes / (1024 * 1024)).toFixed(0)} MB`,
        );
      })
      .progress(({ bytesDownloaded, bytesTotal }) => {
        if (bytesTotal > 0) {
          const percent = Math.round((bytesDownloaded / bytesTotal) * 100);
          onProgress(percent);
        }
      })
      .done(({ bytesDownloaded }) => {
        console.log(
          `[ModelDownloader] Download complete. ${(bytesDownloaded / (1024 * 1024)).toFixed(0)} MB`,
        );
        activeTask = null;
        onProgress(100);
        resolve(filePath);
      })
      .error(({ error, errorCode }) => {
        console.warn(`[ModelDownloader] Download failed: ${error} (code ${errorCode})`);
        activeTask = null;
        // Clean up partial file
        RNFS.unlink(filePath).catch(() => {});
        reject(new Error(`Download failed: ${error}`));
      });

    // If task was already in progress (resumed), trigger initial progress
    if (task.bytesTotal > 0) {
      const percent = Math.round((task.bytesDownloaded / task.bytesTotal) * 100);
      onProgress(percent);
    }
  });
}

export async function cancelDownload(): Promise<void> {
  if (activeTask) {
    await activeTask.stop();
    activeTask = null;
  }
  // Clean up partial file
  const filePath = getModelPath();
  if (await RNFS.exists(filePath)) {
    RNFS.unlink(filePath).catch(() => {});
  }
}

export async function deleteModel(): Promise<void> {
  const filePath = getModelPath();
  if (await RNFS.exists(filePath)) {
    await RNFS.unlink(filePath);
  }
}

export async function getAvailableStorage(): Promise<number> {
  const info = await RNFS.getFSInfo();
  return Math.round(info.freeSpace / (1024 * 1024)); // MB
}

export async function hasEnoughStorage(): Promise<boolean> {
  const available = await getAvailableStorage();
  return available > MODEL_SIZE_MB + 500;
}
