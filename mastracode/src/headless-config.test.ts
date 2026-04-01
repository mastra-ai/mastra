import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, afterAll, vi } from 'vitest';

import { loadHeadlessConfig, resolveProfile } from './headless-config.js';
import type { HeadlessConfig } from './headless-config.js';

const tempDirs: string[] = [];
function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'headless-config-'));
  tempDirs.push(dir);
  return dir;
}
afterAll(() => {
  for (const d of tempDirs) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {}
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
    writeFileSync(
      join(mcDir, 'headless.json'),
      JSON.stringify({
        models: { modeDefaults: { build: 'anthropic/claude-sonnet-4-5' } },
        preferences: { thinkingLevel: 'high' },
      }),
    );
    const config = loadHeadlessConfig({ projectDir: dir });
    expect(config.models?.modeDefaults?.build).toBe('anthropic/claude-sonnet-4-5');
    expect(config.preferences?.thinkingLevel).toBe('high');
  });

  it('loads global ~/.mastracode/headless.json when no project config', () => {
    const projectDir = makeTempDir();
    const globalDir = makeTempDir();
    const mcDir = join(globalDir, '.mastracode');
    mkdirSync(mcDir);
    writeFileSync(
      join(mcDir, 'headless.json'),
      JSON.stringify({
        preferences: { yolo: true },
      }),
    );
    const config = loadHeadlessConfig({ projectDir, globalDir });
    expect(config.preferences?.yolo).toBe(true);
  });

  it('project config wins over global config (first-file-wins)', () => {
    const projectDir = makeTempDir();
    const globalDir = makeTempDir();
    mkdirSync(join(projectDir, '.mastracode'));
    mkdirSync(join(globalDir, '.mastracode'));
    writeFileSync(
      join(projectDir, '.mastracode', 'headless.json'),
      JSON.stringify({
        preferences: { thinkingLevel: 'high' },
      }),
    );
    writeFileSync(
      join(globalDir, '.mastracode', 'headless.json'),
      JSON.stringify({
        preferences: { thinkingLevel: 'low' },
      }),
    );
    const config = loadHeadlessConfig({ projectDir, globalDir });
    expect(config.preferences?.thinkingLevel).toBe('high');
  });

  it('loads explicit config path via configPath option', () => {
    const dir = makeTempDir();
    const filePath = join(dir, 'custom.json');
    writeFileSync(
      filePath,
      JSON.stringify({
        models: { modeDefaults: { fast: 'cerebras/zai-glm-4.7' } },
      }),
    );
    const config = loadHeadlessConfig({ configPath: filePath });
    expect(config.models?.modeDefaults?.fast).toBe('cerebras/zai-glm-4.7');
  });

  it('throws when explicit configPath does not exist', () => {
    expect(() => loadHeadlessConfig({ configPath: '/nonexistent/path.json' })).toThrow(
      'Config file not found: /nonexistent/path.json',
    );
  });

  it('throws when explicit configPath has invalid JSON', () => {
    const dir = makeTempDir();
    const filePath = join(dir, 'bad.json');
    writeFileSync(filePath, '{ not valid json }');
    expect(() => loadHeadlessConfig({ configPath: filePath })).toThrow('Failed to parse config file');
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
      writeFileSync(
        join(dir, '.mastracode', 'headless.json'),
        JSON.stringify({
          models: { modeDefaults: { build: 'anthropic/claude-sonnet-4-5' } },
          unknownField: 'should be ignored',
        }),
      );
      const config = loadHeadlessConfig({ projectDir: dir });
      expect(config.models?.modeDefaults?.build).toBe('anthropic/claude-sonnet-4-5');
      expect((config as any).unknownField).toBeUndefined();
      expect(stderrSpy).toHaveBeenCalledWith('Warning: unknown config key "unknownField" in headless.json, ignoring\n');
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it('ignores invalid thinkingLevel values', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    try {
      const dir = makeTempDir();
      mkdirSync(join(dir, '.mastracode'));
      writeFileSync(
        join(dir, '.mastracode', 'headless.json'),
        JSON.stringify({
          preferences: { thinkingLevel: 'extreme' },
        }),
      );
      const config = loadHeadlessConfig({ projectDir: dir });
      expect(config.preferences?.thinkingLevel).toBeUndefined();
      expect(stderrSpy).toHaveBeenCalledWith('Warning: invalid thinkingLevel "extreme" in headless.json, ignoring\n');
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it('parses config with profiles section', () => {
    const dir = makeTempDir();
    mkdirSync(join(dir, '.mastracode'));
    writeFileSync(
      join(dir, '.mastracode', 'headless.json'),
      JSON.stringify({
        models: { modeDefaults: { build: 'anthropic/claude-sonnet-4-5' } },
        profiles: {
          ci: {
            models: { modeDefaults: { build: 'anthropic/claude-haiku-4-5' } },
            preferences: { thinkingLevel: 'off', yolo: true },
          },
          review: {
            preferences: { thinkingLevel: 'high' },
          },
        },
      }),
    );
    const config = loadHeadlessConfig({ projectDir: dir });
    expect(config.models?.modeDefaults?.build).toBe('anthropic/claude-sonnet-4-5');
    expect(config.profiles?.ci?.models?.modeDefaults?.build).toBe('anthropic/claude-haiku-4-5');
    expect(config.profiles?.ci?.preferences?.thinkingLevel).toBe('off');
    expect(config.profiles?.ci?.preferences?.yolo).toBe(true);
    expect(config.profiles?.review?.preferences?.thinkingLevel).toBe('high');
  });

  it('validates models and preferences within profiles', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    try {
      const dir = makeTempDir();
      mkdirSync(join(dir, '.mastracode'));
      writeFileSync(
        join(dir, '.mastracode', 'headless.json'),
        JSON.stringify({
          profiles: {
            bad: {
              models: { modeDefaults: { turbo: 'some/model' } },
              preferences: { thinkingLevel: 'extreme' },
            },
          },
        }),
      );
      const config = loadHeadlessConfig({ projectDir: dir });
      // Invalid mode and thinkingLevel should be stripped
      expect(config.profiles?.bad?.models?.modeDefaults).toBeUndefined();
      expect(config.profiles?.bad?.preferences?.thinkingLevel).toBeUndefined();
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it('warns on non-object profile entries', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    try {
      const dir = makeTempDir();
      mkdirSync(join(dir, '.mastracode'));
      writeFileSync(
        join(dir, '.mastracode', 'headless.json'),
        JSON.stringify({
          profiles: {
            valid: { preferences: { yolo: true } },
            invalid: 'not-an-object',
          },
        }),
      );
      const config = loadHeadlessConfig({ projectDir: dir });
      expect(config.profiles?.valid?.preferences?.yolo).toBe(true);
      expect(config.profiles?.invalid).toBeUndefined();
      expect(stderrSpy).toHaveBeenCalledWith(
        'Warning: profile "invalid" is not an object in headless.json, ignoring\n',
      );
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it('parses config with activeModelPackId', () => {
    const dir = makeTempDir();
    mkdirSync(join(dir, '.mastracode'));
    writeFileSync(
      join(dir, '.mastracode', 'headless.json'),
      JSON.stringify({
        models: { activeModelPackId: 'anthropic' },
      }),
    );
    const config = loadHeadlessConfig({ projectDir: dir });
    expect(config.models?.activeModelPackId).toBe('anthropic');
  });

  it('parses config with activeOmPackId and omModelOverride', () => {
    const dir = makeTempDir();
    mkdirSync(join(dir, '.mastracode'));
    writeFileSync(
      join(dir, '.mastracode', 'headless.json'),
      JSON.stringify({
        models: {
          activeOmPackId: 'openai',
          omModelOverride: 'anthropic/claude-sonnet-4-5',
        },
      }),
    );
    const config = loadHeadlessConfig({ projectDir: dir });
    expect(config.models?.activeOmPackId).toBe('openai');
    expect(config.models?.omModelOverride).toBe('anthropic/claude-sonnet-4-5');
  });

  it('ignores omModelOverride when set to null (null means no override)', () => {
    const dir = makeTempDir();
    mkdirSync(join(dir, '.mastracode'));
    writeFileSync(
      join(dir, '.mastracode', 'headless.json'),
      JSON.stringify({
        models: { omModelOverride: null },
      }),
    );
    const config = loadHeadlessConfig({ projectDir: dir });
    // null is treated as "no override" — field should not be present
    expect(config.models?.omModelOverride).toBeUndefined();
  });

  it('parses config with subagentModels', () => {
    const dir = makeTempDir();
    mkdirSync(join(dir, '.mastracode'));
    writeFileSync(
      join(dir, '.mastracode', 'headless.json'),
      JSON.stringify({
        models: {
          subagentModels: {
            explore: 'anthropic/claude-haiku-4-5',
            execute: 'openai/gpt-4o',
          },
        },
      }),
    );
    const config = loadHeadlessConfig({ projectDir: dir });
    expect(config.models?.subagentModels?.explore).toBe('anthropic/claude-haiku-4-5');
    expect(config.models?.subagentModels?.execute).toBe('openai/gpt-4o');
  });

  it('warns and ignores non-string subagentModels entries', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    try {
      const dir = makeTempDir();
      mkdirSync(join(dir, '.mastracode'));
      writeFileSync(
        join(dir, '.mastracode', 'headless.json'),
        JSON.stringify({
          models: {
            subagentModels: {
              explore: 'anthropic/claude-haiku-4-5',
              execute: 123,
              plan: null,
            },
          },
        }),
      );
      const config = loadHeadlessConfig({ projectDir: dir });
      expect(config.models?.subagentModels?.explore).toBe('anthropic/claude-haiku-4-5');
      expect(config.models?.subagentModels?.execute).toBeUndefined();
      expect(config.models?.subagentModels?.plan).toBeUndefined();
      expect(stderrSpy).toHaveBeenCalledWith(
        'Warning: subagentModels["execute"] is not a string in headless.json, ignoring\n',
      );
      expect(stderrSpy).toHaveBeenCalledWith(
        'Warning: subagentModels["plan"] is not a string in headless.json, ignoring\n',
      );
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it('parses config with OM thresholds (number and null)', () => {
    const dir = makeTempDir();
    mkdirSync(join(dir, '.mastracode'));
    writeFileSync(
      join(dir, '.mastracode', 'headless.json'),
      JSON.stringify({
        models: {
          omObservationThreshold: 0.7,
          omReflectionThreshold: null,
        },
      }),
    );
    const config = loadHeadlessConfig({ projectDir: dir });
    expect(config.models?.omObservationThreshold).toBe(0.7);
    expect(config.models?.omReflectionThreshold).toBeNull();
  });

  it('validates new model fields within profiles', () => {
    const dir = makeTempDir();
    mkdirSync(join(dir, '.mastracode'));
    writeFileSync(
      join(dir, '.mastracode', 'headless.json'),
      JSON.stringify({
        profiles: {
          ci: {
            models: {
              activeModelPackId: 'anthropic',
              activeOmPackId: 'openai',
              subagentModels: { explore: 'anthropic/claude-haiku-4-5' },
              omObservationThreshold: 0.5,
            },
          },
        },
      }),
    );
    const config = loadHeadlessConfig({ projectDir: dir });
    expect(config.profiles?.ci?.models?.activeModelPackId).toBe('anthropic');
    expect(config.profiles?.ci?.models?.activeOmPackId).toBe('openai');
    expect(config.profiles?.ci?.models?.subagentModels?.explore).toBe('anthropic/claude-haiku-4-5');
    expect(config.profiles?.ci?.models?.omObservationThreshold).toBe(0.5);
  });

  it('is backward compatible when no profiles key is present', () => {
    const dir = makeTempDir();
    mkdirSync(join(dir, '.mastracode'));
    writeFileSync(
      join(dir, '.mastracode', 'headless.json'),
      JSON.stringify({
        models: { modeDefaults: { build: 'anthropic/claude-sonnet-4-5' } },
        preferences: { thinkingLevel: 'medium' },
      }),
    );
    const config = loadHeadlessConfig({ projectDir: dir });
    expect(config.models?.modeDefaults?.build).toBe('anthropic/claude-sonnet-4-5');
    expect(config.preferences?.thinkingLevel).toBe('medium');
    expect(config.profiles).toBeUndefined();
  });
});

describe('resolveProfile', () => {
  it('returns named profile', () => {
    const config: HeadlessConfig = {
      models: { modeDefaults: { build: 'anthropic/claude-sonnet-4-5' } },
      profiles: {
        ci: {
          models: { modeDefaults: { build: 'anthropic/claude-haiku-4-5' } },
          preferences: { thinkingLevel: 'off' },
        },
      },
    };
    const profile = resolveProfile(config, 'ci');
    expect(profile.models?.modeDefaults?.build).toBe('anthropic/claude-haiku-4-5');
    expect(profile.preferences?.thinkingLevel).toBe('off');
  });

  it('throws for unknown profile with helpful message', () => {
    const config: HeadlessConfig = {
      profiles: {
        ci: { preferences: { yolo: true } },
        review: { preferences: { thinkingLevel: 'high' } },
      },
    };
    expect(() => resolveProfile(config, 'staging')).toThrow(
      'Profile "staging" not found in config. Available: ci, review',
    );
  });

  it('throws with "(none)" when no profiles exist', () => {
    const config: HeadlessConfig = {};
    expect(() => resolveProfile(config, 'ci')).toThrow('Profile "ci" not found in config. Available: (none)');
  });
});
