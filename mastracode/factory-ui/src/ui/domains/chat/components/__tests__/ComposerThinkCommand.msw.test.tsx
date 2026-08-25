import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { Composer } from '../Composer';
import { Transcript } from '../Transcript';
import { OverlayTestProviders, useOverlayControllerHandlers } from './overlay-test-utils';

const SESSION_API = `${TEST_BASE_URL}/api/agent-controller/code/sessions/:resourceId`;
const THINKING_CONFIG_API = `${TEST_BASE_URL}/web/config/thinking`;

function useThinkingHandlers({
  initialThinkingLevel = 'medium',
  failThinkingConfig = false,
}: {
  initialThinkingLevel?: string;
  failThinkingConfig?: boolean;
} = {}) {
  let thinkingLevel: string | undefined = initialThinkingLevel;
  const stateUpdates: unknown[] = [];
  server.use(
    http.get(SESSION_API, ({ params }) =>
      HttpResponse.json({
        controllerId: 'code',
        resourceId: params.resourceId,
        modeId: 'build',
        modelId: 'openai/gpt-4o-mini',
        threadId: 'thread-test',
        settings: { yolo: false, thinkingLevel, notifications: 'bell', smartEditing: true },
      }),
    ),
    http.get(THINKING_CONFIG_API, () =>
      failThinkingConfig
        ? new HttpResponse(null, { status: 503 })
        : HttpResponse.json({
            levels: ['off', 'low', 'medium', 'high', 'xhigh', 'max'],
            globalDefault: 'low',
            modeDefaults: { build: 'medium' },
            modes: ['build'],
          }),
    ),
    http.put(`${SESSION_API}/state`, async ({ request }) => {
      const body: unknown = await request.json();
      stateUpdates.push(body);
      if (
        typeof body === 'object' &&
        body !== null &&
        'state' in body &&
        typeof body.state === 'object' &&
        body.state !== null &&
        'thinkingLevel' in body.state
      ) {
        const value = body.state.thinkingLevel;
        if (typeof value === 'string' || value === null) {
          thinkingLevel = value ?? undefined;
        }
      }
      return HttpResponse.json({ ok: true });
    }),
  );
  return stateUpdates;
}

beforeEach(useOverlayControllerHandlers);

describe('the /think command', () => {
  it('sets, reports, and clears the session thinking override', async () => {
    const stateUpdates = useThinkingHandlers();
    const user = userEvent.setup();
    const { client } = renderWithProviders(
      <OverlayTestProviders>
        <Transcript />
        <Composer />
      </OverlayTestProviders>,
    );
    const input = await screen.findByRole<HTMLTextAreaElement>('textbox', { name: 'Message' });
    await waitFor(() => expect(input).toBeEnabled());

    await user.type(input, '/think');
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('region', { name: '/think options' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Medium Current' })).toHaveAttribute('aria-current', 'true');
    await user.click(screen.getByRole('button', { name: 'High' }));

    await waitForMutationsIdle(client);
    expect(stateUpdates).toContainEqual({ state: { thinkingLevel: 'high' } });
    expect(await screen.findByText('Thinking level set to high.')).toBeInTheDocument();
    expect(input).toHaveValue('');

    await user.type(input, '/think status');
    await user.keyboard('{Enter}');

    expect(
      await screen.findByText('Thinking level: high (session override). Default: medium (build mode default).'),
    ).toBeInTheDocument();

    await user.type(input, '/think');
    await user.keyboard('{Enter}');
    await screen.findByRole('region', { name: '/think options' });
    await user.keyboard('{Enter}');

    await waitForMutationsIdle(client);
    expect(stateUpdates).toContainEqual({ state: { thinkingLevel: null } });
    expect(await screen.findByText('Thinking level set to default: medium (build mode default).')).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('clears the session override when the defaults request fails', async () => {
    const stateUpdates = useThinkingHandlers({ initialThinkingLevel: 'high', failThinkingConfig: true });
    const user = userEvent.setup();
    const { client } = renderWithProviders(
      <OverlayTestProviders>
        <Transcript />
        <Composer />
      </OverlayTestProviders>,
    );
    const input = await screen.findByRole<HTMLTextAreaElement>('textbox', { name: 'Message' });
    await waitFor(() => expect(input).toBeEnabled());

    await user.type(input, '/think default');
    await user.keyboard('{Enter}');

    await waitForMutationsIdle(client);
    expect(stateUpdates).toContainEqual({ state: { thinkingLevel: null } });
    expect(
      await screen.findByText('Thinking level set to default. Current default is unavailable.'),
    ).toBeInTheDocument();
    expect(input).toHaveValue('');
  });
});
