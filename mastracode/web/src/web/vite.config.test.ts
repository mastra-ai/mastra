import { describe, expect, it } from 'vitest';

import { createViteConfig } from './vite.config';

const proxyTargets = (port: number) => ({
  '/api': { target: `http://localhost:${port}` },
  '/web': { target: `http://localhost:${port}` },
  '^/auth/': { target: `http://localhost:${port}` },
});

describe('createViteConfig', () => {
  it('uses MastraCode-specific development ports by default', () => {
    const config = createViteConfig('development', {});

    expect(config.server).toMatchObject({
      port: 5173,
      strictPort: true,
      proxy: proxyTargets(4120),
    });
  });

  it('keeps every proxy route aligned with overridden development ports', () => {
    const config = createViteConfig('development', {
      MASTRACODE_DEV_SERVER_PORT: '4121',
      MASTRACODE_DEV_UI_PORT: '5174',
    });

    expect(config.server).toMatchObject({
      port: 5174,
      strictPort: true,
      proxy: proxyTargets(4121),
    });
  });

  it.each([
    ['MASTRACODE_DEV_SERVER_PORT', '0'],
    ['MASTRACODE_DEV_SERVER_PORT', '65536'],
    ['MASTRACODE_DEV_SERVER_PORT', 'not-a-port'],
    ['MASTRACODE_DEV_UI_PORT', '0'],
    ['MASTRACODE_DEV_UI_PORT', '65536'],
    ['MASTRACODE_DEV_UI_PORT', 'not-a-port'],
  ])('rejects invalid %s value %s', (variable, value) => {
    expect(() => createViteConfig('development', { [variable]: value })).toThrowError(
      `${variable} must be an integer between 1 and 65535`,
    );
  });
});
