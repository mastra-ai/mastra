import { RequestContext } from '@mastra/core/request-context';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SetupInProgress } from '../sandbox/setup-progress.js';
import {
  __clearSessionEnvironmentsForTests,
  clearSessionEnvironment,
  FactoryEnvironmentStateProcessor,
  peekSessionEnvironmentTeardown,
  recordSessionEnvironment,
  setSessionEnvironmentNote,
  updateSessionEnvironmentRepository,
} from './environment-state-processor.js';
import type { SessionEnvironmentState } from './environment-state-processor.js';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';

function requestContext(sessionId = 'sess-1', state: Record<string, unknown> = { factoryProjectId: PROJECT_ID }) {
  const context = new RequestContext();
  context.set('controller', {
    sessionId,
    resourceId: PROJECT_ID,
    threadId: 'thread-1',
    getState: () => state,
  });
  return context;
}

function stateArgs(context: RequestContext, overrides: Record<string, unknown> = {}) {
  return {
    requestContext: context,
    threadId: 'thread-1',
    resourceId: 'sess-1',
    activeStateSignals: [],
    contextWindow: { hasSnapshot: false },
    deltasSinceSnapshot: [],
    ...overrides,
  } as never;
}

const environment: SessionEnvironmentState = {
  workingDirectory: '/home/user',
  repositories: [
    {
      slug: 'acme/template-docs-expert',
      dir: '/home/user/template-docs-expert',
      branch: 'factory/issue-7',
      defaultBranch: 'main',
      setupStatus: 'ok',
    },
    {
      slug: 'acme/mastra',
      dir: '/home/user/mastra',
      branch: null,
      defaultBranch: 'main',
      setupStatus: 'skipped',
    },
  ],
};

afterEach(() => {
  __clearSessionEnvironmentsForTests();
});

describe('FactoryEnvironmentStateProcessor', () => {
  it('emits nothing before the session booted an environment', async () => {
    const processor = new FactoryEnvironmentStateProcessor();
    await expect(processor.computeStateSignal(stateArgs(requestContext()))).resolves.toBeUndefined();
  });

  it('emits for a user session whose controller state has no factoryProjectId', async () => {
    recordSessionEnvironment('sess-1', environment);
    const processor = new FactoryEnvironmentStateProcessor();

    const signal = await processor.computeStateSignal(stateArgs(requestContext('sess-1', {})));

    expect(signal).toMatchObject({ id: 'factory-environment', attributes: { repositories: 2 } });
    await expect(processor.computeStateSignal(stateArgs(requestContext('other', {})))).resolves.toBeUndefined();
  });

  it('says a setup command is running, with its clock times, and drops a mark past its deadline', async () => {
    recordSessionEnvironment('sess-1', environment);
    const startedAt = new Date(Date.now() - 60_000);
    let row = {
      setupInProgress: { target: 'acme/mastra', startedAt, deadline: new Date(startedAt.getTime() + 15 * 60_000) },
    };
    const processor = new FactoryEnvironmentStateProcessor({ getSession: async () => row });

    const running = await processor.computeStateSignal(stateArgs(requestContext()));
    expect(running?.contents).toContain(
      `running the setup command for acme/mastra, started at ${startedAt.toISOString().slice(11, 16)} UTC`,
    );
    expect(running?.contents).toContain("don't recreate the sandbox");

    // The process running setup died before clearing it: past the deadline the command was stopped anyway.
    row = { setupInProgress: { ...row.setupInProgress, deadline: new Date(Date.now() - 1) } };
    const stale = await processor.computeStateSignal(stateArgs(requestContext()));
    expect(stale?.contents).not.toContain('setup command');
    expect(stale?.cacheKey).not.toBe(running?.cacheKey);
  });

  it('replaces a setup snapshot once setup ended with no environment recorded, then stays quiet', async () => {
    const now = Date.now();
    let row: { setupInProgress: SetupInProgress | null } = {
      setupInProgress: { target: 'acme/mastra', startedAt: new Date(now), deadline: new Date(now + 60_000) },
    };
    const processor = new FactoryEnvironmentStateProcessor({ getSession: async () => row });
    const running = await processor.computeStateSignal(stateArgs(requestContext()));
    const inWindow = (signal: typeof running) =>
      stateArgs(requestContext(), {
        lastSnapshot: { metadata: { state: { cacheKey: signal?.cacheKey } } },
        contextWindow: { hasSnapshot: true },
      });

    // The setup failed, so the boot never recorded an environment.
    row = { setupInProgress: null };
    const ended = await processor.computeStateSignal(inWindow(running));
    expect(ended?.contents).toBe('No setup command is running in the sandbox now.');
    await expect(processor.computeStateSignal(inWindow(ended))).resolves.toBeUndefined();
  });

  it('keeps the snapshot in the window when the session read fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const processor = new FactoryEnvironmentStateProcessor({
      getSession: async () => {
        throw new Error('database unavailable');
      },
    });
    await expect(
      processor.computeStateSignal(
        stateArgs(requestContext(), {
          lastSnapshot: { metadata: { state: { cacheKey: 'environment:none:setup:acme/mastra:1' } } },
          contextWindow: { hasSnapshot: true },
        }),
      ),
    ).resolves.toBeUndefined();
  });

  it('tells a session with no booted environment yet that setup is running', async () => {
    const now = Date.now();
    const processor = new FactoryEnvironmentStateProcessor({
      getSession: async () => ({
        setupInProgress: { target: 'the workspace', startedAt: new Date(now), deadline: new Date(now + 60_000) },
      }),
    });
    const signal = await processor.computeStateSignal(stateArgs(requestContext()));
    expect(signal?.contents).toContain('running the setup command for the workspace');
  });

  it('describes every booted repository with its directory, branch and setup status', async () => {
    recordSessionEnvironment('sess-1', environment);
    const processor = new FactoryEnvironmentStateProcessor();

    const signal = await processor.computeStateSignal(stateArgs(requestContext()));

    expect(signal).toMatchObject({
      id: 'factory-environment',
      mode: 'snapshot',
      tagName: 'factory-environment',
      value: { environment },
      attributes: { workingDirectory: '/home/user', repositories: 2 },
    });
    const contents = (signal as { contents: string }).contents;
    expect(contents).toContain('2 repositories under /home/user, your working directory');
    expect(contents).toContain(
      '1. acme/template-docs-expert at /home/user/template-docs-expert on factory/issue-7 (default main, setup ok)',
    );
    expect(contents).toContain('2. acme/mastra at /home/user/mastra on (detached) (default main, setup skipped)');
    expect(contents).toContain("A directory's AGENTS.md loads after you open a file there with view or an edit tool");
    expect(contents).toContain(
      'Before your first change in a directory, read any AGENTS.md in it or its parent directories you have not seen yet.',
    );
  });

  it('names a one-repository environment by its checkout as the working directory, with no multi-repository advice', async () => {
    recordSessionEnvironment('sess-1', {
      workingDirectory: '/home/user',
      repositories: [environment.repositories[0]!],
    });
    const processor = new FactoryEnvironmentStateProcessor();

    const signal = await processor.computeStateSignal(stateArgs(requestContext()));

    expect(signal).toMatchObject({
      attributes: { workingDirectory: '/home/user/template-docs-expert', repositories: 1 },
    });
    const contents = (signal as { contents: string }).contents;
    expect(contents).toContain(
      'Factory environment: 1 repository, acme/template-docs-expert at /home/user/template-docs-expert, your working directory.',
    );
    expect(contents).toContain('1. acme/template-docs-expert at /home/user/template-docs-expert on factory/issue-7');
    expect(contents).not.toContain('repositories under');
    expect(contents).not.toContain('Run git and project commands inside the repository directory');
    expect(contents).toContain("A directory's AGENTS.md loads after you open a file there with view or an edit tool");
    expect(contents).toContain(
      'Before your first change in a directory, read any AGENTS.md in it or its parent directories you have not seen yet.',
    );
  });

  it('does not point an untrusted checkout at its working-tree AGENTS.md files', async () => {
    recordSessionEnvironment('sess-1', environment);
    const processor = new FactoryEnvironmentStateProcessor();

    const signal = await processor.computeStateSignal(
      stateArgs(requestContext('sess-1', { factoryProjectId: PROJECT_ID, untrustedCheckout: true })),
    );

    const contents = (signal as { contents: string }).contents;
    expect(contents).toContain('2 repositories under /home/user');
    expect(contents).not.toContain('AGENTS.md');
  });

  it('re-emits without the AGENTS.md guidance when a trusted session turns untrusted', async () => {
    recordSessionEnvironment('sess-1', environment);
    const processor = new FactoryEnvironmentStateProcessor();
    const trusted = (await processor.computeStateSignal(stateArgs(requestContext()))) as {
      cacheKey: string;
      contents: string;
    };
    expect(trusted.contents).toContain('AGENTS.md');
    const inWindow = {
      contextWindow: { hasSnapshot: true },
      lastSnapshot: { metadata: { state: { cacheKey: trusted.cacheKey } } },
      tracking: { currentCacheKey: trusted.cacheKey },
    };

    const untrusted = (await processor.computeStateSignal(
      stateArgs(requestContext('sess-1', { factoryProjectId: PROJECT_ID, untrustedCheckout: true }), inWindow),
    )) as { cacheKey: string; contents: string; mode: string };
    expect(untrusted.mode).toBe('snapshot');
    expect(untrusted.cacheKey).not.toBe(trusted.cacheKey);
    expect(untrusted.contents).not.toContain('AGENTS.md');
  });

  it('is quiet while the snapshot in the window matches, and emits again when the set changes', async () => {
    recordSessionEnvironment('sess-1', environment);
    const processor = new FactoryEnvironmentStateProcessor();
    const first = (await processor.computeStateSignal(stateArgs(requestContext()))) as { cacheKey: string };
    const inWindow = {
      contextWindow: { hasSnapshot: true },
      lastSnapshot: { metadata: { state: { cacheKey: first.cacheKey } } },
      tracking: { currentCacheKey: first.cacheKey },
    };

    await expect(processor.computeStateSignal(stateArgs(requestContext(), inWindow))).resolves.toBeUndefined();

    recordSessionEnvironment('sess-1', { ...environment, repositories: environment.repositories.slice(0, 1) });
    const second = (await processor.computeStateSignal(stateArgs(requestContext(), inWindow))) as {
      cacheKey: string;
      mode: string;
    };
    expect(second.mode).toBe('snapshot');
    expect(second.cacheKey).not.toBe(first.cacheKey);
  });

  it('re-emits with the pushed branch and change request after a source-control tool updates a repository', async () => {
    recordSessionEnvironment('sess-1', environment);
    const processor = new FactoryEnvironmentStateProcessor();
    const first = (await processor.computeStateSignal(stateArgs(requestContext()))) as { cacheKey: string };
    const inWindow = {
      contextWindow: { hasSnapshot: true },
      lastSnapshot: { metadata: { state: { cacheKey: first.cacheKey } } },
      tracking: { currentCacheKey: first.cacheKey },
    };

    updateSessionEnvironmentRepository('sess-1', 'ACME/mastra', { branch: 'factory/issue-7' });
    updateSessionEnvironmentRepository('sess-1', 'acme/mastra', {
      changeRequestUrl: 'https://github.com/acme/mastra/pull/9',
    });
    updateSessionEnvironmentRepository('sess-1', 'acme/elsewhere', { branch: 'ignored' });
    updateSessionEnvironmentRepository('other', 'acme/mastra', { branch: 'ignored' });

    const second = (await processor.computeStateSignal(stateArgs(requestContext(), inWindow))) as {
      cacheKey: string;
      contents: string;
    };
    expect(second.cacheKey).not.toBe(first.cacheKey);
    expect(second.contents).toContain(
      '2. acme/mastra at /home/user/mastra on factory/issue-7 (default main, setup skipped), change request https://github.com/acme/mastra/pull/9',
    );
    expect(second.contents).not.toContain('elsewhere');
    expect(second.contents).not.toContain('ignored');
    // The first repository is untouched and the recorded state object was not mutated in place.
    expect(second.contents).toContain(
      '1. acme/template-docs-expert at /home/user/template-docs-expert on factory/issue-7 (default main, setup ok)\n',
    );
    expect(environment.repositories[1]!.branch).toBeNull();
  });

  it('renders the boot note as the last line, drops it when cleared, and changes the cache key both ways', async () => {
    recordSessionEnvironment('sess-1', environment);
    const processor = new FactoryEnvironmentStateProcessor();
    const first = (await processor.computeStateSignal(stateArgs(requestContext()))) as { cacheKey: string };

    setSessionEnvironmentNote(
      'sess-1',
      'GH_TOKEN covers acme/template-docs-expert only; use the source_control_* tools.',
    );
    setSessionEnvironmentNote('other', 'ignored');
    const noted = (await processor.computeStateSignal(stateArgs(requestContext()))) as {
      cacheKey: string;
      contents: string;
    };
    expect(noted.cacheKey).not.toBe(first.cacheKey);
    expect(
      noted.contents.endsWith('\nGH_TOKEN covers acme/template-docs-expert only; use the source_control_* tools.'),
    ).toBe(true);

    setSessionEnvironmentNote('sess-1', null);
    const cleared = (await processor.computeStateSignal(stateArgs(requestContext()))) as {
      cacheKey: string;
      contents: string;
    };
    expect(cleared.cacheKey).toBe(first.cacheKey);
    expect(cleared.contents).not.toContain('GH_TOKEN');
    expect('note' in environment).toBe(false);
  });

  it('never renders a token or a clone URL: the state only carries slugs, paths, branches and statuses', async () => {
    recordSessionEnvironment('sess-1', environment);
    const processor = new FactoryEnvironmentStateProcessor();
    const signal = await processor.computeStateSignal(stateArgs(requestContext()));
    const rendered = JSON.stringify(signal);
    expect(rendered).not.toMatch(/https?:\/\/|token|authorization/i);
  });

  it('keeps teardown commands beside the state and drops them with it', () => {
    recordSessionEnvironment('sess-1', environment, [
      { slug: 'acme/mastra', dir: '/home/user/mastra', command: 'pnpm stop' },
    ]);
    expect(peekSessionEnvironmentTeardown('sess-1')).toEqual([
      { slug: 'acme/mastra', dir: '/home/user/mastra', command: 'pnpm stop' },
    ]);
    clearSessionEnvironment('sess-1');
    expect(peekSessionEnvironmentTeardown('sess-1')).toEqual([]);
  });
});
