import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { WORKSPACE_TOOLS } from '../../constants';
import { LocalFilesystem } from '../../filesystem';
import { Workspace } from '../../workspace';
import { createWorkspaceTools } from '../tools';

describe('workspace_search', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-tools-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should search indexed content', async () => {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      bm25: true,
    });
    const tools = await createWorkspaceTools(workspace);

    await workspace.index('/doc.txt', 'The quick brown fox');

    const result = await tools[WORKSPACE_TOOLS.SEARCH.SEARCH].execute({ query: 'quick' }, { workspace });

    expect(typeof result).toBe('string');
    expect(result).toContain('bm25 search');
    expect(result).not.toContain('0 results');
  });

  it('should fallback to bm25 when hybrid mode requested but only BM25 configured (#14531)', async () => {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      bm25: true,
      // No vector config — canHybrid is false
    });
    const tools = await createWorkspaceTools(workspace);
    await workspace.index('/doc.txt', 'The quick brown fox');

    // Should not throw "Hybrid search requires both vector and BM25 configuration."
    const result = await tools[WORKSPACE_TOOLS.SEARCH.SEARCH].execute(
      { query: 'quick', mode: 'hybrid' },
      { workspace },
    );
    expect(typeof result).toBe('string');
    expect(result).toContain('bm25 search');
    expect(result).not.toContain('0 results');
  });

  it('should restrict mode enum in tool input schema to supported modes (#14531)', async () => {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      bm25: true,
      // No vector config — only bm25 should appear in the enum
    });
    const tools = await createWorkspaceTools(workspace);
    const tool = tools[WORKSPACE_TOOLS.SEARCH.SEARCH];

    // The dynamic input schema should reject 'hybrid' / 'vector' so the LLM
    // never sees them as valid options in the JSON schema sent to the model.
    const parsed = (tool.inputSchema as any).safeParse({ query: 'quick', mode: 'hybrid' });
    expect(parsed.success).toBe(false);

    const ok = (tool.inputSchema as any).safeParse({ query: 'quick', mode: 'bm25' });
    expect(ok.success).toBe(true);
  });

  it('should return empty results for no matches', async () => {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      bm25: true,
    });
    const tools = await createWorkspaceTools(workspace);

    await workspace.index('/doc.txt', 'The quick brown fox');

    const result = await tools[WORKSPACE_TOOLS.SEARCH.SEARCH].execute({ query: 'elephant' }, { workspace });

    expect(typeof result).toBe('string');
    expect(result).toContain('0 results');
  });
});
