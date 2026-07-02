import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';
import type {
  CreateDevTabInput,
  DesktopSettings,
  DesktopState,
  MastraDesktopApi,
  ProbeModelsResult,
  UpdateSettingsResult,
} from '../shared/types';

const api: MastraDesktopApi = {
  getState: () => ipcRenderer.invoke('desktop:get-state') as Promise<DesktopState>,
  updateSettings: (settings: Partial<DesktopSettings>) =>
    ipcRenderer.invoke('desktop:update-settings', settings) as Promise<UpdateSettingsResult>,
  createLauncherTab: () => ipcRenderer.invoke('desktop:create-launcher-tab') as Promise<DesktopState>,
  createManagedTab: () => ipcRenderer.invoke('desktop:create-managed-tab') as Promise<DesktopState>,
  createDevTab: (input: CreateDevTabInput) =>
    ipcRenderer.invoke('desktop:create-dev-tab', input) as Promise<DesktopState>,
  createPlatformTab: (projectId: string) =>
    ipcRenderer.invoke('desktop:create-platform-tab', projectId) as Promise<DesktopState>,
  activateTab: (tabId: string) => ipcRenderer.invoke('desktop:activate-tab', tabId) as Promise<DesktopState>,
  closeTab: (tabId: string) => ipcRenderer.invoke('desktop:close-tab', tabId) as Promise<DesktopState>,
  reloadTab: (tabId: string) => ipcRenderer.invoke('desktop:reload-tab', tabId) as Promise<DesktopState>,
  openTabExternal: (tabId: string) => ipcRenderer.invoke('desktop:open-tab-external', tabId) as Promise<void>,
  startPlatformLogin: () => ipcRenderer.invoke('desktop:start-platform-login') as Promise<DesktopState>,
  logoutPlatform: () => ipcRenderer.invoke('desktop:logout-platform') as Promise<DesktopState>,
  refreshPlatform: () => ipcRenderer.invoke('desktop:refresh-platform') as Promise<DesktopState>,
  probeLmStudioModels: (modelUrl?: string, apiKey?: string) =>
    ipcRenderer.invoke('desktop:probe-lmstudio-models', modelUrl, apiKey) as Promise<ProbeModelsResult>,
  probeOpenAICompatibleModels: (modelUrl?: string, providerName?: string, apiKey?: string) =>
    ipcRenderer.invoke('desktop:probe-openai-compatible-models', modelUrl, providerName, apiKey) as Promise<ProbeModelsResult>,
  restartRuntime: () => ipcRenderer.invoke('desktop:restart-runtime') as Promise<DesktopState>,
  getLogs: () => ipcRenderer.invoke('desktop:get-logs') as Promise<string[]>,
  openStudioExternal: () => ipcRenderer.invoke('desktop:open-studio-external') as Promise<void>,
  openDataFolder: () => ipcRenderer.invoke('desktop:open-data-folder') as Promise<void>,
  onStateChanged: callback => {
    const listener = (_event: IpcRendererEvent, state: DesktopState) => callback(state);
    ipcRenderer.on('desktop:state-changed', listener);
    return () => ipcRenderer.off('desktop:state-changed', listener);
  },
};

contextBridge.exposeInMainWorld('mastraDesktop', api);
