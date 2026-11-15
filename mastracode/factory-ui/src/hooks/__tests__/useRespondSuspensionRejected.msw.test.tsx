// @vitest-environment jsdom
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import {
  isEndedPrompt,
  RejectedReplyError,
  useRespondAgentControllerSuspensionMutation,
} from '../useAgentControllerRunMutations';

const controllerId = 'code';
const sessionId = 'session-test';
const hookArgs = { agentControllerId: controllerId, sessionId, baseUrl: TEST_BASE_URL, enabled: true };

describe('useRespondAgentControllerSuspensionMutation', () => {
  it('given the server finds nothing waiting on the call, when the plan is approved, then the mutation fails', async () => {
    // What production returns when the run behind a shown plan has gone away.
    server.use(
      http.post(`${TEST_BASE_URL}/api/agent-controller/${controllerId}/sessions/${sessionId}/tool-suspension`, () =>
        HttpResponse.json({ ok: false, reason: 'no_pending_suspension' }),
      ),
    );

    const { result } = renderHookWithProviders(() => useRespondAgentControllerSuspensionMutation(hookArgs));

    await act(async () => {
      await result.current
        .mutateAsync({ toolCallId: 'call-1', resumeData: { action: 'approved' } as never })
        .catch(() => undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/no longer waiting/);
    expect(isEndedPrompt(result.current.error)).toBe(true);
  });

  it('only treats a reply with nothing waiting as an ended prompt', () => {
    expect(isEndedPrompt(new RejectedReplyError('no_pending_suspension'))).toBe(true);
    expect(isEndedPrompt(new RejectedReplyError('not_pending'))).toBe(false);
    expect(isEndedPrompt(new Error('network'))).toBe(false);
  });
});
