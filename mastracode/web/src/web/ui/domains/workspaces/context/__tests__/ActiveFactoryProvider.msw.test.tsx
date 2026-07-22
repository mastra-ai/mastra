/**
 * BDD coverage for `ActiveFactoryProvider` (`domains/workspaces/context`).
 *
 * The provider receives the route's `factoryId` as a prop (the URL is the
 * single source of truth for the active factory) and exposes the
 * `useActiveFactory(factoryId)` hook through context. Server factories with a
 * selected repository are materialized into their cloud sandbox on mount
 * (the `/ensure` SSE route); only the network is mocked (MSW).
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import type { MaterializeResult } from '../../services/github';
import { isServerFactory, loadFactories, selectedRepository } from '../../services/factories';
import type { Factory, LocalFactory, ServerFactory } from '../../services/factories';
import { ActiveFactoryProvider, useActiveFactoryContext } from '../ActiveFactoryProvider';

const LOCAL_FACTORY: LocalFactory = {
  id: 'factory-test',
  name: 'MastraCode Test',
  resourceId: 'resource-test',
  createdAt: 1,
  binding: {
    kind: 'local',
    path: '/tmp/mastracode-test',
  },
};

const SERVER_FACTORY: ServerFactory = {
  id: 'factory-server',
  name: 'octo/hello',
  createdAt: 2,
  binding: {
    kind: 'factory',
    factoryProjectId: 'fp-1',
    repositories: [{ projectRepositoryId: 'pr-1', slug: 'octo/hello', worktrees: [] }],
  },
};

const ENSURE_URL = `${TEST_BASE_URL}/web/github/projects/pr-1/ensure`;

const materialized: MaterializeResult = {
  resourceId: 'resource-gh',
  factoryProjectId: 'fp-1',
  projectRepositoryId: 'pr-1',
  sandboxId: 'sbx_1',
  sandboxWorkdir: '/workspace/hello',
};

function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function sseResponse(body: string) {
  return new HttpResponse(body, { headers: { 'content-type': 'text/event-stream' } });
}

afterEach(() => {
  localStorage.clear();
});

function seedFactories(...factories: Factory[]) {
  localStorage.setItem('mastracode-factories', JSON.stringify(factories));
}

function Probe() {
  const api = useActiveFactoryContext();
  const { factories, activeFactory, resourceId, sessionEnabled, preparing, prepareError, retryPrepare } = api;
  return (
    <div>
      <span data-testid="factory-count">{factories.length}</span>
      <span data-testid="active-factory">{activeFactory?.name ?? '(none)'}</span>
      <span data-testid="active-factory-id">{activeFactory?.id ?? '(none)'}</span>
      <span data-testid="resource-id">{resourceId}</span>
      <span data-testid="session-enabled">{sessionEnabled ? 'yes' : 'no'}</span>
      <span data-testid="preparing">{preparing?.message ?? '(idle)'}</span>
      <span data-testid="prepare-error">{prepareError?.message ?? '(none)'}</span>
      <button onClick={() => retryPrepare()}>retry prepare</button>
    </div>
  );
}

function renderProbe(factoryId: string) {
  return renderWithProviders(
    <ActiveFactoryProvider factoryId={factoryId}>
      <Probe />
    </ActiveFactoryProvider>,
  );
}

describe('ActiveFactoryProvider', () => {
  it('given a seeded factory matching the route factoryId, then it exposes the factories and active selection', async () => {
    seedFactories(LOCAL_FACTORY);
    renderProbe(LOCAL_FACTORY.id);

    await waitFor(() => expect(screen.getByTestId('active-factory')).toHaveTextContent('MastraCode Test'));
    expect(screen.getByTestId('factory-count')).toHaveTextContent('1');
    expect(screen.getByTestId('active-factory-id')).toHaveTextContent('factory-test');
    expect(screen.getByTestId('resource-id')).toHaveTextContent('resource-test');
    expect(screen.getByTestId('session-enabled')).toHaveTextContent('yes');
  });

  it('given a factoryId not present in the list, then no factory activates and the session stays disabled', async () => {
    seedFactories(LOCAL_FACTORY);
    renderProbe('factory-unknown');

    await waitFor(() => expect(screen.getByTestId('factory-count')).toHaveTextContent('1'));
    expect(screen.getByTestId('active-factory')).toHaveTextContent('(none)');
    expect(screen.getByTestId('session-enabled')).toHaveTextContent('no');
  });

  it('given no provider, when useActiveFactoryContext is called, then it throws a descriptive error', () => {
    expect(() => render(<Probe />)).toThrow('useActiveFactoryContext must be used within an ActiveFactoryProvider');
  });

  describe('server factories', () => {
    it('given a factory with a linked repository, when mounted, then it is materialized via /ensure with live progress and the session enables with the server resourceId', async () => {
      seedFactories(SERVER_FACTORY);
      let release!: () => void;
      const gate = new Promise<void>(resolve => (release = resolve));
      server.use(
        http.post(ENSURE_URL, async () => {
          await gate;
          return sseResponse(
            sseFrame('progress', { phase: 'cloning', message: 'Cloning octo/hello…' }) + sseFrame('done', materialized),
          );
        }),
      );
      renderProbe(SERVER_FACTORY.id);

      // The factory is active immediately (URL-driven), but the session stays
      // gated behind the mount-driven materialization.
      await waitFor(() => expect(screen.getByTestId('active-factory')).toHaveTextContent('octo/hello'));
      expect(screen.getByTestId('session-enabled')).toHaveTextContent('no');
      await waitFor(() => expect(screen.getByTestId('preparing')).not.toHaveTextContent('(idle)'));
      release();

      await waitFor(() => expect(screen.getByTestId('session-enabled')).toHaveTextContent('yes'));
      expect(screen.getByTestId('resource-id')).toHaveTextContent('resource-gh');
      expect(screen.getByTestId('preparing')).toHaveTextContent('(idle)');

      // The materialize result is persisted so a reload can reattach.
      const stored = loadFactories().find(factory => factory.id === 'factory-server');
      expect(stored).toMatchObject({ resourceId: 'resource-gh' });
      if (!stored || !isServerFactory(stored)) throw new Error('expected server factory');
      const repository = selectedRepository(stored);
      expect(repository?.sandboxId).toBe('sbx_1');
      expect(repository?.sandboxWorkdir).toBe('/workspace/hello');
      // The repo-root checkout is not a workspace, so materialization seeds no
      // worktrees — sessions only exist once created explicitly.
      expect(repository?.worktrees).toEqual([]);
      // Browser Factory.id remains distinct from the server project identity.
      expect(stored.id).not.toBe(stored.binding.factoryProjectId);
    });

    it('given a factory without linked repositories, when mounted, then it activates against the factory project resource without materialization', async () => {
      const emptyFactory: ServerFactory = {
        ...SERVER_FACTORY,
        binding: { kind: 'factory', factoryProjectId: 'fp-1', repositories: [] },
      };
      seedFactories(emptyFactory);
      renderProbe(emptyFactory.id);

      await waitFor(() => expect(screen.getByTestId('active-factory')).toHaveTextContent('octo/hello'));
      // Chat scopes to the factory project itself until a repository is linked.
      expect(screen.getByTestId('resource-id')).toHaveTextContent('fp-1');
      expect(screen.getByTestId('session-enabled')).toHaveTextContent('yes');
      expect(screen.getByTestId('preparing')).toHaveTextContent('(idle)');
    });

    it('given a materialization failure, then the session stays disabled and retryPrepare re-runs the ensure', async () => {
      seedFactories(SERVER_FACTORY);

      let failNext = true;
      server.use(
        http.post(ENSURE_URL, () => {
          if (failNext) {
            failNext = false;
            return HttpResponse.json({ error: 'Sandbox unavailable', code: 'sandbox_error' }, { status: 503 });
          }
          return sseResponse(sseFrame('done', materialized));
        }),
      );
      renderProbe(SERVER_FACTORY.id);

      await waitFor(() => expect(screen.getByTestId('prepare-error')).not.toHaveTextContent('(none)'));
      // The factory stays active (URL-driven) but the session never binds to
      // an unmaterialized workspace, and nothing is persisted.
      expect(screen.getByTestId('active-factory')).toHaveTextContent('octo/hello');
      expect(screen.getByTestId('session-enabled')).toHaveTextContent('no');
      expect(loadFactories().find(factory => factory.id === 'factory-server')?.resourceId).toBeUndefined();

      await userEvent.click(screen.getByRole('button', { name: 'retry prepare' }));

      await waitFor(() => expect(screen.getByTestId('session-enabled')).toHaveTextContent('yes'));
      expect(screen.getByTestId('resource-id')).toHaveTextContent('resource-gh');
      expect(loadFactories().find(factory => factory.id === 'factory-server')).toMatchObject({
        resourceId: 'resource-gh',
      });
    });
  });
});
