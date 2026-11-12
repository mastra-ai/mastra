import type { SandboxProcess } from '@mastra/client-js';
import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { createInitialTranscript } from '../../services/transcript';
import type { TimelineEntry } from '../../services/transcript';
import { BackgroundWorkPanel } from '../background/BackgroundWorkPanel';
import { BackgroundWorkProvider } from '../background/BackgroundWorkProvider';
import { TranscriptEntries } from '../Transcript';

const CREATED_AT = new Date('2026-11-12T10:00:00.000Z');
const SESSION_ID = 'session-1';
const PROCESSES_URL = `${TEST_BASE_URL}/web/user-sessions/${SESSION_ID}/background/processes`;

type MessagePart = MastraDBMessage['content']['parts'][number];

function assistant(id: string, parts: MessagePart[]): MastraDBMessage {
  return { id, role: 'assistant', createdAt: CREATED_AT, content: { format: 2, parts } };
}

function ran(toolCallId: string, args: Record<string, unknown>, result: string): MessagePart {
  return {
    type: 'tool-invocation',
    toolInvocation: { state: 'result', toolCallId, toolName: 'execute_command', args, result },
  };
}

/** The notice Factory's dispatcher posts to the thread when a background command exits. */
function exitNotice(toolCallId: string, pid: string, exitCode: number, summary: string): MastraDBMessage {
  const text = `Background command exited with code ${exitCode}: pnpm dev\n\nready on :3000`;
  return {
    id: `exit-${pid}`,
    role: 'signal',
    createdAt: CREATED_AT,
    content: {
      format: 2,
      parts: [{ type: 'text', text }],
      metadata: {
        signal: {
          id: `background-process:${pid}:${toolCallId}`,
          type: 'notification',
          tagName: 'notification',
          createdAt: CREATED_AT.toISOString(),
          attributes: { source: 'background-work', kind: 'background-process-exited' },
          metadata: {
            backgroundCompletion: { kind: 'process', pid, originToolCallId: toolCallId, exitCode, summary },
          },
        },
      },
    },
  };
}

const devServer = ran(
  'dev',
  { command: 'pnpm dev', description: 'Start the dev server', background: true },
  'Started background process (PID: 4242)',
);
const lint = ran('lint', { command: 'pnpm lint' }, 'ok\n\nExit code: 0');
const test = ran('test', { command: 'pnpm test' }, 'ok\n\nExit code: 0');

function running(pid: string, toolCallId: string): SandboxProcess {
  return { pid, command: 'pnpm dev', running: true, metadata: { toolCallId, threadId: SESSION_ID, startedAt: 0 } };
}

function renderChat(entries: TimelineEntry[], extra?: ReactNode) {
  return renderWithProviders(
    <MemoryRouter>
      <BackgroundWorkProvider baseUrl={TEST_BASE_URL} sessionId={SESSION_ID} threadId={SESSION_ID} entries={entries}>
        <TranscriptEntries entries={entries} onApprove={() => {}} onRespond={() => {}} />
        {extra}
      </BackgroundWorkProvider>
    </MemoryRouter>,
  );
}

describe('Transcript background commands', () => {
  it('keeps a background command out of the finished commands, tagged while it runs, then shows when it finished', async () => {
    let processes = [running('4242', 'dev')];
    server.use(http.get(PROCESSES_URL, () => HttpResponse.json({ processes })));
    const before = createInitialTranscript({ messages: [assistant('turn', [lint, devServer, test])] }).entries;
    const view = renderChat(before);

    expect(screen.getByRole('group', { name: 'Ran pnpm lint' })).toBeVisible();
    expect(screen.getByRole('group', { name: 'Ran pnpm test' })).toBeVisible();
    const command = screen.getByRole('group', { name: 'Background command: Start the dev server' });
    expect(await within(command).findByText('Background')).toBeVisible();

    processes = [];
    const after = createInitialTranscript({
      messages: [assistant('turn', [lint, devServer, test]), exitNotice('dev', '4242', 1, 'Start the dev server')],
    }).entries;
    view.rerender(
      <MemoryRouter>
        <BackgroundWorkProvider baseUrl={TEST_BASE_URL} sessionId={SESSION_ID} threadId={SESSION_ID} entries={after}>
          <TranscriptEntries entries={after} onApprove={() => {}} onRespond={() => {}} />
        </BackgroundWorkProvider>
      </MemoryRouter>,
    );

    const finished = screen.getByRole('group', { name: 'Command finished: Start the dev server' });
    expect(within(finished).getByText('exit 1')).toBeVisible();
    const settled = screen.getByRole('group', { name: 'Background command: Start the dev server' });
    expect(within(settled).queryByText('Background')).not.toBeInTheDocument();
    expect(within(settled).getByText('exit 1')).toBeVisible();
  });

  it('stops a running command from the activity panel only once the reader confirms, and shows its output', async () => {
    const killed: string[] = [];
    let processes = [running('4242', 'dev')];
    server.use(
      http.get(PROCESSES_URL, () => HttpResponse.json({ processes })),
      http.get(`${PROCESSES_URL}/:pid`, ({ params }) =>
        HttpResponse.json({
          ...running(String(params.pid), 'dev'),
          stdout: 'ready on :3000\n',
          stderr: '',
          stdoutTruncated: false,
          stderrTruncated: false,
        }),
      ),
      http.post(`${PROCESSES_URL}/:pid/kill`, ({ params }) => {
        killed.push(String(params.pid));
        processes = [];
        return HttpResponse.json({ pid: params.pid, killed: true });
      }),
    );
    const entries = createInitialTranscript({ messages: [assistant('turn', [devServer])] }).entries;
    renderChat(entries, <BackgroundWorkPanel />);

    const panel = await screen.findByRole('region', { name: 'Background work' });
    const row = within(panel).getByRole('group', { name: 'Run: pnpm dev' });
    await userEvent.click(within(row).getAllByRole('button')[0]);
    expect(await within(row).findByText('ready on :3000')).toBeVisible();

    await userEvent.click(within(row).getByRole('button', { name: 'Stop command' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Keep running' }));
    expect(killed).toEqual([]);

    await userEvent.click(within(row).getByRole('button', { name: 'Stop command' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Stop command' }));
    await waitFor(() => expect(killed).toEqual(['4242']));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Background work' })).not.toBeInTheDocument());
  });

  it('reads the sandbox only once a call started a background command, and stops polling once nothing runs', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    let reads = 0;
    let processes = [running('4242', 'dev')];
    server.use(
      http.get(PROCESSES_URL, () => {
        reads += 1;
        return HttpResponse.json({ processes });
      }),
    );
    const foreground = createInitialTranscript({ messages: [assistant('turn', [lint])] }).entries;
    const { client, rerender } = renderChat(foreground);
    await waitForMutationsIdle(client);
    expect(reads).toBe(0);

    const launched = createInitialTranscript({ messages: [assistant('turn', [lint, devServer])] }).entries;
    rerender(
      <MemoryRouter>
        <BackgroundWorkProvider baseUrl={TEST_BASE_URL} sessionId={SESSION_ID} threadId={SESSION_ID} entries={launched}>
          <TranscriptEntries entries={launched} onApprove={() => {}} onRespond={() => {}} />
        </BackgroundWorkProvider>
      </MemoryRouter>,
    );
    await vi.waitFor(() => expect(reads).toBe(1));
    await act(async () => vi.advanceTimersByTimeAsync(3_000));
    await vi.waitFor(() => expect(reads).toBe(2));

    // Stopped outside the chat: the next read finds nothing running, and the reads stop.
    processes = [];
    await act(async () => vi.advanceTimersByTimeAsync(3_000));
    await vi.waitFor(() => expect(reads).toBe(3));
    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    await waitForMutationsIdle(client);
    expect(reads).toBe(3);
  });
});
