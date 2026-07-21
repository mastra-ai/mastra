/**
 * BDD coverage for Settings › Model › Factory default model.
 *
 * The picker persists a default model on the server-backed Factory project
 * (`PATCH /web/factory/projects/:id`), which factory runs start on. Local
 * folder factories have no server project, so the picker does not render.
 */
import type { AgentControllerAvailableModel } from '@mastra/client-js';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import { ActiveFactoryProvider } from '../../../workspaces';
import { FactoryDefaultModelSection } from '../FactoryDefaultModelSection';

const models: AgentControllerAvailableModel[] = [
  { id: 'openai/gpt-4o-mini', provider: 'openai', modelName: 'gpt-4o-mini', hasApiKey: true, useCount: 1 },
  { id: 'anthropic/claude-sonnet', provider: 'anthropic', modelName: 'claude-sonnet', hasApiKey: true, useCount: 0 },
];

function seedLocalFactory() {
  localStorage.setItem(
    'mastracode-factories',
    JSON.stringify([
      {
        id: 'factory-local',
        name: 'Local Factory',
        resourceId: 'resource-local',
        createdAt: 1,
        binding: { kind: 'local', path: '/tmp/local' },
      },
    ]),
  );
  localStorage.setItem('mastracode-active-factory', 'factory-local');
}

function seedServerFactory() {
  localStorage.setItem(
    'mastracode-factories',
    JSON.stringify([
      {
        id: 'factory-server',
        name: 'My Factory',
        resourceId: 'resource-server',
        createdAt: 1,
        binding: {
          kind: 'factory',
          factoryProjectId: 'fp-1',
          repositories: [{ projectRepositoryId: 'pr-1', slug: 'octo/hello', worktrees: [] }],
        },
      },
    ]),
  );
  localStorage.setItem('mastracode-active-factory', 'factory-server');
}

function renderSection() {
  return renderWithProviders(
    <ActiveFactoryProvider>
      <FactoryDefaultModelSection models={models} />
    </ActiveFactoryProvider>,
  );
}

/** Open the searchable combobox and pick an option (Base UI selects on pointer events). */
async function pickOption(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement, name: RegExp) {
  await user.click(trigger);
  const option = await screen.findByRole('option', { name });
  fireEvent.pointerDown(option, { pointerType: 'mouse' });
  fireEvent.click(option, { detail: 1 });
}

afterEach(() => {
  localStorage.clear();
});

describe('FactoryDefaultModelSection', () => {
  it('given a local factory, when rendered, then no default-model picker appears', async () => {
    seedLocalFactory();

    renderSection();

    expect(screen.queryByLabelText('Factory default model')).not.toBeInTheDocument();
  });

  it('given a server factory without a default model, when rendered, then the picker shows the session default', async () => {
    seedServerFactory();
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1`, () =>
        HttpResponse.json({ project: { id: 'fp-1', name: 'My Factory', defaultModelId: null } }),
      ),
    );

    renderSection();

    const picker = await screen.findByLabelText('Factory default model');
    await waitFor(() => expect(picker).not.toBeDisabled());
    expect(picker).toHaveTextContent('Session default');
  });

  it('given a server factory, when a model is picked, then it is persisted on the Factory project', async () => {
    seedServerFactory();
    const patches: unknown[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1`, () =>
        HttpResponse.json({ project: { id: 'fp-1', name: 'My Factory', defaultModelId: null } }),
      ),
      http.patch(`${TEST_BASE_URL}/web/factory/projects/fp-1`, async ({ request }) => {
        const body = (await request.json()) as { defaultModelId: string | null };
        patches.push(body);
        return HttpResponse.json({ project: { id: 'fp-1', name: 'My Factory', defaultModelId: body.defaultModelId } });
      }),
    );
    const user = userEvent.setup();

    renderSection();

    const picker = await screen.findByLabelText('Factory default model');
    await waitFor(() => expect(picker).not.toBeDisabled());
    await pickOption(user, picker, /anthropic\/claude-sonnet/);

    await waitFor(() => expect(patches).toEqual([{ defaultModelId: 'anthropic/claude-sonnet' }]));
    await waitFor(() => expect(picker).toHaveTextContent('anthropic/claude-sonnet'));
  });

  it('given a persisted default model, when cleared, then null is sent to the server', async () => {
    seedServerFactory();
    const patches: unknown[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1`, () =>
        HttpResponse.json({ project: { id: 'fp-1', name: 'My Factory', defaultModelId: 'openai/gpt-4o-mini' } }),
      ),
      http.patch(`${TEST_BASE_URL}/web/factory/projects/fp-1`, async ({ request }) => {
        const body = (await request.json()) as { defaultModelId: string | null };
        patches.push(body);
        return HttpResponse.json({ project: { id: 'fp-1', name: 'My Factory', defaultModelId: body.defaultModelId } });
      }),
    );
    const user = userEvent.setup();

    renderSection();

    const picker = await screen.findByLabelText('Factory default model');
    await waitFor(() => expect(picker).toHaveTextContent('openai/gpt-4o-mini'));
    await pickOption(user, picker, /Session default/);

    await waitFor(() => expect(patches).toEqual([{ defaultModelId: null }]));
  });
});
