import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type { IMastraLogger } from '../../../logger';
import { WORKSPACE_TOOLS } from '../../constants';
import { UnsupportedGrepPatternError } from '../../errors';
import { LocalFilesystem } from '../../filesystem';
import type { FilesystemGrepOptions, FilesystemGrepResult } from '../../filesystem';
import { Workspace } from '../../workspace';
import { createWorkspaceTools } from '../tools';

const GREP_FILESYSTEM_CONCURRENCY = 8;

class DelayedLocalFilesystem extends LocalFilesystem {
  private inFlightReaddir = 0;
  private inFlightReadFile = 0;
  maxInFlightReaddir = 0;
  maxInFlightReadFile = 0;
  readFileCalls: string[] = [];

  async readdir(inputPath: string, options?: Parameters<LocalFilesystem['readdir']>[1]) {
    this.inFlightReaddir++;
    this.maxInFlightReaddir = Math.max(this.maxInFlightReaddir, this.inFlightReaddir);
    try {
      await new Promise(resolve => setTimeout(resolve, inputPath.endsWith('slow') ? 15 : 5));
      return await super.readdir(inputPath, options);
    } finally {
      this.inFlightReaddir--;
    }
  }

  async readFile(inputPath: string, options?: Parameters<LocalFilesystem['readFile']>[1]) {
    this.readFileCalls.push(inputPath);
    this.inFlightReadFile++;
    this.maxInFlightReadFile = Math.max(this.maxInFlightReadFile, this.inFlightReadFile);
    try {
      const delay = inputPath.includes('slow') ? 15 : 5;
      await new Promise(resolve => setTimeout(resolve, delay));
      return await super.readFile(inputPath, options);
    } finally {
      this.inFlightReadFile--;
    }
  }
}

/**
 * LocalFilesystem that throws for configured paths, to exercise the tool's
 * error-handling without relying on real permission bits (flaky under CI/root).
 */
class FailingLocalFilesystem extends LocalFilesystem {
  failStatFor?: (p: string) => boolean;
  failReaddirFor?: (p: string) => boolean;
  failReadFileFor?: (p: string) => boolean;
  errorCode?: string;

  private makeError(message: string): Error {
    const err = new Error(message);
    if (this.errorCode) (err as NodeJS.ErrnoException).code = this.errorCode;
    return err;
  }

  async stat(inputPath: string, options?: Parameters<LocalFilesystem['stat']>[1]) {
    if (this.failStatFor?.(inputPath)) throw this.makeError(`stat failed: ${inputPath}`);
    return super.stat(inputPath, options);
  }

  async readdir(inputPath: string, options?: Parameters<LocalFilesystem['readdir']>[1]) {
    if (this.failReaddirFor?.(inputPath)) throw this.makeError(`readdir failed: ${inputPath}`);
    return super.readdir(inputPath, options);
  }

  async readFile(inputPath: string, options?: Parameters<LocalFilesystem['readFile']>[1]) {
    if (this.failReadFileFor?.(inputPath)) throw this.makeError(`readFile failed: ${inputPath}`);
    return super.readFile(inputPath, options);
  }
}

describe('workspace_grep', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-tools-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should find basic regex matches across files', async () => {
    await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'src', 'main.ts'), 'const foo = 1;\nconst bar = 2;\nconst fooBar = 3;');
    await fs.writeFile(path.join(tempDir, 'src', 'util.ts'), 'export function foo() {}\nexport function bar() {}');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute({ pattern: 'foo' }, { workspace });

    expect(typeof result).toBe('string');
    expect(result).toContain('3 matches across 2 files');
    expect(result).toContain('main.ts:1:');
    expect(result).toContain('const foo = 1;');
  });

  it('should support case-insensitive search', async () => {
    await fs.writeFile(path.join(tempDir, 'test.ts'), 'Hello World\nhello world\nHELLO WORLD');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const sensitive = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(
      {
        pattern: 'hello',
        caseSensitive: true,
      },
      { workspace },
    );
    expect(sensitive).toContain('1 match across 1 file');

    const insensitive = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(
      {
        pattern: 'hello',
        caseSensitive: false,
      },
      { workspace },
    );
    expect(insensitive).toContain('3 matches across 1 file');
  });

  it('should scope search to a subdirectory via path', async () => {
    await fs.mkdir(path.join(tempDir, 'a'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'b'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'a', 'file.ts'), 'target');
    await fs.writeFile(path.join(tempDir, 'b', 'file.ts'), 'target');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(
      {
        pattern: 'target',
        path: 'a',
      },
      { workspace },
    );

    expect(result).toContain('1 match across 1 file');
    expect(result).toContain('a/file.ts');
  });

  it('should filter files by glob pattern', async () => {
    await fs.writeFile(path.join(tempDir, 'app.ts'), 'match here');
    await fs.writeFile(path.join(tempDir, 'app.js'), 'match here');
    await fs.writeFile(path.join(tempDir, 'style.css'), 'match here');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(
      {
        pattern: 'match',
        path: '*.ts',
      },
      { workspace },
    );

    expect(result).toContain('1 match across 1 file');
    expect(result).toContain('app.ts');
    expect(result).not.toContain('app.js');
  });

  it('should include context lines', async () => {
    await fs.writeFile(path.join(tempDir, 'ctx.ts'), 'line1\nline2\nTARGET\nline4\nline5');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(
      {
        pattern: 'TARGET',
        contextLines: 2,
      },
      { workspace },
    );

    expect(result).toContain('1 match across 1 file');
    expect(result).toContain('ctx.ts:1- line1');
    expect(result).toContain('ctx.ts:2- line2');
    expect(result).toContain('ctx.ts:3:');
    expect(result).toContain('ctx.ts:4- line4');
    expect(result).toContain('ctx.ts:5- line5');
  });

  it('should merge overlapping context windows without duplicating lines', async () => {
    await fs.writeFile(path.join(tempDir, 'f.ts'), 'MATCH_A\nx\nMATCH_B\ny\nz');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(
      {
        pattern: 'MATCH',
        path: 'f.ts',
        contextLines: 2,
      },
      { workspace },
    );

    expect(result).toBe(
      [
        '2 matches across 1 file',
        '---',
        'f.ts:1:1: MATCH_A',
        'f.ts:2- x',
        'f.ts:3:1: MATCH_B',
        'f.ts:4- y',
        'f.ts:5- z',
      ].join('\n'),
    );
  });

  it('should normalize fractional context lines before rendering context', async () => {
    await fs.writeFile(path.join(tempDir, 'fractional.ts'), 'before\nTARGET\nafter\nextra');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(
      {
        pattern: 'TARGET',
        path: 'fractional.ts',
        contextLines: 1.5,
      },
      { workspace },
    );

    expect(result).toBe(
      [
        '1 match across 1 file',
        '---',
        'fractional.ts:1- before',
        'fractional.ts:2:1: TARGET',
        'fractional.ts:3- after',
      ].join('\n'),
    );
  });

  it('should separate distinct context hunks without a trailing separator', async () => {
    await fs.writeFile(path.join(tempDir, 'split.ts'), 'TARGET_A\nctxA\ngap1\ngap2\nctxB\nTARGET_B');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(
      {
        pattern: 'TARGET',
        path: 'split.ts',
        contextLines: 1,
      },
      { workspace },
    );

    expect(result).toBe(
      [
        '2 matches across 1 file',
        '---',
        'split.ts:1:1: TARGET_A',
        'split.ts:2- ctxA',
        '--',
        'split.ts:5- ctxB',
        'split.ts:6:1: TARGET_B',
      ].join('\n'),
    );
  });

  it('should limit matches per file with maxCount', async () => {
    const lines = Array.from({ length: 200 }, (_, i) => `match_${i}`).join('\n');
    await fs.writeFile(path.join(tempDir, 'big.ts'), lines);
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(
      {
        pattern: 'match_',
        maxCount: 10,
      },
      { workspace },
    );

    expect(result).toContain('10 matches across 1 file');
  });

  it('should apply maxCount per file not globally', async () => {
    await fs.writeFile(path.join(tempDir, 'a.ts'), 'hit\nhit\nhit\nhit\nhit');
    await fs.writeFile(path.join(tempDir, 'b.ts'), 'hit\nhit\nhit\nhit\nhit');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(
      {
        pattern: 'hit',
        maxCount: 2,
      },
      { workspace },
    );

    // 2 per file × 2 files = 4 total
    expect(result).toContain('4 matches across 2 files');
  });

  it('should return error for invalid regex', async () => {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(
      {
        pattern: '[invalid',
      },
      { workspace },
    );

    expect(result).toContain('Error: Invalid regex');
  });

  it('should reject excessively long patterns', async () => {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(
      {
        pattern: 'a'.repeat(1001),
      },
      { workspace },
    );

    expect(result).toContain('Error: Pattern too long');
  });

  it('should support ** globstar patterns', async () => {
    await fs.mkdir(path.join(tempDir, 'src', 'utils'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), 'match');
    await fs.writeFile(path.join(tempDir, 'src', 'utils', 'helpers.ts'), 'match');
    await fs.writeFile(path.join(tempDir, 'src', 'style.css'), 'match');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(
      {
        pattern: 'match',
        path: '**/*.ts',
      },
      { workspace },
    );

    expect(result).toContain('2 matches across 2 files');
    expect(result).not.toContain('style.css');
  });

  it('should support brace expansion glob patterns', async () => {
    await fs.writeFile(path.join(tempDir, 'app.ts'), 'match');
    await fs.writeFile(path.join(tempDir, 'app.js'), 'match');
    await fs.writeFile(path.join(tempDir, 'style.css'), 'match');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(
      {
        pattern: 'match',
        path: '*.{ts,js}',
      },
      { workspace },
    );

    expect(result).toContain('2 matches across 2 files');
    expect(result).toContain('app.ts');
    expect(result).toContain('app.js');
    expect(result).not.toContain('style.css');
  });

  it('should skip binary/non-text files', async () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await fs.writeFile(path.join(tempDir, 'image.png'), buffer);
    await fs.writeFile(path.join(tempDir, 'code.ts'), 'findme');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute({ pattern: 'findme' }, { workspace });

    expect(result).toContain('1 match across 1 file');
    expect(result).toContain('code.ts');
  });

  it('should work with empty directories', async () => {
    await fs.mkdir(path.join(tempDir, 'empty'), { recursive: true });
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(
      {
        pattern: 'anything',
        path: 'empty',
      },
      { workspace },
    );

    expect(result).toContain('0 matches across 0 files');
  });

  it('should search a single file when path points to a file', async () => {
    await fs.writeFile(path.join(tempDir, 'target.md'), '# Heading\n## Sub\nsome text');
    await fs.writeFile(path.join(tempDir, 'other.md'), '# Other Heading');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(
      {
        pattern: '^#',
        path: 'target.md',
      },
      { workspace },
    );

    expect(result).toContain('2 matches across 1 file');
    expect(result).toContain('target.md');
    expect(result).not.toContain('other.md');
  });

  it('should report correct column for match', async () => {
    await fs.writeFile(path.join(tempDir, 'col.ts'), '    findme here');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute({ pattern: 'findme' }, { workspace });

    // Format: file:line:column: content
    expect(result).toContain('col.ts:1:5:');
  });

  it('should skip hidden files by default', async () => {
    await fs.writeFile(path.join(tempDir, '.hidden.ts'), 'const SECRET = "hidden"');
    await fs.writeFile(path.join(tempDir, 'visible.ts'), 'const SECRET = "visible"');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute({ pattern: 'SECRET' }, { workspace });

    expect(result).toContain('1 match across 1 file');
    expect(result).toContain('visible.ts');
    expect(result).not.toContain('.hidden.ts');
  });

  it('should include hidden files when includeHidden is true', async () => {
    await fs.writeFile(path.join(tempDir, '.hidden.ts'), 'const SECRET = "hidden"');
    await fs.writeFile(path.join(tempDir, 'visible.ts'), 'const SECRET = "visible"');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(
      {
        pattern: 'SECRET',
        includeHidden: true,
      },
      { workspace },
    );

    expect(result).toContain('2 matches across 2 files');
    expect(result).toContain('.hidden.ts');
    expect(result).toContain('visible.ts');
  });

  it('should include hidden directories when includeHidden is true', async () => {
    await fs.mkdir(path.join(tempDir, '.config'));
    await fs.writeFile(path.join(tempDir, '.config', 'settings.json'), '{"key": "value"}');
    await fs.writeFile(path.join(tempDir, 'app.ts'), 'const key = "value"');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(
      {
        pattern: 'key',
        includeHidden: true,
      },
      { workspace },
    );

    expect(result).toContain('2 matches across 2 files');
    expect(result).toContain('.config/settings.json');
    expect(result).toContain('app.ts');
  });

  it('should filter hidden files with glob when includeHidden is true', async () => {
    await fs.writeFile(path.join(tempDir, '.eslintrc.json'), '{"hidden": true}');
    await fs.writeFile(path.join(tempDir, '.prettierrc.json'), '{"hidden": true}');
    await fs.writeFile(path.join(tempDir, 'tsconfig.json'), '{"visible": true}');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(
      {
        pattern: 'hidden',
        path: '.*rc.json',
        includeHidden: true,
      },
      { workspace },
    );

    expect(result).toContain('2 matches across 2 files');
    expect(result).toContain('.eslintrc.json');
    expect(result).toContain('.prettierrc.json');
    expect(result).not.toContain('tsconfig.json');
  });

  it('should produce clean paths with default ./ root', async () => {
    await fs.writeFile(path.join(tempDir, 'hello.ts'), 'findme');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute({ pattern: 'findme' }, { workspace });

    // Should be ./hello.ts, not .//hello.ts
    expect(result).toContain('./hello.ts:1:');
    expect(result).not.toContain('.//');
  });

  it('should support combined path + glob pattern', async () => {
    await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'lib'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'src', 'app.ts'), 'target');
    await fs.writeFile(path.join(tempDir, 'src', 'style.css'), 'target');
    await fs.writeFile(path.join(tempDir, 'lib', 'util.ts'), 'target');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(
      {
        pattern: 'target',
        path: 'src/**/*.ts',
      },
      { workspace },
    );

    // Should only match .ts files under src/, not lib/ or .css
    expect(result).toContain('1 match across 1 file');
    expect(result).toContain('src/app.ts');
    expect(result).not.toContain('style.css');
    expect(result).not.toContain('lib/');
  });

  it('should bound concurrent directory listings and file reads while preserving output order', async () => {
    for (const directory of ['fast-a', 'slow', 'fast-b']) {
      await fs.mkdir(path.join(tempDir, directory), { recursive: true });
      for (let index = 0; index < 4; index++) {
        await fs.writeFile(path.join(tempDir, directory, `file-${index}.ts`), `target ${directory} ${index}`);
      }
    }

    const filesystem = new DelayedLocalFilesystem({ basePath: tempDir });
    const workspace = new Workspace({ filesystem });
    const tools = await createWorkspaceTools(workspace);

    const result = (await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(
      { pattern: 'target' },
      { workspace },
    )) as string;

    expect(result).toContain('12 matches across 12 files');
    expect(filesystem.maxInFlightReaddir).toBeGreaterThan(1);
    expect(filesystem.maxInFlightReaddir).toBeLessThanOrEqual(GREP_FILESYSTEM_CONCURRENCY);
    expect(filesystem.maxInFlightReadFile).toBeGreaterThan(1);
    expect(filesystem.maxInFlightReadFile).toBeLessThanOrEqual(GREP_FILESYSTEM_CONCURRENCY);
    expect(result.indexOf('./fast-a/file-0.ts')).toBeLessThan(result.indexOf('./fast-b/file-0.ts'));
    expect(result.indexOf('./fast-b/file-0.ts')).toBeLessThan(result.indexOf('./slow/file-0.ts'));
  });

  it('should stop scheduling file reads after reaching the internal global cap', async () => {
    const lines = Array.from({ length: 100 }, (_, i) => `line_${i}`).join('\n');
    for (let index = 0; index < 24; index++) {
      await fs.writeFile(path.join(tempDir, `file-${String(index).padStart(2, '0')}.ts`), lines);
    }

    const filesystem = new DelayedLocalFilesystem({ basePath: tempDir });
    const workspace = new Workspace({ filesystem });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute({ pattern: 'line_' }, { workspace });

    expect(result).toContain('1000 matches across 10 files');
    expect(result).toContain('(truncated at 1000)');
    const searchedFileCalls = filesystem.readFileCalls.filter(filePath => filePath.endsWith('.ts'));
    expect(searchedFileCalls.length).toBeGreaterThanOrEqual(10);
    expect(searchedFileCalls.length).toBeLessThanOrEqual(16);
  });

  it('should truncate at internal global cap', async () => {
    // Create a file with more lines than the global cap (1000)
    const lines = Array.from({ length: 1100 }, (_, i) => `line_${i}`).join('\n');
    await fs.writeFile(path.join(tempDir, 'huge.ts'), lines);
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(
      {
        pattern: 'line_',
      },
      { workspace },
    );

    expect(result).toContain('1000 matches across 1 file');
    expect(result).toContain('(truncated at 1000)');
  });

  it('should apply token limit to output', async () => {
    // Create a file with many lines that will exceed default token limit (~3k tokens)
    // Each line has ~5 words => ~7 tokens. 1000 lines => ~7000 tokens (well over 3k)
    const lines = Array.from({ length: 1000 }, (_, i) => `match_${i} some extra words here`).join('\n');
    await fs.writeFile(path.join(tempDir, 'big.ts'), lines);
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = (await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(
      {
        pattern: 'match_',
      },
      { workspace },
    )) as string;

    expect(result).toContain('[output truncated');
    // Summary should appear before matches (survives end-truncation)
    const summaryIndex = result.indexOf('matches across');
    const firstMatchIndex = result.indexOf('match_');
    expect(summaryIndex).toBeLessThan(firstMatchIndex);
  });

  it('should respect .gitignore when searching from root', async () => {
    await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'dist'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'src', 'app.ts'), 'findme');
    await fs.writeFile(path.join(tempDir, 'dist', 'app.js'), 'findme');
    await fs.writeFile(path.join(tempDir, '.gitignore'), 'dist/\n');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(
      { pattern: 'findme', includeHidden: true },
      { workspace },
    );

    expect(result).toContain('1 match across 1 file');
    expect(result).toContain('src/app.ts');
    expect(result).not.toContain('dist/app.js');
  });

  it('should still search an ignored directory when explicitly targeted', async () => {
    await fs.mkdir(path.join(tempDir, 'dist'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'dist', 'app.js'), 'findme');
    await fs.writeFile(path.join(tempDir, '.gitignore'), 'dist/\n');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(
      { pattern: 'findme', path: 'dist' },
      { workspace },
    );

    expect(result).toContain('1 match across 1 file');
    expect(result).toContain('dist/app.js');
  });

  it('should still apply gitignore when targeting a non-ignored subdirectory', async () => {
    await fs.mkdir(path.join(tempDir, 'src', 'dist'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'src', 'app.ts'), 'findme');
    await fs.writeFile(path.join(tempDir, 'src', 'dist', 'generated.js'), 'findme');
    await fs.writeFile(path.join(tempDir, '.gitignore'), 'dist/\n');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(
      { pattern: 'findme', path: 'src' },
      { workspace },
    );

    expect(result).toContain('1 match across 1 file');
    expect(result).toContain('src/app.ts');
    expect(result).not.toContain('generated.js');
  });

  it('applies .gitignore files below the workspace root, relative to their directory', async () => {
    // Multi-repo layout: no root .gitignore, each repository has its own.
    await fs.mkdir(path.join(tempDir, 'repo', 'src'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'repo', 'build'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'repo', 'pkg', 'build'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'repo', 'pkg', 'gen'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'repo', '.gitignore'), '/build\n');
    await fs.writeFile(path.join(tempDir, 'repo', 'pkg', '.gitignore'), 'gen/\n');
    await fs.writeFile(path.join(tempDir, 'repo', 'src', 'app.ts'), 'findme');
    await fs.writeFile(path.join(tempDir, 'repo', 'build', 'out.js'), 'findme');
    // `/build` is anchored to repo/, so pkg/build is not ignored.
    await fs.writeFile(path.join(tempDir, 'repo', 'pkg', 'build', 'keep.ts'), 'findme');
    await fs.writeFile(path.join(tempDir, 'repo', 'pkg', 'gen', 'generated.ts'), 'findme');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute({ pattern: 'findme' }, { workspace });

    expect(result).toContain('2 matches across 2 files');
    expect(result).toContain('repo/src/app.ts');
    expect(result).toContain('repo/pkg/build/keep.ts');
    expect(result).not.toContain('out.js');
    expect(result).not.toContain('generated.ts');
  });

  it('applies the .gitignore of a directory above the search path', async () => {
    await fs.mkdir(path.join(tempDir, 'repo', 'channels', 'discord', 'deps'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'repo', '.gitignore'), 'deps\n');
    await fs.writeFile(path.join(tempDir, 'repo', 'channels', 'discord', 'bot.ts'), 'isBot: true');
    await fs.writeFile(path.join(tempDir, 'repo', 'channels', 'discord', 'deps', 'lib.js'), 'isBot: false');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(
      { pattern: 'isBot:', path: 'repo/channels' },
      { workspace },
    );

    expect(result).toContain('1 match across 1 file');
    expect(result).toContain('repo/channels/discord/bot.ts');
    expect(result).not.toContain('lib.js');
  });

  it('skips node_modules without a .gitignore unless the search path points inside it', async () => {
    await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'node_modules', 'dep'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'src', 'app.ts'), 'findme');
    await fs.writeFile(path.join(tempDir, 'node_modules', 'dep', 'index.js'), 'findme');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);
    const grep = tools[WORKSPACE_TOOLS.FILESYSTEM.GREP];

    const fromRoot = await grep.execute({ pattern: 'findme' }, { workspace });
    const inside = await grep.execute({ pattern: 'findme', path: 'node_modules/dep' }, { workspace });

    expect(fromRoot).toContain('1 match across 1 file');
    expect(fromRoot).not.toContain('node_modules');
    expect(inside).toContain('1 match across 1 file');
    expect(inside).toContain('node_modules/dep/index.js');
  });

  it('filters native grep results with nested .gitignore files and node_modules', async () => {
    await fs.mkdir(path.join(tempDir, 'repo'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'repo', '.gitignore'), 'dist/\n');
    class NativeGrepFilesystem extends LocalFilesystem {
      async grep(): Promise<FilesystemGrepResult[]> {
        const match = [{ line: 1, column: 0, text: 'findme' }];
        return [
          { path: 'src/app.ts', matches: match },
          { path: 'dist/app.js', matches: match },
          { path: 'node_modules/dep/index.js', matches: match },
        ];
      }
    }
    const workspace = new Workspace({ filesystem: new NativeGrepFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(
      { pattern: 'findme', path: 'repo' },
      { workspace },
    );

    expect(result).toContain('1 match across 1 file');
    expect(result).toContain('repo/src/app.ts');
  });

  it('applies .gitignore files below the search path to native grep results', async () => {
    await fs.mkdir(path.join(tempDir, 'repo', 'pkg'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'repo', '.gitignore'), 'dist/\n');
    await fs.writeFile(path.join(tempDir, 'repo', 'pkg', '.gitignore'), 'gen/\n');
    class NativeGrepFilesystem extends LocalFilesystem {
      async grep(): Promise<FilesystemGrepResult[]> {
        const match = [{ line: 1, column: 0, text: 'findme' }];
        return [
          { path: 'repo/src/app.ts', matches: match },
          { path: 'repo/dist/app.js', matches: match },
          { path: 'repo/pkg/gen/out.ts', matches: match },
          { path: 'repo/pkg/src/lib.ts', matches: match },
        ];
      }
    }
    const workspace = new Workspace({ filesystem: new NativeGrepFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute({ pattern: 'findme' }, { workspace });

    expect(result).toContain('2 matches across 2 files');
    expect(result).toContain('repo/src/app.ts');
    expect(result).toContain('repo/pkg/src/lib.ts');
    expect(result).not.toContain('app.js');
    expect(result).not.toContain('out.ts');
  });

  it('lets a deeper .gitignore re-include what a parent ignores', async () => {
    await fs.mkdir(path.join(tempDir, 'repo', 'logs'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'repo', '.gitignore'), '*.log\n');
    await fs.writeFile(path.join(tempDir, 'repo', 'logs', '.gitignore'), '!keep.log\n');
    await fs.writeFile(path.join(tempDir, 'repo', 'logs', 'keep.log'), 'findme');
    await fs.writeFile(path.join(tempDir, 'repo', 'logs', 'drop.log'), 'findme');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir, textExtensions: ['.log'] }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute({ pattern: 'findme' }, { workspace });

    expect(result).toContain('1 match across 1 file');
    expect(result).toContain('repo/logs/keep.log');
    expect(result).not.toContain('drop.log');
  });

  it('should not search files with an unregistered extension by default', async () => {
    await fs.writeFile(path.join(tempDir, 'a.sasx'), 'findme');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute({ pattern: 'findme' }, { workspace });

    expect(result).toContain('0 matches across 0 files');
    expect(result).not.toContain('a.sasx');
  });

  it('should search files whose extension is registered via textExtensions', async () => {
    await fs.writeFile(path.join(tempDir, 'a.sasx'), 'findme');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir, textExtensions: ['.sasx'] }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute({ pattern: 'findme' }, { workspace });

    expect(result).toContain('1 match across 1 file');
    expect(result).toContain('a.sasx');
  });

  it('should search the newly built-in .sas / .log / .jsonl extensions', async () => {
    await fs.writeFile(path.join(tempDir, 'a.sas'), 'findme');
    await fs.writeFile(path.join(tempDir, 'b.log'), 'findme');
    await fs.writeFile(path.join(tempDir, 'c.jsonl'), 'findme');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute({ pattern: 'findme' }, { workspace });

    expect(result).toContain('3 matches across 3 files');
  });

  it('should report a skip when an explicit file has an unsupported extension', async () => {
    await fs.writeFile(path.join(tempDir, 'a.bin'), 'findme');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(
      { pattern: 'findme', path: 'a.bin' },
      { workspace },
    );

    expect(result).toContain('0 matches across 0 files');
    expect(result).toContain('1 file skipped: unsupported extension');
  });

  it('should not report skips for unsupported files during directory traversal', async () => {
    await fs.writeFile(path.join(tempDir, 'a.ts'), 'findme');
    await fs.writeFile(path.join(tempDir, 'b.bin'), 'findme');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute({ pattern: 'findme' }, { workspace });

    expect(result).toContain('1 match across 1 file');
    expect(result).not.toContain('skipped: unsupported extension');
  });

  describe('read-failure reporting', () => {
    it('reports when the target path cannot be resolved instead of silent 0 matches', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = await createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(
        { pattern: 'needle', path: 'does-not-exist' },
        { workspace },
      );

      expect(typeof result).toBe('string');
      expect(result).toContain('target path not found: nothing searched');
    });

    it('reports a non-missing target resolution failure as a read error, not "not found"', async () => {
      await fs.mkdir(path.join(tempDir, 'sub'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'sub', 'a.ts'), 'const needle = 1;');

      const filesystem = new FailingLocalFilesystem({ basePath: tempDir });
      filesystem.errorCode = 'EACCES';
      filesystem.failStatFor = p => p.endsWith('sub') || p === 'sub';
      const workspace = new Workspace({ filesystem });
      const tools = await createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(
        { pattern: 'needle', path: 'sub' },
        { workspace },
      );

      expect(result).toContain('path skipped: read error');
      expect(result).not.toContain('target path not found');
    });

    it('treats an ENOTDIR target resolution failure as a missing target, not a read error', async () => {
      await fs.writeFile(path.join(tempDir, 'file.ts'), 'const needle = 1;');
      const filesystem = new LocalFilesystem({ basePath: tempDir });
      const workspace = new Workspace({ filesystem });
      const tools = await createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(
        { pattern: 'needle', path: 'file.ts/missing' },
        { workspace },
      );

      expect(result).toContain('target path not found');
      expect(result).not.toContain('path skipped: read error');
    });

    it('reports a read error when a subdirectory cannot be listed but still searches the rest', async () => {
      await fs.mkdir(path.join(tempDir, 'good'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'bad'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'good', 'a.ts'), 'const needle = 1;');
      await fs.writeFile(path.join(tempDir, 'bad', 'b.ts'), 'const needle = 2;');

      const filesystem = new FailingLocalFilesystem({ basePath: tempDir });
      filesystem.failReaddirFor = p => p.endsWith('/bad') || p === 'bad' || p.endsWith('bad');
      const workspace = new Workspace({ filesystem });
      const tools = await createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute({ pattern: 'needle' }, { workspace });

      expect(result).toContain('path skipped: read error');
      expect(result).toContain('good/a.ts');
    });

    it('reports a read error when a file cannot be read but still returns other matches', async () => {
      await fs.writeFile(path.join(tempDir, 'a.ts'), 'const needle = 1;');
      await fs.writeFile(path.join(tempDir, 'b.ts'), 'const needle = 2;');

      const filesystem = new FailingLocalFilesystem({ basePath: tempDir });
      filesystem.failReadFileFor = p => p.endsWith('b.ts');
      const workspace = new Workspace({ filesystem });
      const tools = await createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute({ pattern: 'needle' }, { workspace });

      expect(result).toContain('1 match across 1 file');
      expect(result).toContain('path skipped: read error');
      expect(result).toContain('a.ts');
    });

    it('does not report skips or not-found on a clean search', async () => {
      await fs.writeFile(path.join(tempDir, 'a.ts'), 'const needle = 1;');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = await createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute({ pattern: 'needle' }, { workspace });

      expect(result).toContain('1 match across 1 file');
      expect(result).not.toContain('read error');
      expect(result).not.toContain('target path not found');
    });

    describe('strict mode', () => {
      it('throws when the target path cannot be resolved', async () => {
        const workspace = new Workspace({
          filesystem: new LocalFilesystem({ basePath: tempDir }),
        });
        const tools = await createWorkspaceTools(workspace, undefined, { grep: { strict: true } });

        await expect(
          tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute({ pattern: 'needle', path: 'does-not-exist' }, { workspace }),
        ).rejects.toThrow();
      });

      it('throws when a directory cannot be listed', async () => {
        await fs.mkdir(path.join(tempDir, 'bad'), { recursive: true });
        await fs.writeFile(path.join(tempDir, 'bad', 'b.ts'), 'const needle = 2;');

        const filesystem = new FailingLocalFilesystem({ basePath: tempDir });
        filesystem.failReaddirFor = p => p.endsWith('bad');
        const workspace = new Workspace({ filesystem });
        const tools = await createWorkspaceTools(workspace, undefined, { grep: { strict: true } });

        await expect(
          tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute({ pattern: 'needle' }, { workspace }),
        ).rejects.toThrow();
      });

      it('throws when a file cannot be read', async () => {
        await fs.writeFile(path.join(tempDir, 'a.ts'), 'const needle = 1;');

        const filesystem = new FailingLocalFilesystem({ basePath: tempDir });
        filesystem.failReadFileFor = p => p.endsWith('a.ts');
        const workspace = new Workspace({ filesystem });
        const tools = await createWorkspaceTools(workspace, undefined, { grep: { strict: true } });

        await expect(
          tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute({ pattern: 'needle' }, { workspace }),
        ).rejects.toThrow();
      });
    });

    describe('gitignore read failures', () => {
      it('propagates a non-ENOENT .gitignore read error instead of silently searching', async () => {
        await fs.writeFile(path.join(tempDir, 'a.ts'), 'const needle = 1;');

        const filesystem = new FailingLocalFilesystem({ basePath: tempDir });
        filesystem.errorCode = 'EACCES';
        filesystem.failReadFileFor = p => p.endsWith('.gitignore');
        const workspace = new Workspace({ filesystem });
        const tools = await createWorkspaceTools(workspace);

        await expect(
          tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute({ pattern: 'needle' }, { workspace }),
        ).rejects.toThrow();
      });

      it('still searches when .gitignore is simply absent', async () => {
        await fs.writeFile(path.join(tempDir, 'a.ts'), 'const needle = 1;');
        const workspace = new Workspace({
          filesystem: new LocalFilesystem({ basePath: tempDir }),
        });
        const tools = await createWorkspaceTools(workspace);

        const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute({ pattern: 'needle' }, { workspace });

        expect(result).toContain('1 match across 1 file');
      });
    });
  });
});

describe('workspace_grep host-side fallback', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-grep-fallback-'));
    await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
    for (let i = 0; i < 30; i++) {
      await fs.writeFile(path.join(tempDir, 'src', `file${String(i).padStart(2, '0')}.ts`), `const foo${i} = ${i};`);
    }
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  class FailingNativeGrepFilesystem extends LocalFilesystem {
    readFileCalls = 0;
    onReadFile?: (inputPath: string) => void;

    async grep(options: FilesystemGrepOptions): Promise<FilesystemGrepResult[]> {
      throw new UnsupportedGrepPatternError(options.pattern, 'timed out after 30s');
    }

    async readFile(inputPath: string, options?: Parameters<LocalFilesystem['readFile']>[1]) {
      this.readFileCalls++;
      this.onReadFile?.(inputPath);
      return super.readFile(inputPath, options);
    }
  }

  it('logs the native grep failure reason and returns fallback results', async () => {
    const filesystem = new FailingNativeGrepFilesystem({ basePath: tempDir });
    const workspace = new Workspace({ filesystem });
    const info = vi.fn();
    vi.spyOn(workspace, 'logger', 'get').mockReturnValue({ info, warn: vi.fn() } as unknown as IMastraLogger);
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute({ pattern: 'foo' }, { workspace });

    expect(info).toHaveBeenCalledWith(expect.stringContaining('timed out after 30s'));
    expect(result).toContain('30 matches across 30 files');
    expect(result).not.toContain('search incomplete');
  });

  it('stops the host-side walk once the time budget is spent and reports partial results', async () => {
    const filesystem = new FailingNativeGrepFilesystem({ basePath: tempDir });
    const realNow = Date.now.bind(Date);
    let offset = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => realNow() + offset);
    // Only source reads advance the clock; .gitignore is read before the walk starts.
    filesystem.onReadFile = inputPath => {
      if (inputPath.endsWith('.ts')) offset = 61_000;
    };
    const workspace = new Workspace({ filesystem });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute({ pattern: 'foo' }, { workspace });

    expect(result).toContain('search incomplete: host-side search stopped after 60s');
    expect(result).toMatch(/\d+ files? scanned/);
    expect(result).toContain('narrow the path or pattern');
    expect(filesystem.readFileCalls).toBeGreaterThan(0);
    expect(filesystem.readFileCalls).toBeLessThan(30);
  });

  it('stops the host-side walk when the run is aborted and reports partial results', async () => {
    const filesystem = new FailingNativeGrepFilesystem({ basePath: tempDir });
    const controller = new AbortController();
    filesystem.onReadFile = inputPath => {
      if (inputPath.endsWith('.ts')) controller.abort();
    };
    const workspace = new Workspace({ filesystem });
    const tools = await createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(
      { pattern: 'foo' },
      { workspace, abortSignal: controller.signal },
    );

    expect(result).toContain('search incomplete: aborted');
    expect(filesystem.readFileCalls).toBeGreaterThan(0);
    expect(filesystem.readFileCalls).toBeLessThan(30);
  });
});
