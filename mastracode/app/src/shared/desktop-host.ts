export const MASTRACODE_DESKTOP_API_KEY = 'mastracodeDesktop';
export const MASTRACODE_DESKTOP_PROJECT_ACCESS_ERROR_CODE = 'desktop_project_access_required';
export const MASTRACODE_DESKTOP_PROJECT_ACCESS_ERROR_MESSAGE = 'Project path has not been approved by the desktop app';

export type DesktopPlatform = 'darwin' | 'linux' | 'win32';

export interface DesktopAppInfo {
  name: string;
  version: string;
  platform: DesktopPlatform;
}

export interface DesktopDirectorySelection {
  canceled: boolean;
  path?: string;
  name?: string;
}

export interface DesktopDirectorySelectionOptions {
  /** Opens the native picker at the current project when re-authorizing access. */
  defaultPath?: string;
}

export interface MastraCodeDesktopApi {
  getAppInfo: () => Promise<DesktopAppInfo>;
  selectProjectDirectory: (options?: DesktopDirectorySelectionOptions) => Promise<DesktopDirectorySelection>;
}

declare global {
  interface Window {
    mastracodeDesktop?: MastraCodeDesktopApi;
  }
}
