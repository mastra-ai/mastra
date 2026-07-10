import { contextBridge, ipcRenderer } from 'electron';
import { MASTRACODE_DESKTOP_API_KEY } from 'mastracode-web/desktop-host';
import type {
  DesktopAppInfo,
  DesktopDirectorySelection,
  DesktopDirectorySelectionOptions,
  MastraCodeDesktopApi,
} from 'mastracode-web/desktop-host';

import { DESKTOP_IPC_CHANNELS } from './ipc.js';

const api: MastraCodeDesktopApi = {
  getAppInfo: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.getAppInfo) as Promise<DesktopAppInfo>,
  selectProjectDirectory: (options?: DesktopDirectorySelectionOptions) =>
    ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.selectProjectDirectory, options) as Promise<DesktopDirectorySelection>,
};

contextBridge.exposeInMainWorld(MASTRACODE_DESKTOP_API_KEY, api);
