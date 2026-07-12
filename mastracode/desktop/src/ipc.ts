import type {
  DesktopAppInfo,
  DesktopDirectorySelection,
  DesktopDirectorySelectionOptions,
  DesktopPlatform,
} from '@mastra/code-app/desktop-host';

export const DESKTOP_IPC_CHANNELS = Object.freeze({
  getAppInfo: 'mastracode:desktop:get-app-info',
  selectProjectDirectory: 'mastracode:desktop:select-project-directory',
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isDesktopPlatform(value: unknown): value is DesktopPlatform {
  return value === 'darwin' || value === 'linux' || value === 'win32';
}

export function parseDirectorySelectionOptions(value: unknown): DesktopDirectorySelectionOptions | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new TypeError('Directory selection options must be an object');
  if (value.defaultPath === undefined) return {};
  if (typeof value.defaultPath !== 'string') throw new TypeError('Directory selection defaultPath must be a string');
  return { defaultPath: value.defaultPath };
}

export function parseDesktopAppInfo(value: unknown): DesktopAppInfo {
  if (
    !isRecord(value) ||
    typeof value.name !== 'string' ||
    typeof value.version !== 'string' ||
    !isDesktopPlatform(value.platform)
  ) {
    throw new TypeError('Desktop app info response is invalid');
  }
  return { name: value.name, version: value.version, platform: value.platform };
}

export function parseDesktopDirectorySelection(value: unknown): DesktopDirectorySelection {
  if (!isRecord(value) || typeof value.canceled !== 'boolean') {
    throw new TypeError('Desktop directory selection response is invalid');
  }
  if (value.canceled) return { canceled: true };
  if (typeof value.path !== 'string' || value.path.length === 0) {
    throw new TypeError('Desktop directory selection response is missing its path');
  }
  if (value.name !== undefined && typeof value.name !== 'string') {
    throw new TypeError('Desktop directory selection response has an invalid name');
  }
  return {
    canceled: false,
    path: value.path,
    ...(value.name === undefined ? {} : { name: value.name }),
  };
}
