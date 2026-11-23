import { existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getSettingsPath, loadSettings, saveSettings } from '../onboarding/settings.js';

// Runs under both vitest.config.ts and vitest.acp.config.ts, so each config must
// point MASTRA_APP_DATA_DIR at a temp folder.
describe('test app data', () => {
  it('saves settings inside a temp folder, never the real Mastra Code settings', () => {
    const settingsPath = getSettingsPath();
    const fromTemp = relative(realpathSync(tmpdir()), realpathSync(dirname(settingsPath)));
    expect(
      fromTemp.startsWith('..') || isAbsolute(fromTemp),
      `settings path ${settingsPath} is outside the temp folder`,
    ).toBe(false);

    saveSettings(loadSettings());

    expect(existsSync(settingsPath)).toBe(true);
  });
});
