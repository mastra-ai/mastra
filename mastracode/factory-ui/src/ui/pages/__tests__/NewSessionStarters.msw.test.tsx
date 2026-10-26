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
  it('previews a starter prompt in the composer while it is hovered, gives my draft back after, and sends it on click', async () => {
    const route = stubDraftRoute();
    const user = userEvent.setup();
    const { router, client } = renderDraft();

    const message = await screen.findByRole<HTMLTextAreaElement>('textbox', { name: 'Message' });
    await waitFor(() => expect(message).toBeEnabled());
    await user.type(message, 'my own idea');

    const starters = screen.getByRole('region', { name: 'Start from a prompt' });
    const starter = within(starters).getByRole('button', { name: /^Triage new intake/ });
    await user.hover(starter);
    const previewed = message.value;
    expect(previewed).not.toBe('my own idea');
    expect(starter).toHaveTextContent(previewed);

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

  it('gives the composer back empty when the cards vanish under the pointer and later return', async () => {
    stubDraftRoute();
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
    await user.hover(screen.getByRole('button', { name: /^Triage new intake/ }));

    answerProviders('none');
    await client.invalidateQueries({ queryKey: queryKeys.providers() });
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Message' })).not.toBeInTheDocument());

    answerProviders('env');
    await client.invalidateQueries({ queryKey: queryKeys.providers() });

    const returned = await screen.findByRole('textbox', { name: 'Message' });
    expect(returned).toHaveValue('');
    expect(returned).not.toHaveAttribute('readonly');
  });

  it('counts the Work board cards in each pipeline stage, leaving out intake, finished work and pull requests', async () => {
    stubDraftRoute({
      workItems: [
        card('triage-1', ['triage']),
        card('triage-2', ['triage']),
        card('building', ['execute']),
        card('reviewing', ['review']),
        card('intake', ['intake']),
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
    ).toEqual(['Triage 2', 'Planning 0', 'Building 1', 'Review 1']);
  });
});
