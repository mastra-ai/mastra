import { RequestContext } from '@mastra/core/request-context';
import { afterEach, describe, expect, it, vi } from 'vitest';

const ensureWebGitCloneMock = vi.fn(async () => '/tmp/mastracode-web-clones/test-checkout');
const detectProjectMock = vi.fn(() => ({
  resourceId: 'mastra-123',
  name: 'mastra',
  rootPath: '/tmp/mastracode-web-clones/test-checkout',
  gitUrl: 'https://github.com/mastra-ai/mastra.git',
  gitBranch: 'main',
  isWorktree: false,
}));

vi.mock('../../onboarding/settings.js', () => ({
  loadSettings: () => ({}),
}));

vi.mock('../../web/git-clone.js', () => ({
  ensureWebGitClone: ensureWebGitCloneMock,
}));

vi.mock('../../utils/project.js', () => ({
  detectProject: detectProjectMock,
  getAppDataDir: () => '/tmp/mastracode-test-app-data',
}));

function createGitRequestContext() {
  const requestContext = new RequestContext();
  const state: Record<string, unknown> = { sandboxAllowedPaths: [] };
  const setState = vi.fn(async (updates: Record<string, unknown>) => {
    Object.assign(state, updates);
  });

  requestContext.set('mastracode.web.gitClone', {
    gitUrl: 'https://github.com/mastra-ai/mastra.git',
    cloneParentPath: '/Users/ward/projects',
  });
  requestContext.set('controller', {
    modeId: 'build',
    getState: () => state,
    setState,
    session: {
      state: {
        get: () => state,
        set: setState,
      },
    },
  });

  return { requestContext, setState };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('getWebWorkspace git clone context', () => {
  it('clones a git URL and builds the workspace from the checkout', async () => {
    const { getWebWorkspace } = await import('../../web/workspace.js');
    const { requestContext, setState } = createGitRequestContext();

    const workspace = await getWebWorkspace({ requestContext });

    expect(ensureWebGitCloneMock).toHaveBeenCalledWith(
      'https://github.com/mastra-ai/mastra.git',
      '/Users/ward/projects',
    );
    expect(detectProjectMock).toHaveBeenCalledWith('/tmp/mastracode-web-clones/test-checkout');
    expect(setState).toHaveBeenCalledWith({
      projectPath: '/tmp/mastracode-web-clones/test-checkout',
      projectName: 'mastra',
      gitBranch: 'main',
    });
    expect(workspace.id).toBe('mastra-code-workspace-/tmp/mastracode-web-clones/test-checkout');
    expect(workspace.filesystem!.basePath).toBe('/tmp/mastracode-web-clones/test-checkout');
  });
});
