import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { clearComposerImages } from '../../domains/chat/services/composerDrafts';
import { renderWithProviders } from '../../../../e2e/ui/render';
import { createAppRoutes } from '../../router';
import { DRAFT_SESSION_ID, FACTORY_ID, stubDraftRoute } from './fixtures/draftRoute';

const OTHER_DRAFT_ID = '30000000-0000-4000-8000-000000000009';
const draftPath = (id: string) => `/factories/${FACTORY_ID}/user/new/${id}`;
const threadPath = `/factories/${FACTORY_ID}/user/threads/${DRAFT_SESSION_ID}`;
const settingsPath = `/factories/${FACTORY_ID}/settings/general`;

function stubRoutes() {
  // Registered first so the draft fixture's handlers win; settings only needs to mount, so its reads 404.
  server.use(http.all('*', () => HttpResponse.json({ error: 'not stubbed' }, { status: 404 })));
  return stubDraftRoute({ defaultModelId: 'openai/gpt-4o-mini' });
}

function renderAt(path: string) {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] });
  return { router, ...renderWithProviders(<RouterProvider router={router} />) };
}

async function readyComposer() {
  const message = await screen.findByRole('textbox', { name: 'Message' }, { timeout: 5000 });
  await waitFor(() => expect(message).toBeEnabled());
  return message;
}

async function leaveFor(router: ReturnType<typeof createMemoryRouter>, path: string) {
  await act(() => router.navigate(path));
  await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Message' })).not.toBeInTheDocument());
}

const screenshot = () => new File(['png'], 'shot.png', { type: 'image/png' });

describe('unsent composer content', () => {
  it('is still there after visiting settings and opening a new session again', async () => {
    stubRoutes();
    const user = userEvent.setup();
    const { router } = renderAt(draftPath(DRAFT_SESSION_ID));

    await user.type(await readyComposer(), 'half-written idea');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Attach image' })).toBeEnabled());
    await user.upload(screen.getByLabelText('Attach images'), screenshot());
    expect(await screen.findByRole('button', { name: 'Remove shot.png' })).toBeInTheDocument();

    await leaveFor(router, settingsPath);
    // "New session" opens a fresh draft id; the unsent work belongs to the Factory's new-session page.
    await act(() => router.navigate(draftPath(OTHER_DRAFT_ID)));

    expect(await readyComposer()).toHaveValue('half-written idea');
    expect(screen.getByRole('button', { name: 'Remove shot.png' })).toBeInTheDocument();
  });

  it('keeps the text, but not the images, across a reload', async () => {
    stubRoutes();
    const user = userEvent.setup();
    const first = renderAt(draftPath(DRAFT_SESSION_ID));

    await user.type(await readyComposer(), 'half-written idea');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Attach image' })).toBeEnabled());
    await user.upload(screen.getByLabelText('Attach images'), screenshot());
    expect(await screen.findByRole('button', { name: 'Remove shot.png' })).toBeInTheDocument();
    first.unmount();

    // A reload drops in-memory state; simulate it by forgetting the image store as the page would.
    clearComposerImages();
    renderAt(draftPath(OTHER_DRAFT_ID));

    expect(await readyComposer()).toHaveValue('half-written idea');
    expect(screen.queryByRole('button', { name: 'Remove shot.png' })).not.toBeInTheDocument();
  });

  it('is cleared once sent, so the next new session starts empty', async () => {
    const route = stubRoutes();
    const user = userEvent.setup();
    const { router } = renderAt(draftPath(DRAFT_SESSION_ID));

    await user.type(await readyComposer(), 'fix the login bug');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(router.state.location.pathname).toBe(threadPath));
    await waitFor(() => expect(route.posted).toEqual(['fix the login bug']));
    // The draft's text does not follow the prompt into its thread's composer.
    expect(await readyComposer()).toHaveValue('');

    await leaveFor(router, settingsPath);
    await act(() => router.navigate(draftPath(OTHER_DRAFT_ID)));
    expect(await readyComposer()).toHaveValue('');
  });

  it('is kept per thread', async () => {
    stubRoutes();
    const user = userEvent.setup();
    const { router } = renderAt(threadPath);

    await user.type(await readyComposer(), 'follow-up for this thread');
    await leaveFor(router, settingsPath);
    await act(() => router.navigate(draftPath(OTHER_DRAFT_ID)));
    // A new session does not pick up another thread's unsent text.
    expect(await readyComposer()).toHaveValue('');

    await act(() => router.navigate(threadPath));
    expect(await readyComposer()).toHaveValue('follow-up for this thread');
  });
});
