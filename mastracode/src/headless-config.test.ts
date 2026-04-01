import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, afterAll, vi } from 'vitest';

import { loadHeadlessConfig, type HeadlessConfig } from './headless-config.js';

const tempDirs: string[] = [];
function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'headless-config-'));
  tempDirs.push(dir);
  return dir;
}
afterAll(() => {
  for (const d of tempDirs) {
    try { rmSync(d, { recursive: true, force: true }); } catch {}
  }
});

describe('loadHeadlessConfig', () => {
  it('returns empty config when no file exists', () => {
    const dir = makeTempDir();
    const config = loadHeadlessConfig({ projectDir: dir });
    expect(config).toEqual({});
  });

  it('loads project-level .mastracode/headless.json', () => {
    const dir = makeTempDir();
    const mcDir = join(dir, '.mastracode');
    mkdirSync(mcDir);
    writeFileSync(join(mcDir, 'headless.json'), JSON.stringify({
      models: { modeDefaults: { build: 'anthropic/claude-sonnet-4-5' } },
      preferences: { thinkingLevel: 'high' },
    }));
    const config = loadHeadlessConfig({ projectDir: dir });
    expect(config.models?.modeDefaults?.build).toBe('anthropic/claude-sonnet-4-5');
    expect(config.preferences?.thinkingLevel).toBe('high');
  });

  it('loads global ~/.mastracode/headless.json when no project config', () => {
    const projectDir = makeTempDir();
    const globalDir = makeTempDir();
    const mcDir = join(globalDir, '.mastracode');
    mkdirSync(mcDir);
    writeFileSync(join(mcDir, 'headless.json'), JSON.stringify({
      preferences: { yolo: true },
    }));
    const config = loadHeadlessConfig({ projectDir, globalDir });
    expect(config.preferences?.yolo).toBe(true);
  });

  it('project config wins over global config (first-file-wins)', () => {
    const projectDir = makeTempDir();
    const globalDir = makeTempDir();
    mkdirSync(join(projectDir, '.mastracode'));
    mkdirSync(join(globalDir, '.mastracode'));
    writeFileSync(join(projectDir, '.mastracode', 'headless.json'), JSON.stringify({
      preferences: { thinkingLevel: 'high' },
    }));
    writeFileSync(join(globalDir, '.mastracode', 'headless.json'), JSON.stringify({
      preferences: { thinkingLevel: 'low' },
    }));
    const config = loadHeadlessConfig({ projectDir, globalDir });
    expect(config.preferences?.thinkingLevel).toBe('high');
  });

  it('loads explicit config path via configPath option', () => {
    const dir = makeTempDir();
    const filePath = join(dir, 'custom.json');
    writeFileSync(filePath, JSON.stringify({
      models: { modeDefaults: { fast: 'cerebras/zai-glm-4.7' } },
    }));
    const config = loadHeadlessConfig({ configPath: filePath });
    expect(config.models?.modeDefaults?.fast).toBe('cerebras/zai-glm-4.7');
  });

  it('throws when explicit configPath does not exist', () => {
    expect(() => loadHeadlessConfig({ configPath: '/nonexistent/path.json' }))
      .toThrow('Config file not found: /nonexistent/path.json');
  });

  it('throws when explicit configPath has invalid JSON', () => {
    const dir = makeTempDir();
    const filePath = join(dir, 'bad.json');
    writeFileSync(filePath, '{ not valid json }');
    expect(() => loadHeadlessConfig({ configPath: filePath }))
      .toThrow('Failed to parse config file');
  });

  it('returns empty config when auto-discovered file has invalid JSON', () => {
    const dir = makeTempDir();
    mkdirSync(join(dir, '.mastracode'));
    writeFileSync(join(dir, '.mastracode', 'headless.json'), '{ broken }');
    const config = loadHeadlessConfig({ projectDir: dir });
    expect(config).toEqual({});
  });

  it('ignores unknown top-level keys', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    try {
      const dir = makeTempDir();
      mkdirSync(join(dir, '.mastracode'));
      writeFileSync(join(dir, '.mastracode', 'headless.json'), JSON.stringify({
        models: { modeDefaults: { build: 'anthropic/claude-sonnet-4-5' } },
        unknownField: 'should be ignored',
      }));
      const config = loadHeadlessConfig({ projectDir: dir });
      expect(config.models?.modeDefaults?.build).toBe('anthropic/claude-sonnet-4-5');
      expect((config as any).unknownField).toBeUndefined();
      expect(stderrSpy).toHaveBeenCalledWith(
        'Warning: unknown config key "unknownField" in headless.json, ignoring\n'
      );
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it('ignores invalid thinkingLevel values', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    try {
      const dir = makeTempDir();
      mkdirSync(join(dir, '.mastracode'));
      writeFileSync(join(dir, '.mastracode', 'headless.json'), JSON.stringify({
        preferences: { thinkingLevel: 'extreme' },
      }));
      const config = loadHeadlessConfig({ projectDir: dir });
      expect(config.preferences?.thinkingLevel).toBeUndefined();
      expect(stderrSpy).toHaveBeenCalledWith(
        'Warning: invalid thinkingLevel "extreme" in headless.json, ignoring\n'
      );
    } finally {
      stderrSpy.mockRestore();
    }
  });
});
