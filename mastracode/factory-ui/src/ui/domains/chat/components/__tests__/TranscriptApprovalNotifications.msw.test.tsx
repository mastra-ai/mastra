import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import type { NotificationEntry, TimelineEntry } from '../../services/transcript';
import { TranscriptEntries } from '../Transcript';

const factoryId = 'fp-1';
const PHASE = 'plan-session';

/** What a card's phase session tells the sessions following the card when it waits on someone. */
function waitingNotice(attributes: Record<string, string>, notifKind = 'blocked'): NotificationEntry {
  return {
    kind: 'notification',
    id: 'waiting',
    source: 'factory',
    notifKind,
    priority: 'urgent',
    message: 'The plan session for #49 is waiting on submit_plan and needs an answer.',
    attributes: { 'from-session': PHASE, 'from-thread': PHASE, 'work-item': '#49', role: 'plan', ...attributes },
  };
}

const approvalNotice = () =>
  waitingNotice({ 'waiting-for': 'approval', 'parked-tool': 'submit_plan', 'tool-call-id': 'call_plan' });

describe('A notification that a followed card’s phase session waits on someone', () => {
  let parkedSessionIds: string[];
  let answers: Array<{ sessionId: unknown; body: unknown }>;
  let refusal: { status: number; error: string } | undefined;

  beforeEach(() => {
    parkedSessionIds = [PHASE];
    answers = [];
    refusal = undefined;
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/work-items`, () =>
        HttpResponse.json({ workItems: [], runningSessionIds: [], parkedSessionIds }),
      ),
      http.post(`${TEST_BASE_URL}/web/user-sessions/:sessionId/parked-approval`, async ({ params, request }) => {
        if (refusal) return HttpResponse.json({ error: refusal.error }, { status: refusal.status });
        const body = (await request.json()) as { decision: string };
        answers.push({ sessionId: params.sessionId, body });
        parkedSessionIds = [];
        return HttpResponse.json({ answered: body.decision, sessionId: params.sessionId, toolCallId: 'call_plan' });
      }),
    );
  });

  function renderNotice(entry: TimelineEntry) {
    const view = renderWithProviders(
      <MemoryRouter initialEntries={[`/factories/${factoryId}/user/threads/my-session`]}>
        <Routes>
          <Route
            path="/factories/:factoryId/user/threads/:threadId"
            element={<TranscriptEntries entries={[entry]} onApprove={() => {}} onRespond={() => {}} />}
          />
        </Routes>
      </MemoryRouter>,
    );
    return { ...view, notice: within(screen.getByRole('group', { name: 'Waiting session' })) };
  }

  it.each([
    ['Approve', 'approve', 'Approved'],
    ['Decline', 'decline', 'Declined'],
  ])('answers the waiting call with %s, right in the chat, and then says so', async (button, decision, outcome) => {
    const { client, notice } = renderNotice(approvalNotice());

    await userEvent.click(await notice.findByRole('button', { name: button }));
    await waitForMutationsIdle(client);

    expect(answers).toEqual([{ sessionId: PHASE, body: { decision, toolCallId: 'call_plan' } }]);
    expect(notice.getByText(outcome)).toBeVisible();
    expect(notice.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(notice.queryByRole('button', { name: 'Decline' })).not.toBeInTheDocument();
  });

  it('offers the answer on the notice as the chat stores it, so it is still there after a reload', async () => {
    const createdAt = new Date('2026-07-15T10:00:00.000Z');
    const { client, notice } = renderNotice({
      kind: 'message',
      id: 'stored',
      message: {
        id: 'stored',
        role: 'signal',
        createdAt,
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'The plan session for #49 is waiting on submit_plan and needs an answer.' }],
          metadata: {
            signal: {
              id: 'stored',
              type: 'notification',
              tagName: 'notification',
              createdAt: createdAt.toISOString(),
              attributes: {
                id: 'notification-1',
                source: 'factory',
                type: 'blocked',
                kind: 'blocked',
                priority: 'urgent',
                status: 'blocked',
                'from-session': PHASE,
                'from-thread': PHASE,
                'waiting-for': 'approval',
                'parked-tool': 'submit_plan',
                'tool-call-id': 'call_plan',
              },
            },
          },
        },
      },
    });

    await userEvent.click(await notice.findByRole('button', { name: 'Approve' }));
    await waitForMutationsIdle(client);

    expect(answers).toEqual([{ sessionId: PHASE, body: { decision: 'approve', toolCallId: 'call_plan' } }]);
  });

  it('links to the session that waits', async () => {
    const { notice } = renderNotice(approvalNotice());

    expect(await notice.findByRole('link', { name: 'Open session' })).toHaveAttribute(
      'href',
      `/factories/${factoryId}/workspaces/${PHASE}/threads/${PHASE}`,
    );
  });

  it('offers the same for a tool call held until a person allows it', async () => {
    const { notice } = renderNotice(
      waitingNotice(
        { 'waiting-for': 'approval', 'tool-name': 'ship_release', 'tool-call-id': 'call_release' },
        'approval',
      ),
    );

    expect(await notice.findByRole('button', { name: 'Approve' })).toBeVisible();
    expect(notice.getByRole('button', { name: 'Decline' })).toBeVisible();
  });

  it('says the call was answered, with nothing left to press, once the session no longer waits', async () => {
    parkedSessionIds = [];
    const { client, notice } = renderNotice(approvalNotice());
    await waitForMutationsIdle(client);

    expect(await notice.findByText('Answered')).toBeVisible();
    expect(notice.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(notice.getByRole('link', { name: 'Open session' })).toBeVisible();
  });

  it('says why when someone else answered first, and stops offering the answer', async () => {
    refusal = { status: 409, error: 'That call was already answered: someone else got there first.' };
    const { client, notice } = renderNotice(approvalNotice());

    await userEvent.click(await notice.findByRole('button', { name: 'Approve' }));
    await waitForMutationsIdle(client);

    await waitFor(() =>
      expect(notice.getByText('That call was already answered: someone else got there first.')).toBeVisible(),
    );
    expect(notice.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });

  it('says why when the viewer may not answer, and leaves the session to open', async () => {
    refusal = {
      status: 403,
      error: "Only the session's owner, an organization admin, or someone following its card can answer.",
    };
    const { client, notice } = renderNotice(approvalNotice());

    await userEvent.click(await notice.findByRole('button', { name: 'Decline' }));
    await waitForMutationsIdle(client);

    await waitFor(() => expect(notice.getByText(/Only the session's owner/)).toBeVisible());
    expect(notice.getByRole('link', { name: 'Open session' })).toBeVisible();
  });

  it('only links to the session when it waits on a typed answer, which a yes or no cannot give', async () => {
    const { client, notice } = renderNotice(
      waitingNotice({ 'parked-tool': 'ask_user', 'tool-call-id': 'call_question' }),
    );
    await waitForMutationsIdle(client);

    expect(notice.getByRole('link', { name: 'Open session' })).toBeVisible();
    expect(notice.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(notice.queryByText('Answered')).not.toBeInTheDocument();
  });
});
