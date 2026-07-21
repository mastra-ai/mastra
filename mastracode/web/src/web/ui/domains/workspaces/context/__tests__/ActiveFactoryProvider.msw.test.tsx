/**
 * BDD coverage for `ActiveFactoryProvider` (`domains/workspaces/context`).
 *
 * The provider exposes the existing `useActiveFactory()` hook through context
 * so factory selection is consumed via `useActiveFactoryContext()` instead of
 * being prop-drilled from the chat composition root. Server factories with a
 * selected repository are materialized into their cloud sandbox on selection
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

function seedFactory(factory: Factory = LOCAL_FACTORY, active = true) {
  localStorage.setItem('mastracode-factories', JSON.stringify([factory]));
  if (active) localStorage.setItem('mastracode-active-factory', factory.id);
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

function renderProbe(selectTarget?: Factory) {
  return renderWithProviders(
    <ActiveFactoryProvider>
      <Probe selectTarget={selectTarget} />
    </ActiveFactoryProvider>,
  );
}

describe('ActiveFactoryProvider', () => {
  it('given a seeded active factory, then it exposes the factories and active selection', async () => {
    seedFactory();
    renderProbe();

    await waitFor(() => expect(screen.getByTestId('active-factory')).toHaveTextContent('MastraCode Test'));
    expect(screen.getByTestId('factory-count')).toHaveTextContent('1');
    expect(screen.getByTestId('active-factory-id')).toHaveTextContent('factory-test');
    expect(screen.getByTestId('resource-id')).toHaveTextContent('resource-test');
    expect(screen.getByTestId('session-enabled')).toHaveTextContent('yes');
    // `activeFactory` is the canonical field; the redundant id field is gone.
    expect(screen.getByTestId('has-legacy-id-field')).toHaveTextContent('no');
  });

  it('given an active factory, when selectFactory(null) is called, then the selection clears', async () => {
    seedFactory();
    renderProbe();

    await waitFor(() => expect(screen.getByTestId('active-factory')).toHaveTextContent('MastraCode Test'));
    await userEvent.click(screen.getByRole('button', { name: 'clear selection' }));

    expect(screen.getByTestId('active-factory')).toHaveTextContent('(none)');
    expect(screen.getByTestId('active-factory-id')).toHaveTextContent('(none)');
    expect(screen.getByTestId('session-enabled')).toHaveTextContent('no');
  });

  it('given no provider, when useActiveFactoryContext is called, then it throws a descriptive error', () => {
    expect(() => render(<Probe />)).toThrow('useActiveFactoryContext must be used within an ActiveFactoryProvider');
  });

  describe('server factories', () => {
    it('given a factory with a linked repository, when selected, then it is materialized via /ensure with live progress and activated with the server resourceId', async () => {
      seedFactory(SERVER_FACTORY, false);
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
      renderProbe(SERVER_FACTORY);

      await waitFor(() => expect(screen.getByTestId('factory-count')).toHaveTextContent('1'));
      await userEvent.click(screen.getByRole('button', { name: 'select target' }));

      // Preparation feedback is exposed while the server works.
      await waitFor(() => expect(screen.getByTestId('preparing')).not.toHaveTextContent('(idle)'));
      expect(screen.getByTestId('active-factory')).toHaveTextContent('(none)');
      release();

      await waitFor(() => expect(screen.getByTestId('active-factory')).toHaveTextContent('octo/hello'));
      expect(screen.getByTestId('resource-id')).toHaveTextContent('resource-gh');
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

    it('given a factory without linked repositories, when selected, then it activates against the factory project resource without materialization', async () => {
      const emptyFactory: ServerFactory = {
        ...SERVER_FACTORY,
        binding: { kind: 'factory', factoryProjectId: 'fp-1', repositories: [] },
      };
      seedFactory(emptyFactory, false);
      renderProbe(emptyFactory);

      await waitFor(() => expect(screen.getByTestId('factory-count')).toHaveTextContent('1'));
      await userEvent.click(screen.getByRole('button', { name: 'select target' }));

      await waitFor(() => expect(screen.getByTestId('active-factory')).toHaveTextContent('octo/hello'));
      // Chat scopes to the factory project itself until a repository is linked.
      expect(screen.getByTestId('resource-id')).toHaveTextContent('fp-1');
      expect(screen.getByTestId('session-enabled')).toHaveTextContent('yes');
      expect(screen.getByTestId('preparing')).toHaveTextContent('(idle)');
    });

    it('given a materialization failure, when selected, then the previous selection stays put and the error is exposed', async () => {
      localStorage.setItem('mastracode-factories', JSON.stringify([LOCAL_FACTORY, SERVER_FACTORY]));
      localStorage.setItem('mastracode-active-factory', LOCAL_FACTORY.id);

      server.use(
        http.post(ENSURE_URL, () =>
          HttpResponse.json({ error: 'Sandbox unavailable', code: 'sandbox_error' }, { status: 503 }),
        ),
      );
      renderProbe(SERVER_FACTORY);

      await waitFor(() => expect(screen.getByTestId('active-factory')).toHaveTextContent('MastraCode Test'));
      await userEvent.click(screen.getByRole('button', { name: 'select target' }));

      await waitFor(() => expect(screen.getByTestId('prepare-error')).not.toHaveTextContent('(none)'));
      expect(screen.getByTestId('active-factory')).toHaveTextContent('MastraCode Test');
      expect(screen.getByTestId('session-enabled')).toHaveTextContent('yes');
      expect(loadFactories().find(factory => factory.id === 'factory-server')?.resourceId).toBeUndefined();
    });
  });
});
