import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { WORKSPACE_TOOLS } from '../../constants';
import { LocalFilesystem } from '../../filesystem';
import { Workspace } from '../../workspace';
import { createWorkspaceTools } from '../tools';

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
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.SEARCH.GREP].execute({ pattern: 'foo' });

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
    const tools = createWorkspaceTools(workspace);

    const sensitive = await tools[WORKSPACE_TOOLS.SEARCH.GREP].execute({
      pattern: 'hello',
      caseSensitive: true,
    });
    expect(sensitive).toContain('1 match across 1 file');

    const insensitive = await tools[WORKSPACE_TOOLS.SEARCH.GREP].execute({
      pattern: 'hello',
      caseSensitive: false,
    });
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
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.SEARCH.GREP].execute({
      pattern: 'target',
      path: '/a',
    });

    expect(result).toContain('1 match across 1 file');
    expect(result).toContain('/a/file.ts');
  });

  it('should filter files by glob pattern', async () => {
    await fs.writeFile(path.join(tempDir, 'app.ts'), 'match here');
    await fs.writeFile(path.join(tempDir, 'app.js'), 'match here');
    await fs.writeFile(path.join(tempDir, 'style.css'), 'match here');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.SEARCH.GREP].execute({
      pattern: 'match',
      glob: '*.ts',
    });

    expect(result).toContain('1 match across 1 file');
    expect(result).toContain('app.ts');
    expect(result).not.toContain('app.js');
  });

  it('should include context lines', async () => {
    await fs.writeFile(path.join(tempDir, 'ctx.ts'), 'line1\nline2\nTARGET\nline4\nline5');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.SEARCH.GREP].execute({
      pattern: 'TARGET',
      contextLines: 2,
    });

    expect(result).toContain('1 match across 1 file');
    expect(result).toContain('ctx.ts:1- line1');
    expect(result).toContain('ctx.ts:2- line2');
    expect(result).toContain('ctx.ts:3:');
    expect(result).toContain('ctx.ts:4- line4');
    expect(result).toContain('ctx.ts:5- line5');
  });

  it('should truncate at maxResults', async () => {
    const lines = Array.from({ length: 200 }, (_, i) => `match_${i}`).join('\n');
    await fs.writeFile(path.join(tempDir, 'big.ts'), lines);
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.SEARCH.GREP].execute({
      pattern: 'match_',
      maxResults: 10,
    });

    expect(result).toContain('10 matches across 1 file');
    expect(result).toContain('(truncated at 10)');
  });

  it('should return error for invalid regex', async () => {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.SEARCH.GREP].execute({
      pattern: '[invalid',
    });

    expect(result).toContain('Error: Invalid regex');
  });

  it('should reject excessively long patterns', async () => {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.SEARCH.GREP].execute({
      pattern: 'a'.repeat(1001),
    });

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
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.SEARCH.GREP].execute({
      pattern: 'match',
      glob: '**/*.ts',
    });

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
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.SEARCH.GREP].execute({
      pattern: 'match',
      glob: '*.{ts,js}',
    });

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
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.SEARCH.GREP].execute({ pattern: 'findme' });

    expect(result).toContain('1 match across 1 file');
    expect(result).toContain('code.ts');
  });

  it('should work with empty directories', async () => {
    await fs.mkdir(path.join(tempDir, 'empty'), { recursive: true });
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.SEARCH.GREP].execute({
      pattern: 'anything',
      path: '/empty',
    });

    expect(result).toContain('0 matches across 0 files');
  });

  it('should search a single file when path points to a file', async () => {
    await fs.writeFile(path.join(tempDir, 'target.md'), '# Heading\n## Sub\nsome text');
    await fs.writeFile(path.join(tempDir, 'other.md'), '# Other Heading');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.SEARCH.GREP].execute({
      pattern: '^#',
      path: '/target.md',
    });

    expect(result).toContain('2 matches across 1 file');
    expect(result).toContain('/target.md');
    expect(result).not.toContain('/other.md');
  });

  it('should report correct column for match', async () => {
    await fs.writeFile(path.join(tempDir, 'col.ts'), '    findme here');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.SEARCH.GREP].execute({ pattern: 'findme' });

    // Format: file:line:column: content
    expect(result).toContain('col.ts:1:5:');
  });

  it('should skip hidden files by default', async () => {
    await fs.writeFile(path.join(tempDir, '.hidden.ts'), 'const SECRET = "hidden"');
    await fs.writeFile(path.join(tempDir, 'visible.ts'), 'const SECRET = "visible"');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.SEARCH.GREP].execute({ pattern: 'SECRET' });

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
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.SEARCH.GREP].execute({
      pattern: 'SECRET',
      includeHidden: true,
    });

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
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.SEARCH.GREP].execute({
      pattern: 'key',
      includeHidden: true,
    });

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
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.SEARCH.GREP].execute({
      pattern: 'hidden',
      glob: '.*rc.json',
      includeHidden: true,
    });

    expect(result).toContain('2 matches across 2 files');
    expect(result).toContain('.eslintrc.json');
    expect(result).toContain('.prettierrc.json');
    expect(result).not.toContain('tsconfig.json');
  });
});
