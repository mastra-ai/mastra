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

beforeEach(useOverlayControllerHandlers);

describe('the /think command', () => {
  it('changes the thinking level for the current session', async () => {
    let thinkingLevel = 'medium';
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
      http.put(`${SESSION_API}/state`, async ({ request }) => {
        const body: unknown = await request.json();
        stateUpdates.push(body);
        if (
          typeof body === 'object' &&
          body !== null &&
          'state' in body &&
          typeof body.state === 'object' &&
          body.state !== null &&
          'thinkingLevel' in body.state &&
          typeof body.state.thinkingLevel === 'string'
        ) {
          thinkingLevel = body.state.thinkingLevel;
        }
        return HttpResponse.json({ ok: true });
      }),
    );
    const user = userEvent.setup();
    const { client } = renderWithProviders(
      <OverlayTestProviders>
        <Transcript />
        <Composer />
      </OverlayTestProviders>,
    );
    const input = await screen.findByRole<HTMLTextAreaElement>('textbox', { name: 'Message' });
    await waitFor(() => expect(input).toBeEnabled());

    await user.type(input, '/think high');
    await user.keyboard('{Enter}');

    await waitForMutationsIdle(client);
    expect(stateUpdates).toContainEqual({ state: { thinkingLevel: 'high' } });
    expect(await screen.findByText('Thinking level set to high.')).toBeInTheDocument();
    expect(input).toHaveValue('');
  });
});
