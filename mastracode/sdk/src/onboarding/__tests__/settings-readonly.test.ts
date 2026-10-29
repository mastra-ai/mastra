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
  it('resolves defaults without rewriting the supplied settings file', () => {
    withTempSettingsFile(filePath => {
      const original = '{\n  "preferences": { "subagentsEnabled": false },\n  "customOption": "keep me"\n}\n';
      writeFileSync(filePath, original, { encoding: 'utf-8', mode: 0o400 });

      for (let attempt = 0; attempt < 2; attempt++) {
        const settings = loadSettings(filePath);
        expect(settings.preferences.previewLines).toBe(2);
        expect(settings.preferences.subagentsEnabled).toBe(false);
        expect(settings.preferences.thinkingLevel).toBe('off');
        expect(readFileSync(filePath, 'utf-8')).toBe(original);
        expect(statSync(filePath).mode & 0o777).toBe(0o400);
      }
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
