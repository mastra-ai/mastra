import { basename, isAbsolute, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import type { DesktopAppInfo, DesktopDirectorySelection, DesktopPlatform } from '@mastra/code-app/desktop-host';
import electron from 'electron';
import type {
  BrowserWindow as ElectronBrowserWindow,
  BrowserWindowConstructorOptions,
  IpcMainInvokeEvent,
  OpenDialogOptions,
  Session,
} from 'electron';

import { startDesktopBackend } from './backend-client.js';
import { DESKTOP_IPC_CHANNELS, parseDirectorySelectionOptions } from './ipc.js';
import { createLaunchScreenDataUrl } from './launch-screen.js';
import { resolvePreloadPath } from './paths.js';
import type { DesktopServerHandle } from './server-types.js';

const APP_NAME = 'MastraCode Desktop Alpha';
const APP_LOAD_TIMEOUT_MS = 30_000;
const MIN_LAUNCH_SCREEN_MS = 1_400;
const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:']);
const { app, BrowserWindow, dialog, ipcMain, nativeImage, session, shell } = electron;

let mainWindow: ElectronBrowserWindow | null = null;
let splashWindow: ElectronBrowserWindow | null = null;
let mainWindowCreation: Promise<void> | null = null;
let serverHandle: DesktopServerHandle | null = null;
let serverClosePromise: Promise<void> | undefined;
let launchScreenUrl: string | null = null;
let quitting = false;
let cleanupComplete = false;

const desktopTestMode = process.env.MASTRACODE_DESKTOP_TEST_MODE === '1';
const desktopTestUserDataDir = desktopTestMode ? process.env.MASTRACODE_DESKTOP_TEST_USER_DATA_DIR : undefined;
const desktopTestProjectDir = desktopTestMode ? process.env.MASTRACODE_DESKTOP_TEST_PROJECT_DIR : undefined;

if (!desktopTestMode) {
  app.commandLine.removeSwitch('remote-debugging-pipe');
  app.commandLine.removeSwitch('remote-debugging-port');
}

if (desktopTestUserDataDir) {
  app.setPath('userData', desktopTestUserDataDir);
  app.setPath('sessionData', desktopTestUserDataDir);
}

app.enableSandbox();
app.setName(APP_NAME);

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
    if (ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
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
    const window = mainWindow;
    if (!window) throw new Error('Desktop IPC is only available while the MastraCode window is open');
    if (
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      !isAllowedAppUrl(event.senderFrame.url)
    ) {
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
      const testProjectDir = desktopTestProjectDir;
      if (testProjectDir) {
        if (!serverHandle) throw new Error('Desktop server is not ready');
        const path = await serverHandle.approveProjectDirectory(testProjectDir);
        return { canceled: false, path, name: basename(path) };
      }

      const requestedDefaultPath = parseDirectorySelectionOptions(selectionOptions)?.defaultPath;
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
  if (serverClosePromise) return serverClosePromise;
  if (!serverHandle) return;
  const handle = serverHandle;
  serverHandle = null;
  serverClosePromise = handle.close().finally(() => {
    serverClosePromise = undefined;
  });
  return serverClosePromise;
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

async function createSplashWindow(url: string, appSession: Session): Promise<ElectronBrowserWindow> {
  const window = new BrowserWindow({
    title: APP_NAME,
    width: 280,
    height: 280,
    show: false,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    focusable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      allowRunningInsecureContent: false,
      contextIsolation: true,
      devTools: false,
      experimentalFeatures: false,
      navigateOnDragDrop: false,
      nodeIntegration: false,
      safeDialogs: true,
      sandbox: true,
      session: appSession,
      webviewTag: false,
      webSecurity: true,
    },
  });
  splashWindow = window;
  window.setIgnoreMouseEvents(true);
  window.center();
  registerSecurityHandlers(window);
  window.on('closed', () => {
    if (splashWindow === window) splashWindow = null;
  });
  await window.loadURL(url);
  if (!window.isDestroyed()) window.showInactive();
  return window;
}

async function revealMainWindow(window: ElectronBrowserWindow, splash: ElectronBrowserWindow): Promise<void> {
  const supportsOpacity = process.platform !== 'linux';
  if (supportsOpacity) window.setOpacity(0);
  window.show();

  if (supportsOpacity) {
    const durationMs = 240;
    const startedAt = performance.now();
    let progress = 0;
    while (progress < 1 && !window.isDestroyed()) {
      progress = Math.min((performance.now() - startedAt) / durationMs, 1);
      const easedProgress = 1 - (1 - progress) ** 3;
      window.setOpacity(easedProgress);
      if (!splash.isDestroyed()) splash.setOpacity(1 - easedProgress);
      if (progress < 1) await delay(16);
    }
  }

  if (!window.isDestroyed()) {
    if (supportsOpacity) window.setOpacity(1);
    window.focus();
  }
  if (!splash.isDestroyed()) splash.destroy();
}

async function createMainWindow(): Promise<void> {
  await serverClosePromise;
  const appSession = session.defaultSession;
  appSession.setPermissionCheckHandler(() => false);
  appSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  launchScreenUrl = getLaunchScreenUrl();
  const launchStartedAt = performance.now();
  const splash = await createSplashWindow(launchScreenUrl, appSession);

  const startedServer = await startDesktopBackend({
    projectAccessFile: join(app.getPath('userData'), 'approved-projects.json'),
    onUnexpectedExit: error => {
      dialog.showErrorBox(APP_NAME, error.message);
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
    },
  });
  serverHandle = startedServer;

  const platformWindowOptions: Partial<BrowserWindowConstructorOptions> =
    process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 14, y: 14 } } : {};
  const window = new BrowserWindow({
    title: APP_NAME,
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: '#050706',
    ...platformWindowOptions,
    webPreferences: {
      allowRunningInsecureContent: false,
      contextIsolation: true,
      devTools: !app.isPackaged,
      experimentalFeatures: false,
      navigateOnDragDrop: false,
      nodeIntegration: false,
      preload: resolvePreloadPath(),
      safeDialogs: true,
      sandbox: true,
      session: appSession,
      webviewTag: false,
      webSecurity: true,
    },
  });
  mainWindow = window;

  registerSecurityHandlers(window);

  window.on('page-title-updated', event => {
    event.preventDefault();
    window.setTitle(APP_NAME);
  });
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null;
    if (!quitting) void closeServer();
  });

  if (window.isDestroyed()) {
    await startedServer.close();
    return;
  }
  const remainingLaunchTime = MIN_LAUNCH_SCREEN_MS - (performance.now() - launchStartedAt);
  await Promise.all([
    loadMainWindow(window, serverHandle.bootstrapUrl),
    remainingLaunchTime > 0 ? delay(remainingLaunchTime) : Promise.resolve(),
  ]);
  if (window.isDestroyed()) {
    await startedServer.close();
    return;
  }

  await revealMainWindow(window, splash);
  launchScreenUrl = null;
}

function ensureMainWindow(): Promise<void> {
  if (mainWindow) return Promise.resolve();
  mainWindowCreation ??= createMainWindow().finally(() => {
    mainWindowCreation = null;
  });
  return mainWindowCreation;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
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
    contents.on('will-attach-webview', event => {
      event.preventDefault();
    });
  });

  app
    .whenReady()
    .then(async () => {
      await ensureMainWindow();
    })
    .catch((error: unknown) => {
      dialog.showErrorBox(APP_NAME, error instanceof Error ? error.message : String(error));
      app.quit();
    });

  app.on('before-quit', event => {
    quitting = true;
    if (cleanupComplete || (!serverHandle && !serverClosePromise)) {
      cleanupComplete = true;
      return;
    }
    event.preventDefault();
    void closeServer()
      .catch((error: unknown) => {
        console.error('Failed to close the MastraCode desktop server:', error);
      })
      .finally(() => {
        cleanupComplete = true;
        app.quit();
      });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (!mainWindow) {
      void ensureMainWindow().catch((error: unknown) => {
        dialog.showErrorBox(APP_NAME, error instanceof Error ? error.message : String(error));
      });
    }
  });
}
