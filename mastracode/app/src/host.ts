import type { MastraCodeDesktopApi } from './shared/desktop-host';

export interface MastraCodeWebHost {
  kind: 'web';
}

export interface MastraCodeDesktopHost {
  kind: 'desktop';
  getAppInfo: MastraCodeDesktopApi['getAppInfo'];
  selectProjectDirectory: MastraCodeDesktopApi['selectProjectDirectory'];
}

export type MastraCodeHost = MastraCodeWebHost | MastraCodeDesktopHost;

export const WEB_HOST: MastraCodeWebHost = { kind: 'web' };

export function createDesktopHost(api: MastraCodeDesktopApi): MastraCodeDesktopHost {
  return {
    kind: 'desktop',
    getAppInfo: api.getAppInfo,
    selectProjectDirectory: api.selectProjectDirectory,
  };
}
