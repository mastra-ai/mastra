import type { ModelCredentialHolder } from '@mastra/factory/routes/config';
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

function renderModelCredential({
  viewer = DAMIEN,
  owner,
  draft = false,
  authEnabled = true,
  provider = 'anthropic',
  credentialLabel = 'Claude Pro/Max',
  credentialHolder = 'personal',
}: {
  viewer?: { id: string; name: string };
  owner?: ChatSessionContextApi['owner'];
  draft?: boolean;
  authEnabled?: boolean;
  provider?: string;
  credentialLabel?: string | null;
  credentialHolder?: ModelCredentialHolder;
}) {
  const modelId = `${provider}/model-1`;
  const catalog: SessionModelCatalog = {
    models: [
      {
        id: modelId,
        provider,
        modelName: 'Model 1',
        hasApiKey: true,
        credentialLabel: credentialLabel ?? undefined,
        credentialHolder,
      },
    ],
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
      HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra', modelScope: 'hybrid' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/config/models`, () => HttpResponse.json(catalog)),
  );
  const session: ChatSessionContextApi = {
    sessionId: 'session-1',
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
    activeModelId: modelId,
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
    renderModelCredential({ owner: SHANE });

    expect(
      await findCredential(
        'Claude Pro/Max. Shane Thomas · session owner. Your messages use Shane Thomas’s Claude Pro/Max',
      ),
    ).toBeInTheDocument();
  });

  it('tells the session owner the credential is their own, without the teammate warning', async () => {
    renderModelCredential({ viewer: SHANE, owner: SHANE });

    expect(await findCredential('Claude Pro/Max. Shane Thomas · session owner (you)')).toBeInTheDocument();
  });

  it('names your credential on a new chat, where you become the owner', async () => {
    renderModelCredential({ draft: true });

    expect(await findCredential('Claude Pro/Max. Damien Schneider · session owner (you)')).toBeInTheDocument();
  });

  it('names you without claiming ownership on a thread no session row backs, such as a Slack channel thread', async () => {
    renderModelCredential({});

    expect(await findCredential('Claude Pro/Max. Damien Schneider (you)')).toBeInTheDocument();
  });

  it('credits the organization, not the session owner, when the model runs on an organization credential', async () => {
    renderModelCredential({ owner: SHANE, credentialHolder: 'organization', credentialLabel: 'Anthropic API key' });

    expect(await findCredential('Anthropic API key. Shared by the organization')).toBeInTheDocument();
  });

  it('credits the server, not a person, when the model runs on a key configured on the server', async () => {
    renderModelCredential({
      owner: SHANE,
      provider: 'amazon-bedrock',
      credentialHolder: 'deployment',
      credentialLabel: null,
    });

    expect(await findCredential('Amazon Bedrock connection. Configured on the server')).toBeInTheDocument();
  });

  it('falls back to the provider connection when the catalog cannot tell a subscription from an API key', async () => {
    renderModelCredential({ credentialHolder: 'organization', credentialLabel: null });

    expect(await findCredential('Anthropic connection. Shared by the organization')).toBeInTheDocument();
  });

  it('does not send the draft when someone clicks the credential icon inside the composer form', async () => {
    const { submitComposer } = renderModelCredential({ viewer: SHANE, owner: SHANE });

    await userEvent.click(await findCredential('Claude Pro/Max. Shane Thomas · session owner (you)'));

    expect(submitComposer).not.toHaveBeenCalled();
  });

  it('stays hidden on a local Factory without sign-in, where only your own credentials exist', async () => {
    const { client } = renderModelCredential({ draft: true, authEnabled: false });

    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
