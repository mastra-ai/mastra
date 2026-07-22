/**
 * BDD coverage for `ActiveFactoryProvider` (`domains/workspaces/context`).
 *
 * The provider exposes the existing `useActiveFactory()` hook through context.
 * The active factory is resolved from the `/factories/:factoryId` URL param —
 * the URL is the single source of truth (nothing is persisted in storage) and
 * `selectFactory` navigates. Server factories with a selected repository are
 * materialized into their cloud sandbox by an effect reacting to the param
 * (the `/ensure` SSE route); only the network is mocked (MSW).
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { FactoryRouteHarness, LocationProbe } from '../../../../../../../e2e/web-ui/factory-route';
import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import type { MaterializeResult } from '../../services/github';
import { isServerFactory, loadFactories, selectedRepository } from '../../services/factories';
import type { Factory, LocalFactory, ServerFactory } from '../../services/factories';
import { ActiveFactoryLayout, useActiveFactoryContext } from '../ActiveFactoryProvider';

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

function seedFactories(factories: Factory[]) {
  localStorage.setItem('mastracode-factories', JSON.stringify(factories));
}

function Probe({ selectTarget }: { selectTarget?: Factory }) {
  const api = useActiveFactoryContext();
  const { factories, activeFactory, resourceId, sessionEnabled, selectFactory, preparing, prepareError } = api;
  return (
    <div>
      <span data-testid="factory-count">{factories.length}</span>
      <span data-testid="active-factory">{activeFactory?.name ?? '(none)'}</span>
      <span data-testid="active-factory-id">{activeFactory?.id ?? '(none)'}</span>
      <span data-testid="has-legacy-id-field">{'activeFactoryId' in api ? 'yes' : 'no'}</span>
      <span data-testid="resource-id">{resourceId}</span>
      <span data-testid="session-enabled">{sessionEnabled ? 'yes' : 'no'}</span>
      <span data-testid="preparing">{preparing?.message ?? '(idle)'}</span>
      <span data-testid="prepare-error">{prepareError?.message ?? '(none)'}</span>
      <button onClick={() => void selectFactory(null)}>clear selection</button>
      {selectTarget && <button onClick={() => void selectFactory(selectTarget)}>select target</button>}
    </div>
  );
}

function renderProbe(options: { factoryId: string; initialSuffix?: string; selectTarget?: Factory }) {
  return renderWithProviders(
    <FactoryRouteHarness factoryId={options.factoryId} initialSuffix={options.initialSuffix}>
      <Probe selectTarget={options.selectTarget} />
      <LocationProbe />
    </FactoryRouteHarness>,
  );
}

describe('ActiveFactoryProvider', () => {
  it('given a seeded factory, when its URL param is visited, then it exposes the factories and active selection', async () => {
    seedFactories([LOCAL_FACTORY]);
    renderProbe({ factoryId: LOCAL_FACTORY.id });

    await waitFor(() => expect(screen.getByTestId('active-factory')).toHaveTextContent('MastraCode Test'));
    expect(screen.getByTestId('factory-count')).toHaveTextContent('1');
    expect(screen.getByTestId('active-factory-id')).toHaveTextContent('factory-test');
    expect(screen.getByTestId('resource-id')).toHaveTextContent('resource-test');
    expect(screen.getByTestId('session-enabled')).toHaveTextContent('yes');
    // `activeFactory` is the canonical field; the redundant id field is gone.
    expect(screen.getByTestId('has-legacy-id-field')).toHaveTextContent('no');
    // Nothing is persisted — the URL is the source of truth.
    expect(localStorage.getItem('mastracode-active-factory')).toBeNull();
  });

  it('given a URL param that matches no factory, then no factory is active', async () => {
    seedFactories([LOCAL_FACTORY]);
    renderProbe({ factoryId: 'factory-unknown' });

    await waitFor(() => expect(screen.getByTestId('factory-count')).toHaveTextContent('1'));
    expect(screen.getByTestId('active-factory')).toHaveTextContent('(none)');
    expect(screen.getByTestId('session-enabled')).toHaveTextContent('no');
  });

  it('given an active factory, when selectFactory(null) is called, then it navigates out of the factory scope', async () => {
    seedFactories([LOCAL_FACTORY]);
    renderProbe({ factoryId: LOCAL_FACTORY.id });

    await waitFor(() => expect(screen.getByTestId('active-factory')).toHaveTextContent('MastraCode Test'));
    await userEvent.click(screen.getByRole('button', { name: 'clear selection' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/'));
  });

  it('given two factories, when selecting the other from a shared sub-page, then it navigates to that factory preserving the sub-page', async () => {
    seedFactories([LOCAL_FACTORY, SERVER_FACTORY]);
    server.use(http.post(ENSURE_URL, () => sseResponse(sseFrame('done', materialized))));
    renderProbe({ factoryId: LOCAL_FACTORY.id, initialSuffix: '/work', selectTarget: SERVER_FACTORY });

    await waitFor(() => expect(screen.getByTestId('active-factory')).toHaveTextContent('MastraCode Test'));
    await userEvent.click(screen.getByRole('button', { name: 'select target' }));

    await waitFor(() => expect(screen.getByTestId('active-factory')).toHaveTextContent('octo/hello'));
    expect(screen.getByTestId('location')).toHaveTextContent('/factories/factory-server/work');
  });

  it('given a thread sub-page, when selecting another factory, then it falls back to the draft composer', async () => {
    seedFactories([SERVER_FACTORY, LOCAL_FACTORY]);
    server.use(http.post(ENSURE_URL, () => sseResponse(sseFrame('done', materialized))));
    renderProbe({ factoryId: SERVER_FACTORY.id, initialSuffix: '/threads/thread-1', selectTarget: LOCAL_FACTORY });

    await waitFor(() => expect(screen.getByTestId('active-factory')).toHaveTextContent('octo/hello'));
    await userEvent.click(screen.getByRole('button', { name: 'select target' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/factories/factory-test/new'));
  });

  it('given no provider, when useActiveFactoryContext is called, then it throws a descriptive error', () => {
    expect(() => render(<Probe />)).toThrow('useActiveFactoryContext must be used within an ActiveFactoryProvider');
  });

  describe('ActiveFactoryLayout', () => {
    it('given an unknown :factoryId, once factories hydrate, then it redirects to /', async () => {
      seedFactories([LOCAL_FACTORY]);
      renderWithProviders(
        <MemoryRouter initialEntries={['/factories/factory-unknown/work']}>
          <Routes>
            <Route path="/factories/:factoryId/*" element={<ActiveFactoryLayout />} />
            <Route path="*" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/'));
    });
  });

  describe('server factories', () => {
    it('given a factory with a linked repository, when its URL is visited, then it is materialized via /ensure with live progress and activated with the server resourceId', async () => {
      seedFactories([SERVER_FACTORY]);
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
      renderProbe({ factoryId: SERVER_FACTORY.id });

      // Preparation feedback is exposed while the server works; the factory is
      // already active (resolved from the URL) against its project resource.
      await waitFor(() => expect(screen.getByTestId('preparing')).not.toHaveTextContent('(idle)'));
      expect(screen.getByTestId('active-factory')).toHaveTextContent('octo/hello');
      expect(screen.getByTestId('resource-id')).toHaveTextContent('fp-1');
      release();

      await waitFor(() => expect(screen.getByTestId('resource-id')).toHaveTextContent('resource-gh'));
      expect(screen.getByTestId('session-enabled')).toHaveTextContent('yes');
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

    it('given a factory without linked repositories, when its URL is visited, then it activates against the factory project resource without materialization', async () => {
      const emptyFactory: ServerFactory = {
        ...SERVER_FACTORY,
        binding: { kind: 'factory', factoryProjectId: 'fp-1', repositories: [] },
      };
      seedFactories([emptyFactory]);
      renderProbe({ factoryId: emptyFactory.id });

      await waitFor(() => expect(screen.getByTestId('active-factory')).toHaveTextContent('octo/hello'));
      // Chat scopes to the factory project itself until a repository is linked.
      expect(screen.getByTestId('resource-id')).toHaveTextContent('fp-1');
      expect(screen.getByTestId('session-enabled')).toHaveTextContent('yes');
      expect(screen.getByTestId('preparing')).toHaveTextContent('(idle)');
    });

    it('given a materialization failure, then the URL stays put and the error is exposed', async () => {
      seedFactories([LOCAL_FACTORY, SERVER_FACTORY]);
      server.use(
        http.post(ENSURE_URL, () =>
          HttpResponse.json({ error: 'Sandbox unavailable', code: 'sandbox_error' }, { status: 503 }),
        ),
      );
      renderProbe({ factoryId: SERVER_FACTORY.id });

      await waitFor(() => expect(screen.getByTestId('prepare-error')).not.toHaveTextContent('(none)'));
      // The factory stays active (URL is the source of truth); the page can
      // surface the error while chat scopes to the factory project resource.
      expect(screen.getByTestId('active-factory')).toHaveTextContent('octo/hello');
      expect(screen.getByTestId('resource-id')).toHaveTextContent('fp-1');
      expect(loadFactories().find(factory => factory.id === 'factory-server')?.resourceId).toBeUndefined();
    });
  });
});
