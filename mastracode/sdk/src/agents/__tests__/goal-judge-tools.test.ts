import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { RequestContext } from '@mastra/core/request-context';
import { LocalFilesystem, Workspace } from '@mastra/core/workspace';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MASTRACODE_WORKSPACE_TOOLS } from '../tool-availability.js';

vi.mock('../onboarding/settings.js', () => ({
  loadSettings: () => ({}),
}));
vi.mock('../../onboarding/settings.js', () => ({
  loadSettings: () => ({}),
}));

afterEach(() => {
  vi.resetModules();
});

const READONLY = ['view', 'search_content', 'find_files', 'file_stat', 'lsp_inspect'];
const MUTATING = ['write_file', 'string_replace_lsp', 'delete_file', 'mkdir', 'ast_smart_edit', 'execute_command'];

describe('createGoalJudgeToolsResolver', () => {
  it('returns only the read-only verification subset of the configured workspace tools', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastracode-goal-judge-tools-'));
    try {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        tools: MASTRACODE_WORKSPACE_TOOLS,
      });
      const { createGoalJudgeToolsResolver } = await import('../goal-judge-tools.js');
      const tools = await createGoalJudgeToolsResolver(workspace)({ requestContext: new RequestContext() as any });

      expect(tools).toBeDefined();
      const names = Object.keys(tools!);

      for (const name of READONLY) {
        expect(names).toContain(name);
      }
      for (const name of MUTATING) {
        expect(names).not.toContain(name);
      }
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('resolves dynamic workspace factories with requestContext and mastra', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastracode-goal-judge-dynamic-'));
    try {
      const requestContext = new RequestContext();
      const mastra = { id: 'mastra' } as any;
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        tools: MASTRACODE_WORKSPACE_TOOLS,
      });
      const factory = vi.fn(() => workspace);
      const { createGoalJudgeToolsResolver } = await import('../goal-judge-tools.js');

      const tools = await createGoalJudgeToolsResolver(factory as any)({
        requestContext: requestContext as any,
        mastra,
      });

      expect(factory).toHaveBeenCalledWith({ requestContext, mastra });
      expect(tools).toBeDefined();
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('returns undefined when the configured workspace cannot be resolved', async () => {
    const { createGoalJudgeToolsResolver } = await import('../goal-judge-tools.js');
    const requestContext = new RequestContext();
    const tools = await createGoalJudgeToolsResolver(vi.fn(() => undefined) as any)({
      requestContext: requestContext as any,
    });
    expect(tools).toBeUndefined();
  });
});
