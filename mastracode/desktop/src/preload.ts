import { contextBridge, ipcRenderer } from 'electron';
import { MASTRACODE_DESKTOP_API_KEY } from 'mastracode-web/desktop-host';
import type { DesktopDirectorySelectionOptions, MastraCodeDesktopApi } from 'mastracode-web/desktop-host';

import { DESKTOP_IPC_CHANNELS, parseDesktopAppInfo, parseDesktopDirectorySelection } from './ipc.js';

const api: MastraCodeDesktopApi = {
  getAppInfo: async () => {
    const result: unknown = await ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.getAppInfo);
    return parseDesktopAppInfo(result);
  },
  selectProjectDirectory: async (options?: DesktopDirectorySelectionOptions) => {
    const result: unknown = await ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.selectProjectDirectory, options);
    return parseDesktopDirectorySelection(result);
  },
};

contextBridge.exposeInMainWorld(MASTRACODE_DESKTOP_API_KEY, api);
