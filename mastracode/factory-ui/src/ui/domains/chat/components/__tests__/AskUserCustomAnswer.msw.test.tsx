import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { SESSION_ID, releaseSession, renderThread, stubPreparingSession } from './composer-session-test-fixture';
import { askUserPayload, askUserSuspension } from './fixtures/ask-user';

const agentControllerBaseUrl = `${TEST_BASE_URL}/api/agent-controller/code`;

// Operators can answer beyond the agent's suggestions without sending a separate
// chat message. Both transcript renderers must resume the originating tool call
// through the real client transport with the same string/string[] contract.
describe('Factory custom question answers', () => {
  describe.each([
    ['when the question has a streamed tool row', true],
    ['when the question arrives as a standalone suspension', false],
  ])('%s', (_precondition, hasStreamedToolRow) => {
    it.each(['single_select', 'multi_select'] as const)(
      'resumes a %s question with the custom answer on the correct session and tool',
      async selectionMode => {
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
        const suspendPayload = { ...askUserPayload, selectionMode };

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

        const optionControlRole = selectionMode === 'multi_select' ? 'checkbox' : 'radio';
        const customAnswerOption = await screen.findByRole(optionControlRole, { name: 'Other…' });
        if (selectionMode === 'multi_select') {
          await user.click(screen.getByRole('checkbox', { name: 'Keep the current client' }));
        }
        await user.click(customAnswerOption);
        expect(captureToolResume).not.toHaveBeenCalled();
        await user.type(screen.getByRole('textbox', { name: 'Your answer' }), '  Add a narrow handwritten RPC type  ');
        await user.click(screen.getByRole('button', { name: 'Submit answer' }));
        await waitForMutationsIdle(queryClient);

        const expectedResumeData =
          selectionMode === 'multi_select'
            ? ['Keep the current client', 'Add a narrow handwritten RPC type']
            : 'Add a narrow handwritten RPC type';
        await waitFor(() =>
          expect(captureToolResume).toHaveBeenCalledExactlyOnceWith(SESSION_ID, {
            toolCallId: askUserSuspension.toolCallId,
            resumeData: expectedResumeData,
          }),
        );
        expect(sessionFixture.posted).toEqual([]);
      },
    );
  });
});
