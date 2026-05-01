import { mkdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getStagehandChromePid, patchProfileExitType } from '../utils';

describe('patchProfileExitType', () => {
  let profileDir: string;

  beforeEach(() => {
    profileDir = mkdtempSync(join(tmpdir(), 'stagehand-test-'));
  });

  afterEach(() => {
    rmSync(profileDir, { recursive: true, force: true });
  });

  function writePrefs(data: object): void {
    const dir = join(profileDir, 'Default');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'Preferences'), JSON.stringify(data), 'utf-8');
  }

  function readPrefs(): any {
    return JSON.parse(readFileSync(join(profileDir, 'Default', 'Preferences'), 'utf-8'));
  }

  it('patches exit_type from Crashed to Normal', () => {
    writePrefs({ profile: { exit_type: 'Crashed' } });

    patchProfileExitType(profileDir);

    expect(readPrefs().profile.exit_type).toBe('Normal');
  });

  it('creates profile key if missing', () => {
    writePrefs({ browser: { window_placement: {} } });

    patchProfileExitType(profileDir);

    const prefs = readPrefs();
    expect(prefs.profile.exit_type).toBe('Normal');
    // Doesn't clobber existing keys
    expect(prefs.browser.window_placement).toEqual({});
  });

  it('skips if already Normal', () => {
    writePrefs({ profile: { exit_type: 'Normal', name: 'test' } });
    const before = readFileSync(join(profileDir, 'Default', 'Preferences'), 'utf-8');

    patchProfileExitType(profileDir);

    const after = readFileSync(join(profileDir, 'Default', 'Preferences'), 'utf-8');
    expect(after).toBe(before); // file untouched
  });

  it('handles missing Preferences file', () => {
    // No Default/Preferences exists
    expect(() => patchProfileExitType(profileDir)).not.toThrow();
  });

  it('handles non-existent profile directory', () => {
    expect(() => patchProfileExitType('/nonexistent/path')).not.toThrow();
  });

  it('handles empty string', () => {
    expect(() => patchProfileExitType('')).not.toThrow();
  });

  it('handles malformed JSON', () => {
    const dir = join(profileDir, 'Default');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'Preferences'), 'not json', 'utf-8');

    expect(() => patchProfileExitType(profileDir)).not.toThrow();
    // File should be unchanged since we caught the error
    expect(readFileSync(join(dir, 'Preferences'), 'utf-8')).toBe('not json');
  });
});

describe('getStagehandChromePid', () => {
  it('extracts PID from chrome.process.pid', () => {
    const stagehand = { state: { kind: 'LOCAL', chrome: { process: { pid: 12345 } } } };
    expect(getStagehandChromePid(stagehand as any)).toBe(12345);
  });

  it('falls back to chrome.pid', () => {
    const stagehand = { state: { kind: 'LOCAL', chrome: { pid: 67890 } } };
    expect(getStagehandChromePid(stagehand as any)).toBe(67890);
  });

  it('returns undefined for BROWSERBASE env', () => {
    const stagehand = { state: { kind: 'BROWSERBASE', sessionId: 'abc' } };
    expect(getStagehandChromePid(stagehand as any)).toBeUndefined();
  });

  it('returns undefined for UNINITIALIZED state', () => {
    const stagehand = { state: { kind: 'UNINITIALIZED' } };
    expect(getStagehandChromePid(stagehand as any)).toBeUndefined();
  });

  it('returns undefined when state is missing', () => {
    expect(getStagehandChromePid({} as any)).toBeUndefined();
  });

  it('returns undefined for non-positive PIDs', () => {
    expect(getStagehandChromePid({ state: { kind: 'LOCAL', chrome: { process: { pid: 0 } } } } as any)).toBeUndefined();
    expect(getStagehandChromePid({ state: { kind: 'LOCAL', chrome: { pid: -1 } } } as any)).toBeUndefined();
  });
});
