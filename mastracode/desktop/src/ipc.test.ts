import { describe, expect, it } from 'vitest';

import {
  parseDesktopAppInfo,
  parseDesktopDirectorySelection,
  parseDirectorySelectionOptions,
} from './ipc.js';

describe('desktop IPC contracts', () => {
  it('parses valid app info and directory selection payloads', () => {
    expect(parseDesktopAppInfo({ name: 'MastraCode', version: '1.2.3', platform: 'darwin' })).toEqual({
      name: 'MastraCode',
      version: '1.2.3',
      platform: 'darwin',
    });
    expect(parseDesktopDirectorySelection({ canceled: false, path: '/tmp/project', name: 'project' })).toEqual({
      canceled: false,
      path: '/tmp/project',
      name: 'project',
    });
    expect(parseDesktopDirectorySelection({ canceled: true, path: '/ignored' })).toEqual({ canceled: true });
  });

  it('rejects malformed values at both sides of the bridge', () => {
    expect(() => parseDirectorySelectionOptions({ defaultPath: 42 })).toThrow('defaultPath must be a string');
    expect(() => parseDesktopAppInfo({ name: 'MastraCode', version: '1.2.3', platform: 'browser' })).toThrow(
      'app info response is invalid',
    );
    expect(() => parseDesktopDirectorySelection({ canceled: false })).toThrow('missing its path');
  });
});
