import { basename, isAbsolute, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import electron from 'electron';
import type { BrowserWindow as ElectronBrowserWindow, IpcMainInvokeEvent, OpenDialogOptions } from 'electron';
import type {
  DesktopAppInfo,
  DesktopDirectorySelection,
  DesktopDirectorySelectionOptions,
  DesktopPlatform,
} from 'mastracode-web/desktop-host';

import { maybeRunDesktopE2E, readDesktopE2EOption, writeDesktopE2EFailure, writeDesktopE2EProgress } from './e2e.js';
import { DESKTOP_IPC_CHANNELS } from './ipc.js';
import { createLaunchScreenDataUrl } from './launch-screen.js';
import { resolvePreloadPath } from './paths.js';
import type { DesktopServerHandle } from './server.js';

const APP_NAME = 'MastraCode Desktop Alpha';
const APP_LOAD_TIMEOUT_MS = 30_000;
const MIN_LAUNCH_SCREEN_MS = 1_400;
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const { app, BrowserWindow, dialog, ipcMain, nativeImage, session, shell } = electron;

let mainWindow: ElectronBrowserWindow | null = null;
let mainWindowCreation: Promise<void> | null = null;
let serverHandle: DesktopServerHandle | null = null;
let launchScreenUrl: string | null = null;
let quitting = false;

const desktopE2EUserDataDir = readDesktopE2EOption(
  'MASTRACODE_DESKTOP_USER_DATA_DIR',
  'mastracode-desktop-user-data-dir',
);
const desktopE2ETestProjectDir = readDesktopE2EOption(
  'MASTRACODE_DESKTOP_TEST_PROJECT_DIR',
  'mastracode-desktop-test-project-dir',
);

if (desktopE2EUserDataDir) {
  app.setPath('userData', desktopE2EUserDataDir);
  app.setPath('sessionData', desktopE2EUserDataDir);
}

app.setName(APP_NAME);

const desktopE2ERunConfigured = Boolean(
  readDesktopE2EOption('MASTRACODE_DESKTOP_E2E_RESULT_FILE', 'mastracode-desktop-e2e-result-file'),
);

void writeDesktopE2EProgress('main-module-loaded', {
  argv: process.argv,
  resourcesPath: process.resourcesPath,
  resultFileConfigured: Boolean(process.env.MASTRACODE_DESKTOP_E2E_RESULT_FILE),
  resultFileArgConfigured: desktopE2ERunConfigured,
});

function isAllowedAppUrl(url: string): boolean {
  if (!serverHandle) return false;
  try {
    return new URL(url).origin === serverHandle.origin;
  } catch {
    return false;
  }
}

function isAllowedRendererUrl(url: string): boolean {
  return url === launchScreenUrl || isAllowedAppUrl(url);
}

function openExternal(url: string): void {
  try {
    const parsed = new URL(url);
    if (ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      void shell.openExternal(url);
    }
  } catch {
    // Ignore malformed external URLs.
  }
}

function isDesktopPlatform(platform: NodeJS.Platform): platform is DesktopPlatform {
  return platform === 'darwin' || platform === 'linux' || platform === 'win32';
}

function getDesktopAppInfo(): DesktopAppInfo {
  if (!isDesktopPlatform(process.platform)) {
    throw new Error(`Unsupported desktop platform: ${process.platform}`);
  }
  return {
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
  };
}

function registerSecurityHandlers(window: ElectronBrowserWindow): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', event => {
    const url = event.url;
    if (isAllowedRendererUrl(url)) return;
    event.preventDefault();
    openExternal(url);
  });
}

function getLaunchScreenUrl(): string {
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'launch-icon.png')
    : resolve(import.meta.dirname, '../../build/icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) throw new Error(`MastraCode launch icon is missing: ${iconPath}`);
  return createLaunchScreenDataUrl(icon.resize({ width: 224, height: 224, quality: 'best' }).toDataURL());
}

function registerIpcHandlers(): void {
  const assertTrustedRenderer = (event: IpcMainInvokeEvent) => {
    if (!isAllowedAppUrl(event.senderFrame?.url ?? '')) {
      throw new Error('Desktop IPC is only available to the MastraCode app');
    }
  };

  ipcMain.handle(DESKTOP_IPC_CHANNELS.getAppInfo, event => {
    assertTrustedRenderer(event);
    return getDesktopAppInfo();
  });

  ipcMain.handle(
    DESKTOP_IPC_CHANNELS.selectProjectDirectory,
    async (event, selectionOptions: unknown): Promise<DesktopDirectorySelection> => {
      assertTrustedRenderer(event);
      const testProjectDir = desktopE2ETestProjectDir;
      if (testProjectDir) {
        if (!serverHandle) throw new Error('Desktop server is not ready');
        const path = await serverHandle.approveProjectDirectory(testProjectDir);
        return { canceled: false, path, name: basename(path) };
      }

      const requestedDefaultPath = (selectionOptions as DesktopDirectorySelectionOptions | undefined)?.defaultPath;
      const options: OpenDialogOptions = {
        title: 'Choose a MastraCode project',
        properties: ['openDirectory', 'createDirectory'],
        ...(typeof requestedDefaultPath === 'string' && isAbsolute(requestedDefaultPath)
          ? { defaultPath: requestedDefaultPath }
          : {}),
      };
      const result = mainWindow
        ? await dialog.showOpenDialog(mainWindow, options)
        : await dialog.showOpenDialog(options);
      if (result.canceled || result.filePaths.length === 0) return { canceled: true };

      const path = result.filePaths[0];
      if (!path) return { canceled: true };
      if (!serverHandle) throw new Error('Desktop server is not ready');
      const approvedPath = await serverHandle.approveProjectDirectory(path);
      return { canceled: false, path: approvedPath, name: basename(approvedPath) };
    },
  );
}

async function closeServer(): Promise<void> {
  if (!serverHandle) return;
  const handle = serverHandle;
  serverHandle = null;
  await handle.close();
}

async function loadMainWindow(window: ElectronBrowserWindow, url: string): Promise<void> {
  let timeout: NodeJS.Timeout | undefined;
  const timedOut = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      reject(new Error('MastraCode interface did not load from the local desktop server within 30 seconds'));
    }, APP_LOAD_TIMEOUT_MS);
  });

  try {
    await Promise.race([window.loadURL(url), timedOut]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function createMainWindow(): Promise<void> {
  const appSession = session.defaultSession;
  appSession.setPermissionCheckHandler(() => false);
  appSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  launchScreenUrl = getLaunchScreenUrl();
  const launchStartedAt = performance.now();
  const window = new BrowserWindow({
    title: APP_NAME,
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: '#050706',
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 14, y: 14 } }
      : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: resolvePreloadPath(),
      sandbox: true,
      session: appSession,
      webSecurity: true,
    },
  });
  mainWindow = window;
  await writeDesktopE2EProgress('browser-window-created');

  registerSecurityHandlers(window);
  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    void writeDesktopE2EProgress('browser-window-did-fail-load', { errorCode, errorDescription, validatedURL });
  });
  window.webContents.on('did-finish-load', () => {
    void writeDesktopE2EProgress('browser-window-did-finish-load', { url: window.webContents.getURL() });
  });

  window.once('ready-to-show', () => {
    void writeDesktopE2EProgress('browser-window-ready-to-show');
    window.show();
  });
  window.on('page-title-updated', event => {
    event.preventDefault();
    window.setTitle(APP_NAME);
  });
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null;
    if (!quitting) void closeServer();
  });

  await window.loadURL(launchScreenUrl);
  await writeDesktopE2EProgress('launch-screen-loaded');

  await writeDesktopE2EProgress('loading-desktop-server-module');
  const { startDesktopServer } = await import('./server.js');
  await writeDesktopE2EProgress('starting-desktop-server');
  const startedServer = await startDesktopServer({
    projectAccessFile: join(app.getPath('userData'), 'approved-projects.json'),
    onProgress: writeDesktopE2EProgress,
  });
  if (window.isDestroyed()) {
    await startedServer.close();
    return;
  }
  await writeDesktopE2EProgress('desktop-server-started', { origin: startedServer.origin });
  await writeDesktopE2EProgress('desktop-server-bootstrap-ready');

  const remainingLaunchTime = MIN_LAUNCH_SCREEN_MS - (performance.now() - launchStartedAt);
  if (remainingLaunchTime > 0) await delay(remainingLaunchTime);
  if (window.isDestroyed()) {
    await startedServer.close();
    return;
  }
  serverHandle = startedServer;

  await writeDesktopE2EProgress('loading-app-url', { origin: serverHandle.origin });
  await loadMainWindow(window, serverHandle.bootstrapUrl);
  launchScreenUrl = null;
  await writeDesktopE2EProgress('app-url-loaded', { url: window.webContents.getURL() });
  await maybeRunDesktopE2E(window);
}

function ensureMainWindow(): Promise<void> {
  if (mainWindow) return Promise.resolve();
  mainWindowCreation ??= createMainWindow().finally(() => {
    mainWindowCreation = null;
  });
  return mainWindowCreation;
}

const gotLock = desktopE2ERunConfigured || app.requestSingleInstanceLock();
if (!gotLock) {
  void writeDesktopE2EProgress('single-instance-lock-denied');
  app.quit();
} else {
  void writeDesktopE2EProgress('single-instance-lock-acquired');
  registerIpcHandlers();

  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      openExternal(url);
      return { action: 'deny' };
    });
  });

  app
    .whenReady()
    .then(async () => {
      await ensureMainWindow();
    })
    .catch(async (error: unknown) => {
      await writeDesktopE2EFailure(error);
      dialog.showErrorBox(APP_NAME, error instanceof Error ? error.message : String(error));
      app.quit();
    });

  app.on('before-quit', () => {
    quitting = true;
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (!mainWindow) {
      void ensureMainWindow().catch(async (error: unknown) => {
        await writeDesktopE2EFailure(error);
        dialog.showErrorBox(APP_NAME, error instanceof Error ? error.message : String(error));
      });
    }
  });

  app.on('quit', () => {
    void closeServer();
  });
}
