import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadSettings, saveSettings } from '../settings.js';

function withTempSettingsFile(run: (filePath: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'mastracode-settings-'));
  const previousAppDataDir = process.env.MASTRA_APP_DATA_DIR;
  process.env.MASTRA_APP_DATA_DIR = dir;
  try {
    run(join(dir, 'settings.json'));
  } finally {
    if (previousAppDataDir === undefined) delete process.env.MASTRA_APP_DATA_DIR;
    else process.env.MASTRA_APP_DATA_DIR = previousAppDataDir;
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('loading sparse settings', () => {
  it('adds only the resolved preview limit to the supplied settings file', () => {
    withTempSettingsFile(filePath => {
      const original = { preferences: { subagentsEnabled: false }, customOption: 'keep me' };
      writeFileSync(filePath, JSON.stringify(original, null, 2), { encoding: 'utf-8', mode: 0o400 });
      const originalMode = statSync(filePath).mode;

      const settings = loadSettings(filePath);
      expect(settings.preferences.previewLines).toBe(2);
      expect(settings.preferences.subagentsEnabled).toBe(false);
      expect(settings.preferences.thinkingLevel).toBe('off');
      expect(JSON.parse(readFileSync(filePath, 'utf-8'))).toEqual({
        preferences: { subagentsEnabled: false, previewLines: 2 },
        customOption: 'keep me',
      });
      expect(statSync(filePath).mode).toBe(originalMode);

      // Once the preview limit is stored, loading leaves the file untouched.
      const persisted = readFileSync(filePath, 'utf-8');
      expect(loadSettings(filePath).preferences.previewLines).toBe(2);
      expect(readFileSync(filePath, 'utf-8')).toBe(persisted);
    });
  });

  it('still persists defaults when settings are explicitly saved', () => {
    withTempSettingsFile(filePath => {
      writeFileSync(filePath, '{}\n', 'utf-8');
      const settings = loadSettings(filePath);
      settings.preferences.previewLines = 5;
      saveSettings(settings, filePath);
      expect(JSON.parse(readFileSync(filePath, 'utf-8')).preferences.previewLines).toBe(5);
      expect(loadSettings(filePath).preferences.previewLines).toBe(5);
    });
  });
});
