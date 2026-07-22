import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cliVersion: 'test-cli-version',
  runCreateCommand: vi.fn(),
  isCreateCancelledError: vi.fn((_error: unknown) => false),
  getAnalytics: vi.fn(),
  getVersionTag: vi.fn(),
}));

vi.mock('../../../package.json', () => ({
  default: { version: mocks.cliVersion },
}));

vi.mock('../create/create', () => ({
  runCreateCommand: mocks.runCreateCommand,
  isCreateCancelledError: mocks.isCreateCancelledError,
  getCreateCommandAnalyticsArgs: (args: {
    empty?: boolean;
    template?: string | boolean;
    skills?: boolean;
    git?: boolean;
  }) => ({
    mode: args.empty ? 'empty' : args.template !== undefined ? 'template' : 'managed',
    skills: args.skills,
    git: args.git,
  }),
}));

vi.mock('../../analytics', () => ({
  getAnalytics: mocks.getAnalytics,
}));

vi.mock('../utils', () => ({
  getVersionTag: mocks.getVersionTag,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.runCreateCommand.mockResolvedValue(undefined);
  mocks.getVersionTag.mockResolvedValue('latest');
});

describe('createProject', () => {
  it('passes the shared create contract through without removed create behavior', async () => {
    const trackCommandExecution = vi.fn(async ({ execution }) => execution());
    const analytics = { trackCommandExecution } as never;
    const { createProjectWithDependencies } = await import('./create-project');
    const args = {
      empty: false,
      llm: 'anthropic' as const,
      llmApiKey: 'secret',
      skills: false,
      git: false,
      template: 'https://github.com/private-owner/private-repo?token=secret',
      timeout: 12_345,
    };

    await createProjectWithDependencies('private-project-name', args, { analytics });

    expect(mocks.runCreateCommand).toHaveBeenCalledWith('private-project-name', args, {
      analytics,
      resolveVersionTag: expect.any(Function),
    });

    const trackedArgs = trackCommandExecution.mock.calls[0]?.[0].args;
    expect(trackedArgs).toEqual({
      mode: 'template',
      skills: false,
      git: false,
    });
    expect(JSON.stringify(trackedArgs)).not.toContain('private-project-name');
    expect(JSON.stringify(trackedArgs)).not.toContain('private-repo');
    expect(JSON.stringify(trackedArgs)).not.toContain('secret');
    expect(trackedArgs).not.toHaveProperty('llmApiKey');
    expect(trackedArgs).not.toHaveProperty('components');
    expect(trackedArgs).not.toHaveProperty('observability');
    expect(trackedArgs).not.toHaveProperty('mcp');
  });

  it('passes the known running CLI version to the lazy version-tag resolver', async () => {
    const { createProjectWithDependencies } = await import('./create-project');

    await createProjectWithDependencies(
      'my-project',
      {
        skills: true,
        git: true,
        timeout: 60_000,
      },
      { analytics: null },
    );

    const dependencies = mocks.runCreateCommand.mock.calls[0]?.[2];
    expect(mocks.getVersionTag).not.toHaveBeenCalled();
    await dependencies.resolveVersionTag();
    expect(mocks.getVersionTag).toHaveBeenCalledWith(mocks.cliVersion);
  });

  it('reports centralized cancellation as a successful tracked command', async () => {
    const cancellation = new Error('cancelled');
    mocks.runCreateCommand.mockRejectedValue(cancellation);
    mocks.isCreateCancelledError.mockImplementation(error => error === cancellation);
    let trackedOutcome: 'resolved' | 'rejected' | undefined;
    const trackCommandExecution = vi.fn(async ({ execution }) => {
      try {
        await execution();
        trackedOutcome = 'resolved';
      } catch (error) {
        trackedOutcome = 'rejected';
        throw error;
      }
    });
    const analytics = { trackCommandExecution } as never;
    const { createProjectWithDependencies } = await import('./create-project');

    await expect(
      createProjectWithDependencies('my-project', { skills: true, git: true, timeout: 60_000 }, { analytics }),
    ).resolves.toBeUndefined();
    expect(trackCommandExecution).toHaveBeenCalledOnce();
    expect(trackedOutcome).toBe('resolved');
  });

  it('rethrows non-cancellation failures', async () => {
    const failure = new Error('failed');
    mocks.runCreateCommand.mockRejectedValue(failure);
    const { createProjectWithDependencies } = await import('./create-project');

    await expect(
      createProjectWithDependencies('my-project', { skills: true, git: true, timeout: 60_000 }, { analytics: null }),
    ).rejects.toThrow('failed');
  });
});
