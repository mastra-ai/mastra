import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listBundledThemes, listCustomThemes, loadCustomTheme, parseCustomTheme } from '../custom-themes.js';
import { darkTheme, lightTheme } from '../theme.js';

describe('parseCustomTheme', () => {
  it('merges colors over the dark base theme', () => {
    const result = parseCustomTheme(JSON.stringify({ appearance: 'dark', colors: { accent: '#ff0000' } }), 'test');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.theme.colors.accent).toBe('#ff0000');
    expect(result.theme.colors.text).toBe(darkTheme.text);
  });

  it('uses the light base theme for light appearance', () => {
    const result = parseCustomTheme(JSON.stringify({ appearance: 'light' }), 'test');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.theme.colors.text).toBe(lightTheme.text);
  });

  it('resolves var references and expands 3-digit hex', () => {
    const result = parseCustomTheme(
      JSON.stringify({
        appearance: 'dark',
        vars: { blue: '#7aa2f7' },
        colors: { accent: 'blue', error: '#f00' },
      }),
      'test',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.theme.colors.accent).toBe('#7aa2f7');
    expect(result.theme.colors.error).toBe('#ff0000');
  });

  it('uses the name field, falling back to the filename', () => {
    const named = parseCustomTheme(JSON.stringify({ name: 'Midnight', appearance: 'dark' }), 'file');
    const unnamed = parseCustomTheme(JSON.stringify({ appearance: 'dark' }), 'file');
    expect(named.ok && named.theme.name).toBe('Midnight');
    expect(unnamed.ok && unnamed.theme.name).toBe('file');
  });

  it('parses bg as a hex value or var reference', () => {
    const hex = parseCustomTheme(JSON.stringify({ appearance: 'dark', bg: '#1a1b26' }), 'test');
    expect(hex.ok && hex.theme.bg).toBe('#1a1b26');

    const viaVar = parseCustomTheme(
      JSON.stringify({ appearance: 'dark', vars: { base: '#282828' }, bg: 'base' }),
      'test',
    );
    expect(viaVar.ok && viaVar.theme.bg).toBe('#282828');

    const absent = parseCustomTheme(JSON.stringify({ appearance: 'dark' }), 'test');
    expect(absent.ok && absent.theme.bg).toBeUndefined();
  });

  it('rejects an invalid bg value', () => {
    const result = parseCustomTheme(JSON.stringify({ appearance: 'dark', bg: 'nope' }), 'test');
    expect(result.ok).toBe(false);
  });

  it('derives panel backgrounds from bg unless set explicitly', () => {
    const result = parseCustomTheme(
      JSON.stringify({ appearance: 'dark', bg: '#1a1b26', colors: { selectedBg: '#33467c' } }),
      'test',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Derived keys move off the built-in defaults and stay near the theme bg
    expect(result.theme.colors.overlayBg).not.toBe(darkTheme.overlayBg);
    expect(result.theme.colors.toolPendingBg).not.toBe(darkTheme.toolPendingBg);
    expect(result.theme.colors.userMessageBg).not.toBe(darkTheme.userMessageBg);
    // Explicit keys win over derivation
    expect(result.theme.colors.selectedBg).toBe('#33467c');
    // Without bg, built-in backgrounds are untouched
    const noBg = parseCustomTheme(JSON.stringify({ appearance: 'dark' }), 'test');
    expect(noBg.ok && noBg.theme.colors.overlayBg).toBe(darkTheme.overlayBg);
  });

  it('ignores unknown color keys', () => {
    const result = parseCustomTheme(JSON.stringify({ appearance: 'dark', colors: { futureColor: '#123456' } }), 'test');
    expect(result.ok).toBe(true);
  });

  it('rejects invalid JSON', () => {
    const result = parseCustomTheme('{not json', 'test');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('invalid JSON');
  });

  it('rejects missing or invalid appearance', () => {
    const missing = parseCustomTheme(JSON.stringify({ colors: {} }), 'test');
    const invalid = parseCustomTheme(JSON.stringify({ appearance: 'blue' }), 'test');
    expect(missing.ok).toBe(false);
    expect(invalid.ok).toBe(false);
  });

  it('rejects colors that are neither hex nor a known var', () => {
    const result = parseCustomTheme(JSON.stringify({ appearance: 'dark', colors: { accent: 'nope' } }), 'test');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('accent');
  });

  it('rejects invalid var values', () => {
    const result = parseCustomTheme(JSON.stringify({ appearance: 'dark', vars: { bad: 'red' } }), 'test');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('bad');
  });
});

describe('loadCustomTheme / listCustomThemes', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-themes-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('loads a theme file by name', () => {
    fs.writeFileSync(path.join(dir, 'midnight.json'), JSON.stringify({ appearance: 'dark' }));
    const result = loadCustomTheme('midnight', dir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.theme.name).toBe('midnight');
  });

  it('returns an error for a missing theme with no close match', () => {
    const result = loadCustomTheme('completely-unrelated', dir);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('completely-unrelated');
    expect(result.error).toContain('/theme list');
  });

  it('suggests the closest theme name for a typo', () => {
    const result = loadCustomTheme('catpuccin-mocha', dir);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('did you mean "catppuccin-mocha"?');
  });

  it('suggests a nearby user theme name', () => {
    fs.writeFileSync(path.join(dir, 'midnight.json'), JSON.stringify({ appearance: 'dark' }));
    const result = loadCustomTheme('midnite', dir);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('did you mean "midnight"?');
  });

  it('lists json theme files sorted, without extensions', () => {
    fs.writeFileSync(path.join(dir, 'b.json'), '{}');
    fs.writeFileSync(path.join(dir, 'a.json'), '{}');
    fs.writeFileSync(path.join(dir, 'notes.txt'), '');
    expect(listCustomThemes(dir)).toEqual(['a', 'b']);
  });

  it('returns an empty list when the directory is missing', () => {
    expect(listCustomThemes(path.join(dir, 'missing'))).toEqual([]);
  });

  it('rejects theme names that escape the themes directory', () => {
    for (const name of ['../outside', 'a/b', 'bad\0name']) {
      const result = loadCustomTheme(name, dir);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toContain('invalid theme name');
    }
  });

  it('does not resolve prototype members as vars or bundled themes', () => {
    const viaVars = parseCustomTheme(JSON.stringify({ appearance: 'dark', colors: { accent: 'constructor' } }), 'test');
    expect(viaVars.ok).toBe(false);

    const viaBundled = loadCustomTheme('constructor', dir);
    expect(viaBundled.ok).toBe(false);
  });
});

describe('bundled themes', () => {
  it('every bundled theme parses and loads', () => {
    const names = listBundledThemes();
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      const result = loadCustomTheme(name, '/nonexistent');
      expect(result.ok, `bundled theme "${name}" failed: ${result.ok ? '' : result.error}`).toBe(true);
      if (result.ok) expect(result.theme.bg, `bundled theme "${name}" is missing bg`).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('a user file overrides a bundled theme of the same name', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-themes-'));
    try {
      fs.writeFileSync(
        path.join(dir, 'dracula.json'),
        JSON.stringify({ appearance: 'light', colors: { accent: '#123456' } }),
      );
      const result = loadCustomTheme('dracula', dir);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.theme.appearance).toBe('light');
      expect(result.theme.colors.accent).toBe('#123456');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('falls back to the bundled theme when no user file exists', () => {
    const result = loadCustomTheme('nord', '/nonexistent');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.theme.name).toBe('Nord');
    expect(result.theme.appearance).toBe('dark');
  });
});
