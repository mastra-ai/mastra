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
      http.post(`${TEST_BASE_URL}/web/agent-controller/code/commands/discover`, () =>
        HttpResponse.json({
          capabilities: { customCommands: 'supported', skills: 'supported' },
          commands: [
            { command: '//review', source: 'custom', name: 'review', description: 'Review the tree', goal: false },
          ],
        }),
      ),
      http.post(`${TEST_BASE_URL}/web/agent-controller/code/commands/prepare`, async ({ request }) => {
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
      http.post(`${TEST_BASE_URL}/web/agent-controller/code/commands/discover`, () =>
        HttpResponse.json({
          capabilities: { customCommands: 'supported', skills: 'supported' },
          commands: [
            { command: '//boom', source: 'custom', name: 'boom', description: 'Fails on purpose', goal: false },
          ],
        }),
      ),
      http.post(`${TEST_BASE_URL}/web/agent-controller/code/commands/prepare`, () =>
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

  it('executes a submit made while discovery is still in flight, after it settles', async () => {
    const requests: Recorded[] = [];
    let releaseDiscovery: () => void = () => {};
    const discoveryGate = new Promise<void>(resolve => {
      releaseDiscovery = resolve;
    });
    server.use(
      http.post(`${TEST_BASE_URL}/web/agent-controller/code/commands/discover`, async () => {
        await discoveryGate;
        return HttpResponse.json({
          capabilities: { customCommands: 'supported', skills: 'supported' },
          commands: [{ command: '//slow', source: 'custom', name: 'slow', description: 'Slow discovery', goal: false }],
        });
      }),
      http.post(`${TEST_BASE_URL}/web/agent-controller/code/commands/prepare`, async ({ request }) => {
        requests.push({ url: 'prepare', body: await request.json() });
        return HttpResponse.json({ action: 'none', notice: '//slow ran' });
      }),
    );

    const user = userEvent.setup();
    renderComposer();
    const input = await findReadyInput();

    // Type the token and hit Enter while discovery is still parked on the gate.
    await user.type(input, '//slow');
    await user.keyboard('{Enter}');
    expect(requests.find(request => request.url === 'prepare')).toBeUndefined();

    // Settling discovery must let the queued submission proceed.
    releaseDiscovery();
    await waitFor(
      () => expect(requests.find(request => request.url === 'prepare')?.body).toMatchObject({ command: '//slow' }),
      { timeout: 5000 },
    );
  });

  it('falls back from /review to the canonical //review preparation token', async () => {
    const requests: Recorded[] = [];
    server.use(
      http.post(`${TEST_BASE_URL}/web/agent-controller/code/commands/discover`, () =>
        HttpResponse.json({
          capabilities: { customCommands: 'supported', skills: 'supported' },
          commands: [
            { command: '//review', source: 'custom', name: 'review', description: 'Review the tree', goal: false },
          ],
        }),
      ),
      http.post(`${TEST_BASE_URL}/web/agent-controller/code/commands/prepare`, async ({ request }) => {
        requests.push({ url: 'prepare', body: await request.json() });
        return HttpResponse.json({ action: 'none', notice: 'ran' });
      }),
    );

    const user = userEvent.setup();
    const { client } = renderComposer();
    const input = await findReadyInput();

    // User types the single-slash form; no suggestions match it exactly.
    await user.type(input, '/review');
    await user.keyboard('{Enter}');

    await waitForMutationsIdle(client);
    // Preparation receives the canonical double-slash token even though the
    // user typed the single-slash form.
    const prepare = requests.find(request => request.url === 'prepare');
    expect(prepare?.body).toMatchObject({ command: '//review' });
  });

  it('prepares /skill/<name> through discovery and submits the skill envelope', async () => {
    const requests: Recorded[] = [];
    server.use(
      http.post(`${TEST_BASE_URL}/web/agent-controller/code/commands/discover`, () =>
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
      http.post(`${TEST_BASE_URL}/web/agent-controller/code/commands/prepare`, async ({ request }) => {
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
