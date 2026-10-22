import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { SESSION_ID, releaseSession, renderThread, stubPreparingSession } from './composer-session-test-fixture';

const agentControllerBaseUrl = `${TEST_BASE_URL}/api/agent-controller/code`;
const toolCallId = 'call-move';
const args = { stage: 'done', expectedRevision: 3, rationale: 'Fixed on main.' };
const suspendPayload = {
  kind: 'factory_transition_approval',
  question: 'Move "Fix it" from triage to done?',
  options: [{ label: 'Approve' }, { label: 'Decline' }],
  stage: 'done',
  rationale: 'Fixed on main.',
};

// A role session's stage move pauses with a question. Its tool row is already on
// screen, so the question must be answerable from that row, not only from a
// standalone card the row makes redundant.
describe('a tool that pauses with a question', () => {
  it('shows the question on its tool row and resumes the call with the answer', async () => {
    const captureToolResume = vi.fn();
    server.use(
      http.post(`${agentControllerBaseUrl}/sessions/:resourceId/tool-suspension`, async ({ request, params }) => {
        captureToolResume(params.resourceId, await request.json());
        return HttpResponse.json({ ok: true });
      }),
    );
    const sessionFixture = stubPreparingSession({ materialized: true, autoAgentEnd: false });
    const user = userEvent.setup();
    const { client: queryClient } = renderThread();
    await releaseSession(sessionFixture.finishWorkspace, queryClient);

    await act(async () => {
      await sessionFixture.emit({
        type: 'message_start',
        message: {
          id: 'message-move',
          role: 'assistant',
          createdAt: new Date('2026-10-16T09:00:00Z'),
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: { state: 'call', toolCallId, toolName: 'factory_transition_work_item', args },
              },
            ],
          },
        },
      });
      await sessionFixture.emit({ type: 'tool_start', toolCallId, toolName: 'factory_transition_work_item', args });
      await sessionFixture.emit({
        type: 'tool_suspended',
        toolCallId,
        toolName: 'factory_transition_work_item',
        args,
        suspendPayload,
      });
      await sessionFixture.emit({ type: 'message_end', id: 'message-move' });
    });

    expect(await screen.findByText('Move "Fix it" from triage to done?')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Approve' }));
    await waitForMutationsIdle(queryClient);

    await waitFor(() =>
      expect(captureToolResume).toHaveBeenCalledExactlyOnceWith(SESSION_ID, { toolCallId, resumeData: 'Approve' }),
    );
    expect(sessionFixture.posted).toEqual([]);
  });
});
