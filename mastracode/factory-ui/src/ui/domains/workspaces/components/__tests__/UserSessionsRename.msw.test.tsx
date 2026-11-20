import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { listedRepository } from '../../../../../../e2e/ui/factory-projects';
import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { ChatSessionContext } from '../../../chat/context/ChatSessionContext';
import type { FactoryUserSession } from '../../services/user-sessions';
import { SessionsSection } from '../SessionsSection';
import { testChatSession } from './fixtures/sessionsSection';

const projectRepositoryId = 'ghp-1';
const sessionId = 'sess-1';

const session: FactoryUserSession = {
  id: 'row-1',
  sessionId,
  projectRepositoryId,
  orgId: 'org-1',
  userId: 'user-1',
  visibility: 'org' as const,
  branch: 'user/my-feature',
  baseBranch: 'main',
  title: 'Tell me what have been done',
  sandboxId: null,
  sandboxWorkdir: null,
  materializedAt: null,
  createdAt: '2026-07-23T00:00:00.000Z',
  updatedAt: '2026-07-23T00:00:00.000Z',
};

const project = {
  id: 'fp-1',
  name: 'Mastra',
  repositories: [listedRepository(projectRepositoryId, 'octo/hello', { branch: 'main' })],
};

function useFactoryFixtures(sessions: () => FactoryUserSession[], viewerId = session.userId) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () => HttpResponse.json({ projects: [project] })),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryId/sessions`, () =>
      HttpResponse.json({ sessions: sessions() }),
    ),
    http.get(`${TEST_BASE_URL}/api/agent-controller/:agentControllerId/sessions/:resourceId/threads`, () =>
      HttpResponse.json({ threads: [] }),
    ),
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authEnabled: true, authenticated: true, user: { userId: viewerId } }),
    ),
  );
}

function renderSection() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/factories/fp-1']}>
      <ChatSessionContext.Provider value={testChatSession('fp-1', projectRepositoryId)}>
        <Routes>
          <Route path="/factories/:factoryId" element={<SessionsSection />} />
        </Routes>
      </ChatSessionContext.Provider>
      <Toaster position="bottom-right" />
    </MemoryRouter>,
  );
}

async function openRename(user: ReturnType<typeof userEvent.setup>, entry: string) {
  if (entry === 'context') {
    await user.pointer({ target: await screen.findByRole('link', { name: session.title! }), keys: '[MouseRight]' });
  } else {
    await user.click(await screen.findByRole('button', { name: `Session actions for ${session.title}` }));
  }
  await user.click(await screen.findByRole('menuitem', { name: 'Rename' }));
  return screen.findByRole('textbox', { name: 'Session title' });
}

describe('Renaming a session by hand', () => {
  it.each(['dropdown', 'context'])('saves the typed title from the %s menu', async entry => {
    let sessions = [session];
    const sent: unknown[] = [];
    useFactoryFixtures(() => sessions);
    server.use(
      http.put(`${TEST_BASE_URL}/web/user-sessions/${sessionId}/title`, async ({ request }) => {
        sent.push(await request.json());
        sessions = [{ ...session, title: 'Launch checklist' }];
        return HttpResponse.json({ title: 'Launch checklist' });
      }),
    );

    const user = userEvent.setup();
    const { client } = renderSection();

    const input = await openRename(user, entry);
    expect(input).toHaveValue('Tell me what have been done');
    await user.clear(input);
    await user.type(input, '  Launch checklist{Enter}');
    await waitForMutationsIdle(client);

    expect(sent).toEqual([{ title: 'Launch checklist' }]);
    expect(await screen.findByRole('link', { name: 'Launch checklist' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Session title' })).not.toBeInTheDocument());
  });

  it('keeps the dialog open with the reason when the server refuses the title', async () => {
    useFactoryFixtures(() => [session]);
    server.use(
      http.put(`${TEST_BASE_URL}/web/user-sessions/${sessionId}/title`, () =>
        HttpResponse.json({ error: 'This session has no conversation to name yet.' }, { status: 409 }),
      ),
    );

    const user = userEvent.setup();
    const { client } = renderSection();

    const input = await openRename(user, 'dropdown');
    await user.clear(input);
    await user.type(input, 'Launch checklist');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitForMutationsIdle(client);

    expect(await screen.findByRole('alert')).toHaveTextContent('This session has no conversation to name yet.');
    expect(screen.getByRole('textbox', { name: 'Session title' })).toHaveValue('Launch checklist');
    // The open dialog hides the page behind it from assistive tech.
    expect(screen.getByRole('link', { name: session.title!, hidden: true })).toBeInTheDocument();

    // The reason was for the refused title; it goes once the title is edited.
    await user.type(screen.getByRole('textbox', { name: 'Session title' }), ' v2');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not save when Enter only confirms an input-method candidate', async () => {
    const sent: unknown[] = [];
    useFactoryFixtures(() => [session]);
    server.use(
      http.put(`${TEST_BASE_URL}/web/user-sessions/${sessionId}/title`, async ({ request }) => {
        sent.push(await request.json());
        return HttpResponse.json({ title: 'x' });
      }),
    );

    const user = userEvent.setup();
    const { client } = renderSection();

    const input = await openRename(user, 'dropdown');
    await user.clear(input);
    await user.type(input, 'にほん');
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 });
    await waitForMutationsIdle(client);

    expect(sent).toEqual([]);
    expect(screen.getByRole('textbox', { name: 'Session title' })).toHaveValue('にほん');
  });

  it('does not save an empty title', async () => {
    const sent: unknown[] = [];
    useFactoryFixtures(() => [session]);
    server.use(
      http.put(`${TEST_BASE_URL}/web/user-sessions/${sessionId}/title`, async ({ request }) => {
        sent.push(await request.json());
        return HttpResponse.json({ title: 'x' });
      }),
    );

    const user = userEvent.setup();
    renderSection();

    const input = await openRename(user, 'dropdown');
    await user.clear(input);
    await user.type(input, '   {Enter}');

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(sent).toEqual([]);
  });

  it('accepts as many emoji as the server keeps', async () => {
    useFactoryFixtures(() => [session]);

    const user = userEvent.setup();
    renderSection();

    const input = await openRename(user, 'dropdown');
    await user.clear(input);
    await user.paste('🚀'.repeat(85));

    expect(input).toHaveValue('🚀'.repeat(80));
  });

  it('does not count whitespace the server drops against the limit', async () => {
    useFactoryFixtures(() => [session]);

    const user = userEvent.setup();
    renderSection();

    const input = await openRename(user, 'dropdown');
    await user.clear(input);
    const spaced = `A${' '.repeat(79)}B`;
    await user.paste(spaced);

    expect(input).toHaveValue(spaced);
  });

  it('cuts text that is still too long once its extra whitespace is dropped', async () => {
    useFactoryFixtures(() => [session]);

    const user = userEvent.setup();
    renderSection();

    const input = await openRename(user, 'dropdown');
    await user.clear(input);
    // 60 words of one letter, two spaces apart: stored as 119 characters, so only 40 words fit.
    await user.paste(Array.from({ length: 60 }, () => 'a').join('  '));

    expect(input).toHaveValue(Array.from({ length: 40 }, () => 'a').join('  ') + '  ');
  });

  it("offers no rename on a teammate's session", async () => {
    useFactoryFixtures(() => [session], 'user-2');

    const user = userEvent.setup();
    renderSection();

    await user.click(await screen.findByRole('button', { name: `Session actions for ${session.title}` }));
    expect(await screen.findByRole('menuitem', { name: 'Pin session' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Rename' })).not.toBeInTheDocument();
  });
});
