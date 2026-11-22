import { act, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { releaseSession, renderThread, stubPreparingSession } from './composer-session-test-fixture';
import { askUserPayload, askUserSuspension } from './fixtures/ask-user';

// The agent can mark one option as the one it would pick. Both transcript renderers must show that
// hint on that option only, and must not choose it for the operator.
describe('Factory recommended question option', () => {
  const suspendPayload = {
    ...askUserPayload,
    options: [{ label: 'Regenerate the client' }, { label: 'Keep the current client', recommended: true }],
  };

  it.each([
    ['when the question has a streamed tool row', true],
    ['when the question arrives as a standalone suspension', false],
  ])('tags the recommended option and leaves every option unselected %s', async (_precondition, hasStreamedToolRow) => {
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
    expect(tags[0]!.closest('label')?.textContent).toContain('Keep the current client');
    expect(recommended.getAttribute('aria-checked')).toBe('false');
    expect(other.getAttribute('aria-checked')).toBe('false');
  });
});
