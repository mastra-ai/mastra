// @vitest-environment jsdom

import { toast } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { releaseSession, renderThread, stubPreparingSession } from './composer-session-test-fixture';

const API = `${TEST_BASE_URL}/api/agent-controller/code`;

async function renderPendingPlan(reply: { ok: boolean; reason?: string }) {
  const onResume = vi.fn();
  server.use(
    http.post(`${API}/sessions/:resourceId/tool-suspension`, async ({ request }) => {
      onResume(await request.json());
      return HttpResponse.json(reply);
    }),
  );
  const session = stubPreparingSession({ materialized: true, autoAgentEnd: false });
  const { client } = renderThread();
  await releaseSession(session.finishWorkspace, client);
  await session.emit({
    type: 'tool_suspended',
    toolCallId: 'plan-call-1',
    toolName: 'submit_plan',
    args: { path: '.artifacts/plans/ship.md' },
    suspendPayload: {
      toolId: 'submit_plan',
      path: '.artifacts/plans/ship.md',
      title: 'Ship it',
      plan: 'Add the feature.',
    },
  });
  const composer = await screen.findByRole('textbox', { name: 'Message' });
  await waitFor(() => expect(composer).toHaveAttribute('placeholder', 'Give feedback on this plan'));
  return { session, client, composer, onResume };
}

describe('Composer plan feedback', () => {
  describe('when a submit_plan approval is pending', () => {
    it('resumes the plan suspension with the composer message as revision feedback', async () => {
      const onResume = vi.fn();
      server.use(
        http.post(`${API}/sessions/:resourceId/tool-suspension`, async ({ request }) => {
          onResume(await request.json());
          return HttpResponse.json({ ok: true });
        }),
      );
      const session = stubPreparingSession({ materialized: true, autoAgentEnd: false });
      const user = userEvent.setup();
      const { client } = renderThread();
      await releaseSession(session.finishWorkspace, client);

      await session.emit({
        type: 'tool_suspended',
        toolCallId: 'plan-call-1',
        toolName: 'submit_plan',
        args: { path: '.artifacts/plans/ship.md' },
        suspendPayload: {
          toolId: 'submit_plan',
          path: '.artifacts/plans/ship.md',
          title: 'Ship it',
          plan: 'Add the feature.',
        },
      });

      const composer = await screen.findByRole('textbox', { name: 'Message' });
      await waitFor(() => expect(composer).toHaveAttribute('placeholder', 'Give feedback on this plan'));
      await user.type(composer, 'Cover the rollback path too.{enter}');
      await waitForMutationsIdle(client);

      expect(onResume).toHaveBeenCalledWith({
        toolCallId: 'plan-call-1',
        resumeData: {
          action: 'rejected',
          feedback: 'Cover the rollback path too.',
          path: '.artifacts/plans/ship.md',
          title: 'Ship it',
          plan: 'Add the feature.',
        },
      });
      expect(session.posted).toEqual([]);
      expect(session.steerAttempts).toBe(0);
    });

    it('sends the text as a normal message when the plan it answers has already ended', async () => {
      const toastError = vi.spyOn(toast, 'error');
      const { session, client, composer, onResume } = await renderPendingPlan({
        ok: false,
        reason: 'no_pending_suspension',
      });
      const user = userEvent.setup();

      await user.type(composer, 'bro where you are at ?{enter}');
      await waitForMutationsIdle(client);

      expect(onResume).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(session.posted).toEqual(['bro where you are at ?']));
      expect(composer).toHaveValue('');
      expect(composer).not.toHaveAttribute('placeholder', 'Give feedback on this plan');
      expect(toastError).not.toHaveBeenCalled();
      toastError.mockRestore();
    });

    it('keeps the draft and reports it when someone else already answered the plan', async () => {
      const toastError = vi.spyOn(toast, 'error');
      const { session, client, composer, onResume } = await renderPendingPlan({ ok: false, reason: 'not_pending' });
      const user = userEvent.setup();

      await user.type(composer, 'Cover the rollback path too.{enter}');
      await waitForMutationsIdle(client);

      expect(onResume).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(composer).toHaveValue('Cover the rollback path too.'));
      expect(toastError).toHaveBeenCalledWith('Your reply was not delivered. Someone may have already answered it.', {
        id: 'agent-controller-reply-rejected',
      });
      expect(session.posted).toEqual([]);
      expect(session.steerAttempts).toBe(0);
      toastError.mockRestore();
    });
  });
});
