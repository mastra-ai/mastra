import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { WORKSPACE_TOOLS } from '../../constants';
import { LocalFilesystem } from '../../filesystem';
import { Workspace } from '../../workspace';
import { createWorkspaceTools } from '../tools';

describe('workspace_index', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-tools-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should index content', async () => {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      bm25: true,
    });
    const tools = createWorkspaceTools(workspace);

    const result = await tools[WORKSPACE_TOOLS.SEARCH.INDEX].execute({
      path: '/doc.txt',
      content: 'Document content',
    });

    expect(typeof result).toBe('string');
    expect(result).toBe('Indexed /doc.txt');

    // Verify it's searchable
    const searchResult = await tools[WORKSPACE_TOOLS.SEARCH.SEARCH].execute({ query: 'Document' });
    expect(typeof searchResult).toBe('string');
    expect(searchResult).not.toContain('0 results');
  });
});
