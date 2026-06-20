import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './defaults';
import { normalizeSettings, readSettings, updateSettings, writeSettings } from './settings';

describe('desktop settings', () => {
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
      }),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      modelId: 'local/model',
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
    });

    await updateSettings(path, { serverMode: 'managed', modelId: 'lmstudio/next' });

    await expect(readSettings(path)).resolves.toMatchObject({
      serverMode: 'managed',
      externalServerUrl: 'http://127.0.0.1:4111',
      modelId: 'lmstudio/next',
    });
    await expect(readFile(path, 'utf8')).resolves.toContain('\n');
  });
});
