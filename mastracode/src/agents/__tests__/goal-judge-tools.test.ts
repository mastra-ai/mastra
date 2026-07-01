import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { RequestContext } from '@mastra/core/request-context';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../onboarding/settings.js', () => ({
  loadSettings: () => ({}),
}));
vi.mock('../../onboarding/settings.js', () => ({
  loadSettings: () => ({}),
}));

afterEach(() => {
  vi.resetModules();
});

function createRequestContext(projectPath: string) {
  const requestContext = new RequestContext();
  const getState = () => ({
    projectPath,
    sandboxAllowedPaths: [],
  });
  requestContext.set('controller', {
    modeId: 'build',
    getState,
    session: {
      state: {
        get: getState,
      },
    },
  });
  return requestContext;
}

const READONLY = ['view', 'search_content', 'find_files', 'file_stat', 'lsp_inspect'];
const MUTATING = ['write_file', 'string_replace_lsp', 'delete_file', 'mkdir', 'ast_smart_edit', 'execute_command'];

describe('getGoalJudgeTools', () => {
  it('returns only the read-only verification subset of workspace tools', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastracode-goal-judge-tools-'));
    try {
      const { getDynamicWorkspace, getGoalJudgeTools } = await import('../workspace.js');
      const tools = await getGoalJudgeTools({
        requestContext: createRequestContext(tempDir) as any,
        workspaceFactory: getDynamicWorkspace,
      });

      expect(tools).toBeDefined();
      const names = Object.keys(tools!);

      // Every read-only tool is present.
      for (const name of READONLY) {
        expect(names).toContain(name);
      }
      // No mutating / command-execution tool leaks into the judge toolset.
      for (const name of MUTATING) {
        expect(names).not.toContain(name);
      }
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('returns undefined when no project path can be resolved (keeps judge text-only)', async () => {
    const { getDynamicWorkspace, getGoalJudgeTools } = await import('../workspace.js');
    // Empty controller state → getDynamicWorkspace throws → resolver returns undefined.
    const requestContext = new RequestContext();
    const getState = () => ({});
    requestContext.set('controller', { modeId: 'build', getState, session: { state: { get: getState } } });
    const tools = await getGoalJudgeTools({
      requestContext: requestContext as any,
      workspaceFactory: getDynamicWorkspace,
    });
    expect(tools).toBeUndefined();
  });
});
