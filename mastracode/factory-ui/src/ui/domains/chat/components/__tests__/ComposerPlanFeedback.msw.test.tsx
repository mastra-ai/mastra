// @vitest-environment jsdom

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { releaseSession, renderThread, stubPreparingSession } from './composer-session-test-fixture';

const API = `${TEST_BASE_URL}/api/agent-controller/code`;

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
      await waitFor(() => expect(composer).toHaveAttribute('placeholder', 'Give feedback on this plan…'));
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
  });
});
