import { describe, expect, it } from 'vitest';

import * as connect from '../index.js';

describe('@mastra/connect root exports', () => {
  it('exposes the provider-neutral client surface and nothing importer-specific', () => {
    expect(Object.keys(connect).sort()).toEqual([
      'CHANNELS',
      'MastraConnectError',
      'PROVIDERS',
      'channels',
      'credential',
      'getConnectionContext',
      'listProjectConnections',
      'proxyRequest',
      'proxyRequestWithResponse',
      'resolveClient',
      'tools',
      'userConnectRoutes',
    ]);
    expect(Object.keys(connect).filter(name => /import/i.test(name))).toEqual([]);
  });
});
