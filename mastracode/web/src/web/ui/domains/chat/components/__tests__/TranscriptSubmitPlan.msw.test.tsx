import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import { ChatSessionContext } from '../../context/ChatSessionContext';
import type { TimelineEntry } from '../../services/transcript';
import { TranscriptEntries } from '../Transcript';

const PLAN_FILE_URL = `${TEST_BASE_URL}/web/plans/file`;
const PLAN_PATH = '.mastracode/plans/render-markdown.md';
const SESSION_ID = 'session-1';

function withSession(children: ReactNode) {
  return (
    <ChatSessionContext.Provider
      value={{
        resourceId: SESSION_ID,
        sessionEnabled: true,
        resourceEnabled: true,
        baseUrl: TEST_BASE_URL,
        kind: 'user',
      }}
    >
      {children}
    </ChatSessionContext.Provider>
  );
}

function suspension(): TimelineEntry {
  return {
    kind: 'suspension',
    id: 'suspension-call-1',
    toolCallId: 'call-1',
    toolName: 'submit_plan',
    args: { path: PLAN_PATH },
    suspendPayload: { path: PLAN_PATH },
  };
}

function assistantMessage(parts: MastraDBMessage['content']['parts']): TimelineEntry {
  return {
    kind: 'message',
    id: 'msg-1',
    message: {
      id: 'msg-1',
      role: 'assistant',
      createdAt: new Date('2026-07-23T10:00:00.000Z'),
      content: { format: 2, parts },
    },
  };
}

function renderEntries(entries: TimelineEntry[], onRespond: (...args: unknown[]) => void = () => {}) {
  return renderWithProviders(withSession(<TranscriptEntries entries={entries} onApprove={() => {}} onRespond={onRespond} />));
}

describe('submit_plan live suspension card', () => {
  it('shows a loading skeleton, then renders the plan markdown fetched from the plans endpoint', async () => {
    let seenBody: unknown;
    server.use(
      http.post(PLAN_FILE_URL, async ({ request }) => {
        seenBody = await request.json();
        return HttpResponse.json({
          path: PLAN_PATH,
          content: '# Render markdown\n\nAdd a plans endpoint.',
          truncated: false,
          updatedAt: '2026-07-23T00:00:00.000Z',
        });
      }),
    );

    renderEntries([suspension()]);

    expect(screen.getByLabelText('Loading plan content')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('Plan: Render markdown')).toBeInTheDocument());
    expect(screen.getByText('Add a plans endpoint.')).toBeInTheDocument();
    expect(seenBody).toEqual({ workspacePath: SESSION_ID, path: PLAN_PATH });
  });

  it('keeps Approve & build clickable when the plan content cannot be read', async () => {
    server.use(http.post(PLAN_FILE_URL, () => HttpResponse.json({ error: 'plan not found' }, { status: 404 })));

    const onRespond = vi.fn();
    renderEntries([suspension()], onRespond);

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent(/Couldn't load plan content/);

    await userEvent.click(screen.getByRole('button', { name: 'Approve the plan and switch to build' }));
    expect(onRespond).toHaveBeenCalledWith('call-1', { action: 'approved' }, 'suspension-call-1');
  });

  it('renders the live fetching card instead of the generic tool entry when the canonical tool part exists', async () => {
    server.use(
      http.post(PLAN_FILE_URL, () =>
        HttpResponse.json({
          path: PLAN_PATH,
          content: '# Canonical plan\n\nBody.',
          truncated: false,
          updatedAt: '2026-07-23T00:00:00.000Z',
        }),
      ),
    );

    renderEntries([
      assistantMessage([
        {
          type: 'tool-invocation',
          toolInvocation: { state: 'call', toolCallId: 'call-1', toolName: 'submit_plan', args: { path: PLAN_PATH } },
        },
      ]),
      suspension(),
    ]);

    await waitFor(() => expect(screen.getByText('Plan: Canonical plan')).toBeInTheDocument());
    // Only one card renders for the suspended tool call.
    expect(screen.getAllByRole('group', { name: 'Plan approval' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Approve the plan and switch to build' })).toBeEnabled();
  });
});

describe('submit_plan resolved entry', () => {
  it('renders the persisted submittedPlan markdown without fetching', async () => {
    let fetched = false;
    server.use(
      http.post(PLAN_FILE_URL, () => {
        fetched = true;
        return HttpResponse.json({ path: PLAN_PATH, content: '', truncated: false, updatedAt: '' });
      }),
    );

    renderEntries([
      assistantMessage([
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId: 'call-1',
            toolName: 'submit_plan',
            args: { path: PLAN_PATH },
            result: {
              submittedPlan: {
                title: 'Render markdown',
                path: PLAN_PATH,
                plan: '# Render markdown\n\nPersisted plan body.',
              },
            },
          },
        },
      ]),
    ]);

    await waitFor(() => expect(screen.getByText('Persisted plan body.')).toBeInTheDocument());
    // PlanPath renders the filename with the full path as the tooltip.
    expect(screen.getByTitle(PLAN_PATH)).toHaveTextContent('render-markdown.md');
    expect(fetched).toBe(false);
  });
});
