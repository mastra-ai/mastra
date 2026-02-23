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
    const tools = createWorkspaceTools(workspace);

    await workspace.index('/doc.txt', 'The quick brown fox');

    const result = await tools[WORKSPACE_TOOLS.SEARCH.SEARCH].execute({ query: 'quick' });

    expect(typeof result).toBe('string');
    expect(result).toContain('bm25 search');
    expect(result).not.toContain('0 results');
  });

  it('should return empty results for no matches', async () => {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      bm25: true,
    });
    const tools = createWorkspaceTools(workspace);

    await workspace.index('/doc.txt', 'The quick brown fox');

    const result = await tools[WORKSPACE_TOOLS.SEARCH.SEARCH].execute({ query: 'elephant' });

    expect(typeof result).toBe('string');
    expect(result).toContain('0 results');
  });
});
