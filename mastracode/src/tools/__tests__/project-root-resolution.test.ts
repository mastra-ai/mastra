import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDynamicTools } from '../../agents/tools.js';
import { createAstSmartEditTool } from '../ast-smart-edit.js';
import { createStringReplaceLspTool } from '../string-replace-lsp.js';
import { createWriteFileTool } from '../write.js';

const tmpDirs: string[] = [];

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

    expect((result as any).content[0]?.text).toContain('has been edited');
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

    expect((result as any).success).toBe(true);
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

    expect((result as any).isError).toBe(false);
    expect(fs.readFileSync(targetPath, 'utf-8')).toBe('created from write_file');
  });

  it('wires dynamic edit tools to the project root from harness state', async () => {
    const projectRoot = createTempProject();
    const editableFile = path.join(projectRoot, 'dynamic.ts');
    const astFile = path.join(projectRoot, 'dynamic-ast.ts');
    const createdFile = path.join(projectRoot, 'nested', 'dynamic-created.txt');

    fs.writeFileSync(editableFile, 'export const value = 1;\n', 'utf-8');
    fs.writeFileSync(astFile, 'const oldName = 1;\nconsole.log(oldName);\n', 'utf-8');

    const requestContext = {
      get: (key: string) => {
        if (key !== 'harness') return undefined;
        return {
          modeId: 'build',
          getState: () => ({ projectPath: projectRoot }),
        };
      },
    } as any;

    const tools = createDynamicTools()({ requestContext });

    const replaceResult = await tools.string_replace_lsp.execute({
      path: 'dynamic.ts',
      old_str: 'export const value = 1;',
      new_str: 'export const value = 2;',
    });
    expect((replaceResult as any).content[0]?.text).toContain('has been edited');
    expect(fs.readFileSync(editableFile, 'utf-8')).toContain('export const value = 2;');

    const astResult = await tools.ast_smart_edit.execute({
      path: 'dynamic-ast.ts',
      transform: 'rename-variable',
      targetName: 'oldName',
      newName: 'newName',
    });
    expect((astResult as any).success).toBe(true);
    expect(fs.readFileSync(astFile, 'utf-8')).toContain('newName');

    const writeResult = await tools.write_file.execute({
      path: 'nested/dynamic-created.txt',
      content: 'dynamic tool write',
    });
    expect((writeResult as any).isError).toBe(false);
    expect(fs.readFileSync(createdFile, 'utf-8')).toBe('dynamic tool write');
  });
});
