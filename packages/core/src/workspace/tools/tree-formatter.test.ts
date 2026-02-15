import { execSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { LocalFilesystem } from '../filesystem';
import { formatAsTree, formatEntriesAsTree } from './tree-formatter';

describe('tree-formatter', () => {
  let tempDir: string;
  let filesystem: LocalFilesystem;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tree-formatter-test-'));
    filesystem = new LocalFilesystem({ basePath: tempDir });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // ===========================================================================
  // formatAsTree - Basic Output
  // ===========================================================================
  describe('formatAsTree', () => {
    it('should format empty directory', async () => {
      const result = await formatAsTree(filesystem, '/');

      expect(result.tree).toBe('.');
      expect(result.summary).toBe('0 directories, 0 files');
      expect(result.dirCount).toBe(0);
      expect(result.fileCount).toBe(0);
      expect(result.truncated).toBe(false);
    });

    it('should format single file', async () => {
      await fs.writeFile(path.join(tempDir, 'file.txt'), 'content');

      const result = await formatAsTree(filesystem, '/');

      expect(result.tree).toBe('.\n└── file.txt');
      expect(result.summary).toBe('0 directories, 1 file');
      expect(result.fileCount).toBe(1);
    });

    it('should format single directory', async () => {
      await fs.mkdir(path.join(tempDir, 'dir'));

      const result = await formatAsTree(filesystem, '/');

      expect(result.tree).toBe('.\n└── dir');
      expect(result.summary).toBe('1 directory, 0 files');
      expect(result.dirCount).toBe(1);
    });

    it('should format multiple files and directories', async () => {
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), 'export {}');
      await fs.writeFile(path.join(tempDir, 'package.json'), '{}');
      await fs.writeFile(path.join(tempDir, 'README.md'), '# README');

      const result = await formatAsTree(filesystem, '/');

      // Directories first, then files, all ASCII alphabetical (to match native tree's strcmp)
      expect(result.tree).toBe(
        `.
├── src
│   └── index.ts
├── README.md
└── package.json`,
      );
      expect(result.dirCount).toBe(1);
      expect(result.fileCount).toBe(3);
    });

    it('should format nested directory structure', async () => {
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.mkdir(path.join(tempDir, 'src', 'utils'));
      await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), '');
      await fs.writeFile(path.join(tempDir, 'src', 'utils', 'helpers.ts'), '');
      await fs.writeFile(path.join(tempDir, 'package.json'), '');

      const result = await formatAsTree(filesystem, '/');

      expect(result.tree).toBe(
        `.
├── src
│   ├── utils
│   │   └── helpers.ts
│   └── index.ts
└── package.json`,
      );
      expect(result.dirCount).toBe(2);
      expect(result.fileCount).toBe(3);
    });

    it('should sort directories before files', async () => {
      await fs.writeFile(path.join(tempDir, 'aaa.txt'), '');
      await fs.mkdir(path.join(tempDir, 'zzz'));

      const result = await formatAsTree(filesystem, '/');

      // Directory 'zzz' should come before file 'aaa.txt'
      expect(result.tree).toBe(
        `.
├── zzz
└── aaa.txt`,
      );
    });

    it('should sort alphabetically within type', async () => {
      await fs.writeFile(path.join(tempDir, 'zebra.txt'), '');
      await fs.writeFile(path.join(tempDir, 'alpha.txt'), '');
      await fs.writeFile(path.join(tempDir, 'beta.txt'), '');

      const result = await formatAsTree(filesystem, '/');

      expect(result.tree).toBe(
        `.
├── alpha.txt
├── beta.txt
└── zebra.txt`,
      );
    });
  });

  // ===========================================================================
  // formatAsTree - maxDepth
  // ===========================================================================
  describe('maxDepth', () => {
    it('should limit depth to 1', async () => {
      await fs.mkdir(path.join(tempDir, 'level1'));
      await fs.mkdir(path.join(tempDir, 'level1', 'level2'));
      await fs.mkdir(path.join(tempDir, 'level1', 'level2', 'level3'));
      await fs.writeFile(path.join(tempDir, 'level1', 'level2', 'level3', 'deep.txt'), '');

      const result = await formatAsTree(filesystem, '/', { maxDepth: 1 });

      expect(result.tree).toBe(
        `.
└── level1`,
      );
      expect(result.truncated).toBe(true);
      expect(result.summary).toContain('truncated at depth 1');
      expect(result.dirCount).toBe(1);
      expect(result.fileCount).toBe(0);
    });

    it('should limit depth to 2', async () => {
      await fs.mkdir(path.join(tempDir, 'level1'));
      await fs.mkdir(path.join(tempDir, 'level1', 'level2'));
      await fs.writeFile(path.join(tempDir, 'level1', 'file1.txt'), '');
      await fs.writeFile(path.join(tempDir, 'level1', 'level2', 'file2.txt'), '');

      const result = await formatAsTree(filesystem, '/', { maxDepth: 2 });

      expect(result.tree).toBe(
        `.
└── level1
    ├── level2
    └── file1.txt`,
      );
      expect(result.truncated).toBe(true);
      expect(result.dirCount).toBe(2);
      expect(result.fileCount).toBe(1);
    });

    it('should not truncate when depth is sufficient', async () => {
      await fs.mkdir(path.join(tempDir, 'dir'));
      await fs.writeFile(path.join(tempDir, 'dir', 'file.txt'), '');

      const result = await formatAsTree(filesystem, '/', { maxDepth: 10 });

      expect(result.truncated).toBe(false);
      expect(result.summary).not.toContain('truncated');
    });

    it('should handle maxDepth of 0', async () => {
      await fs.mkdir(path.join(tempDir, 'dir'));
      await fs.writeFile(path.join(tempDir, 'file.txt'), '');

      const result = await formatAsTree(filesystem, '/', { maxDepth: 0 });

      expect(result.tree).toBe('.');
      expect(result.truncated).toBe(true);
      expect(result.dirCount).toBe(0);
      expect(result.fileCount).toBe(0);
    });
  });

  // ===========================================================================
  // formatAsTree - Hidden Files
  // ===========================================================================
  describe('hidden files', () => {
    it('should hide dotfiles by default', async () => {
      await fs.writeFile(path.join(tempDir, '.gitignore'), '');
      await fs.writeFile(path.join(tempDir, 'visible.txt'), '');
      await fs.mkdir(path.join(tempDir, '.git'));

      const result = await formatAsTree(filesystem, '/');

      expect(result.tree).toBe(
        `.
└── visible.txt`,
      );
      expect(result.fileCount).toBe(1);
      expect(result.dirCount).toBe(0);
    });

    it('should show dotfiles when showHidden is true', async () => {
      await fs.writeFile(path.join(tempDir, '.gitignore'), '');
      await fs.writeFile(path.join(tempDir, 'visible.txt'), '');

      const result = await formatAsTree(filesystem, '/', { showHidden: true });

      expect(result.tree).toBe(
        `.
├── .gitignore
└── visible.txt`,
      );
      expect(result.fileCount).toBe(2);
    });
  });

  // ===========================================================================
  // formatAsTree - Extension Filter
  // ===========================================================================
  describe('extension filter', () => {
    it('should filter by single extension', async () => {
      await fs.writeFile(path.join(tempDir, 'index.ts'), '');
      await fs.writeFile(path.join(tempDir, 'style.css'), '');
      await fs.writeFile(path.join(tempDir, 'utils.ts'), '');

      const result = await formatAsTree(filesystem, '/', { extension: '.ts' });

      expect(result.tree).toBe(
        `.
├── index.ts
└── utils.ts`,
      );
      expect(result.fileCount).toBe(2);
    });

    it('should filter by extension without dot prefix', async () => {
      await fs.writeFile(path.join(tempDir, 'index.ts'), '');
      await fs.writeFile(path.join(tempDir, 'style.css'), '');

      const result = await formatAsTree(filesystem, '/', { extension: 'ts' });

      expect(result.tree).toBe(
        `.
└── index.ts`,
      );
    });

    it('should filter by multiple extensions', async () => {
      await fs.writeFile(path.join(tempDir, 'index.ts'), '');
      await fs.writeFile(path.join(tempDir, 'test.tsx'), '');
      await fs.writeFile(path.join(tempDir, 'style.css'), '');

      const result = await formatAsTree(filesystem, '/', { extension: ['.ts', '.tsx'] });

      expect(result.tree).toBe(
        `.
├── index.ts
└── test.tsx`,
      );
      expect(result.fileCount).toBe(2);
    });

    it('should preserve directories when filtering by extension', async () => {
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), '');
      await fs.writeFile(path.join(tempDir, 'README.md'), '');

      const result = await formatAsTree(filesystem, '/', { extension: '.ts' });

      // Directory 'src' should be included because it contains .ts files
      expect(result.tree).toBe(
        `.
└── src
    └── index.ts`,
      );
      expect(result.dirCount).toBe(1);
      expect(result.fileCount).toBe(1);
    });

    it('should show empty directories when extension filters out all files', async () => {
      await fs.mkdir(path.join(tempDir, 'empty-dir'));
      await fs.writeFile(path.join(tempDir, 'README.md'), '');

      const result = await formatAsTree(filesystem, '/', { extension: '.ts' });

      // Directory is shown (no files inside match, but directory itself isn't filtered)
      expect(result.tree).toBe(
        `.
└── empty-dir`,
      );
    });
  });

  // ===========================================================================
  // formatAsTree - Subdirectory
  // ===========================================================================
  describe('subdirectory', () => {
    it('should format from subdirectory', async () => {
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.mkdir(path.join(tempDir, 'src', 'utils'));
      await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), '');
      await fs.writeFile(path.join(tempDir, 'src', 'utils', 'helpers.ts'), '');

      const result = await formatAsTree(filesystem, '/src');

      expect(result.tree).toBe(
        `.
├── utils
│   └── helpers.ts
└── index.ts`,
      );
    });
  });

  // ===========================================================================
  // formatAsTree - Summary
  // ===========================================================================
  describe('summary', () => {
    it('should use singular for 1 directory', async () => {
      await fs.mkdir(path.join(tempDir, 'dir'));

      const result = await formatAsTree(filesystem, '/');

      expect(result.summary).toBe('1 directory, 0 files');
    });

    it('should use singular for 1 file', async () => {
      await fs.writeFile(path.join(tempDir, 'file.txt'), '');

      const result = await formatAsTree(filesystem, '/');

      expect(result.summary).toBe('0 directories, 1 file');
    });

    it('should use plural for multiple', async () => {
      await fs.mkdir(path.join(tempDir, 'dir1'));
      await fs.mkdir(path.join(tempDir, 'dir2'));
      await fs.writeFile(path.join(tempDir, 'file1.txt'), '');
      await fs.writeFile(path.join(tempDir, 'file2.txt'), '');

      const result = await formatAsTree(filesystem, '/');

      expect(result.summary).toBe('2 directories, 2 files');
    });
  });

  // ===========================================================================
  // formatAsTree - Edge Cases
  // ===========================================================================
  describe('edge cases', () => {
    it('should handle deeply nested structure', async () => {
      let currentPath = tempDir;
      for (let i = 1; i <= 5; i++) {
        currentPath = path.join(currentPath, `level${i}`);
        await fs.mkdir(currentPath);
      }
      await fs.writeFile(path.join(currentPath, 'deep.txt'), '');

      const result = await formatAsTree(filesystem, '/');

      expect(result.tree).toBe(
        `.
└── level1
    └── level2
        └── level3
            └── level4
                └── level5
                    └── deep.txt`,
      );
      expect(result.dirCount).toBe(5);
      expect(result.fileCount).toBe(1);
    });

    it('should handle special characters in filenames', async () => {
      await fs.writeFile(path.join(tempDir, 'file with spaces.txt'), '');
      await fs.writeFile(path.join(tempDir, 'file-with-dashes.txt'), '');
      await fs.writeFile(path.join(tempDir, 'file_with_underscores.txt'), '');

      const result = await formatAsTree(filesystem, '/');

      expect(result.tree).toContain('file with spaces.txt');
      expect(result.tree).toContain('file-with-dashes.txt');
      expect(result.tree).toContain('file_with_underscores.txt');
    });

    it('should handle mixed depth with multiple branches', async () => {
      // Create structure:
      // src/
      //   components/
      //     Button.tsx
      //   index.ts
      // tests/
      //   test.ts
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.mkdir(path.join(tempDir, 'src', 'components'));
      await fs.writeFile(path.join(tempDir, 'src', 'components', 'Button.tsx'), '');
      await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), '');
      await fs.mkdir(path.join(tempDir, 'tests'));
      await fs.writeFile(path.join(tempDir, 'tests', 'test.ts'), '');

      const result = await formatAsTree(filesystem, '/');

      expect(result.tree).toBe(
        `.
├── src
│   ├── components
│   │   └── Button.tsx
│   └── index.ts
└── tests
    └── test.ts`,
      );
    });
  });

  // ===========================================================================
  // dirsOnly Option (tree -d flag)
  // ===========================================================================
  describe('dirsOnly', () => {
    it('should list only directories when dirsOnly is true', async () => {
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.mkdir(path.join(tempDir, 'tests'));
      await fs.writeFile(path.join(tempDir, 'package.json'), '');
      await fs.writeFile(path.join(tempDir, 'README.md'), '');

      const result = await formatAsTree(filesystem, '/', { dirsOnly: true });

      expect(result.tree).toContain('src');
      expect(result.tree).toContain('tests');
      expect(result.tree).not.toContain('package.json');
      expect(result.tree).not.toContain('README.md');
      expect(result.fileCount).toBe(0);
      expect(result.dirCount).toBe(2);
    });

    it('should work with nested directories', async () => {
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.mkdir(path.join(tempDir, 'src', 'utils'));
      await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), '');
      await fs.writeFile(path.join(tempDir, 'src', 'utils', 'helpers.ts'), '');

      const result = await formatAsTree(filesystem, '/', { dirsOnly: true });

      expect(result.tree).toBe(
        `.
└── src
    └── utils`,
      );
      expect(result.fileCount).toBe(0);
      expect(result.dirCount).toBe(2);
    });
  });

  // ===========================================================================
  // exclude Option (tree -I flag)
  // ===========================================================================
  describe('exclude', () => {
    it('should exclude matching entries', async () => {
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.mkdir(path.join(tempDir, 'node_modules'));
      await fs.mkdir(path.join(tempDir, 'node_modules', 'lodash'));
      await fs.writeFile(path.join(tempDir, 'package.json'), '');

      const result = await formatAsTree(filesystem, '/', { exclude: 'node_modules' });

      expect(result.tree).toContain('src');
      expect(result.tree).toContain('package.json');
      expect(result.tree).not.toContain('node_modules');
      expect(result.tree).not.toContain('lodash');
    });

    it('should support multiple exclude patterns', async () => {
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.mkdir(path.join(tempDir, 'node_modules'));
      await fs.mkdir(path.join(tempDir, 'dist'));
      await fs.mkdir(path.join(tempDir, '.git'));
      await fs.writeFile(path.join(tempDir, 'index.ts'), '');

      const result = await formatAsTree(filesystem, '/', {
        exclude: ['node_modules', 'dist'],
        showHidden: true, // Show .git to verify it's not excluded
      });

      expect(result.tree).toContain('src');
      expect(result.tree).toContain('.git');
      expect(result.tree).toContain('index.ts');
      expect(result.tree).not.toContain('node_modules');
      expect(result.tree).not.toContain('dist');
    });

    it('should exclude partial matches', async () => {
      await fs.writeFile(path.join(tempDir, 'test.ts'), '');
      await fs.writeFile(path.join(tempDir, 'test.spec.ts'), '');
      await fs.writeFile(path.join(tempDir, 'index.ts'), '');

      const result = await formatAsTree(filesystem, '/', { exclude: 'spec' });

      expect(result.tree).toContain('test.ts');
      expect(result.tree).toContain('index.ts');
      expect(result.tree).not.toContain('test.spec.ts');
    });
  });

  // ===========================================================================
  // formatAsTree - Glob Pattern Filter
  // ===========================================================================
  describe('pattern (glob filter)', () => {
    it('should filter files by glob pattern', async () => {
      await fs.writeFile(path.join(tempDir, 'index.ts'), '');
      await fs.writeFile(path.join(tempDir, 'style.css'), '');
      await fs.writeFile(path.join(tempDir, 'utils.ts'), '');

      const result = await formatAsTree(filesystem, '/', { pattern: '**/*.ts' });

      expect(result.tree).toContain('index.ts');
      expect(result.tree).toContain('utils.ts');
      expect(result.tree).not.toContain('style.css');
      expect(result.fileCount).toBe(2);
    });

    it('should match files at any depth with **', async () => {
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.mkdir(path.join(tempDir, 'src', 'utils'));
      await fs.writeFile(path.join(tempDir, 'index.ts'), '');
      await fs.writeFile(path.join(tempDir, 'src', 'app.ts'), '');
      await fs.writeFile(path.join(tempDir, 'src', 'utils', 'helpers.ts'), '');
      await fs.writeFile(path.join(tempDir, 'src', 'style.css'), '');

      const result = await formatAsTree(filesystem, '/', { pattern: '**/*.ts' });

      expect(result.tree).toContain('index.ts');
      expect(result.tree).toContain('app.ts');
      expect(result.tree).toContain('helpers.ts');
      expect(result.tree).not.toContain('style.css');
      expect(result.fileCount).toBe(3);
    });

    it('should support brace expansion', async () => {
      await fs.writeFile(path.join(tempDir, 'vitest.config.ts'), '');
      await fs.writeFile(path.join(tempDir, 'eslint.config.js'), '');
      await fs.writeFile(path.join(tempDir, 'README.md'), '');

      const result = await formatAsTree(filesystem, '/', { pattern: '*.config.{js,ts}' });

      expect(result.tree).toContain('vitest.config.ts');
      expect(result.tree).toContain('eslint.config.js');
      expect(result.tree).not.toContain('README.md');
      expect(result.fileCount).toBe(2);
    });

    it('should support multiple patterns', async () => {
      await fs.writeFile(path.join(tempDir, 'index.ts'), '');
      await fs.writeFile(path.join(tempDir, 'App.tsx'), '');
      await fs.writeFile(path.join(tempDir, 'style.css'), '');

      const result = await formatAsTree(filesystem, '/', { pattern: ['**/*.ts', '**/*.tsx'] });

      expect(result.tree).toContain('index.ts');
      expect(result.tree).toContain('App.tsx');
      expect(result.tree).not.toContain('style.css');
      expect(result.fileCount).toBe(2);
    });

    it('should preserve directories so their contents can be checked', async () => {
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), '');
      await fs.writeFile(path.join(tempDir, 'README.md'), '');

      const result = await formatAsTree(filesystem, '/', { pattern: '**/*.ts' });

      // Directory 'src' should still be present because it contains matching files
      expect(result.tree).toContain('src');
      expect(result.tree).toContain('index.ts');
      expect(result.tree).not.toContain('README.md');
      expect(result.dirCount).toBe(1);
      expect(result.fileCount).toBe(1);
    });

    it('should work with pattern combined with exclude', async () => {
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.mkdir(path.join(tempDir, 'node_modules'));
      await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), '');
      await fs.writeFile(path.join(tempDir, 'node_modules', 'lib.ts'), '');

      const result = await formatAsTree(filesystem, '/', {
        pattern: '**/*.ts',
        exclude: 'node_modules',
      });

      expect(result.tree).toContain('index.ts');
      expect(result.tree).not.toContain('node_modules');
      expect(result.tree).not.toContain('lib.ts');
    });

    it('should work with pattern combined with maxDepth', async () => {
      await fs.mkdir(path.join(tempDir, 'a'));
      await fs.mkdir(path.join(tempDir, 'a', 'b'));
      await fs.writeFile(path.join(tempDir, 'a', 'shallow.ts'), '');
      await fs.writeFile(path.join(tempDir, 'a', 'b', 'deep.ts'), '');

      const result = await formatAsTree(filesystem, '/', {
        pattern: '**/*.ts',
        maxDepth: 2,
      });

      expect(result.tree).toContain('shallow.ts');
      // b/ is visible at depth 2 but its contents (depth 3) are truncated
      expect(result.tree).not.toContain('deep.ts');
      expect(result.truncated).toBe(true);
    });

    it('should produce empty tree when no files match', async () => {
      await fs.writeFile(path.join(tempDir, 'style.css'), '');
      await fs.writeFile(path.join(tempDir, 'README.md'), '');

      const result = await formatAsTree(filesystem, '/', { pattern: '**/*.ts' });

      expect(result.tree).toBe('.');
      expect(result.fileCount).toBe(0);
    });

    it('should work when listing a subdirectory', async () => {
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), '');
      await fs.writeFile(path.join(tempDir, 'src', 'style.css'), '');

      const result = await formatAsTree(filesystem, '/src', { pattern: '**/*.ts' });

      expect(result.tree).toContain('index.ts');
      expect(result.tree).not.toContain('style.css');
      expect(result.fileCount).toBe(1);
    });
  });

  // ===========================================================================
  // formatEntriesAsTree - Direct Entry Formatting
  // ===========================================================================
  describe('formatEntriesAsTree', () => {
    it('should format flat entries into tree', () => {
      const entries = [
        { name: 'src/index.ts', type: 'file' as const },
        { name: 'src/utils/helpers.ts', type: 'file' as const },
        { name: 'package.json', type: 'file' as const },
      ];

      const result = formatEntriesAsTree(entries);

      expect(result).toBe(
        `.
├── src
│   ├── utils
│   │   └── helpers.ts
│   └── index.ts
└── package.json`,
      );
    });

    it('should handle empty entries', () => {
      const result = formatEntriesAsTree([]);

      expect(result).toBe('.');
    });

    it('should handle single entry', () => {
      const result = formatEntriesAsTree([{ name: 'file.txt', type: 'file' as const }]);

      expect(result).toBe(
        `.
└── file.txt`,
      );
    });

    it('should sort directories before files', () => {
      const entries = [
        { name: 'file.txt', type: 'file' as const },
        { name: 'dir/nested.txt', type: 'file' as const },
      ];

      const result = formatEntriesAsTree(entries);

      // 'dir' directory should come before 'file.txt'
      expect(result).toBe(
        `.
├── dir
│   └── nested.txt
└── file.txt`,
      );
    });
  });

  // ===========================================================================
  // Symlink Support
  // ===========================================================================
  describe('symlinks', () => {
    it('should display symlinks with target path', async () => {
      // Create a real file and a symlink to it
      await fs.writeFile(path.join(tempDir, 'real-file.txt'), 'content');
      await fs.symlink(path.join(tempDir, 'real-file.txt'), path.join(tempDir, 'link-to-file.txt'));

      const result = await formatAsTree(filesystem, '/');

      expect(result.tree).toContain('link-to-file.txt -> ');
      expect(result.tree).toContain('real-file.txt');
      expect(result.fileCount).toBe(2); // Both the real file and symlink count as files
    });

    it('should display directory symlinks with target path', async () => {
      // Create a real directory and a symlink to it
      await fs.mkdir(path.join(tempDir, 'real-dir'));
      await fs.writeFile(path.join(tempDir, 'real-dir', 'file.txt'), 'content');
      await fs.symlink(path.join(tempDir, 'real-dir'), path.join(tempDir, 'link-to-dir'));

      const result = await formatAsTree(filesystem, '/');

      expect(result.tree).toContain('link-to-dir -> ');
      expect(result.tree).toContain('real-dir');
      // Both real-dir and link-to-dir are directories
      expect(result.dirCount).toBe(2);
    });

    it('should NOT follow symlinks to directories (prevents infinite loops)', async () => {
      // Create a directory with files
      await fs.mkdir(path.join(tempDir, 'source'));
      await fs.writeFile(path.join(tempDir, 'source', 'nested.txt'), 'content');
      // Create a symlink to the directory
      await fs.symlink(path.join(tempDir, 'source'), path.join(tempDir, 'linked'));

      const result = await formatAsTree(filesystem, '/', { maxDepth: 3 });

      // Should show the symlink but NOT its contents (matches native tree behavior)
      expect(result.tree).toContain('source');
      expect(result.tree).toContain('linked -> ');
      expect(result.tree).toContain('nested.txt'); // Only from source dir
      // The symlink shows as a directory but we don't recurse into it
      expect(result.dirCount).toBe(2); // source and linked
    });

    it('should handle relative symlink targets', async () => {
      // Create structure with relative symlink
      await fs.mkdir(path.join(tempDir, 'packages'));
      await fs.mkdir(path.join(tempDir, 'packages', 'core'));
      await fs.writeFile(path.join(tempDir, 'packages', 'core', 'index.ts'), '');
      await fs.mkdir(path.join(tempDir, 'node_modules'));
      // Create relative symlink like pnpm/npm does
      await fs.symlink('../packages/core', path.join(tempDir, 'node_modules', 'core'));

      const result = await formatAsTree(filesystem, '/');

      expect(result.tree).toContain('core -> ../packages/core');
    });

    it('should handle broken symlinks gracefully', async () => {
      // Create a symlink to a non-existent target
      await fs.symlink(path.join(tempDir, 'does-not-exist'), path.join(tempDir, 'broken-link'));

      // Should not throw, should display the symlink
      const result = await formatAsTree(filesystem, '/');

      expect(result.tree).toContain('broken-link -> ');
    });
  });

  // ===========================================================================
  // Comparison with Native `tree` Command
  // ===========================================================================
  describe('comparison with native tree command', () => {
    /**
     * Check if the `tree` command is available on this system.
     * Cached at describe-time for use with it.skipIf.
     */
    const treeAvailable = (() => {
      // Only run native tree comparison in CI (Linux) to avoid macOS sort-order differences
      if (!process.env.CI) return false;
      try {
        execSync('which tree', { encoding: 'utf-8' });
        return true;
      } catch {
        return false;
      }
    })();

    /**
     * Normalize tree output for comparison.
     * Native tree uses non-breaking spaces (U+00A0) in some positions,
     * while our formatter uses regular spaces. Both are visually equivalent.
     */
    function normalizeTreeOutput(output: string): string {
      // Replace all whitespace with regular spaces for comparison
      // Preserves box-drawing characters while normalizing spacing
      return output.replace(/\u00a0/g, ' ');
    }

    /**
     * Get output from native `tree` command and normalize it
     */
    function getNativeTreeOutput(dir: string): string {
      // Use --noreport to skip the summary line, --charset=utf-8 for Unicode chars
      // --dirsfirst to match our sorting (directories before files)
      const output = execSync(`tree --noreport --charset=utf-8 --dirsfirst "${dir}"`, {
        encoding: 'utf-8',
        cwd: dir,
      });

      // Native tree shows the full path as root, we use "."
      // Replace the first line (full path) with "."
      const lines = output.trim().split('\n');
      lines[0] = '.';
      return normalizeTreeOutput(lines.join('\n'));
    }

    it.skipIf(!treeAvailable)('should match native tree output for simple structure', async function () {
      // Create a simple structure
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), '');
      await fs.writeFile(path.join(tempDir, 'package.json'), '');
      await fs.writeFile(path.join(tempDir, 'README.md'), '');

      const ourResult = await formatAsTree(filesystem, '/');
      const nativeResult = getNativeTreeOutput(tempDir);

      expect(ourResult.tree).toBe(nativeResult);
    });

    it.skipIf(!treeAvailable)('should match native tree output for nested structure', async function () {
      // Create nested structure
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.mkdir(path.join(tempDir, 'src', 'utils'));
      await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), '');
      await fs.writeFile(path.join(tempDir, 'src', 'utils', 'helpers.ts'), '');
      await fs.mkdir(path.join(tempDir, 'tests'));
      await fs.writeFile(path.join(tempDir, 'tests', 'test.ts'), '');

      const ourResult = await formatAsTree(filesystem, '/');
      const nativeResult = getNativeTreeOutput(tempDir);

      expect(ourResult.tree).toBe(nativeResult);
    });

    it.skipIf(!treeAvailable)('should match native tree output for deeply nested structure', async function () {
      // Create deep structure
      let currentPath = tempDir;
      for (let i = 1; i <= 4; i++) {
        currentPath = path.join(currentPath, `level${i}`);
        await fs.mkdir(currentPath);
      }
      await fs.writeFile(path.join(currentPath, 'deep.txt'), '');

      const ourResult = await formatAsTree(filesystem, '/');
      const nativeResult = getNativeTreeOutput(tempDir);

      expect(ourResult.tree).toBe(nativeResult);
    });

    it.skipIf(!treeAvailable)('should match native tree output for multiple branches', async function () {
      // Create structure with multiple branches at same level
      await fs.mkdir(path.join(tempDir, 'alpha'));
      await fs.mkdir(path.join(tempDir, 'beta'));
      await fs.mkdir(path.join(tempDir, 'gamma'));
      await fs.writeFile(path.join(tempDir, 'alpha', 'a.txt'), '');
      await fs.writeFile(path.join(tempDir, 'beta', 'b.txt'), '');
      await fs.writeFile(path.join(tempDir, 'gamma', 'c.txt'), '');
      await fs.writeFile(path.join(tempDir, 'root.txt'), '');

      const ourResult = await formatAsTree(filesystem, '/');
      const nativeResult = getNativeTreeOutput(tempDir);

      expect(ourResult.tree).toBe(nativeResult);
    });

    it.skipIf(!treeAvailable)('should match native tree output for symlinks', async function () {
      // Create structure with symlinks
      await fs.mkdir(path.join(tempDir, 'packages'));
      await fs.mkdir(path.join(tempDir, 'packages', 'core'));
      await fs.writeFile(path.join(tempDir, 'packages', 'core', 'index.ts'), '');
      await fs.mkdir(path.join(tempDir, 'node_modules'));
      // Create relative symlink
      await fs.symlink('../packages/core', path.join(tempDir, 'node_modules', 'core'));

      const ourResult = await formatAsTree(filesystem, '/');
      const nativeResult = getNativeTreeOutput(tempDir);

      // Both should show the symlink with its target
      expect(ourResult.tree).toContain('core -> ../packages/core');
      expect(nativeResult).toContain('core -> ../packages/core');
      expect(ourResult.tree).toBe(nativeResult);
    });
  });
});
