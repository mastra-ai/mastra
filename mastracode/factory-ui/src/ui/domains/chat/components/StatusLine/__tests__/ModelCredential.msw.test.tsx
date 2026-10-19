import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../e2e/ui/render';
import type { SessionModelCatalog } from '../../../../../../hooks/useSessionModelCatalog';
import { ChatModelsContext } from '../../../context/ChatModelsContext';
import type { ChatModelsApi } from '../../../context/ChatModelsContext';
import type { ChatSessionContextApi } from '../../../context/ChatSessionContext';
import { ChatSessionContext } from '../../../context/ChatSessionContext';
import { ModelCredential } from '../ModelCredential';

const SHANE = { id: 'user-shane', name: 'Shane Thomas' };
const DAMIEN = { id: 'user-damien', name: 'Damien Schneider' };
const MODEL_ID = 'anthropic/claude-opus-4-6';

function renderModelCredential({
  viewer = DAMIEN,
  owner,
  draft = false,
  projectScope = 'hybrid',
  threadScope,
  authEnabled = true,
  credentialLabel = 'Claude Pro/Max',
}: {
  viewer?: { id: string; name: string };
  owner?: ChatSessionContextApi['owner'];
  draft?: boolean;
  projectScope?: 'factory' | 'user' | 'hybrid';
  threadScope?: SessionModelCatalog['modelScope'];
  authEnabled?: boolean;
  credentialLabel?: string | null;
}) {
  const catalog: SessionModelCatalog = {
    models: [
      {
        id: MODEL_ID,
        provider: 'anthropic',
        modelName: 'Claude Opus 4.6',
        hasApiKey: true,
        credentialLabel: credentialLabel ?? undefined,
      },
    ],
    modelScope: threadScope,
    defaultModelId: null,
  };
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      authEnabled
        ? HttpResponse.json({
            authenticated: true,
            user: { userId: viewer.id, name: viewer.name, organizationId: 'org-1' },
          })
        : HttpResponse.json({ error: 'not_found' }, { status: 404 }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1`, () =>
      HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra', modelScope: projectScope } }),
    ),
    http.get(`${TEST_BASE_URL}/web/config/models`, () => HttpResponse.json(catalog)),
  );
  const session: ChatSessionContextApi = {
    resourceId: 'session-1',
    sessionThreadId: 'session-1',
    draftSessionId: draft ? 'draft-1' : undefined,
    sessionEnabled: true,
    resourceReady: true,
    sandboxReady: true,
    sandboxPreparing: false,
    resourceEnabled: true,
    baseUrl: TEST_BASE_URL,
    kind: 'user',
    owner,
  };
  const models: ChatModelsApi = {
    activeModelId: MODEL_ID,
    defaultModelId: undefined,
    isLoading: false,
    error: undefined,
    setModel: async () => {},
  };
  const submitComposer = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
  const view = renderWithProviders(
    <MemoryRouter initialEntries={['/factories/fp-1/work']}>
      <Routes>
        <Route
          path="/factories/:factoryId/*"
          element={
            <ChatSessionContext.Provider value={session}>
              <ChatModelsContext.Provider value={models}>
                <form onSubmit={submitComposer}>
                  <ModelCredential />
                </form>
              </ChatModelsContext.Provider>
            </ChatSessionContext.Provider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
  return { ...view, submitComposer };
}

const findCredential = (name: string) => screen.findByRole('button', { name });

describe('ModelCredential', () => {
  it('warns a teammate that their messages run on the session owner’s subscription', async () => {
    renderModelCredential({ owner: SHANE, threadScope: 'user' });

    expect(
      await findCredential(
        'Claude Pro/Max. Shane Thomas · session owner. Your messages use Shane Thomas’s Claude Pro/Max',
      ),
    ).toBeInTheDocument();
  });

  it('tells the session owner the credential is their own, without the teammate warning', async () => {
    renderModelCredential({ viewer: SHANE, owner: SHANE, threadScope: 'user' });

    expect(await findCredential('Claude Pro/Max. Shane Thomas · session owner (you)')).toBeInTheDocument();
  });

  it('names the organization API key for a work-item thread even in a hybrid Factory', async () => {
    renderModelCredential({ owner: SHANE, threadScope: 'factory', credentialLabel: 'Anthropic API key' });

    expect(await findCredential('Anthropic API key. Shared by the organization')).toBeInTheDocument();
  });

  it('names your credential on a new chat in a hybrid Factory, where you become the owner', async () => {
    renderModelCredential({ draft: true, projectScope: 'hybrid' });

    expect(await findCredential('Claude Pro/Max. Damien Schneider · session owner (you)')).toBeInTheDocument();
  });

  it('names the organization credential on a new chat in an organization-scoped Factory', async () => {
    renderModelCredential({ draft: true, projectScope: 'factory', credentialLabel: 'Anthropic API key' });

    expect(await findCredential('Anthropic API key. Shared by the organization')).toBeInTheDocument();
  });

  it('falls back to the provider connection when the catalog cannot tell a subscription from an API key', async () => {
    renderModelCredential({ draft: true, projectScope: 'factory', credentialLabel: null });

    expect(await findCredential('Anthropic connection. Shared by the organization')).toBeInTheDocument();
  });

  it('does not send the draft when someone clicks the credential icon inside the composer form', async () => {
    const { submitComposer } = renderModelCredential({ viewer: SHANE, owner: SHANE, threadScope: 'user' });

    await userEvent.click(await findCredential('Claude Pro/Max. Shane Thomas · session owner (you)'));

    expect(submitComposer).not.toHaveBeenCalled();
  });

  it('stays hidden on a local Factory without sign-in, where only your own credentials exist', async () => {
    const { client } = renderModelCredential({ draft: true, projectScope: 'factory', authEnabled: false });

    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
