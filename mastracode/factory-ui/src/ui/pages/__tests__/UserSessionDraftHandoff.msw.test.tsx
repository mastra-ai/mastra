import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { renderWithProviders, waitForMutationsIdle } from '../../../../e2e/ui/render';
import { createAppRoutes } from '../../router';
import { DRAFT_SESSION_ID, FACTORY_ID, stubDraftRoute } from './fixtures/draftRoute';

if (typeof globalThis.Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

describe('a user session draft on the real thread route', () => {
  it('given a new draft, when the first prompt is sent, then the session starts without a mode picker or mode switch', async () => {
    const route = stubDraftRoute({ defaultModelId: 'openai/gpt-4o-mini' });
    const user = userEvent.setup();
    const router = createMemoryRouter(createAppRoutes(), {
      initialEntries: [`/factories/${FACTORY_ID}/user/new/${DRAFT_SESSION_ID}`],
    });
    const { client } = renderWithProviders(<RouterProvider router={router} />);

    const message = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message).toBeEnabled());
    expect(screen.queryByLabelText('Session mode')).not.toBeInTheDocument();
    await user.type(message, 'fix the login bug');
    await user.keyboard('{Enter}');

    await waitFor(() =>
      expect(route.createBodies).toEqual([
        { sessionId: DRAFT_SESSION_ID, title: 'fix the login bug', visibility: 'private' },
      ]),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/user/threads/${DRAFT_SESSION_ID}`),
    );
    await waitFor(() => expect(route.posted).toEqual(['fix the login bug']));
    expect(route.bindingsBeforePrompt).toEqual([]);
    const thread = within(screen.getByRole('main'));
    // The title lands in the header breadcrumb as well; the transcript renders the message as a paragraph.
    await waitFor(() => expect(thread.getByText('fix the login bug', { selector: 'p' })).toBeInTheDocument());
    expect(thread.queryByText(/Failed to load messages/)).not.toBeInTheDocument();

    route.finishWorkspace();
    await waitForMutationsIdle(client);
    expect(route.posted).toEqual(['fix the login bug']);
  });

  it('reads a session reopened before its thread exists as empty, then loads it once the session boots', async () => {
    const route = stubDraftRoute({
      persistedMessages: [
        {
          id: 'persisted-prompt',
          role: 'user',
          createdAt: '2026-08-07T09:00:01.000Z',
          content: { format: 2, parts: [{ type: 'text', text: 'resume after reload' }] },
        },
      ],
    });
    // A reload lands straight on the thread route, with none of the draft handoff's client state.
    const router = createMemoryRouter(createAppRoutes(), {
      initialEntries: [`/factories/${FACTORY_ID}/user/threads/${DRAFT_SESSION_ID}`],
    });
    renderWithProviders(<RouterProvider router={router} />);

    await screen.findByRole('textbox', { name: 'Message' });
    // Give the messages read time to land: before the fix it surfaced the 404.
    await waitFor(() => expect(screen.queryByLabelText('Loading session')).not.toBeInTheDocument());
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(screen.queryByText(/Failed to load messages/)).not.toBeInTheDocument();

    route.finishWorkspace();
    expect(await screen.findByText('resume after reload', undefined, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByText(/Failed to load messages/)).not.toBeInTheDocument();
  });

  it('does not switch models when the draft already uses the personal default', async () => {
    const route = stubDraftRoute({ defaultModelId: 'openai/gpt-4o-mini' });
    const user = userEvent.setup();
    const router = createMemoryRouter(createAppRoutes(), {
      initialEntries: [`/factories/${FACTORY_ID}/user/new/${DRAFT_SESSION_ID}`],
    });
    const { client } = renderWithProviders(<RouterProvider router={router} />);

    const message = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message).toBeEnabled());
    await user.type(message, 'keep the default');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(route.posted).toEqual(['keep the default']));
    expect(route.bindingsBeforePrompt).toEqual([]);

    route.finishWorkspace();
    await waitForMutationsIdle(client);
  });

  it('hands a thinking level picked in the draft to the new session with its model', async () => {
    const route = stubDraftRoute({ defaultModelId: 'openai/gpt-4o-mini' });
    const user = userEvent.setup();
    const router = createMemoryRouter(createAppRoutes(), {
      initialEntries: [`/factories/${FACTORY_ID}/user/new/${DRAFT_SESSION_ID}`],
    });
    const { client } = renderWithProviders(<RouterProvider router={router} />);

    const message = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message).toBeEnabled());
    await user.click(await screen.findByRole('button', { name: 'Thinking: Medium · Built-in default' }));
    const ramp = screen.getByRole('slider', { name: 'Thinking' });
    fireEvent.change(ramp, { target: { value: '3' } });
    fireEvent.keyUp(ramp);
    await user.type(message, 'think harder');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(route.posted).toEqual(['think harder']));
    expect(route.bindingsBeforePrompt).toEqual(['model:openai/gpt-4o-mini thinking:high']);

    route.finishWorkspace();
    await waitForMutationsIdle(client);
  });

  it('starts the session on the defaults when the draft level is reset before the first message', async () => {
    const route = stubDraftRoute({ defaultModelId: 'openai/gpt-4o-mini' });
    const user = userEvent.setup();
    const router = createMemoryRouter(createAppRoutes(), {
      initialEntries: [`/factories/${FACTORY_ID}/user/new/${DRAFT_SESSION_ID}`],
    });
    const { client } = renderWithProviders(<RouterProvider router={router} />);

    const message = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message).toBeEnabled());
    await user.click(await screen.findByRole('button', { name: 'Thinking: Medium · Built-in default' }));
    const ramp = screen.getByRole('slider', { name: 'Thinking' });
    fireEvent.change(ramp, { target: { value: '3' } });
    fireEvent.keyUp(ramp);
    await user.click(await screen.findByRole('button', { name: 'Use default' }));
    expect(await screen.findByText('Follows the Built-in default.')).toBeInTheDocument();
    await user.type(message, 'use the default');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(route.posted).toEqual(['use the default']));
    expect(route.bindingsBeforePrompt).toEqual([]);

    route.finishWorkspace();
    await waitForMutationsIdle(client);
  });

  it('keeps typing free while the draft model resolves, but holds the send', async () => {
    let releaseModelDefaults = () => {};
    const modelDefaultsGate = new Promise<void>(resolve => {
      releaseModelDefaults = resolve;
    });
    const route = stubDraftRoute({ modelDefaultsGate, defaultModelId: 'openai/gpt-4o-mini' });
    const user = userEvent.setup();
    const router = createMemoryRouter(createAppRoutes(), {
      initialEntries: [`/factories/${FACTORY_ID}/user/new/${DRAFT_SESSION_ID}`],
    });
    renderWithProviders(<RouterProvider router={router} />);

    const message = await screen.findByRole('textbox', { name: 'Message' });
    expect(await screen.findByLabelText('Loading model')).toBeInTheDocument();
    expect(message).toBeEnabled();

    await user.type(message, 'fix the login bug');
    await user.keyboard('{Enter}');

    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    expect(message).toHaveValue('fix the login bug');
    expect(route.createBodies).toEqual([]);

    releaseModelDefaults();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled());
    expect(message).toHaveValue('fix the login bug');
  });
});
