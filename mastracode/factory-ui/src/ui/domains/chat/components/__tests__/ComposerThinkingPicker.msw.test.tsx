import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { Composer } from '../Composer';
import {
  FACTORY_ID,
  PROJECT_REPOSITORY_ID,
  SESSION_ID,
  createdDraftSession,
  renderDraft,
  stubPreparingSession,
} from './composer-session-test-fixture';
import { OverlayTestProviders, useOverlayControllerHandlers } from './overlay-test-utils';

const SESSION_API = `${TEST_BASE_URL}/api/agent-controller/code/sessions/:resourceId`;

const dragTo = (slider: HTMLElement, stop: number) => fireEvent.change(slider, { target: { value: String(stop) } });

async function openModelMenu(user: UserEvent) {
  await user.click(await screen.findByRole('button', { name: 'Session model' }));
}

function useLiveSession({ modelId, thinkingLevel }: { modelId: string; thinkingLevel?: string }) {
  let sessionThinkingLevel = thinkingLevel;
  const stateUpdates: unknown[] = [];
  server.use(
    http.get(SESSION_API, ({ params }) =>
      HttpResponse.json({
        controllerId: 'code',
        resourceId: params.resourceId,
        modeId: 'build',
        modelId,
        threadId: 'thread-test',
        settings: { yolo: false, thinkingLevel: sessionThinkingLevel, notifications: 'bell', smartEditing: true },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/config/models`, () =>
      HttpResponse.json({
        models: [{ id: modelId, provider: modelId.split('/')[0], modelName: modelId.split('/')[1], hasApiKey: true }],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/config/thinking`, () =>
      HttpResponse.json({
        levels: ['off', 'low', 'medium', 'high', 'xhigh', 'max'],
        globalDefault: 'off',
        modeDefaults: { build: 'medium' },
        modes: ['build'],
        editable: true,
      }),
    ),
    http.put(`${SESSION_API}/state`, async ({ request }) => {
      const body = await request.json();
      if (typeof body === 'object' && body !== null && 'state' in body) {
        const { state } = body;
        if (typeof state === 'object' && state !== null && 'thinkingLevel' in state) {
          stateUpdates.push(body);
          sessionThinkingLevel = typeof state.thinkingLevel === 'string' ? state.thinkingLevel : undefined;
        }
      }
      return HttpResponse.json({ ok: true });
    }),
  );
  return stateUpdates;
}

function renderComposer() {
  return renderWithProviders(
    <OverlayTestProviders>
      <Composer />
    </OverlayTestProviders>,
  );
}

beforeEach(useOverlayControllerHandlers);

describe('Composer thinking picker', () => {
  it('offers only the levels the model runs, starting from the mode default, then saves the dropped level', async () => {
    const stateUpdates = useLiveSession({ modelId: 'anthropic/claude-sonnet-4-6' });
    const user = userEvent.setup();
    const { client } = renderComposer();

    await user.click(await screen.findByRole('button', { name: 'Thinking: Medium' }));
    const slider = await screen.findByRole('slider', { name: 'Thinking' });
    expect(slider).toHaveAttribute('aria-valuetext', 'Medium');
    expect(slider).toHaveAttribute('max', '4');
    expect(screen.queryByText('Extra high')).not.toBeInTheDocument();

    dragTo(slider, 4);
    expect(stateUpdates).toEqual([]);
    fireEvent.pointerUp(slider);

    await waitForMutationsIdle(client);
    expect(stateUpdates).toEqual([{ state: { thinkingLevel: 'max' } }]);
    expect(screen.getByRole('button', { name: 'Thinking: Max' })).toBeInTheDocument();
  });

  it('shows the level the model actually runs, not the stored one it cannot honour', async () => {
    useLiveSession({ modelId: 'openai/gpt-5.4-mini', thinkingLevel: 'max' });
    renderComposer();

    expect(await screen.findByRole('button', { name: 'Thinking: Extra high' })).toBeInTheDocument();
  });

  it('explains why a model without thinking has no levels to pick', async () => {
    const stateUpdates = useLiveSession({ modelId: 'anthropic/claude-3-5-haiku-20241022' });
    const user = userEvent.setup();
    renderComposer();

    const thinking = await screen.findByRole('button', { name: /^Thinking: unavailable\. .+ has no thinking levels$/ });
    expect(thinking).toHaveAttribute('aria-disabled', 'true');

    await user.click(thinking);
    expect(screen.queryByRole('slider', { name: 'Thinking' })).not.toBeInTheDocument();
    expect(stateUpdates).toEqual([]);
  });

  it('holds a draft level locally and applies it to the new session before the first prompt', async () => {
    const preparation = stubPreparingSession({ createdSessionTitle: 'think hard' });
    server.use(
      http.post(`${TEST_BASE_URL}/web/source-control/projects/${PROJECT_REPOSITORY_ID}/sessions`, () =>
        HttpResponse.json({ session: createdDraftSession('think hard') }),
      ),
    );
    const user = userEvent.setup();
    const { client } = renderDraft();

    await openModelMenu(user);
    await user.click(await screen.findByRole('option', { name: /gpt-5\.4-mini/ }));
    await user.click(await screen.findByRole('button', { name: 'Thinking: Off' }));
    const slider = await screen.findByRole('slider', { name: 'Thinking' });
    dragTo(slider, 3);
    fireEvent.pointerUp(slider);
    expect(await screen.findByRole('button', { name: 'Thinking: High' })).toBeInTheDocument();
    expect(preparation.operations).toEqual([]);

    await user.keyboard('{Escape}');
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'think hard');
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(screen.getByTestId('pathname')).toHaveTextContent(`/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`),
    );

    preparation.finishWorkspace();
    await waitForMutationsIdle(client);
    await waitFor(() => expect(preparation.delivered).toEqual(['think hard']));
    expect(preparation.operations).toEqual(['mode:build', 'model:openai/gpt-5.4-mini', 'thinking:high', 'message']);
  });
});
