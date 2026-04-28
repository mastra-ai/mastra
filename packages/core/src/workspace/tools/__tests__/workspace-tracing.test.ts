import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { SpanType } from '../../../observability/types/tracing';
import type { AnySpan, WorkspaceActionAttributes } from '../../../observability/types/tracing';
import { WORKSPACE_TOOLS } from '../../constants';
import { LocalFilesystem } from '../../filesystem';
import { Workspace } from '../../workspace';
import { indexContentTool } from '../index-content';
import { searchTool } from '../search';
import { createWorkspaceTools } from '../tools';
import { startWorkspaceSpan } from '../tracing';
import { writeFileTool } from '../write-file';

/**
 * Creates a mock span that records createChildSpan calls.
 * Returns both the mock span and a list of captured child span calls.
 */
function createMockSpan() {
  const childSpans: Array<{
    type: SpanType;
    name: string;
    input?: unknown;
    attributes?: Record<string, unknown>;
    ended: boolean;
    errored: boolean;
    endAttributes?: Partial<WorkspaceActionAttributes>;
    endOutput?: unknown;
    errorObj?: unknown;
    errorAttributes?: Partial<WorkspaceActionAttributes>;
  }> = [];

  const mockParentSpan = {
    createChildSpan: vi.fn((options: any) => {
      const childRecord = {
        type: options.type,
        name: options.name,
        input: options.input,
        attributes: options.attributes,
        ended: false,
        errored: false,
        endAttributes: undefined as Partial<WorkspaceActionAttributes> | undefined,
        endOutput: undefined as unknown,
        errorObj: undefined as unknown,
        errorAttributes: undefined as Partial<WorkspaceActionAttributes> | undefined,
      };
      childSpans.push(childRecord);

      return {
        end: vi.fn((options?: any) => {
          childRecord.ended = true;
          childRecord.endAttributes = options?.attributes;
          childRecord.endOutput = options?.output;
        }),
        error: vi.fn((options?: any) => {
          childRecord.errored = true;
          childRecord.errorObj = options?.error;
          childRecord.errorAttributes = options?.attributes;
        }),
        update: vi.fn(),
        createChildSpan: vi.fn(),
      };
    }),
  } as unknown as AnySpan;

  return { mockParentSpan, childSpans };
}

describe('startWorkspaceSpan', () => {
  it('creates a WORKSPACE_ACTION child span with correct attributes', () => {
    const { mockParentSpan, childSpans } = createMockSpan();
    const workspace = new Workspace({ id: 'ws-1', name: 'test-workspace', skills: ['./skills'] });

    const handle = startWorkspaceSpan({ tracing: { currentSpan: mockParentSpan } } as any, workspace, {
      category: 'filesystem',
      operation: 'readFile',
      input: { path: '/data/file.txt' },
      attributes: { filePath: '/data/file.txt' },
    });

    expect(handle.span).toBeDefined();
    expect(childSpans).toHaveLength(1);
    expect(childSpans[0]!.type).toBe(SpanType.WORKSPACE_ACTION);
    expect(childSpans[0]!.name).toBe('workspace:filesystem:readFile');
    expect(childSpans[0]!.attributes).toMatchObject({
      category: 'filesystem',
      workspaceId: 'ws-1',
      workspaceName: 'test-workspace',
    });
  });

  it('returns no-op handle when no tracing context is available', () => {
    const handle = startWorkspaceSpan(undefined, undefined, {
      category: 'sandbox',
      operation: 'executeCommand',
    });

    expect(handle.span).toBeUndefined();
    // Should not throw
    handle.end();
    handle.error(new Error('test'));
  });

  it('returns no-op handle when context has no currentSpan', () => {
    const handle = startWorkspaceSpan({ tracing: { currentSpan: undefined } } as any, undefined, {
      category: 'filesystem',
      operation: 'readFile',
    });

    expect(handle.span).toBeUndefined();
    handle.end();
    handle.error(new Error('test'));
  });

  it('end() passes through attributes and output separately', async () => {
    const { mockParentSpan, childSpans } = createMockSpan();

    const handle = startWorkspaceSpan({ tracing: { currentSpan: mockParentSpan } } as any, undefined, {
      category: 'search',
      operation: 'search',
    });

    handle.end({ success: true }, { resultCount: 3 });

    expect(childSpans[0]!.ended).toBe(true);
    expect(childSpans[0]!.endAttributes?.success).toBe(true);
    expect(childSpans[0]!.endOutput).toEqual({ resultCount: 3 });
  });

  it('end() does not set success when caller omits it', () => {
    const { mockParentSpan, childSpans } = createMockSpan();

    const handle = startWorkspaceSpan({ tracing: { currentSpan: mockParentSpan } } as any, undefined, {
      category: 'filesystem',
      operation: 'readFile',
    });

    handle.end(undefined, { bytesTransferred: 100 });

    expect(childSpans[0]!.ended).toBe(true);
    expect(childSpans[0]!.endAttributes?.success).toBeUndefined();
    expect(childSpans[0]!.endOutput).toEqual({ bytesTransferred: 100 });
  });

  it('error() sets success=false and records the error', () => {
    const { mockParentSpan, childSpans } = createMockSpan();

    const handle = startWorkspaceSpan({ tracing: { currentSpan: mockParentSpan } } as any, undefined, {
      category: 'filesystem',
      operation: 'writeFile',
    });

    const testError = new Error('disk full');
    handle.error(testError);

    expect(childSpans[0]!.errored).toBe(true);
    expect(childSpans[0]!.errorObj).toBe(testError);
    expect(childSpans[0]!.errorAttributes?.success).toBe(false);
  });

  it('error() wraps non-Error values in an Error', () => {
    const { mockParentSpan, childSpans } = createMockSpan();

    const handle = startWorkspaceSpan({ tracing: { currentSpan: mockParentSpan } } as any, undefined, {
      category: 'sandbox',
      operation: 'executeCommand',
    });

    handle.error('string error');

    expect(childSpans[0]!.errored).toBe(true);
    expect(childSpans[0]!.errorObj).toBeInstanceOf(Error);
    expect((childSpans[0]!.errorObj as Error).message).toBe('string error');
  });

  it('falls back to tracingContext when tracing is not set', () => {
    const { mockParentSpan, childSpans } = createMockSpan();

    const handle = startWorkspaceSpan({ tracingContext: { currentSpan: mockParentSpan } } as any, undefined, {
      category: 'filesystem',
      operation: 'delete',
    });

    expect(handle.span).toBeDefined();
    expect(childSpans).toHaveLength(1);
    expect(childSpans[0]!.name).toBe('workspace:filesystem:delete');
  });
});

describe('workspace tool tracing integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-tracing-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('readFile tool creates a WORKSPACE_ACTION span on success', async () => {
    await fs.writeFile(path.join(tempDir, 'hello.txt'), 'Hello World');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const { mockParentSpan, childSpans } = createMockSpan();

    await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute(
      { path: 'hello.txt' },
      { workspace, tracing: { currentSpan: mockParentSpan } },
    );

    expect(childSpans).toHaveLength(1);
    expect(childSpans[0]!.type).toBe(SpanType.WORKSPACE_ACTION);
    expect(childSpans[0]!.attributes?.category).toBe('filesystem');
    expect(childSpans[0]!.name).toBe('workspace:filesystem:readFile');
    expect(childSpans[0]!.ended).toBe(true);
    expect(childSpans[0]!.endAttributes?.success).toBe(true);
    expect(childSpans[0]!.endOutput).toEqual({ bytesTransferred: 11 });
  });

  it('writeFile tool creates a WORKSPACE_ACTION span on success', async () => {
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const { mockParentSpan, childSpans } = createMockSpan();

    await tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE].execute(
      { path: 'out.txt', content: 'test content' },
      { workspace, tracing: { currentSpan: mockParentSpan } },
    );

    expect(childSpans).toHaveLength(1);
    expect(childSpans[0]!.attributes?.category).toBe('filesystem');
    expect(childSpans[0]!.name).toBe('workspace:filesystem:writeFile');
    expect(childSpans[0]!.ended).toBe(true);
    expect(childSpans[0]!.endOutput).toEqual({ bytesTransferred: 12 });
  });

  it('editFile tool creates a WORKSPACE_ACTION span on success', async () => {
    await fs.writeFile(path.join(tempDir, 'edit.txt'), 'foo bar baz');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const { mockParentSpan, childSpans } = createMockSpan();

    await tools[WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE].execute(
      { path: 'edit.txt', old_string: 'bar', new_string: 'qux' },
      { workspace, tracing: { currentSpan: mockParentSpan } },
    );

    expect(childSpans).toHaveLength(1);
    expect(childSpans[0]!.attributes?.category).toBe('filesystem');
    expect(childSpans[0]!.name).toBe('workspace:filesystem:editFile');
    expect(childSpans[0]!.ended).toBe(true);
  });

  it('deleteFile tool creates a WORKSPACE_ACTION span on success', async () => {
    await fs.writeFile(path.join(tempDir, 'del.txt'), 'delete me');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const { mockParentSpan, childSpans } = createMockSpan();

    await tools[WORKSPACE_TOOLS.FILESYSTEM.DELETE].execute(
      { path: 'del.txt' },
      { workspace, tracing: { currentSpan: mockParentSpan } },
    );

    expect(childSpans).toHaveLength(1);
    expect(childSpans[0]!.attributes?.category).toBe('filesystem');
    expect(childSpans[0]!.name).toBe('workspace:filesystem:delete');
    expect(childSpans[0]!.ended).toBe(true);
    expect(childSpans[0]!.endAttributes?.success).toBe(true);
  });

  it('listFiles tool creates a WORKSPACE_ACTION span', async () => {
    await fs.writeFile(path.join(tempDir, 'a.txt'), 'a');
    await fs.writeFile(path.join(tempDir, 'b.txt'), 'b');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const { mockParentSpan, childSpans } = createMockSpan();

    await tools[WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES].execute(
      { path: '.' },
      { workspace, tracing: { currentSpan: mockParentSpan } },
    );

    expect(childSpans).toHaveLength(1);
    expect(childSpans[0]!.attributes?.category).toBe('filesystem');
    expect(childSpans[0]!.name).toBe('workspace:filesystem:listFiles');
    expect(childSpans[0]!.ended).toBe(true);
  });

  it('fileStat tool creates a WORKSPACE_ACTION span', async () => {
    await fs.writeFile(path.join(tempDir, 'stat.txt'), 'hello');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const { mockParentSpan, childSpans } = createMockSpan();

    await tools[WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT].execute(
      { path: 'stat.txt' },
      { workspace, tracing: { currentSpan: mockParentSpan } },
    );

    expect(childSpans).toHaveLength(1);
    expect(childSpans[0]!.attributes?.category).toBe('filesystem');
    expect(childSpans[0]!.name).toBe('workspace:filesystem:stat');
    expect(childSpans[0]!.ended).toBe(true);
    expect(childSpans[0]!.endOutput).toEqual({ bytesTransferred: 5 });
  });

  it('fileStat tool ends span with success=false for missing file', async () => {
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const { mockParentSpan, childSpans } = createMockSpan();

    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT].execute(
      { path: 'nonexistent.txt' },
      { workspace, tracing: { currentSpan: mockParentSpan } },
    );

    expect(result).toContain('not found');
    expect(childSpans).toHaveLength(1);
    expect(childSpans[0]!.ended).toBe(true);
    expect(childSpans[0]!.endAttributes?.success).toBe(false);
  });

  it('mkdir tool creates a WORKSPACE_ACTION span', async () => {
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const { mockParentSpan, childSpans } = createMockSpan();

    await tools[WORKSPACE_TOOLS.FILESYSTEM.MKDIR].execute(
      { path: 'subdir' },
      { workspace, tracing: { currentSpan: mockParentSpan } },
    );

    expect(childSpans).toHaveLength(1);
    expect(childSpans[0]!.attributes?.category).toBe('filesystem');
    expect(childSpans[0]!.name).toBe('workspace:filesystem:mkdir');
    expect(childSpans[0]!.ended).toBe(true);
  });

  it('grep tool creates a WORKSPACE_ACTION span with resultCount', async () => {
    await fs.writeFile(path.join(tempDir, 'code.ts'), 'function hello() {}\nfunction world() {}');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    const { mockParentSpan, childSpans } = createMockSpan();

    await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(
      { pattern: 'function' },
      { workspace, tracing: { currentSpan: mockParentSpan } },
    );

    expect(childSpans).toHaveLength(1);
    expect(childSpans[0]!.attributes?.category).toBe('filesystem');
    expect(childSpans[0]!.name).toBe('workspace:filesystem:grep');
    expect(childSpans[0]!.ended).toBe(true);
    expect(childSpans[0]!.endOutput).toEqual({ resultCount: 2 });
  });

  it('search tool creates a WORKSPACE_ACTION span with error when search not configured', async () => {
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });

    const { mockParentSpan, childSpans } = createMockSpan();

    await expect(
      searchTool.execute({ query: 'test query', topK: 5 }, {
        workspace,
        tracing: { currentSpan: mockParentSpan },
      } as any),
    ).rejects.toThrow();

    expect(childSpans).toHaveLength(1);
    expect(childSpans[0]!.attributes?.category).toBe('search');
    expect(childSpans[0]!.name).toBe('workspace:search:search');
    expect(childSpans[0]!.errored).toBe(true);
    expect(childSpans[0]!.errorAttributes?.success).toBe(false);
  });

  it('index tool creates a WORKSPACE_ACTION span with error when search not configured', async () => {
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });

    const { mockParentSpan, childSpans } = createMockSpan();

    await expect(
      indexContentTool.execute({ path: 'doc.txt', content: 'indexed content' }, {
        workspace,
        tracing: { currentSpan: mockParentSpan },
      } as any),
    ).rejects.toThrow();

    expect(childSpans).toHaveLength(1);
    expect(childSpans[0]!.attributes?.category).toBe('search');
    expect(childSpans[0]!.name).toBe('workspace:search:index');
    expect(childSpans[0]!.errored).toBe(true);
    expect(childSpans[0]!.errorAttributes?.success).toBe(false);
  });

  it('tools work correctly without tracing context (no span created)', async () => {
    await fs.writeFile(path.join(tempDir, 'no-trace.txt'), 'content');
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);

    // No tracing context — should not throw
    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute({ path: 'no-trace.txt' }, { workspace });

    expect(result).toContain('content');
  });

  it('writeFile tool records error span on failure', async () => {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir, readOnly: true }),
    });

    const { mockParentSpan, childSpans } = createMockSpan();

    await expect(
      writeFileTool.execute({ path: 'fail.txt', content: 'data', overwrite: true }, {
        workspace,
        tracing: { currentSpan: mockParentSpan },
      } as any),
    ).rejects.toThrow();

    expect(childSpans).toHaveLength(1);
    expect(childSpans[0]!.errored).toBe(true);
    expect(childSpans[0]!.errorAttributes?.success).toBe(false);
  });
});
