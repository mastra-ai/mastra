import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { SESSION_ID, releaseSession, renderThread, stubPreparingSession } from './composer-session-test-fixture';
import { askUserPayload, askUserSuspension } from './fixtures/ask-user';

const agentControllerBaseUrl = `${TEST_BASE_URL}/api/agent-controller/code`;

// The agent can mark one option as the one it would pick. Both transcript renderers must show that
// hint on that option only, must not choose it for the operator, and must answer with the bare label.
describe('Factory recommended question option', () => {
  const suspendPayload = {
    ...askUserPayload,
    options: [{ label: 'Regenerate the client' }, { label: 'Keep the current client', recommended: true }],
  };

  it.each([
    ['when the question has a streamed tool row', true],
    ['when the question arrives as a standalone suspension', false],
  ])('tags the recommended option and answers it by its bare label %s', async (_precondition, hasStreamedToolRow) => {
    const captureToolResume = vi.fn();
    server.use(
      http.post(`${agentControllerBaseUrl}/sessions/:resourceId/tool-suspension`, async ({ request, params }) => {
        captureToolResume(params.resourceId, await request.json());
        return HttpResponse.json({ ok: true });
      }),
    );
    const user = userEvent.setup();
    const sessionFixture = stubPreparingSession({ materialized: true, autoAgentEnd: false });
    const { client: queryClient } = renderThread();
    await releaseSession(sessionFixture.finishWorkspace, queryClient);

    await act(async () => {
      if (hasStreamedToolRow) {
        await sessionFixture.emit({
          type: 'message_start',
          message: {
            id: 'message-ask',
            role: 'assistant',
            createdAt: new Date('2026-10-07T09:00:00Z'),
            content: {
              format: 2,
              parts: [
                {
                  type: 'tool-invocation',
                  toolInvocation: {
                    state: 'call',
                    toolCallId: askUserSuspension.toolCallId,
                    toolName: 'ask_user',
                    args: suspendPayload,
                  },
                },
              ],
            },
          },
        });
        await sessionFixture.emit({
          type: 'tool_start',
          toolCallId: askUserSuspension.toolCallId,
          toolName: 'ask_user',
          args: suspendPayload,
        });
      }
      await sessionFixture.emit({ ...askUserSuspension, args: suspendPayload, suspendPayload });
      if (hasStreamedToolRow) await sessionFixture.emit({ type: 'message_end', id: 'message-ask' });
    });

    const recommended = await screen.findByRole('radio', { name: /Keep the current client/ });
    const other = screen.getByRole('radio', { name: /Regenerate the client/ });
    const tags = screen.getAllByText('Recommended');
    expect(tags).toHaveLength(1);
    expect(tags[0].closest('label')?.textContent).toContain('Keep the current client');
    expect(recommended.getAttribute('aria-checked')).toBe('false');
    expect(other.getAttribute('aria-checked')).toBe('false');

    // A single-select answer is sent as soon as the operator picks it.
    await user.click(recommended);
    await waitForMutationsIdle(queryClient);
    await waitFor(() =>
      expect(captureToolResume).toHaveBeenCalledExactlyOnceWith(SESSION_ID, {
        toolCallId: askUserSuspension.toolCallId,
        resumeData: 'Keep the current client',
      }),
    );
  });
});
