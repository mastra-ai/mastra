import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG_DIR } from '../../constants.js';
import { buildSkillPaths } from '../workspace.js';

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

      const realPath = '/real/location/my-skill';
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

      // Should include the parent of the real path
      expect(result).toContain('/real/location');
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
        if (s === path.join(skillsDir, 'skill-a')) return '/shared/skills-repo/skill-a';
        if (s === path.join(skillsDir, 'skill-b')) return '/shared/skills-repo/skill-b';
        return s;
      });

      mockedFs.statSync.mockReturnValue({ isDirectory: () => true } as fs.Stats);

      const result = buildSkillPaths(projectPath, DEFAULT_CONFIG_DIR);

      const occurrences = result.filter(p => p === '/shared/skills-repo');
      expect(occurrences).toHaveLength(1);
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

    it('silently handles errors during symlink resolution', () => {
      const skillsDir = path.join(projectPath, '.mastracode', 'skills');

      mockedFs.existsSync.mockImplementation((p: fs.PathLike) => {
        return String(p) === skillsDir;
      });

      const symlinkEntry = {
        name: 'broken-link',
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

      mockedFs.realpathSync.mockImplementation(() => {
        throw new Error('ENOENT: broken symlink');
      });

      // Should not throw — errors are silently caught
      expect(() => buildSkillPaths(projectPath, DEFAULT_CONFIG_DIR)).not.toThrow();

      // Base paths should still be returned
      const result = buildSkillPaths(projectPath, DEFAULT_CONFIG_DIR);
      expect(result.length).toBeGreaterThanOrEqual(6);
    });
  });
});
