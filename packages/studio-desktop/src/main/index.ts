import { mkdir } from 'node:fs/promises';
import type { Server } from 'node:http';
import { join } from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import type { DesktopSettings, DesktopState } from '../shared/types';
import { DEFAULT_RUNTIME_PORT, DEFAULT_STUDIO_PORT, LOCALHOST } from './defaults';
import { probeLmStudioModels } from './lmstudio';
import { LogBuffer } from './log-buffer';
import { resolveAppIconPath, resolveStarterOutputPath, resolveStudioDistPath } from './paths';
import { findAvailablePort } from './ports';
import { buildLmStudioPresetSettings, LM_STUDIO_PRESET, selectLmStudioModelId } from './presets';
import { ManagedMastraRuntime } from './runtime';
import { readSettings, updateSettings, writeSettings } from './settings';
import { startStudioShellServer } from './studio-server';
import { buildLocalUrl, normalizeServerUrl } from './url';

let mainWindow: BrowserWindow | undefined;
let studioServer: Server | undefined;
let runtime: ManagedMastraRuntime | undefined;
let settingsPath = '';
let userDataPath = '';
let currentSettings: DesktopSettings;
let currentState: DesktopState | undefined;

const logs = new LogBuffer();

app.setName('Mastra Studio');
const hasSingleInstanceLock = app.requestSingleInstanceLock();

function emitState() {
  if (mainWindow && !mainWindow.isDestroyed() && currentState) {
    mainWindow.webContents.send('desktop:state-changed', currentState);
  }
}

function addAppLog(message: string) {
  logs.add(message);
  if (!currentState) return;
  currentState = { ...currentState, logs: logs.all() };
  emitState();
}

function snapshotState(patch: Partial<DesktopState> = {}) {
  currentState = {
    settings: currentSettings,
    runtime: runtime?.status ?? { state: 'idle' },
    studio: currentState?.studio ?? {},
    activeServerUrl: currentState?.activeServerUrl,
    logs: logs.all(),
    ...patch,
  };
  emitState();
  return currentState;
}

async function closeStudioServer() {
  if (!studioServer) return;
  const server = studioServer;
  studioServer = undefined;
  await new Promise<void>(resolve => server.close(() => resolve()));
}

async function stopRuntime() {
  if (!runtime) return;
  await runtime.stop();
  runtime = undefined;
}

function externalServerUrl(settings: DesktopSettings) {
  return normalizeServerUrl(settings.externalServerUrl || 'http://127.0.0.1:4111');
}

async function startServices(settings: DesktopSettings) {
  await closeStudioServer();

  let activeServerUrl: string;
  let runtimeStatus = runtime?.status ?? { state: 'idle' as const };

  if (settings.serverMode === 'managed') {
    await stopRuntime();
    const runtimePort = await findAvailablePort(DEFAULT_RUNTIME_PORT);
    const outputDir = resolveStarterOutputPath({
      packaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
    });

    runtime = new ManagedMastraRuntime({
      outputDir,
      userDataPath,
      logs,
    });
    runtimeStatus = await runtime.start(settings, runtimePort);
    activeServerUrl = runtimeStatus.url ?? buildLocalUrl(runtimePort).replace(/\/$/, '');
  } else {
    await stopRuntime();
    runtimeStatus = { state: 'idle' };
    activeServerUrl = externalServerUrl(settings);
  }

  const studioPort = await findAvailablePort(DEFAULT_STUDIO_PORT);
  const studioDistPath = resolveStudioDistPath({
    packaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
  });
  studioServer = await startStudioShellServer({
    builtStudioPath: studioDistPath,
    port: studioPort,
    serverUrl: activeServerUrl,
  });

  logs.add(`Studio shell listening on http://${LOCALHOST}:${studioPort}`);
  snapshotState({
    runtime: runtimeStatus,
    studio: {
      port: studioPort,
      url: buildLocalUrl(studioPort),
    },
    activeServerUrl,
    logs: logs.all(),
  });
}

async function loadStudioInWindow() {
  if (!mainWindow || mainWindow.isDestroyed() || !currentState?.studio.url) return;
  await mainWindow.loadURL(currentState.studio.url);
}

async function reloadServicesWithSettings(settings: DesktopSettings) {
  currentSettings = await writeSettings(settingsPath, settings);
  await startServices(currentSettings);
  await loadStudioInWindow();
  return snapshotState({ logs: logs.all() });
}

async function showMessage(options: Electron.MessageBoxOptions) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    await dialog.showMessageBox(mainWindow, options);
    return;
  }

  await dialog.showMessageBox(options);
}

async function checkLmStudioServer() {
  const result = await probeLmStudioModels(currentSettings.modelUrl || LM_STUDIO_PRESET.modelUrl);
  if (!result.ok) {
    logs.add(`LM Studio probe failed: ${result.error ?? 'unknown error'}`);
    snapshotState({ logs: logs.all() });
    await showMessage({
      type: 'warning',
      title: 'LM Studio unavailable',
      message: 'LM Studio is not reachable.',
      detail: `${result.error ?? 'Start the LM Studio local server and try again.'}\n\nChecked: ${result.modelUrl}/models`,
    });
    return result;
  }

  const detail =
    result.models.length > 0
      ? result.models.map(model => `- ${model}`).join('\n')
      : 'LM Studio responded, but it did not report any loaded models.';
  logs.add(`LM Studio probe succeeded with ${result.models.length} model(s).`);
  snapshotState({ logs: logs.all() });
  await showMessage({
    type: result.models.length > 0 ? 'info' : 'warning',
    title: 'LM Studio models',
    message: result.models.length > 0 ? 'LM Studio is reachable.' : 'LM Studio is running without loaded models.',
    detail,
  });
  return result;
}

async function applyLmStudioPreset() {
  const result = await probeLmStudioModels(LM_STUDIO_PRESET.modelUrl);
  const modelId = selectLmStudioModelId(result);
  await reloadServicesWithSettings(buildLmStudioPresetSettings(currentSettings, modelId));

  const detail = result.ok
    ? result.models.length > 0
      ? `Selected detected model: ${modelId}`
      : `No loaded models were reported. The default model remains: ${modelId}`
    : `${result.error ?? 'Start the LM Studio local server and try again.'}\n\nThe preset was applied with the default model: ${modelId}`;

  await showMessage({
    type: result.ok && result.models.length > 0 ? 'info' : 'warning',
    title: 'LM Studio preset',
    message: 'LM Studio preset applied.',
    detail,
  });
}

async function loadMainWindow() {
  const icon = resolveAppIconPath({
    packaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
  });

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 980,
    minWidth: 980,
    minHeight: 700,
    title: 'Mastra Studio',
    icon,
    backgroundColor: '#101113',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('console-message', details => {
    const source = details.sourceId ? ` (${details.sourceId}:${details.lineNumber})` : '';
    addAppLog(`Renderer ${details.level}: ${details.message}${source}`);
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    const frame = isMainFrame ? 'main frame' : 'subframe';
    addAppLog(`Renderer failed to load ${frame} ${validatedURL}: ${errorCode} ${errorDescription}`);
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    addAppLog(`Renderer process exited: ${details.reason} (${details.exitCode})`);
  });

  mainWindow.webContents.on('will-navigate', event => {
    const targetUrl = event.url;
    if (targetUrl.startsWith('file:') || targetUrl.startsWith(`http://${LOCALHOST}:`)) {
      return;
    }
    event.preventDefault();
    void shell.openExternal(targetUrl);
  });

  await loadStudioInWindow();
}

function installMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: 'Mastra Studio',
      submenu: [
        {
          label: 'Open Studio in Browser',
          click: () => {
            if (currentState?.studio.url) void shell.openExternal(currentState.studio.url);
          },
        },
        {
          label: 'Open Data Folder',
          click: () => {
            void shell.openPath(userDataPath);
          },
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Model',
      submenu: [
        {
          label: 'Use LM Studio Preset',
          click: () => {
            void applyLmStudioPreset();
          },
        },
        {
          label: 'Check LM Studio Server',
          click: () => {
            void checkLmStudioServer();
          },
        },
        { type: 'separator' },
        {
          label: 'Restart Managed Runtime',
          click: () => {
            void reloadServicesWithSettings(currentSettings);
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }],
    },
  ]);

  Menu.setApplicationMenu(menu);
}

function installIpc() {
  ipcMain.handle('desktop:get-state', () => snapshotState({ logs: logs.all() }));

  ipcMain.handle('desktop:update-settings', async (_event, updates: Partial<DesktopSettings>) => {
    currentSettings = await updateSettings(settingsPath, updates);
    await startServices(currentSettings);
    await loadStudioInWindow();
    return {
      settings: currentSettings,
      state: snapshotState({ logs: logs.all() }),
    };
  });

  ipcMain.handle('desktop:probe-lmstudio-models', async (_event, modelUrl?: string) => {
    const result = await probeLmStudioModels(modelUrl ?? currentSettings.modelUrl);
    if (!result.ok) {
      logs.add(`LM Studio probe failed: ${result.error ?? 'unknown error'}`);
    }
    snapshotState({ logs: logs.all() });
    return result;
  });

  ipcMain.handle('desktop:restart-runtime', async () => {
    if (currentSettings.serverMode === 'managed') {
      await reloadServicesWithSettings(currentSettings);
    }
    return snapshotState({ logs: logs.all() });
  });

  ipcMain.handle('desktop:get-logs', () => logs.all());

  ipcMain.handle('desktop:open-studio-external', async () => {
    if (currentState?.studio.url) await shell.openExternal(currentState.studio.url);
  });

  ipcMain.handle('desktop:open-data-folder', async () => {
    await shell.openPath(userDataPath);
  });
}

async function boot() {
  userDataPath = app.getPath('userData');
  settingsPath = join(userDataPath, 'settings.json');
  await mkdir(userDataPath, { recursive: true });

  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(
      resolveAppIconPath({
        packaged: app.isPackaged,
        resourcesPath: process.resourcesPath,
      }),
    );
  }

  currentSettings = await readSettings(settingsPath);
  await writeSettings(settingsPath, currentSettings);
  currentState = {
    settings: currentSettings,
    runtime: { state: 'idle' },
    studio: {},
    logs: logs.all(),
  };

  installMenu();
  installIpc();
  await startServices(currentSettings);
  await loadMainWindow();
}

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  void app.whenReady().then(() => {
    boot().catch(error => {
      logs.add(error instanceof Error ? error.stack || error.message : String(error));
      void loadMainWindow();
    });
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void loadMainWindow();
    }
  });

  app.on('before-quit', event => {
    event.preventDefault();
    Promise.all([closeStudioServer(), stopRuntime()])
      .catch(error => logs.add(error instanceof Error ? error.message : String(error)))
      .finally(() => app.exit(0));
  });
}
