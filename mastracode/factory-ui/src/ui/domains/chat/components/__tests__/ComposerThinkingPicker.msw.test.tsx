import { Toaster } from '@mastra/playground-ui/components/Toaster';
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

function useLiveSession({
  modelId,
  thinkingLevel,
  listedModelIds = [modelId],
}: {
  modelId: string;
  thinkingLevel?: string;
  listedModelIds?: string[];
}) {
  let sessionModelId = modelId;
  let sessionThinkingLevel = thinkingLevel;
  const requests: string[] = [];
  server.use(
    http.get(SESSION_API, ({ params }) =>
      HttpResponse.json({
        controllerId: 'code',
        resourceId: params.resourceId,
        modeId: 'build',
        modelId: sessionModelId,
        threadId: 'thread-test',
        settings: { yolo: false, thinkingLevel: sessionThinkingLevel, notifications: 'bell', smartEditing: true },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/config/models`, () =>
      HttpResponse.json({
        models: listedModelIds.map(id => ({
          id,
          provider: id.split('/')[0],
          modelName: id.split('/')[1],
          hasApiKey: true,
        })),
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
    http.post(`${SESSION_API}/model`, async ({ request }) => {
      const body = await request.json();
      if (typeof body === 'object' && body !== null && 'modelId' in body && typeof body.modelId === 'string') {
        requests.push(`model:${body.modelId}`);
        sessionModelId = body.modelId;
      }
      return HttpResponse.json({ ok: true });
    }),
    http.put(`${SESSION_API}/state`, async ({ request }) => {
      const body = await request.json();
      if (typeof body === 'object' && body !== null && 'state' in body) {
        const { state } = body;
        if (typeof state === 'object' && state !== null && 'thinkingLevel' in state) {
          requests.push(`thinking:${String(state.thinkingLevel)}`);
          sessionThinkingLevel = typeof state.thinkingLevel === 'string' ? state.thinkingLevel : undefined;
        }
      }
      return HttpResponse.json({ ok: true });
    }),
  );
  return requests;
}

function renderComposer() {
  return renderWithProviders(
    <OverlayTestProviders>
      <Composer />
      <Toaster />
    </OverlayTestProviders>,
  );
}

beforeEach(useOverlayControllerHandlers);

describe('Composer thinking picker', () => {
  it('starts from the mode default and saves the level only once it is dropped', async () => {
    const requests = useLiveSession({ modelId: 'anthropic/claude-sonnet-4-6' });
    const user = userEvent.setup();
    const { client } = renderComposer();

    await user.click(await screen.findByRole('button', { name: 'Thinking: Medium' }));
    const slider = await screen.findByRole('slider', { name: 'Thinking' });
    expect(slider).toHaveAttribute('aria-valuetext', 'Medium');

    dragTo(slider, 3);
    expect(requests).toEqual([]);
    fireEvent.pointerUp(slider);

    await waitForMutationsIdle(client);
    expect(requests).toEqual(['thinking:high']);
    expect(screen.getByRole('button', { name: 'Thinking: High' })).toBeInTheDocument();
  });

  it('shows the level the model actually runs, not the stored one it cannot honour', async () => {
    useLiveSession({ modelId: 'openai/gpt-5.4-mini', thinkingLevel: 'max' });
    renderComposer();

    expect(await screen.findByRole('button', { name: 'Thinking: Extra high' })).toBeInTheDocument();
  });

  it('keeps thinking adjustable when no other model can be picked', async () => {
    const requests = useLiveSession({ modelId: 'anthropic/claude-sonnet-4-6', listedModelIds: [] });
    const user = userEvent.setup();
    const { client } = renderComposer();

    await user.click(await screen.findByRole('button', { name: 'Thinking: Medium' }));
    expect(screen.queryByRole('button', { name: 'Session model' })).not.toBeInTheDocument();
    const slider = await screen.findByRole('slider', { name: 'Thinking' });
    dragTo(slider, 3);
    fireEvent.pointerUp(slider);

    await waitForMutationsIdle(client);
    expect(requests).toEqual(['thinking:high']);
  });

  describe('when the model changes', () => {
    const listedModelIds = ['anthropic/claude-sonnet-4-6', 'openai/gpt-5.4-mini'];

    it('sends the level the new model can run right after the model', async () => {
      const requests = useLiveSession({ modelId: 'anthropic/claude-sonnet-4-6', thinkingLevel: 'max', listedModelIds });
      const user = userEvent.setup();
      const { client } = renderComposer();

      await openModelMenu(user);
      await user.click(await screen.findByRole('option', { name: /gpt-5\.4-mini/ }));

      await waitForMutationsIdle(client);
      expect(requests).toEqual(['model:openai/gpt-5.4-mini', 'thinking:xhigh']);
      expect(await screen.findByRole('button', { name: 'Thinking: Extra high' })).toBeInTheDocument();
    });

    it('leaves thinking alone when the new model runs the current level', async () => {
      const requests = useLiveSession({
        modelId: 'anthropic/claude-sonnet-4-6',
        thinkingLevel: 'high',
        listedModelIds,
      });
      const user = userEvent.setup();
      const { client } = renderComposer();

      await openModelMenu(user);
      await user.click(await screen.findByRole('option', { name: /gpt-5\.4-mini/ }));

      await waitForMutationsIdle(client);
      expect(requests).toEqual(['model:openai/gpt-5.4-mini']);
    });

    it('holds send and the thinking control until both requests settle', async () => {
      useLiveSession({ modelId: 'anthropic/claude-sonnet-4-6', thinkingLevel: 'max', listedModelIds });
      let releaseThinking: () => void = () => {};
      server.use(
        http.put(`${SESSION_API}/state`, async ({ request }) => {
          const body = await request.json();
          if (!JSON.stringify(body).includes('thinkingLevel')) return HttpResponse.json({ ok: true });
          return new Promise<Response>(resolve => {
            releaseThinking = () => resolve(HttpResponse.json({ ok: true }));
          });
        }),
      );
      const user = userEvent.setup();
      renderComposer();

      await openModelMenu(user);
      await user.click(await screen.findByRole('option', { name: /gpt-5\.4-mini/ }));
      await user.type(screen.getByRole('textbox', { name: 'Message' }), 'next turn');

      await waitFor(() => expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled());
      expect(screen.getByRole('button', { name: 'Thinking: unavailable. Switching model…' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );

      releaseThinking();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled());
    });

    it('says the model changed when only the thinking level failed', async () => {
      const requests = useLiveSession({ modelId: 'anthropic/claude-sonnet-4-6', thinkingLevel: 'max', listedModelIds });
      server.use(
        http.put(`${SESSION_API}/state`, async ({ request }) => {
          const body = await request.json();
          if (!JSON.stringify(body).includes('thinkingLevel')) return HttpResponse.json({ ok: true });
          return HttpResponse.json({ error: 'Settings store is down' }, { status: 500 });
        }),
      );
      const user = userEvent.setup();
      renderComposer();

      await openModelMenu(user);
      await user.click(await screen.findByRole('option', { name: /gpt-5\.4-mini/ }));

      expect(
        await screen.findByText(
          /^Switched to openai\/gpt-5\.4-mini, but thinking stayed at max: .*Settings store is down/,
        ),
      ).toBeInTheDocument();
      expect(requests).toEqual(['model:openai/gpt-5.4-mini']);
    });
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
