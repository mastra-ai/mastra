import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_DEV_SERVER_URL, DEFAULT_RUNTIME_PORT, DEFAULT_SETTINGS } from './defaults';
import { normalizeSettings, readSettings, updateSettings, writeSettings } from './settings';

describe('desktop settings', () => {
  it('keeps the managed runtime default separate from the Mastra dev server default', () => {
    expect(DEFAULT_RUNTIME_PORT).toBe(43111);
    expect(DEFAULT_DEV_SERVER_URL).toBe('http://127.0.0.1:4111');
  });

  it('returns defaults when no settings file exists', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mastra-desktop-settings-'));
    await expect(readSettings(join(dir, 'settings.json'))).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it('normalizes invalid persisted settings', () => {
    expect(
      normalizeSettings({
        serverMode: 'invalid',
        modelUrl: '',
        modelId: '  local/model  ',
        modelApiKey: '',
        environmentVariables: {
          ' invalid key ': 'ignored',
          LM_API_TOKEN: 'lm-secret',
          OPENAI_API_KEY: 123,
        },
      }),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      modelId: 'local/model',
      environmentVariables: {
        LM_API_TOKEN: 'lm-secret',
        OPENAI_API_KEY: '123',
      },
    });
  });

  it('persists and updates settings as formatted JSON', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mastra-desktop-settings-'));
    const path = join(dir, 'nested', 'settings.json');

    await mkdir(join(dir, 'nested'), { recursive: true });
    await writeSettings(path, {
      serverMode: 'external',
      externalServerUrl: ' http://127.0.0.1:4111 ',
      modelUrl: 'http://localhost:1234/v1',
      modelId: 'lmstudio/test',
      modelApiKey: 'not-needed',
      environmentVariables: {
        OPENAI_API_KEY: 'sk-local',
      },
    });

    await updateSettings(path, {
      serverMode: 'managed',
      modelId: 'lmstudio/next',
      environmentVariables: {
        LM_API_TOKEN: 'lm-local',
      },
    });

    await expect(readSettings(path)).resolves.toMatchObject({
      serverMode: 'managed',
      externalServerUrl: 'http://127.0.0.1:4111',
      modelId: 'lmstudio/next',
      environmentVariables: {
        LM_API_TOKEN: 'lm-local',
      },
    });
    await expect(readFile(path, 'utf8')).resolves.toContain('\n');
  });
});
