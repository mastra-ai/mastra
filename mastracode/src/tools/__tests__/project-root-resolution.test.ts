import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createAstSmartEditTool } from '../ast-smart-edit.js';
import { createStringReplaceLspTool } from '../string-replace-lsp.js';
import { createWriteFileTool } from '../write.js';

const tmpDirs: string[] = [];

interface ToolTextResult {
  content: Array<{ text: string }>;
}

interface ToolSuccessResult {
  success: boolean;
}

interface ToolErrorFlagResult {
  isError: boolean;
}

function isToolTextResult(result: unknown): result is ToolTextResult {
  if (!result || typeof result !== 'object') return false;
  const value = result as { content?: unknown };
  if (!Array.isArray(value.content)) return false;
  const first = value.content[0] as { text?: unknown } | undefined;
  return typeof first?.text === 'string';
}

function isToolSuccessResult(result: unknown): result is ToolSuccessResult {
  if (!result || typeof result !== 'object') return false;
  return typeof (result as { success?: unknown }).success === 'boolean';
}

function isToolErrorFlagResult(result: unknown): result is ToolErrorFlagResult {
  if (!result || typeof result !== 'object') return false;
  return typeof (result as { isError?: unknown }).isError === 'boolean';
}

function createTempProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mastracode-tools-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('tool project-root path resolution', () => {
  it('resolves string_replace_lsp paths relative to the provided project root', async () => {
    const projectRoot = createTempProject();
    const filePath = path.join(projectRoot, 'relative-target.ts');
    fs.writeFileSync(filePath, 'export const count = 1;\n', 'utf-8');

    const tool = createStringReplaceLspTool(projectRoot);
    const result = await tool.execute({
      path: 'relative-target.ts',
      old_str: 'export const count = 1;',
      new_str: 'export const count = 2;',
    });

    expect(isToolTextResult(result)).toBe(true);
    if (!isToolTextResult(result)) {
      throw new Error('Unexpected result shape from string_replace_lsp');
    }
    expect(result.content[0]?.text).toContain('has been edited');
    expect(fs.readFileSync(filePath, 'utf-8')).toContain('export const count = 2;');
  });

  it('resolves ast_smart_edit paths relative to the provided project root', async () => {
    const projectRoot = createTempProject();
    const filePath = path.join(projectRoot, 'rename.ts');
    fs.writeFileSync(filePath, 'const oldName = 1;\nconsole.log(oldName);\n', 'utf-8');

    const tool = createAstSmartEditTool(projectRoot);
    const result = await tool.execute({
      path: 'rename.ts',
      transform: 'rename-variable',
      targetName: 'oldName',
      newName: 'newName',
    });

    expect(isToolSuccessResult(result)).toBe(true);
    if (!isToolSuccessResult(result)) {
      throw new Error('Unexpected result shape from ast_smart_edit');
    }
    expect(result.success).toBe(true);
    expect(fs.readFileSync(filePath, 'utf-8')).toContain('newName');
    expect(fs.readFileSync(filePath, 'utf-8')).not.toContain('oldName');
  });

  it('resolves write_file paths relative to the provided project root', async () => {
    const projectRoot = createTempProject();
    const targetPath = path.join(projectRoot, 'nested', 'created.txt');

    const tool = createWriteFileTool(projectRoot);
    const result = await tool.execute({
      path: 'nested/created.txt',
      content: 'created from write_file',
    });

    expect(isToolErrorFlagResult(result)).toBe(true);
    if (!isToolErrorFlagResult(result)) {
      throw new Error('Unexpected result shape from write_file');
    }
    expect(result.isError).toBe(false);
    expect(fs.readFileSync(targetPath, 'utf-8')).toBe('created from write_file');
  });

});
