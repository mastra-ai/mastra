import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { Composer } from '../Composer';
import { OverlayTestProviders, useOverlayControllerHandlers } from './overlay-test-utils';

const API = `${TEST_BASE_URL}/api/agent-controller/code`;

type Recorded = { url: string; body: unknown };

function renderComposer() {
  return renderWithProviders(
    <OverlayTestProviders>
      <Composer />
    </OverlayTestProviders>,
  );
}

async function findReadyInput(): Promise<HTMLTextAreaElement> {
  const input = await screen.findByRole<HTMLTextAreaElement>('textbox', { name: 'Message' });
  await waitFor(() => expect(input).toBeEnabled());
  return input;
}

beforeEach(useOverlayControllerHandlers);

describe('Composer runtime command execution', () => {
  it('prepares //custom server-side and submits the envelope while showing the typed text', async () => {
    const requests: Recorded[] = [];
    server.use(
      http.post(`${API}/commands/discover`, () =>
        HttpResponse.json({
          capabilities: { customCommands: 'supported', skills: 'supported' },
          commands: [
            { command: '//review', source: 'custom', name: 'review', description: 'Review the tree', goal: false },
          ],
        }),
      ),
      http.post(`${API}/commands/prepare`, async ({ request }) => {
        requests.push({ url: 'prepare', body: await request.json() });
        return HttpResponse.json({
          action: 'message',
          content: '<slash-command name="review">\nReview the tree\n</slash-command>',
        });
      }),
      http.post(`${API}/sessions/:resourceId/messages`, async ({ request }) => {
        requests.push({ url: 'messages', body: await request.json() });
        return HttpResponse.json({ ok: true });
      }),
    );

    const user = userEvent.setup();
    const { client } = renderComposer();
    const input = await findReadyInput();

    await user.type(input, '//review');
    await waitFor(async () => {
      expect(await screen.findByRole('button', { name: /\/\/review/ })).toBeInTheDocument();
    });
    await user.keyboard('{Tab}');
    expect(input).toHaveValue('//review ');
    await user.keyboard('{Enter}');

    await waitForMutationsIdle(client);
    const prepare = requests.find(request => request.url === 'prepare');
    const message = requests.find(request => request.url === 'messages');
    expect(prepare?.body).toMatchObject({
      resourceId: 'session-overlay',
      projectRepositoryId: 'repo-overlay',
      command: '//review',
    });
    expect(message?.body).toMatchObject({
      message: '<slash-command name="review">\nReview the tree\n</slash-command>',
    });
    // The optimistic row keeps the user's original slash text, and the raw
    // envelope is never rendered into the transcript.
    expect(screen.getByText('//review')).toBeInTheDocument();
    expect(screen.queryByText(/<slash-command name=/)).not.toBeInTheDocument();
  });

  it('restores the exact draft when preparation fails and sends nothing', async () => {
    const requests: Recorded[] = [];
    server.use(
      http.post(`${API}/commands/discover`, () =>
        HttpResponse.json({
          capabilities: { customCommands: 'supported', skills: 'supported' },
          commands: [
            { command: '//boom', source: 'custom', name: 'boom', description: 'Fails on purpose', goal: false },
          ],
        }),
      ),
      http.post(`${API}/commands/prepare`, () =>
        HttpResponse.json(
          { error: 'command_expansion_failed', message: 'The command could not be expanded.' },
          { status: 422 },
        ),
      ),
      http.post(`${API}/sessions/:resourceId/messages`, async ({ request }) => {
        requests.push({ url: 'messages', body: await request.json() });
        return HttpResponse.json({ ok: true });
      }),
    );

    const user = userEvent.setup();
    const { client } = renderComposer();
    const input = await findReadyInput();

    await user.type(input, '//boom args');
    // Suggestions close once arguments are typed, but exact-token execution
    // still resolves `//boom` from the settled discovery.
    await user.keyboard('{Enter}');

    await waitForMutationsIdle(client);
    // The exact text comes back so nothing is lost.
    expect(input).toHaveValue('//boom args');
    expect(requests).toEqual([]);
  });

  it('preserves text when a required argument is missing and sends nothing', async () => {
    const requests: Recorded[] = [];
    server.use(
      http.post(`${API}/sessions/:resourceId/messages`, async ({ request }) => {
        requests.push({ url: 'messages', body: await request.json() });
        return HttpResponse.json({ ok: true });
      }),
    );

    const user = userEvent.setup();
    const { client } = renderComposer();
    const input = await findReadyInput();

    await user.type(input, '/follow-up');
    await user.keyboard('{Enter}');

    await waitForMutationsIdle(client);
    expect(input).toHaveValue('/follow-up');
    expect(requests).toEqual([]);
  });

  it('prepares /skill/<name> through discovery and submits the skill envelope', async () => {
    const requests: Recorded[] = [];
    server.use(
      http.post(`${API}/commands/discover`, () =>
        HttpResponse.json({
          capabilities: { customCommands: 'supported', skills: 'supported' },
          commands: [
            {
              command: '/skill/understand-pr',
              source: 'skill',
              name: 'understand-pr',
              description: 'PRs',
              goal: false,
            },
          ],
        }),
      ),
      http.post(`${API}/commands/prepare`, async ({ request }) => {
        requests.push({ url: 'prepare', body: await request.json() });
        return HttpResponse.json({
          action: 'message',
          content: '<skill name="understand-pr">\nInspect the PR\n</skill>',
        });
      }),
      http.post(`${API}/sessions/:resourceId/messages`, async ({ request }) => {
        requests.push({ url: 'messages', body: await request.json() });
        return HttpResponse.json({ ok: true });
      }),
    );

    const user = userEvent.setup();
    const { client } = renderComposer();
    const input = await findReadyInput();

    await user.type(input, '/skill/understand-pr');
    await user.keyboard('{Enter}');

    await waitForMutationsIdle(client);
    expect(requests.find(request => request.url === 'prepare')?.body).toMatchObject({
      command: '/skill/understand-pr',
    });
    expect(requests.find(request => request.url === 'messages')?.body).toMatchObject({
      message: '<skill name="understand-pr">\nInspect the PR\n</skill>',
    });
  });
});
