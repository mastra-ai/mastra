import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { mastraGatewayBaseUrl } from './mastra-gateway.js';

function withSettings(settings?: unknown) {
  const dir = mkdtempSync(join(tmpdir(), 'mastra-gateway-url-'));
  if (settings !== undefined) writeFileSync(join(dir, 'settings.json'), JSON.stringify(settings));
  vi.stubEnv('MASTRA_APP_DATA_DIR', dir);
}

describe('mastraGatewayBaseUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('prefers the settings over the environment, as model calls do', () => {
    withSettings({ memoryGateway: { baseUrl: 'https://gateway.settings.example.com/v1/' } });
    vi.stubEnv('MASTRA_GATEWAY_URL', 'https://gateway.env.example.com');

    expect(mastraGatewayBaseUrl()).toBe('https://gateway.settings.example.com');
  });

  it('uses the environment when the settings name no gateway', () => {
    withSettings();
    vi.stubEnv('MASTRA_GATEWAY_URL', 'http://127.0.0.1:4180/v1');

    expect(mastraGatewayBaseUrl()).toBe('http://127.0.0.1:4180');
  });

  it.each([
    ['a number', 42],
    ['a blank string', '  '],
  ])('ignores a setting that is %s', (_shape, baseUrl) => {
    withSettings({ memoryGateway: { baseUrl } });
    vi.stubEnv('MASTRA_GATEWAY_URL', 'https://gateway.env.example.com');

    expect(mastraGatewayBaseUrl()).toBe('https://gateway.env.example.com');
  });

  it('falls back to the production gateway', () => {
    withSettings();
    vi.stubEnv('MASTRA_GATEWAY_URL', '');

    expect(mastraGatewayBaseUrl()).toBe('https://gateway-api.mastra.ai');
  });
});
