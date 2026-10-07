import { RequestContext } from '@mastra/core/request-context';
import { afterEach, describe, expect, it } from 'vitest';

import {
  __clearSessionEnvironmentsForTests,
  clearSessionEnvironment,
  FactoryEnvironmentStateProcessor,
  peekSessionEnvironmentTeardown,
  recordSessionEnvironment,
  updateSessionEnvironmentRepository,
} from './environment-state-processor.js';
import type { SessionEnvironmentState } from './environment-state-processor.js';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';

function requestContext(sessionId = 'sess-1', state: Record<string, unknown> = { factoryProjectId: PROJECT_ID }) {
  const context = new RequestContext();
  context.set('controller', {
    resourceId: sessionId,
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
      position: 1,
      setupStatus: 'ok',
    },
    {
      slug: 'acme/mastra',
      dir: '/home/user/mastra',
      branch: null,
      defaultBranch: 'main',
      position: 2,
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
