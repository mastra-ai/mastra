import { existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, relative } from 'node:path';
import { getSettingsPath, loadSettings, saveSettings } from '@mastra/code-sdk/onboarding/settings';
import { describe, expect, it } from 'vitest';

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
