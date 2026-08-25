import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { WORKSPACE_TOOLS } from '../../constants';
import { UnsupportedGrepPatternError } from '../../errors';
import { LocalFilesystem } from '../../filesystem';
import type { FilesystemGrepOptions, FilesystemGrepResult, WalkEntry, WalkOptions } from '../../filesystem';
import { Workspace } from '../../workspace';
import { createWorkspaceTools } from '../tools';
import { formatAsTree } from '../tree-formatter';

/**
 * LocalFilesystem extended with the optional native walk/grep capabilities,
 * implemented on top of node fs so results are ground truth. Tracks calls so
 * tests can assert delegation happens (and readdir/readFile walks don't).
 */
class CapabilityFilesystem extends LocalFilesystem {
  walkCalls: Array<{ path: string; options?: WalkOptions }> = [];
  grepCalls: FilesystemGrepOptions[] = [];
  readdirCalls: string[] = [];
  readFileCalls: string[] = [];
  walkError: Error | undefined;
  grepError: Error | undefined;

  constructor(private readonly rootDir: string) {
    super({ basePath: rootDir });
  }

  async readdir(inputPath: string, options?: Parameters<LocalFilesystem['readdir']>[1]) {
    this.readdirCalls.push(inputPath);
    return super.readdir(inputPath, options);
  }

  async readFile(inputPath: string, options?: Parameters<LocalFilesystem['readFile']>[1]) {
    this.readFileCalls.push(inputPath);
    return super.readFile(inputPath, options);
  }

  async walk(walkPath: string, options?: WalkOptions): Promise<WalkEntry[]> {
    this.walkCalls.push({ path: walkPath, options });
    if (this.walkError) throw this.walkError;

    const root = path.join(this.rootDir, walkPath === '.' ? '' : walkPath.replace(/^\.\//, '').replace(/^\//, ''));
    const entries: WalkEntry[] = [];
    const visit = async (dir: string, rel: string, depth: number): Promise<void> => {
      if (options?.maxDepth !== undefined && depth >= options.maxDepth) return;
      const dirents = await fs.readdir(dir, { withFileTypes: true });
      for (const dirent of dirents) {
        if (!options?.includeHidden && dirent.name.startsWith('.')) continue;
        const entryRel = rel ? `${rel}/${dirent.name}` : dirent.name;
        entries.push({
          name: dirent.name,
          type: dirent.isDirectory() ? 'directory' : 'file',
          isSymlink: dirent.isSymbolicLink() || undefined,
          path: entryRel,
        });
        if (dirent.isDirectory() && !dirent.isSymbolicLink()) {
          await visit(path.join(dir, dirent.name), entryRel, depth + 1);
        }
      }
    };
    await visit(root, '', 0);
    return entries;
  }

  async grep(options: FilesystemGrepOptions): Promise<FilesystemGrepResult[]> {
    this.grepCalls.push(options);
    if (this.grepError) throw this.grepError;

    const regex = new RegExp(options.pattern, options.caseSensitive ? 'g' : 'gi');
    const walked = await this.walk(options.path, { includeHidden: true });
    const results: FilesystemGrepResult[] = [];
    const context = options.contextLines ?? 0;

    for (const entry of walked.filter(e => e.type === 'file')) {
      const raw = await fs.readFile(
        path.join(this.rootDir, options.path === '.' ? '' : options.path.replace(/^\.\//, ''), entry.path),
        'utf-8',
      );
      const lines = raw.split('\n');
      const matches: FilesystemGrepResult['matches'] = [];
      for (let i = 0; i < lines.length; i++) {
        regex.lastIndex = 0;
        const m = regex.exec(lines[i]!);
        if (!m) continue;
        matches.push({
          line: i + 1,
          column: m.index,
          text: lines[i]!,
          before: context > 0 ? lines.slice(Math.max(0, i - context), i) : undefined,
          after: context > 0 ? lines.slice(i + 1, Math.min(lines.length, i + 1 + context)) : undefined,
        });
        if (options.maxCountPerFile !== undefined && matches.length >= options.maxCountPerFile) break;
      }
      if (matches.length > 0) results.push({ path: entry.path, matches });
    }
    return results;
  }
}

describe('filesystem capability delegation', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'capability-delegation-test-'));
    // Fixture tree
    await fs.mkdir(path.join(tempDir, 'src', 'utils'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'dist'), { recursive: true });
    await fs.mkdir(path.join(tempDir, '.hidden'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), 'const foo = 1;\nconst bar = 2;\nconst foobar = 3;');
    await fs.writeFile(path.join(tempDir, 'src', 'utils', 'helpers.ts'), 'export function foo() {}\n');
    await fs.writeFile(path.join(tempDir, 'dist', 'out.js'), 'var foo = 1;');
    await fs.writeFile(path.join(tempDir, '.hidden', 'secret.ts'), 'foo hidden');
    await fs.writeFile(path.join(tempDir, 'README.md'), '# foo readme');
    await fs.writeFile(path.join(tempDir, '.gitignore'), 'dist\n');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  describe('formatAsTree with walk capability', () => {
    it('delegates to walk and does not call readdir', async () => {
      const capFs = new CapabilityFilesystem(tempDir);
      const result = await formatAsTree(capFs, '.');

      expect(capFs.walkCalls).toHaveLength(1);
      expect(capFs.readdirCalls).toHaveLength(0);
      expect(result.tree).toContain('src');
      expect(result.tree).toContain('index.ts');
    });

    it('produces identical output to the readdir fallback', async () => {
      const capFs = new CapabilityFilesystem(tempDir);
      const plainFs = new LocalFilesystem({ basePath: tempDir });

      for (const options of [
        undefined,
        { maxDepth: 1 },
        { showHidden: true },
        { dirsOnly: true },
        { extension: '.ts' },
        { pattern: '**/*.ts' },
        { exclude: 'utils' },
        { respectGitignore: false },
      ]) {
        const native = await formatAsTree(capFs, '.', options);
        const fallback = await formatAsTree(plainFs, '.', options);
        expect(native).toEqual(fallback);
      }
    });

    it('falls back to readdir walk when walk throws', async () => {
      const capFs = new CapabilityFilesystem(tempDir);
      capFs.walkError = new Error('boom');
      const plainFs = new LocalFilesystem({ basePath: tempDir });

      const result = await formatAsTree(capFs, '.');
      const expected = await formatAsTree(plainFs, '.');

      expect(capFs.readdirCalls.length).toBeGreaterThan(0);
      expect(result).toEqual(expected);
    });

    it('still throws for a nonexistent root path', async () => {
      const capFs = new CapabilityFilesystem(tempDir);
      capFs.walkError = new Error('walk failed');
      await expect(formatAsTree(capFs, './does-not-exist')).rejects.toThrow();
    });

    it('passes maxDepth and showHidden to walk', async () => {
      const capFs = new CapabilityFilesystem(tempDir);
      await formatAsTree(capFs, '.', { maxDepth: 2, showHidden: true });
      expect(capFs.walkCalls[0]!.options).toEqual({ maxDepth: 2, includeHidden: true });
    });
  });

  describe('grep tool with grep capability', () => {
    async function makeTools(filesystem: LocalFilesystem) {
      const workspace = new Workspace({ filesystem });
      const tools = await createWorkspaceTools(workspace);
      return { workspace, grep: tools[WORKSPACE_TOOLS.FILESYSTEM.GREP] };
    }

    it('delegates to the native grep capability and does not walk or read files', async () => {
      const capFs = new CapabilityFilesystem(tempDir);
      const { workspace, grep } = await makeTools(capFs);

      const result = await grep.execute({ pattern: 'foo' }, { workspace });

      expect(capFs.grepCalls).toHaveLength(1);
      expect(capFs.readdirCalls).toHaveLength(0);
      // Only the .gitignore load reads a file host-side
      expect(capFs.readFileCalls).toEqual(['.gitignore']);
      expect(result).toContain('index.ts');
    });

    it('produces identical output to the fallback implementation', async () => {
      const capFs = new CapabilityFilesystem(tempDir);
      const plainFs = new LocalFilesystem({ basePath: tempDir });
      const { workspace: capWs, grep: capGrep } = await makeTools(capFs);
      const { workspace: plainWs, grep: plainGrep } = await makeTools(plainFs);

      for (const input of [
        { pattern: 'foo' },
        { pattern: 'foo', contextLines: 1 },
        { pattern: 'foo', maxCount: 1 },
        { pattern: 'FOO', caseSensitive: false },
        { pattern: 'foo', includeHidden: true },
        { pattern: 'foo', path: 'src/**/*.ts' },
        { pattern: 'foo', path: './src' },
      ]) {
        const native = await capGrep.execute(input, { workspace: capWs });
        const fallback = await plainGrep.execute(input, { workspace: plainWs });
        expect(native, JSON.stringify(input)).toEqual(fallback);
      }
    });

    it('applies gitignore filtering to native results', async () => {
      const capFs = new CapabilityFilesystem(tempDir);
      const { workspace, grep } = await makeTools(capFs);

      const result = await grep.execute({ pattern: 'foo' }, { workspace });

      // dist is gitignored — native results include it, host filter removes it
      expect(result).not.toContain('out.js');
    });

    it('excludes hidden files from native results by default', async () => {
      const capFs = new CapabilityFilesystem(tempDir);
      const { workspace, grep } = await makeTools(capFs);

      const result = await grep.execute({ pattern: 'foo' }, { workspace });
      expect(result).not.toContain('secret.ts');

      const withHidden = await grep.execute({ pattern: 'foo', includeHidden: true }, { workspace });
      expect(withHidden).toContain('secret.ts');
    });

    it('falls back to the host-side walk on UnsupportedGrepPatternError', async () => {
      const capFs = new CapabilityFilesystem(tempDir);
      capFs.grepError = new UnsupportedGrepPatternError('\\bfoo\\b');
      const { workspace, grep } = await makeTools(capFs);

      const result = await grep.execute({ pattern: 'foo' }, { workspace });

      expect(capFs.grepCalls).toHaveLength(1);
      expect(capFs.readdirCalls.length).toBeGreaterThan(0);
      expect(result).toContain('index.ts');
    });
  });
});
