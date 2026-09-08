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
  let tools: Awaited<ReturnType<typeof createWorkspaceTools>>;
  // lsp_inspect is only registered when the workspace has an active LSP manager,
  // so tests swap this stub in place of a real one.
  let lspStub: any;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lsp-inspect-test-'));
    workspace = new Workspace({
      id: 'test-ws',
      name: 'Test',
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });
    lspStub = {};
    Object.defineProperty(workspace, 'lsp', { get: () => lspStub, configurable: true });
    tools = await createWorkspaceTools(workspace);
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

  it('should not register the tool when the workspace has no LSP configured', async () => {
    const wsNoLsp = new Workspace({
      id: 'test-ws-no-lsp',
      name: 'Test No LSP',
      filesystem: new LocalFilesystem({ basePath: tempDir }),
    });

    const toolsNoLsp = await createWorkspaceTools(wsNoLsp);

    expect(toolsNoLsp[WORKSPACE_TOOLS.LSP.LSP_INSPECT]).toBeUndefined();
  });

  it('should return error when LSP goes away after the tool was registered', async () => {
    await fs.writeFile(path.join(tempDir, 'test.ts'), 'const foo = 1');
    lspStub = undefined;

    const result = await tools[WORKSPACE_TOOLS.LSP.LSP_INSPECT].execute(
      { path: 'test.ts', line: 1, match: 'const foo <<< = 1' },
      { workspace },
    );

    expect(result).toEqual({
      error: 'LSP is not configured for this workspace. Enable LSP in workspace config to use this tool.',
    });
  });

  it('should parse cursor position from <<< marker', async () => {
    await fs.writeFile(path.join(tempDir, 'test.ts'), 'const foo = 1');
    const mockRelease = vi.fn();

    // Mock the LSP manager
    const mockClient = {
      queryHover: vi.fn().mockResolvedValue(null),
      queryDefinition: vi.fn().mockResolvedValue([]),
      queryTypeDefinition: vi.fn().mockResolvedValue([]),
      queryImplementation: vi.fn().mockResolvedValue([]),
      notifyChange: vi.fn(),
      waitForDiagnostics: vi.fn().mockResolvedValue([]),
      notifyClose: vi.fn(),
      serverName: 'typescript',
    };

    const mockLsp = {
      root: tempDir,
      prepareQuery: vi.fn().mockResolvedValue({
        client: mockClient,
        uri: `file://${tempDir}/test.ts`,
        languageId: 'typescript',
        serverName: 'typescript',
        release: mockRelease,
      }),
    };

    lspStub = mockLsp;

    const result = await tools[WORKSPACE_TOOLS.LSP.LSP_INSPECT].execute(
      { path: 'test.ts', line: 1, match: 'const foo <<< = 1' },
      { workspace },
    );

    expect(result).toMatchObject({});

    // Verify prepareQuery was called with correct path
    expect(mockLsp.prepareQuery).toHaveBeenCalled();

    // Verify the document and client lease were released
    expect(mockClient.notifyClose).toHaveBeenCalled();
    expect(mockRelease).toHaveBeenCalledOnce();
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
      notifyChange: vi.fn(),
      waitForDiagnostics: vi.fn().mockResolvedValue([]),
      notifyClose: vi.fn(),
      serverName: 'typescript',
    };

    const mockLsp = {
      root: tempDir,
      prepareQuery: vi.fn().mockResolvedValue({
        client: mockClient,
        uri: `file://${tempDir}/test.ts`,
        languageId: 'typescript',
        serverName: 'typescript',
        release: vi.fn(),
      }),
    };

    lspStub = mockLsp;

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
      notifyChange: vi.fn(),
      waitForDiagnostics: vi.fn().mockResolvedValue([]),
      notifyClose: vi.fn(),
      serverName: 'typescript',
    };

    const mockLsp = {
      root: tempDir,
      prepareQuery: vi.fn().mockResolvedValue({
        client: mockClient,
        uri: `file://${tempDir}/test.ts`,
        languageId: 'typescript',
        serverName: 'typescript',
        release: vi.fn(),
      }),
    };

    lspStub = mockLsp;

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
      notifyChange: vi.fn(),
      waitForDiagnostics: vi.fn().mockResolvedValue([
        {
          severity: 1,
          message: "Type 'number' is not assignable to type 'string'.",
          range: { start: { line: 0, character: 6 } },
          source: 'typescript',
        },
        {
          message: 'Diagnostic without severity',
          range: { start: { line: 0, character: 0 } },
          source: 'typescript',
        },
        {
          severity: 2,
          message: 'Unused variable bar',
          range: { start: { line: 1, character: 6 } },
          source: 'typescript',
        },
      ]),
      notifyClose: vi.fn(),
      serverName: 'typescript',
    };

    const mockLsp = {
      root: tempDir,
      prepareQuery: vi.fn().mockResolvedValue({
        client: mockClient,
        uri: `file://${tempDir}/test.ts`,
        languageId: 'typescript',
        serverName: 'typescript',
        release: vi.fn(),
      }),
    };

    lspStub = mockLsp;

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
        {
          severity: 'error',
          message: 'Diagnostic without severity',
          source: 'typescript',
        },
      ],
    });
    expect(mockClient.notifyChange).toHaveBeenCalledWith(
      path.join(tempDir, 'test.ts'),
      'const foo: string = 42\nconst bar = true',
      1,
    );
    expect(mockClient.waitForDiagnostics).toHaveBeenCalledWith(path.join(tempDir, 'test.ts'), 5000, true);
  });

  it('should handle prepareQuery returning null (no server available)', async () => {
    await fs.writeFile(path.join(tempDir, 'test.ts'), 'const foo = 1');

    const mockLsp = {
      root: tempDir,
      prepareQuery: vi.fn().mockResolvedValue(null),
    };

    lspStub = mockLsp;

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

    lspStub = mockLsp;

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
      notifyChange: vi.fn(),
      waitForDiagnostics: vi.fn().mockResolvedValue([]),
      notifyClose: vi.fn(),
      serverName: 'typescript',
    };

    const mockLsp = {
      root: tempDir,
      prepareQuery: vi.fn().mockResolvedValue({
        client: mockClient,
        uri: `file://${tempDir}/test.ts`,
        languageId: 'typescript',
        serverName: 'typescript',
        release: vi.fn(),
      }),
    };

    lspStub = mockLsp;

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

  it('should preserve absolute input paths when filesystem resolution is unavailable', async () => {
    const absolutePath = path.join(tempDir, 'absolute.ts');
    await fs.writeFile(absolutePath, 'const foo = 1');

    const mockClient = {
      queryHover: vi.fn().mockResolvedValue(null),
      queryDefinition: vi.fn().mockResolvedValue([]),
      queryImplementation: vi.fn().mockResolvedValue([]),
      notifyChange: vi.fn(),
      waitForDiagnostics: vi.fn().mockResolvedValue([]),
      notifyClose: vi.fn(),
      serverName: 'typescript',
    };

    const mockLsp = {
      root: '/different-root',
      prepareQuery: vi.fn().mockResolvedValue({
        client: mockClient,
        uri: `file://${absolutePath}`,
        languageId: 'typescript',
        serverName: 'typescript',
        release: vi.fn(),
      }),
    };

    lspStub = mockLsp;
    Object.defineProperty(workspace, 'filesystem', { get: () => undefined });

    await tools[WORKSPACE_TOOLS.LSP.LSP_INSPECT].execute(
      { path: absolutePath, line: 1, match: 'const foo <<< = 1' },
      { workspace },
    );

    expect(mockLsp.prepareQuery).toHaveBeenCalledWith(absolutePath);
    expect(mockClient.notifyClose).toHaveBeenCalledWith(absolutePath);
  });

  it('should filter implementations that share the same file and line as definitions', async () => {
    await fs.writeFile(path.join(tempDir, 'test.ts'), 'const foo = 1\nconst bar = foo');

    const fileUri = `file://${path.join(tempDir, 'test.ts')}`;
    const mockClient = {
      queryHover: vi.fn().mockResolvedValue(null),
      queryDefinition: vi.fn().mockResolvedValue([
        {
          uri: fileUri,
          range: { start: { line: 1, character: 0 }, end: { line: 1, character: 3 } },
        },
      ]),
      queryImplementation: vi.fn().mockResolvedValue([
        {
          uri: fileUri,
          range: { start: { line: 1, character: 5 }, end: { line: 1, character: 8 } },
        },
      ]),
      notifyChange: vi.fn(),
      waitForDiagnostics: vi.fn().mockResolvedValue([]),
      notifyClose: vi.fn(),
      serverName: 'typescript',
    };

    const mockLsp = {
      root: tempDir,
      prepareQuery: vi.fn().mockResolvedValue({
        client: mockClient,
        uri: fileUri,
        languageId: 'typescript',
        serverName: 'typescript',
        release: vi.fn(),
      }),
    };

    lspStub = mockLsp;

    const result = await tools[WORKSPACE_TOOLS.LSP.LSP_INSPECT].execute(
      { path: 'test.ts', line: 1, match: 'const <<<foo = 1' },
      { workspace },
    );

    expect(result).toMatchObject({
      definition: [{ location: expect.stringContaining('test.ts:L2:C1') }],
    });
    expect(result).not.toHaveProperty('implementation');
  });

  it('should still return secondary results when hover query fails', async () => {
    await fs.writeFile(path.join(tempDir, 'test.ts'), 'const foo = 1\nconst bar = foo\nfoo()');

    const fileUri = `file://${path.join(tempDir, 'test.ts')}`;
    const mockClient = {
      queryHover: vi.fn().mockRejectedValue(new Error('hover failed')),
      queryDefinition: vi.fn().mockResolvedValue([
        {
          uri: fileUri,
          range: { start: { line: 1, character: 0 }, end: { line: 1, character: 3 } },
        },
      ]),
      queryImplementation: vi.fn().mockResolvedValue([
        {
          uri: fileUri,
          range: { start: { line: 2, character: 0 }, end: { line: 2, character: 3 } },
        },
      ]),
      notifyChange: vi.fn(),
      waitForDiagnostics: vi.fn().mockResolvedValue([
        {
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
          severity: 1,
          message: 'Boom',
          source: 'ts',
        },
      ]),
      notifyClose: vi.fn(),
      serverName: 'typescript',
    };

    const mockLsp = {
      root: tempDir,
      prepareQuery: vi.fn().mockResolvedValue({
        client: mockClient,
        uri: fileUri,
        languageId: 'typescript',
        serverName: 'typescript',
        release: vi.fn(),
      }),
    };

    lspStub = mockLsp;

    const result = await tools[WORKSPACE_TOOLS.LSP.LSP_INSPECT].execute(
      { path: 'test.ts', line: 1, match: 'const <<<foo = 1' },
      { workspace },
    );

    expect(result).toMatchObject({
      diagnostics: [{ severity: 'error', message: 'Boom', source: 'ts' }],
      definition: [{ location: expect.stringContaining('test.ts:L2:C1') }],
    });
    expect(result).toHaveProperty('implementation');
    expect(result).not.toHaveProperty('hover');
  });
});
