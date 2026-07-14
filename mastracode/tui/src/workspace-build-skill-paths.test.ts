import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_CONFIG_DIR } from '@mastra/code-sdk/constants';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSkillPaths } from './workspace.js';

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof fs>('node:fs');
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn(),
      readdirSync: vi.fn(),
      realpathSync: vi.fn(),
      statSync: vi.fn(),
    },
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    realpathSync: vi.fn(),
    statSync: vi.fn(),
  };
});

const mockedFs = vi.mocked(fs);

describe('buildSkillPaths', () => {
  const projectPath = '/test/project';
  const home = os.homedir();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no directories exist
    mockedFs.existsSync.mockReturnValue(false);
    mockedFs.readdirSync.mockReturnValue([]);
    mockedFs.realpathSync.mockImplementation(p => String(p));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns all six base skill directories with default configDir', () => {
    const result = buildSkillPaths(projectPath, DEFAULT_CONFIG_DIR);

    expect(result).toEqual([
      path.join(projectPath, '.mastracode', 'skills'),
      path.join(projectPath, '.claude', 'skills'),
      path.join(projectPath, '.agents', 'skills'),
      path.join(home, '.mastracode', 'skills'),
      path.join(home, '.claude', 'skills'),
      path.join(home, '.agents', 'skills'),
    ]);
  });

  it('substitutes custom configDir in project-local and global paths', () => {
    const result = buildSkillPaths(projectPath, '.acme-code');

    expect(result).toContain(path.join(projectPath, '.acme-code', 'skills'));
    expect(result).toContain(path.join(home, '.acme-code', 'skills'));
    // Claude and agents paths remain unchanged
    expect(result).toContain(path.join(projectPath, '.claude', 'skills'));
    expect(result).toContain(path.join(projectPath, '.agents', 'skills'));
    expect(result).toContain(path.join(home, '.claude', 'skills'));
    expect(result).toContain(path.join(home, '.agents', 'skills'));
  });

  it('deduplicates paths that resolve to the same directory', () => {
    // Use projectPath that happens to be homedir so local and global overlap
    const result = buildSkillPaths(home, DEFAULT_CONFIG_DIR);

    const resolvedPaths = result.map(p => path.resolve(p));
    const unique = new Set(resolvedPaths);
    expect(unique.size).toBe(resolvedPaths.length);
  });

  it('returns all paths as absolute', () => {
    const result = buildSkillPaths(projectPath, DEFAULT_CONFIG_DIR);

    for (const p of result) {
      expect(path.isAbsolute(p)).toBe(true);
    }
  });

  it('all paths end with skills', () => {
    const result = buildSkillPaths(projectPath, '.custom');

    for (const p of result) {
      expect(p).toMatch(/skills$/);
    }
  });

  describe('symlink resolution', () => {
    it('adds resolved symlink parent directories', () => {
      const skillsDir = path.join(projectPath, '.mastracode', 'skills');

      mockedFs.existsSync.mockImplementation((p: fs.PathLike) => {
        return String(p) === skillsDir;
      });

      const symlinkEntry = {
        name: 'my-skill',
        isSymbolicLink: () => true,
        isDirectory: () => false,
        isFile: () => false,
        isBlockDevice: () => false,
        isCharacterDevice: () => false,
        isFIFO: () => false,
        isSocket: () => false,
        path: skillsDir,
        parentPath: skillsDir,
      } as fs.Dirent;

      mockedFs.readdirSync.mockImplementation((p: fs.PathLike, _opts?: any) => {
        if (String(p) === skillsDir) return [symlinkEntry] as any;
        return [] as any;
      });

      const realPath = path.join(projectPath, 'shared-skills', 'my-skill');
      mockedFs.realpathSync.mockImplementation((p: fs.PathLike) => {
        if (String(p) === path.join(skillsDir, 'my-skill')) return realPath;
        return String(p);
      });

      mockedFs.statSync.mockImplementation((p: fs.PathLike) => {
        if (String(p) === realPath) {
          return { isDirectory: () => true } as fs.Stats;
        }
        return { isDirectory: () => false } as fs.Stats;
      });

      const result = buildSkillPaths(projectPath, DEFAULT_CONFIG_DIR);

      // Should include symlink targets that remain inside the project boundary
      expect(result).toContain(path.join(projectPath, 'shared-skills'));
    });

    it('does not add duplicate resolved parents', () => {
      const skillsDir = path.join(projectPath, '.mastracode', 'skills');

      mockedFs.existsSync.mockImplementation((p: fs.PathLike) => {
        return String(p) === skillsDir;
      });

      const makeSymlink = (name: string) =>
        ({
          name,
          isSymbolicLink: () => true,
          isDirectory: () => false,
          isFile: () => false,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isFIFO: () => false,
          isSocket: () => false,
          path: skillsDir,
          parentPath: skillsDir,
        }) as fs.Dirent;

      mockedFs.readdirSync.mockImplementation((p: fs.PathLike, _opts?: any) => {
        if (String(p) === skillsDir) return [makeSymlink('skill-a'), makeSymlink('skill-b')] as any;
        return [] as any;
      });

      // Both symlinks resolve to the same parent directory
      mockedFs.realpathSync.mockImplementation((p: fs.PathLike) => {
        const s = String(p);
        if (s === path.join(skillsDir, 'skill-a')) return path.join(projectPath, 'shared-skills', 'skill-a');
        if (s === path.join(skillsDir, 'skill-b')) return path.join(projectPath, 'shared-skills', 'skill-b');
        return s;
      });

      mockedFs.statSync.mockReturnValue({ isDirectory: () => true } as fs.Stats);

      const result = buildSkillPaths(projectPath, DEFAULT_CONFIG_DIR);

      const occurrences = result.filter(p => p === path.join(projectPath, 'shared-skills'));
      expect(occurrences).toHaveLength(1);
    });

    it('rejects project skill directories symlinked outside the project root', () => {
      const skillsDir = path.join(projectPath, '.claude', 'skills');

      mockedFs.existsSync.mockImplementation((p: fs.PathLike) => String(p) === skillsDir);
      mockedFs.realpathSync.mockImplementation((p: fs.PathLike) => {
        if (String(p) === skillsDir) return '/outside/skills';
        return String(p);
      });

      const result = buildSkillPaths(projectPath, DEFAULT_CONFIG_DIR);

      expect(result).not.toContain(skillsDir);
    });

    it('rejects project skill symlinks that escape the project root', () => {
      const skillsDir = path.join(projectPath, '.mastracode', 'skills');
      const symlinkEntry = {
        name: 'escaped-skill',
        isSymbolicLink: () => true,
        isDirectory: () => false,
        isFile: () => false,
      } as fs.Dirent;

      mockedFs.existsSync.mockImplementation((p: fs.PathLike) => String(p) === skillsDir);
      mockedFs.readdirSync.mockImplementation((p: fs.PathLike, _opts?: any) => {
        if (String(p) === skillsDir) return [symlinkEntry] as any;
        return [] as any;
      });
      mockedFs.realpathSync.mockImplementation((p: fs.PathLike) => {
        if (String(p) === path.join(skillsDir, 'escaped-skill')) return '/outside/skills/escaped-skill';
        return String(p);
      });
      mockedFs.statSync.mockReturnValue({ isDirectory: () => true } as fs.Stats);

      const result = buildSkillPaths(projectPath, DEFAULT_CONFIG_DIR);

      expect(result).not.toContain('/outside/skills');
    });

    it('rejects skill symlinks whose resolved parent escapes the project root', () => {
      const skillsDir = path.join(projectPath, '.mastracode', 'skills');
      const symlinkEntry = {
        name: 'project-root',
        isSymbolicLink: () => true,
        isDirectory: () => false,
        isFile: () => false,
      } as fs.Dirent;

      mockedFs.existsSync.mockImplementation((p: fs.PathLike) => String(p) === skillsDir);
      mockedFs.readdirSync.mockImplementation((p: fs.PathLike, _opts?: any) => {
        if (String(p) === skillsDir) return [symlinkEntry] as any;
        return [] as any;
      });
      mockedFs.realpathSync.mockImplementation((p: fs.PathLike) => {
        if (String(p) === path.join(skillsDir, 'project-root')) return projectPath;
        return String(p);
      });
      mockedFs.statSync.mockReturnValue({ isDirectory: () => true } as fs.Stats);

      const result = buildSkillPaths(projectPath, DEFAULT_CONFIG_DIR);

      expect(result).not.toContain(path.dirname(projectPath));
    });

    it('rejects plugin skill symlinks that escape the plugin skill root', () => {
      const pluginSkillsDir = '/plugins/example/skills';
      const symlinkEntry = {
        name: 'escaped-skill',
        isSymbolicLink: () => true,
        isDirectory: () => false,
        isFile: () => false,
      } as fs.Dirent;

      mockedFs.existsSync.mockImplementation((p: fs.PathLike) => String(p) === pluginSkillsDir);
      mockedFs.readdirSync.mockImplementation((p: fs.PathLike, _opts?: any) => {
        if (String(p) === pluginSkillsDir) return [symlinkEntry] as any;
        return [] as any;
      });
      mockedFs.realpathSync.mockImplementation((p: fs.PathLike) => {
        if (String(p) === path.join(pluginSkillsDir, 'escaped-skill')) return '/outside/skills/escaped-skill';
        return String(p);
      });
      mockedFs.statSync.mockReturnValue({ isDirectory: () => true } as fs.Stats);

      const result = buildSkillPaths(projectPath, DEFAULT_CONFIG_DIR, home, [pluginSkillsDir]);

      expect(result).not.toContain('/outside/skills');
    });

    it('allows global skill symlinks to external user-managed locations', () => {
      const globalSkillsDir = path.join(home, '.mastracode', 'skills');
      const symlinkEntry = {
        name: 'global-skill',
        isSymbolicLink: () => true,
        isDirectory: () => false,
        isFile: () => false,
      } as fs.Dirent;

      mockedFs.existsSync.mockImplementation((p: fs.PathLike) => String(p) === globalSkillsDir);
      mockedFs.readdirSync.mockImplementation((p: fs.PathLike, _opts?: any) => {
        if (String(p) === globalSkillsDir) return [symlinkEntry] as any;
        return [] as any;
      });
      mockedFs.realpathSync.mockImplementation((p: fs.PathLike) => {
        if (String(p) === path.join(globalSkillsDir, 'global-skill')) return '/external/skills/global-skill';
        return String(p);
      });
      mockedFs.statSync.mockReturnValue({ isDirectory: () => true } as fs.Stats);

      const result = buildSkillPaths(projectPath, DEFAULT_CONFIG_DIR);

      expect(result).toContain('/external/skills');
    });

    it('ignores symlinks that resolve to files, not directories', () => {
      const skillsDir = path.join(projectPath, '.mastracode', 'skills');

      mockedFs.existsSync.mockImplementation((p: fs.PathLike) => {
        return String(p) === skillsDir;
      });

      const symlinkEntry = {
        name: 'not-a-dir',
        isSymbolicLink: () => true,
        isDirectory: () => false,
        isFile: () => false,
        isBlockDevice: () => false,
        isCharacterDevice: () => false,
        isFIFO: () => false,
        isSocket: () => false,
        path: skillsDir,
        parentPath: skillsDir,
      } as fs.Dirent;

      mockedFs.readdirSync.mockImplementation((p: fs.PathLike, _opts?: any) => {
        if (String(p) === skillsDir) return [symlinkEntry] as any;
        return [] as any;
      });

      mockedFs.realpathSync.mockReturnValue('/some/file.txt');
      mockedFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);

      const result = buildSkillPaths(projectPath, DEFAULT_CONFIG_DIR);

      expect(result).not.toContain('/some');
    });

    it('continues resolving skills after a broken symlink', () => {
      const skillsDir = path.join(projectPath, '.mastracode', 'skills');
      const entries = ['broken-link', 'valid-skill'].map(
        name =>
          ({
            name,
            isSymbolicLink: () => true,
            isDirectory: () => false,
            isFile: () => false,
          }) as fs.Dirent,
      );

      mockedFs.existsSync.mockImplementation((p: fs.PathLike) => String(p) === skillsDir);
      mockedFs.readdirSync.mockImplementation((p: fs.PathLike, _opts?: any) => {
        if (String(p) === skillsDir) return entries as any;
        return [] as any;
      });
      mockedFs.realpathSync.mockImplementation((p: fs.PathLike) => {
        const value = String(p);
        if (value.endsWith('broken-link')) throw new Error('ENOENT: broken symlink');
        if (value.endsWith('valid-skill')) return path.join(skillsDir, 'sources', 'valid-skill');
        return value;
      });
      mockedFs.statSync.mockReturnValue({ isDirectory: () => true } as fs.Stats);

      const result = buildSkillPaths(projectPath, DEFAULT_CONFIG_DIR);

      expect(result).toContain(path.join(skillsDir, 'sources'));
    });

    it('returns no project skill paths when the project root cannot be canonicalized', () => {
      mockedFs.realpathSync.mockImplementation((p: fs.PathLike) => {
        if (String(p) === projectPath) throw new Error('EACCES');
        return String(p);
      });

      const result = buildSkillPaths(projectPath, DEFAULT_CONFIG_DIR, home);

      expect(result).not.toContain(path.join(projectPath, '.mastracode', 'skills'));
      expect(result).not.toContain(path.join(projectPath, '.claude', 'skills'));
      expect(result).not.toContain(path.join(projectPath, '.agents', 'skills'));
    });
  });
});
