import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { WORKSPACE_TOOLS } from '../../constants';
import { LocalFilesystem } from '../../filesystem';
import { Workspace } from '../../workspace';
import { createWorkspaceTools } from '../tools';

describe('workspace_lsp_inspect', () => {
  let tempDir: string;
  let workspace: Workspace;
  let tools: ReturnType<typeof createWorkspaceTools>;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lsp-inspect-test-'));
    workspace = new Workspace({
      id: 'test-ws',
      name: 'Test',
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    tools = createWorkspaceTools(workspace);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should return error when no <<< marker found', async () => {
    await fs.writeFile(path.join(tempDir, 'test.ts'), 'const foo = 1');

    const result = await tools[WORKSPACE_TOOLS.LSP.LSP_INSPECT].execute(
      { path: 'test.ts', line: 1, match: 'const foo = 1' },
      { workspace },
    );

    expect(result).toEqual({
      error: 'No <<< cursor marker found in match',
    });
  });

  it('should return error when multiple <<< markers found', async () => {
    await fs.writeFile(path.join(tempDir, 'test.ts'), 'const foo = 1');

    const result = await tools[WORKSPACE_TOOLS.LSP.LSP_INSPECT].execute(
      { path: 'test.ts', line: 1, match: '<<<const<<< foo = 1' },
      { workspace },
    );

    expect(result).toEqual({
      error: 'Multiple <<< markers found (found 2, expected 1)',
    });
  });

  it('should return error when workspace has no LSP configured', async () => {
    await fs.writeFile(path.join(tempDir, 'test.ts'), 'const foo = 1');

    // Create workspace without LSP
    const wsNoLsp = new Workspace({
      id: 'test-ws-no-lsp',
      name: 'Test No LSP',
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    const toolsNoLsp = createWorkspaceTools(wsNoLsp);

    const result = await toolsNoLsp[WORKSPACE_TOOLS.LSP.LSP_INSPECT].execute(
      { path: 'test.ts', line: 1, match: 'const foo <<< = 1' },
      { workspace: wsNoLsp },
    );

    expect(result).toEqual({
      error: 'LSP is not configured for this workspace. Enable LSP in workspace config to use this tool.',
    });
  });

  it('should parse cursor position from <<< marker', async () => {
    await fs.writeFile(path.join(tempDir, 'test.ts'), 'const foo = 1');

    // Mock the LSP manager
    const mockClient = {
      queryHover: vi.fn().mockResolvedValue(null),
      queryDefinition: vi.fn().mockResolvedValue([]),
      queryTypeDefinition: vi.fn().mockResolvedValue([]),
      queryImplementation: vi.fn().mockResolvedValue([]),
      notifyClose: vi.fn(),
      serverName: 'typescript',
    };

    const mockLsp = {
      root: tempDir,
      getDiagnostics: vi.fn().mockResolvedValue([]),
      prepareQuery: vi.fn().mockResolvedValue({
        client: mockClient,
        uri: `file://${tempDir}/test.ts`,
        languageId: 'typescript',
        serverName: 'typescript',
      }),
    };

    Object.defineProperty(workspace, 'lsp', { get: () => mockLsp });

    const result = await tools[WORKSPACE_TOOLS.LSP.LSP_INSPECT].execute(
      { path: 'test.ts', line: 1, match: 'const foo <<< = 1' },
      { workspace },
    );

    expect(result).toMatchObject({});

    // Verify prepareQuery was called with correct path
    expect(mockLsp.prepareQuery).toHaveBeenCalled();

    // Verify notifyClose was called
    expect(mockClient.notifyClose).toHaveBeenCalled();
  });

  it('should return hover information when available', async () => {
    await fs.writeFile(path.join(tempDir, 'test.ts'), 'const foo: string = "hello"');

    const mockClient = {
      queryHover: vi.fn().mockResolvedValue({
        contents: {
          value: '```ts\nconst foo: string\n```',
          kind: 'markdown',
        },
      }),
      queryDefinition: vi.fn().mockResolvedValue([]),
      queryTypeDefinition: vi.fn().mockResolvedValue([]),
      queryImplementation: vi.fn().mockResolvedValue([]),
      notifyClose: vi.fn(),
      serverName: 'typescript',
    };

    const mockLsp = {
      root: tempDir,
      getDiagnostics: vi.fn().mockResolvedValue([]),
      prepareQuery: vi.fn().mockResolvedValue({
        client: mockClient,
        uri: `file://${tempDir}/test.ts`,
        languageId: 'typescript',
        serverName: 'typescript',
      }),
    };

    Object.defineProperty(workspace, 'lsp', { get: () => mockLsp });

    const result = await tools[WORKSPACE_TOOLS.LSP.LSP_INSPECT].execute(
      { path: 'test.ts', line: 1, match: 'const foo: string <<< = "hello"' },
      { workspace },
    );

    expect(result).toMatchObject({
      hover: {
        value: '```ts\nconst foo: string\n```',
        kind: 'markdown',
      },
    });
  });

  it('should handle definition locations', async () => {
    await fs.writeFile(path.join(tempDir, 'test.ts'), 'const foo = 1\nconst bar = 2\nconst baz = 3');

    const mockClient = {
      queryHover: vi.fn().mockResolvedValue(null),
      queryDefinition: vi.fn().mockResolvedValue([
        {
          uri: `file://${tempDir}/test.ts`,
          range: { start: { line: 2, character: 0 }, end: { line: 2, character: 9 } },
        },
      ]),
      queryTypeDefinition: vi.fn().mockResolvedValue([]),
      queryImplementation: vi.fn().mockResolvedValue([]),
      notifyClose: vi.fn(),
      serverName: 'typescript',
    };

    const mockLsp = {
      root: tempDir,
      getDiagnostics: vi.fn().mockResolvedValue([]),
      prepareQuery: vi.fn().mockResolvedValue({
        client: mockClient,
        uri: `file://${tempDir}/test.ts`,
        languageId: 'typescript',
        serverName: 'typescript',
      }),
    };

    Object.defineProperty(workspace, 'lsp', { get: () => mockLsp });

    const result = await tools[WORKSPACE_TOOLS.LSP.LSP_INSPECT].execute(
      { path: 'test.ts', line: 1, match: 'const <<<foo = 1' },
      { workspace },
    );

    expect(result).toMatchObject({
      definition: [{ location: expect.stringContaining('test.ts'), preview: expect.any(String) }],
    });
  });

  it('should return diagnostics for the inspected line', async () => {
    await fs.writeFile(path.join(tempDir, 'test.ts'), 'const foo: string = 42\nconst bar = true');

    const mockClient = {
      queryHover: vi.fn().mockResolvedValue(null),
      queryDefinition: vi.fn().mockResolvedValue([]),
      queryImplementation: vi.fn().mockResolvedValue([]),
      notifyClose: vi.fn(),
      serverName: 'typescript',
    };

    const mockLsp = {
      root: tempDir,
      getDiagnostics: vi.fn().mockResolvedValue([
        {
          severity: 'error',
          message: "Type 'number' is not assignable to type 'string'.",
          line: 1,
          character: 7,
          source: 'typescript',
        },
        {
          severity: 'warning',
          message: 'Unused variable bar',
          line: 2,
          character: 7,
          source: 'typescript',
        },
      ]),
      prepareQuery: vi.fn().mockResolvedValue({
        client: mockClient,
        uri: `file://${tempDir}/test.ts`,
        languageId: 'typescript',
        serverName: 'typescript',
      }),
    };

    Object.defineProperty(workspace, 'lsp', { get: () => mockLsp });

    const result = await tools[WORKSPACE_TOOLS.LSP.LSP_INSPECT].execute(
      { path: 'test.ts', line: 1, match: 'const foo: <<<string = 42' },
      { workspace },
    );

    expect(result).toMatchObject({
      diagnostics: [
        {
          severity: 'error',
          message: "Type 'number' is not assignable to type 'string'.",
          source: 'typescript',
        },
      ],
    });
    expect(mockLsp.getDiagnostics).toHaveBeenCalled();
  });

  it('should handle prepareQuery returning null (no server available)', async () => {
    await fs.writeFile(path.join(tempDir, 'test.ts'), 'const foo = 1');

    const mockLsp = {
      root: tempDir,
      prepareQuery: vi.fn().mockResolvedValue(null),
    };

    Object.defineProperty(workspace, 'lsp', { get: () => mockLsp });

    const result = await tools[WORKSPACE_TOOLS.LSP.LSP_INSPECT].execute(
      { path: 'test.ts', line: 1, match: 'const foo <<< = 1' },
      { workspace },
    );

    expect(result).toEqual({
      error: `No language server available for files of this type: test.ts`,
    });
  });

  it('should handle prepareQuery throwing an error', async () => {
    await fs.writeFile(path.join(tempDir, 'test.ts'), 'const foo = 1');

    const mockLsp = {
      root: tempDir,
      prepareQuery: vi.fn().mockRejectedValue(new Error('Connection failed')),
    };

    Object.defineProperty(workspace, 'lsp', { get: () => mockLsp });

    const result = await tools[WORKSPACE_TOOLS.LSP.LSP_INSPECT].execute(
      { path: 'test.ts', line: 1, match: 'const foo <<< = 1' },
      { workspace },
    );

    expect(result).toEqual({
      error: 'Failed to initialize LSP client: Connection failed',
    });
  });

  it('should handle plain text hover content', async () => {
    await fs.writeFile(path.join(tempDir, 'test.ts'), 'const foo = 1');

    const mockClient = {
      queryHover: vi.fn().mockResolvedValue({
        contents: 'const foo: number',
      }),
      queryDefinition: vi.fn().mockResolvedValue([]),
      queryTypeDefinition: vi.fn().mockResolvedValue([]),
      queryImplementation: vi.fn().mockResolvedValue([]),
      notifyClose: vi.fn(),
      serverName: 'typescript',
    };

    const mockLsp = {
      root: tempDir,
      getDiagnostics: vi.fn().mockResolvedValue([]),
      prepareQuery: vi.fn().mockResolvedValue({
        client: mockClient,
        uri: `file://${tempDir}/test.ts`,
        languageId: 'typescript',
        serverName: 'typescript',
      }),
    };

    Object.defineProperty(workspace, 'lsp', { get: () => mockLsp });

    const result = await tools[WORKSPACE_TOOLS.LSP.LSP_INSPECT].execute(
      { path: 'test.ts', line: 1, match: 'const foo <<< = 1' },
      { workspace },
    );

    expect(result).toMatchObject({
      hover: {
        value: 'const foo: number',
        kind: 'plaintext',
      },
    });
  });
});
