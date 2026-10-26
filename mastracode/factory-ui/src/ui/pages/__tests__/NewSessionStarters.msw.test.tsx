import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../e2e/ui/render';
import { queryKeys } from '../../../api/keys';
import { workItem } from '../../__tests__/workBoardStubs';
import { createAppRoutes } from '../../router';
import { DRAFT_SESSION_ID, FACTORY_ID, stubDraftRoute } from './fixtures/draftRoute';

if (typeof globalThis.Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

function renderDraft() {
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [`/factories/${FACTORY_ID}/user/new/${DRAFT_SESSION_ID}`],
  });
  return { router, ...renderWithProviders(<RouterProvider router={router} />) };
}

function card(id: string, stages: string[], board = 'work') {
  return { ...workItem(id, id, '2026-08-01T00:00:00.000Z', '2026-08-02T00:00:00.000Z'), stages, board };
}

describe('the new session page', () => {
  it('asks the signed-in person, by first name, what to ship', async () => {
    stubDraftRoute();
    server.use(
      http.get(`${TEST_BASE_URL}/auth/me`, () =>
        HttpResponse.json({
          authenticated: true,
          authEnabled: true,
          user: { userId: 'user-1', name: ' Dustin Moskovitz ' },
        }),
      ),
    );
    renderDraft();

    expect(await screen.findByRole('heading', { level: 1, name: 'What should we ship, Dustin?' })).toBeInTheDocument();
  });

  it('suggests triaging the cards waiting in Intake, previews that prompt while hovered, gives my draft back after, and sends it on click', async () => {
    const route = stubDraftRoute({
      workItems: [card('Login fails on Safari', ['intake']), card('Add dark mode', ['intake'])],
    });
    const user = userEvent.setup();
    const { router, client } = renderDraft();

    const message = await screen.findByRole<HTMLTextAreaElement>('textbox', { name: 'Message' });
    await waitFor(() => expect(message).toBeEnabled());
    await user.type(message, 'my own idea');

    const starters = await screen.findByRole('list', { name: 'Start from a prompt' });
    const starter = within(starters).getByRole('button', { name: /^Triage 2 cards in Intake/ });
    await user.hover(starter);
    const previewed = message.value;
    expect(previewed).toContain('Login fails on Safari');
    expect(previewed).toContain('Add dark mode');

    await user.unhover(starter);
    expect(message).toHaveValue('my own idea');

    await user.click(starter);

    await waitFor(() =>
      expect(route.createBodies).toEqual([{ sessionId: DRAFT_SESSION_ID, title: previewed, visibility: 'private' }]),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/user/threads/${DRAFT_SESSION_ID}`),
    );
    await waitFor(() => expect(route.posted).toEqual([previewed]));

    route.finishWorkspace();
    await waitForMutationsIdle(client);
  });

  it('offers no prompt when nothing on the board waits on anyone', async () => {
    stubDraftRoute({ workItems: [card('building', ['execute']), card('done', ['done'])] });
    renderDraft();

    expect(await screen.findByRole('region', { name: 'In flight' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Start from a prompt' })).not.toBeInTheDocument();
  });

  it('gives the composer back empty when the prompts vanish under the pointer and later return', async () => {
    stubDraftRoute({ workItems: [card('Login fails on Safari', ['intake'])] });
    const user = userEvent.setup();
    const { client } = renderDraft();
    const answerProviders = (source: string) =>
      server.use(
        http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
          HttpResponse.json({ providers: [{ provider: 'openai', source }] }),
        ),
      );

    const message = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message).toBeEnabled());
    await user.hover(await screen.findByRole('button', { name: /^Triage 1 card in Intake/ }));

    answerProviders('none');
    await client.invalidateQueries({ queryKey: queryKeys.providers() });
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Message' })).not.toBeInTheDocument());

    answerProviders('env');
    await client.invalidateQueries({ queryKey: queryKeys.providers() });

    const returned = await screen.findByRole('textbox', { name: 'Message' });
    expect(returned).toHaveValue('');
    expect(returned).not.toHaveAttribute('readonly');
  });

  it('counts the Work board cards in each open stage, a card with no stage in Intake as the board shows it, leaving out finished work and pull requests', async () => {
    stubDraftRoute({
      workItems: [
        card('intake', ['intake']),
        card('unstaged', []),
        card('triage-1', ['triage']),
        card('triage-2', ['triage']),
        card('building', ['execute']),
        card('reviewing', ['review']),
        card('done', ['done']),
        card('canceled', ['canceled']),
        card('pull-request', ['review'], 'review'),
      ],
    });
    renderDraft();

    const inFlight = await screen.findByRole('region', { name: 'In flight' });

    expect(
      within(inFlight)
        .getAllByRole('listitem')
        .map(stage => stage.textContent),
    ).toEqual(['Intake 2', 'Triage 2', 'Planning 0', 'Building 1', 'Review 1']);
  });
});
