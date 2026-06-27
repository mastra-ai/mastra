import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain, Menu, safeStorage, shell, WebContentsView } from 'electron';
import type { CreateDevTabInput, DesktopSettings, DesktopState, DesktopTab, PlatformState } from '../shared/types';
import { DEFAULT_RUNTIME_PORT, DEFAULT_STUDIO_PORT, LOCALHOST } from './defaults';
import { probeLmStudioModels, probeOpenAICompatibleModels } from './lmstudio';
import { probeMastraServer } from './local-dev';
import { LogBuffer } from './log-buffer';
import { resolveAppIconPath, resolveStarterOutputPath, resolveStudioDistPath } from './paths';
import {
  buildHostedStudioLoginUrl,
  buildPlatformCliLoginUrl,
  fetchPlatformProjects,
  hostedStudioOrigin,
  isHostedStudioAuthNavigation,
  normalizePlatformBaseUrl,
  refreshPlatformAccessToken,
  shouldAttachPlatformAuthorization,
} from './platform';
import type { PlatformSession } from './platform';
import { deletePlatformSession, readPlatformSession, writePlatformSession } from './platform-session';
import { findAvailablePort } from './ports';
import {
  buildLmStudioPresetSettings,
  buildModelPresetSettings,
  LM_STUDIO_PRESET,
  OLLAMA_PRESET,
  selectDetectedModelId,
  selectLmStudioModelId,
} from './presets';
import { ManagedMastraRuntime } from './runtime';
import { readSettings, updateSettings, writeSettings } from './settings';
import { startStudioShellServer } from './studio-server';
import { buildLocalUrl, normalizeServerUrl } from './url';

interface StudioShellEntry {
  key: string;
  port: number;
  url: string;
  serverUrl: string;
  server: Server;
}

interface StudioContentViewEntry {
  url: string;
  view: WebContentsView;
}

const thisFile = fileURLToPath(import.meta.url);
const thisDir = dirname(thisFile);
const CHROME_HEIGHT = 42;

let mainWindow: BrowserWindow | undefined;
let runtime: ManagedMastraRuntime | undefined;
let settingsPath = '';
let platformSessionPath = '';
let userDataPath = '';
let currentSettings: DesktopSettings;
let platformSession: PlatformSession | undefined;
let platformState: PlatformState;
let activeTabId: string | undefined;
let managedShellKey: string | undefined;
let managedStudio: { port?: number; url?: string } = {};
let activeServerUrl: string | undefined;
let isQuitting = false;

const logs = new LogBuffer();
const tabs: DesktopTab[] = [];
const studioShellServers = new Map<string, StudioShellEntry>();
const studioContentViews = new Map<string, StudioContentViewEntry>();
const studioWebContentsTabs = new Map<number, string>();
const platformStudioOrigins = new Set<string>();
let studioWebRequestHandlersInstalled = false;

app.setName('Mastra Studio');
const hasSingleInstanceLock = app.requestSingleInstanceLock();

function defaultPlatformState(baseUrl: string): PlatformState {
  return {
    baseUrl,
    status: 'signed-out',
    signedIn: false,
    organizations: [],
    projects: [],
  };
}

function buildState(patch: Partial<DesktopState> = {}): DesktopState {
  return {
    settings: currentSettings,
    runtime: runtime?.status ?? { state: 'idle' },
    studio: managedStudio,
    activeServerUrl,
    tabs: [...tabs],
    activeTabId,
    platform: platformState,
    logs: logs.all(),
    ...patch,
  };
}

function studioViewBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { x: 0, y: CHROME_HEIGHT, width: 0, height: 0 };
  }

  const [width, height] = mainWindow.getContentSize();
  return {
    x: 0,
    y: CHROME_HEIGHT,
    width,
    height: Math.max(0, height - CHROME_HEIGHT),
  };
}

function tabForWebContents(webContentsId: number) {
  const tabId = studioWebContentsTabs.get(webContentsId);
  return tabId ? tabs.find(tab => tab.id === tabId) : undefined;
}

function externalNavigationUrl(tab: DesktopTab | undefined, requestUrl: string) {
  if (!requestUrl.startsWith('http://') && !requestUrl.startsWith('https://')) {
    return requestUrl;
  }

  if (tab?.kind !== 'platform' || !tab.sourceUrl) return undefined;

  if (isHostedStudioAuthNavigation(requestUrl, tab.sourceUrl)) {
    return buildHostedStudioLoginUrl(currentSettings.platformBaseUrl, tab.sourceUrl);
  }

  try {
    const requestOrigin = new URL(requestUrl).origin;
    const studioOrigin = hostedStudioOrigin(tab.sourceUrl);
    return requestOrigin === studioOrigin ? undefined : requestUrl;
  } catch {
    return requestUrl;
  }
}

function createStudioContentView() {
  const view = new WebContentsView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      partition: 'persist:mastra-studio-tabs',
    },
  });
  view.setBackgroundColor('#101113');
  installStudioWebRequestHandlers(view);

  view.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
  view.webContents.on('will-navigate', event => {
    const url = externalNavigationUrl(tabForWebContents(view.webContents.id), event.url);
    if (url) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });
  view.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    const frame = isMainFrame ? 'main frame' : 'subframe';
    addAppLog(`Studio view failed to load ${frame} ${validatedURL}: ${errorCode} ${errorDescription}`);
    if (isMainFrame && errorCode !== -3) {
      markStudioWebContentsLoadError(
        view.webContents.id,
        `Studio failed to load ${validatedURL}: ${errorDescription} (${errorCode})`,
      );
    }
  });
  view.webContents.on('render-process-gone', (_event, details) => {
    addAppLog(`Studio view process exited: ${details.reason} (${details.exitCode})`);
  });

  return {
    url: '',
    view,
  };
}

function installStudioWebRequestHandlers(view: WebContentsView) {
  if (studioWebRequestHandlersInstalled) return;
  studioWebRequestHandlersInstalled = true;

  view.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
    if (!platformSession?.accessToken || !shouldAttachPlatformAuthorization(details.url, platformStudioOrigins)) {
      callback({ requestHeaders: details.requestHeaders });
      return;
    }

    const requestHeaders = { ...details.requestHeaders };
    const hasAuthorization = Object.keys(requestHeaders).some(header => header.toLowerCase() === 'authorization');
    if (!hasAuthorization) {
      requestHeaders.Authorization = `Bearer ${platformSession.accessToken}`;
    }
    callback({ requestHeaders });
  });

  view.webContents.session.webRequest.onCompleted({ urls: ['http://*/*', 'https://*/*'] }, details => {
    if (details.resourceType !== 'mainFrame' || details.statusCode < 400) return;
    if (typeof details.webContentsId !== 'number') return;

    const message = `Studio returned HTTP ${details.statusCode} for ${details.url}. If this is a hosted Platform Studio, verify that the deployment is available and the instance URL is current.`;
    markStudioWebContentsLoadError(details.webContentsId, message);
  });
}

function markStudioWebContentsLoadError(webContentsId: number, message: string) {
  const tabId = studioWebContentsTabs.get(webContentsId);
  if (!tabId) return;

  const tab = tabs.find(candidate => candidate.id === tabId);
  if (!tab) return;
  if (tab.status === 'error' && tab.error === message) return;

  tab.status = 'error';
  tab.error = message;
  logs.add(message);
  emitState();
}

function removeStudioContentView(tabId: string) {
  const entry = studioContentViews.get(tabId);
  if (!entry) return;
  studioContentViews.delete(tabId);
  studioWebContentsTabs.delete(entry.view.webContents.id);

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.contentView.removeChildView(entry.view);
  }
  if (!entry.view.webContents.isDestroyed()) {
    entry.view.webContents.close();
  }
}

function syncStudioViewBounds() {
  const bounds = studioViewBounds();
  for (const entry of studioContentViews.values()) {
    entry.view.setBounds(bounds);
  }
}

function syncStudioContentViews() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const tabIds = new Set(tabs.map(tab => tab.id));
  for (const tabId of studioContentViews.keys()) {
    if (!tabIds.has(tabId)) {
      removeStudioContentView(tabId);
    }
  }

  const active = activeTab();
  const bounds = studioViewBounds();
  for (const tab of tabs) {
    if (!tab.url || tab.status === 'error') {
      const entry = studioContentViews.get(tab.id);
      if (entry) {
        entry.view.setVisible(false);
      }
      continue;
    }

    let entry = studioContentViews.get(tab.id);
    if (!entry) {
      entry = createStudioContentView();
      studioContentViews.set(tab.id, entry);
      studioWebContentsTabs.set(entry.view.webContents.id, tab.id);
      mainWindow.contentView.addChildView(entry.view);
    }

    entry.view.setBounds(bounds);
    if (entry.url !== tab.url) {
      entry.url = tab.url;
      void entry.view.webContents.loadURL(tab.url).catch(error => {
        markStudioWebContentsLoadError(
          entry.view.webContents.id,
          `Studio failed to load ${tab.url}: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }

    const isActive = tab.id === active?.id;
    entry.view.setVisible(isActive);
    if (isActive) {
      mainWindow.contentView.addChildView(entry.view);
    }
  }
}

function emitState() {
  syncStudioContentViews();
  const state = buildState();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('desktop:state-changed', state);
  }
}

function snapshotState(patch: Partial<DesktopState> = {}) {
  syncStudioContentViews();
  const state = buildState(patch);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('desktop:state-changed', state);
  }
  return state;
}

function addAppLog(message: string) {
  logs.add(message);
  emitState();
}

function activeTab() {
  return tabs.find(tab => tab.id === activeTabId);
}

function upsertTab(tab: DesktopTab) {
  const index = tabs.findIndex(candidate => candidate.id === tab.id);
  if (index >= 0) {
    tabs[index] = tab;
  } else {
    tabs.push(tab);
  }
  activeTabId = tab.id;
  emitState();
}

function replaceTab(tab: DesktopTab) {
  const index = tabs.findIndex(candidate => candidate.id === tab.id);
  if (index < 0) return false;

  tabs[index] = tab;
  emitState();
  return true;
}

function createLauncherTab() {
  upsertTab({
    id: randomUUID(),
    kind: 'launcher',
    title: 'New tab',
    subtitle: 'Choose a Studio connection',
    status: 'ready',
  });
  return snapshotState();
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForMastraServer(serverUrl: string, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';

  while (Date.now() < deadline) {
    const probe = await probeMastraServer(serverUrl);
    if (probe.ok) return;

    lastError = probe.error ?? '';
    await wait(250);
  }

  throw new Error(lastError || `Mastra server did not become ready at ${serverUrl}`);
}

async function closeStudioShellServer(key: string | undefined) {
  if (!key) return;
  const entry = studioShellServers.get(key);
  if (!entry) return;
  studioShellServers.delete(key);
  await new Promise<void>(resolve => entry.server.close(() => resolve()));
}

async function closeAllStudioShellServers() {
  await Promise.all([...studioShellServers.keys()].map(key => closeStudioShellServer(key)));
}

async function stopRuntime() {
  if (!runtime) return;
  await runtime.stop();
  runtime = undefined;
}

async function startStudioShellForServer(serverUrl: string): Promise<StudioShellEntry> {
  const key = normalizeServerUrl(serverUrl);
  const existing = studioShellServers.get(key);
  if (existing) return existing;

  const studioPort = await findAvailablePort(DEFAULT_STUDIO_PORT + studioShellServers.size);
  const studioDistPath = resolveStudioDistPath({
    packaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
  });
  const server = await startStudioShellServer({
    builtStudioPath: studioDistPath,
    port: studioPort,
    serverUrl: key,
  });
  const entry = {
    key,
    port: studioPort,
    url: buildLocalUrl(studioPort),
    serverUrl: key,
    server,
  };

  studioShellServers.set(key, entry);
  logs.add(`Studio shell for ${key} listening on ${entry.url}`);
  emitState();
  return entry;
}

async function ensureManagedStudio(forceRestart = false) {
  if (!forceRestart && managedStudio.url && activeServerUrl && runtime?.status.state === 'running') {
    return managedStudio.url;
  }

  if (forceRestart) {
    await closeStudioShellServer(managedShellKey);
    managedShellKey = undefined;
    managedStudio = {};
    await stopRuntime();
  }

  if (!runtime) {
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
    await runtime.start(currentSettings, runtimePort);
  }

  activeServerUrl = runtime.status.url;
  if (!activeServerUrl) {
    throw new Error(runtime.status.error ?? 'Managed Mastra runtime did not return a URL');
  }

  await waitForMastraServer(activeServerUrl);

  const studio = await startStudioShellForServer(activeServerUrl);
  managedShellKey = studio.key;
  managedStudio = {
    port: studio.port,
    url: studio.url,
  };
  emitState();
  return studio.url;
}

async function restartManagedRuntime() {
  const url = await ensureManagedStudio(true);
  for (const tab of tabs) {
    if (tab.kind === 'managed') {
      tab.url = url;
      tab.sourceUrl = activeServerUrl;
      tab.status = 'ready';
      tab.error = undefined;
    }
  }
  return snapshotState();
}

async function createManagedTab() {
  const tab: DesktopTab = {
    id: randomUUID(),
    kind: 'managed',
    title: 'Bundled Template',
    subtitle: 'Starting local runtime',
    status: 'loading',
  };

  upsertTab(tab);

  try {
    const url = await ensureManagedStudio();
    replaceTab({
      ...tab,
      subtitle: 'Local starter runtime',
      url,
      sourceUrl: activeServerUrl,
      externalUrl: url,
      status: 'ready',
      error: undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logs.add(`Managed runtime failed: ${message}`);
    replaceTab({
      ...tab,
      subtitle: 'Local starter runtime unavailable',
      status: 'error',
      error: message,
    });
  }

  return snapshotState();
}

async function createDevTab(input: CreateDevTabInput) {
  const probe = await probeMastraServer(input.serverUrl);
  if (!probe.ok) {
    throw new Error(probe.error ?? `Unable to reach ${probe.serverUrl}`);
  }

  currentSettings = await updateSettings(settingsPath, {
    devServerUrl: probe.serverUrl,
    externalServerUrl: probe.serverUrl,
  });

  const studio = await startStudioShellForServer(probe.serverUrl);
  const title = new URL(probe.serverUrl).host;
  upsertTab({
    id: randomUUID(),
    kind: 'dev',
    title,
    subtitle: 'Local Mastra dev server',
    url: studio.url,
    sourceUrl: probe.serverUrl,
    externalUrl: studio.url,
    status: 'ready',
  });
  return snapshotState();
}

async function createPlatformTab(projectId: string) {
  const project = platformState.projects.find(candidate => candidate.id === projectId);
  if (!project) {
    throw new Error('Platform Studio project was not found');
  }
  if (!project.instanceUrl) {
    throw new Error('This hosted Studio does not have a URL yet');
  }
  if (!platformSession) {
    throw new Error('Connect to Platform before opening hosted Studio');
  }

  const studioUrl = normalizeServerUrl(project.instanceUrl);
  const loginUrl = buildHostedStudioLoginUrl(currentSettings.platformBaseUrl, studioUrl);
  await shell.openExternal(loginUrl);
  logs.add(`Opened hosted Studio sign-in in the browser for ${studioUrl}`);
  platformStudioOrigins.add(hostedStudioOrigin(studioUrl));
  upsertTab({
    id: randomUUID(),
    kind: 'platform',
    title: project.name,
    subtitle: studioUrl,
    url: studioUrl,
    sourceUrl: studioUrl,
    externalUrl: studioUrl,
    status: 'ready',
  });
  return snapshotState();
}

async function refreshPlatform() {
  if (!platformSession) {
    platformState = defaultPlatformState(currentSettings.platformBaseUrl);
    emitState();
    return snapshotState();
  }

  platformState = {
    ...platformState,
    status: 'loading',
    signedIn: true,
    error: undefined,
  };
  emitState();

  try {
    let result;
    try {
      result = await fetchPlatformProjects(platformSession);
    } catch (error) {
      platformSession = await refreshPlatformAccessToken(platformSession);
      await writePlatformSession(platformSessionPath, platformSession, safeStorage);
      result = await fetchPlatformProjects(platformSession);
      if (error instanceof Error) {
        logs.add(`Platform token refreshed after request failure: ${error.message}`);
      }
    }

    platformSession = {
      ...platformSession,
      organizationId: result.organizationId,
    };
    await writePlatformSession(platformSessionPath, platformSession, safeStorage);
    currentSettings = await updateSettings(settingsPath, {
      platformBaseUrl: platformSession.baseUrl,
      platformOrganizationId: result.organizationId,
    });
    platformState = {
      baseUrl: platformSession.baseUrl,
      status: 'ready',
      signedIn: true,
      user: platformSession.user,
      organizationId: result.organizationId,
      organizations: result.organizations,
      projects: result.projects,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load Platform projects';
    platformState = {
      ...platformState,
      status: 'error',
      signedIn: true,
      error: message,
    };
    logs.add(`Platform refresh failed: ${message}`);
  }

  return snapshotState();
}

async function waitForPlatformLoginCallback(port: number, state: string): Promise<PlatformSession> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const reqUrl = new URL(req.url ?? '/', `http://${LOCALHOST}:${port}`);
      if (reqUrl.pathname !== '/callback') {
        res.writeHead(404);
        res.end();
        return;
      }

      const error = reqUrl.searchParams.get('error');
      const returnedState = reqUrl.searchParams.get('state');
      const token = reqUrl.searchParams.get('token');
      const refreshToken = reqUrl.searchParams.get('refresh_token');
      const organizationId = reqUrl.searchParams.get('org') || undefined;
      const userParam = reqUrl.searchParams.get('user');

      if (error) {
        reject(new Error(reqUrl.searchParams.get('error_description') || error));
      } else if (returnedState !== state) {
        reject(new Error('Platform login state did not match'));
      } else if (!token || !refreshToken) {
        reject(new Error('Platform login did not return tokens'));
      } else {
        let user: PlatformSession['user'] | undefined;
        if (userParam) {
          try {
            user = JSON.parse(userParam) as PlatformSession['user'];
          } catch (parseError) {
            logs.add(
              `Platform login returned an unreadable user payload: ${
                parseError instanceof Error ? parseError.message : String(parseError)
              }`,
            );
          }
        }
        resolve({
          baseUrl: normalizePlatformBaseUrl(currentSettings.platformBaseUrl),
          accessToken: token,
          refreshToken,
          organizationId,
          user,
        });
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><title>Mastra Studio</title><p>You can return to Mastra Studio.</p>');
      server.close();
    });

    server.once('error', reject);
    server.listen(port, LOCALHOST);
    setTimeout(() => {
      server.close();
      reject(new Error('Platform login timed out'));
    }, 120_000).unref();
  });
}

async function startPlatformLogin() {
  const port = await findAvailablePort(52881);
  const state = randomUUID();
  const callback = waitForPlatformLoginCallback(port, state);
  platformState = {
    ...platformState,
    status: 'signing-in',
    error: undefined,
  };
  emitState();

  await shell.openExternal(buildPlatformCliLoginUrl(currentSettings.platformBaseUrl, port, state));
  platformSession = await callback;
  await writePlatformSession(platformSessionPath, platformSession, safeStorage);
  return refreshPlatform();
}

async function logoutPlatform() {
  platformSession = undefined;
  platformStudioOrigins.clear();
  await deletePlatformSession(platformSessionPath);
  platformState = defaultPlatformState(currentSettings.platformBaseUrl);
  return snapshotState();
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
    emitState();
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
  emitState();
  await showMessage({
    type: result.models.length > 0 ? 'info' : 'warning',
    title: 'LM Studio models',
    message: result.models.length > 0 ? 'LM Studio is reachable.' : 'LM Studio is running without loaded models.',
    detail,
  });
  return result;
}

async function checkCurrentModelServer() {
  const result = await probeOpenAICompatibleModels(currentSettings.modelUrl || LM_STUDIO_PRESET.modelUrl);
  if (!result.ok) {
    logs.add(`Model server probe failed: ${result.error ?? 'unknown error'}`);
    emitState();
    await showMessage({
      type: 'warning',
      title: 'Model server unavailable',
      message: 'The configured model server is not reachable.',
      detail: `${result.error ?? 'Start the local model server and try again.'}\n\nChecked: ${result.modelUrl}/models`,
    });
    return result;
  }

  logs.add(`Model server probe succeeded with ${result.models.length} model(s).`);
  emitState();
  await showMessage({
    type: result.models.length > 0 ? 'info' : 'warning',
    title: 'Model server models',
    message:
      result.models.length > 0
        ? 'The configured model server is reachable.'
        : 'The model server is running without loaded models.',
    detail:
      result.models.length > 0
        ? result.models.map(model => `- ${model}`).join('\n')
        : 'The server responded, but it did not report any loaded models.',
  });
  return result;
}

async function applyLmStudioPreset() {
  const result = await probeLmStudioModels(LM_STUDIO_PRESET.modelUrl);
  const modelId = selectLmStudioModelId(result);
  currentSettings = await writeSettings(settingsPath, buildLmStudioPresetSettings(currentSettings, modelId));
  await restartManagedRuntime();

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

async function applyOllamaPreset() {
  const result = await probeOpenAICompatibleModels(OLLAMA_PRESET.modelUrl, OLLAMA_PRESET.name);
  const modelId = selectDetectedModelId(result, OLLAMA_PRESET.modelId);
  currentSettings = await writeSettings(
    settingsPath,
    buildModelPresetSettings(currentSettings, {
      ...OLLAMA_PRESET,
      modelId,
    }),
  );
  await restartManagedRuntime();

  const detail = result.ok
    ? result.models.length > 0
      ? `Selected detected model: ${modelId}`
      : `No loaded models were reported. The default model remains: ${modelId}`
    : `${result.error ?? 'Start Ollama and try again.'}\n\nThe preset was applied with the default model: ${modelId}`;

  await showMessage({
    type: result.ok && result.models.length > 0 ? 'info' : 'warning',
    title: 'Ollama preset',
    message: 'Ollama preset applied.',
    detail,
  });
}

function rendererUrl() {
  return process.env.ELECTRON_RENDERER_URL;
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
    backgroundColor: '#111111',
    webPreferences: {
      preload: join(thisDir, '../preload/index.js'),
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

  const devRendererUrl = rendererUrl();
  if (devRendererUrl) {
    await mainWindow.loadURL(devRendererUrl);
  } else {
    await mainWindow.loadFile(join(thisDir, '../renderer/index.html'));
  }
  mainWindow.on('resize', syncStudioViewBounds);
  mainWindow.on('maximize', syncStudioViewBounds);
  mainWindow.on('unmaximize', syncStudioViewBounds);
  mainWindow.on('enter-full-screen', syncStudioViewBounds);
  mainWindow.on('leave-full-screen', syncStudioViewBounds);
  mainWindow.on('closed', () => {
    for (const tabId of [...studioContentViews.keys()]) {
      removeStudioContentView(tabId);
    }
  });
  syncStudioContentViews();
}

function installMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: 'Mastra Studio',
      submenu: [
        {
          label: 'New Tab',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            void createLauncherTab();
          },
        },
        {
          label: 'Open Active Tab in Browser',
          click: () => {
            const tab = activeTab();
            if (tab?.externalUrl || tab?.url) void shell.openExternal(tab.externalUrl || tab.url!);
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
          label: 'Use Ollama Preset',
          click: () => {
            void applyOllamaPreset();
          },
        },
        {
          label: 'Check LM Studio Server',
          click: () => {
            void checkLmStudioServer();
          },
        },
        {
          label: 'Check Current Model Server',
          click: () => {
            void checkCurrentModelServer();
          },
        },
        { type: 'separator' },
        {
          label: 'Restart Managed Runtime',
          click: () => {
            void restartManagedRuntime();
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
  ipcMain.handle('desktop:get-state', () => snapshotState());

  ipcMain.handle('desktop:update-settings', async (_event, updates: Partial<DesktopSettings>) => {
    currentSettings = await updateSettings(settingsPath, updates);
    platformState = {
      ...platformState,
      baseUrl: currentSettings.platformBaseUrl,
    };
    return {
      settings: currentSettings,
      state: snapshotState(),
    };
  });

  ipcMain.handle('desktop:create-launcher-tab', () => createLauncherTab());
  ipcMain.handle('desktop:create-managed-tab', () => createManagedTab());
  ipcMain.handle('desktop:create-dev-tab', (_event, input: CreateDevTabInput) => createDevTab(input));
  ipcMain.handle('desktop:create-platform-tab', (_event, projectId: string) => createPlatformTab(projectId));
  ipcMain.handle('desktop:activate-tab', (_event, tabId: string) => {
    if (tabs.some(tab => tab.id === tabId)) {
      activeTabId = tabId;
    }
    return snapshotState();
  });
  ipcMain.handle('desktop:close-tab', (_event, tabId: string) => {
    const index = tabs.findIndex(tab => tab.id === tabId);
    if (index >= 0) {
      tabs.splice(index, 1);
    }
    if (activeTabId === tabId) {
      activeTabId = tabs[Math.max(0, index - 1)]?.id ?? tabs[0]?.id;
    }
    if (tabs.length === 0) {
      createLauncherTab();
    }
    return snapshotState();
  });
  ipcMain.handle('desktop:reload-tab', (_event, tabId: string) => {
    const tab = tabs.find(candidate => candidate.id === tabId);
    if (tab) {
      tab.status = 'ready';
      tab.error = undefined;
      const entry = studioContentViews.get(tabId);
      if (entry && !entry.view.webContents.isDestroyed()) {
        entry.view.webContents.reload();
      }
    }
    return snapshotState();
  });
  ipcMain.handle('desktop:open-tab-external', async (_event, tabId: string) => {
    const tab = tabs.find(candidate => candidate.id === tabId);
    if (tab?.externalUrl || tab?.url) {
      await shell.openExternal(tab.externalUrl || tab.url!);
    }
  });
  ipcMain.handle('desktop:start-platform-login', () => startPlatformLogin());
  ipcMain.handle('desktop:logout-platform', () => logoutPlatform());
  ipcMain.handle('desktop:refresh-platform', () => refreshPlatform());

  ipcMain.handle('desktop:probe-lmstudio-models', async (_event, modelUrl?: string) => {
    const result = await probeLmStudioModels(modelUrl ?? currentSettings.modelUrl);
    if (!result.ok) {
      logs.add(`LM Studio probe failed: ${result.error ?? 'unknown error'}`);
    }
    emitState();
    return result;
  });

  ipcMain.handle('desktop:probe-openai-compatible-models', async (_event, modelUrl?: string, providerName?: string) => {
    const result = await probeOpenAICompatibleModels(modelUrl ?? currentSettings.modelUrl, providerName);
    if (!result.ok) {
      logs.add(`Model server probe failed: ${result.error ?? 'unknown error'}`);
    }
    emitState();
    return result;
  });

  ipcMain.handle('desktop:restart-runtime', () => restartManagedRuntime());
  ipcMain.handle('desktop:get-logs', () => logs.all());

  ipcMain.handle('desktop:open-studio-external', async () => {
    const tab = activeTab();
    if (tab?.externalUrl || tab?.url) await shell.openExternal(tab.externalUrl || tab.url!);
  });

  ipcMain.handle('desktop:open-data-folder', async () => {
    await shell.openPath(userDataPath);
  });
}

async function boot() {
  userDataPath = app.getPath('userData');
  settingsPath = join(userDataPath, 'settings.json');
  platformSessionPath = join(userDataPath, 'platform-session.json');
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
  currentSettings = await writeSettings(settingsPath, currentSettings);
  platformState = defaultPlatformState(currentSettings.platformBaseUrl);
  platformSession = await readPlatformSession(platformSessionPath, safeStorage).catch(error => {
    logs.add(`Unable to read saved Platform session: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  });
  if (platformSession) {
    platformState = {
      ...platformState,
      baseUrl: platformSession.baseUrl,
      status: 'loading',
      signedIn: true,
      user: platformSession.user,
      organizationId: platformSession.organizationId,
    };
  }

  installMenu();
  installIpc();
  void createManagedTab();
  await loadMainWindow();
  if (platformSession) {
    void refreshPlatform();
  }
}

async function cleanup() {
  await Promise.all([closeAllStudioShellServers(), stopRuntime()]);
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
    if (isQuitting) return;
    event.preventDefault();
    cleanup()
      .catch(error => logs.add(error instanceof Error ? error.message : String(error)))
      .finally(() => {
        isQuitting = true;
        app.exit(0);
      });
  });
}
