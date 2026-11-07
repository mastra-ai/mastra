// @vitest-environment jsdom
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { server } from '../../test/msw-server';
import { renderWithProviders } from '../../test/render';
import { MessageFactory } from '../../ui/MessageFactory';
import { createGenUI, defineGenUIToolRenderer, useGenUIChat } from '../index';
import type { GenUIActionHandlers, GenUIRegistry } from '../index';
import { AGENT_URL, chunk, controllableStream, finish, sseResponse, STREAM_URL } from './sse';

type Chat = ReturnType<typeof useGenUIChat>;
let current: Chat;

function GenUIChat({
  genUI,
  actions,
  initialMessages,
  threadId = 'thread-1',
}: {
  genUI: GenUIRegistry<any>;
  actions?: GenUIActionHandlers<any>;
  initialMessages?: MastraDBMessage[];
  threadId?: string;
}) {
  const chat = useGenUIChat({
    agentId: 'agent-1',
    resourceId: 'resource-1',
    threadId,
    genUI,
    actions,
    initialMessages,
  });
  current = chat;
  return (
    <div>
      {chat.messages.map(message => (
        <MessageFactory
          key={message.id}
          message={message}
          Text={part => <span>{part.text}</span>}
          {...chat.genUI.renderers}
        />
      ))}
    </div>
  );
}

const send = async (message: string) => {
  await act(async () => {
    void current.sendMessage({ message, threadId: 'thread-1' });
  });
};

const json = async (request: Request) => (await request.json()) as Record<string, unknown>;

/** A backend tool renderer with the approval controls a real app would show. */
const deleteFiles = defineGenUIToolRenderer({
  argsSchema: z.object({ paths: z.array(z.string()) }),
  outputSchema: z.object({ deleted: z.number() }),
  component: ({ phase, args, output, approval }) => (
    <section data-testid="delete" data-phase={phase}>
      <p>Delete {args?.paths.join(', ')}</p>
      {output ? <p>Deleted {output.deleted}</p> : null}
      {approval ? (
        <>
          {approval.kind === 'suspended' ? (
            <p>Asks: {String((approval.suspendPayload as { ask: string }).ask)}</p>
          ) : null}
          <button disabled={approval.status === 'pending'} onClick={() => void approval.approve()}>
            Approve
          </button>
          <button
            disabled={approval.status === 'pending'}
            onClick={() => void approval.approve({ keepBackup: true }).catch(() => {})}
          >
            Approve with backup
          </button>
          <button disabled={approval.status === 'pending'} onClick={() => void approval.decline()}>
            Decline
          </button>
          {approval.error ? <p role="alert">{approval.error}</p> : null}
        </>
      ) : null}
    </section>
  ),
});

const approvalStream = () =>
  sseResponse([
    chunk('start'),
    chunk('tool-call', { toolCallId: 'c1', toolName: 'deleteFiles', args: { paths: ['a.txt', 'b.txt'] } }),
    chunk('tool-call-approval', { toolCallId: 'c1', toolName: 'deleteFiles', args: { paths: ['a.txt', 'b.txt'] } }),
    finish('suspended'),
  ]);

afterEach(() => {
  cleanup();
});

describe('useGenUIChat — human in the loop', () => {
  it('a backend tool awaiting approval shows its arguments, and approving resumes the run once', async () => {
    const approvals: Record<string, unknown>[] = [];
    let declines = 0;
    const resumed = controllableStream();
    server.use(
      http.post(STREAM_URL, () => approvalStream()),
      http.post(`${AGENT_URL}/decline-tool-call`, () => {
        declines++;
        return sseResponse([finish('stop')]);
      }),
      http.post(`${AGENT_URL}/approve-tool-call`, async ({ request }) => {
        approvals.push(await json(request));
        return resumed.response();
      }),
    );
    renderWithProviders(<GenUIChat genUI={createGenUI({ tools: { deleteFiles } })} />);
    await send('clean up');

    const tool = await screen.findByTestId('delete');
    await waitFor(() => expect(tool.getAttribute('data-phase')).toBe('awaiting-approval'));
    expect(tool.textContent).toContain('Delete a.txt, b.txt');

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Approve' }) as HTMLButtonElement).disabled).toBe(true),
    );
    // A second decision while the first is in flight (double click, or a component calling approve twice) must not POST again.
    await act(async () => {
      void current.genUI.controller.getToolApproval('c1')!.approve();
      void current.genUI.controller.getToolApproval('c1')!.decline();
    });

    act(() =>
      resumed.push(
        chunk('tool-result', { toolCallId: 'c1', toolName: 'deleteFiles', result: { deleted: 2 } }),
        finish('stop'),
      ),
    );
    resumed.close();

    await waitFor(() => expect(screen.getByTestId('delete').getAttribute('data-phase')).toBe('output-available'));
    expect(screen.getByTestId('delete').textContent).toContain('Deleted 2');
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(approvals).toHaveLength(1);
    expect(declines).toBe(0);
    expect(approvals[0]).toMatchObject({ toolCallId: 'c1' });
    expect(approvals[0]!.resumeData).toBeUndefined();
  });

  it('declining sends a decline and renders the denial', async () => {
    const declines: Record<string, unknown>[] = [];
    server.use(
      http.post(STREAM_URL, () => approvalStream()),
      http.post(`${AGENT_URL}/decline-tool-call`, async ({ request }) => {
        declines.push(await json(request));
        return sseResponse([
          chunk('tool-output-denied', {
            toolCallId: 'c1',
            toolName: 'deleteFiles',
            args: { paths: ['a.txt', 'b.txt'] },
            approval: { id: 'approval-1', approved: false },
          }),
          finish('stop'),
        ]);
      }),
    );
    renderWithProviders(<GenUIChat genUI={createGenUI({ tools: { deleteFiles } })} />);
    await send('clean up');

    fireEvent.click(await screen.findByRole('button', { name: 'Decline' }));
    await waitFor(() => expect(screen.getByTestId('delete').getAttribute('data-phase')).toBe('output-denied'));
    expect(screen.queryByRole('button', { name: 'Decline' })).toBeNull();
    expect(declines).toHaveLength(1);
    expect(declines[0]).toMatchObject({ toolCallId: 'c1' });
  });

  it('a failed approval surfaces the error and can be retried', async () => {
    let attempts = 0;
    server.use(
      http.post(STREAM_URL, () => approvalStream()),
      http.post(`${AGENT_URL}/approve-tool-call`, () => {
        attempts++;
        // 4xx is terminal for the client (5xx would be retried transparently).
        if (attempts === 1) return HttpResponse.json({ error: 'run lock busy' }, { status: 409 });
        return sseResponse([
          chunk('tool-result', { toolCallId: 'c1', toolName: 'deleteFiles', result: { deleted: 2 } }),
          finish('stop'),
        ]);
      }),
    );
    renderWithProviders(<GenUIChat genUI={createGenUI({ tools: { deleteFiles } })} />);
    await send('clean up');

    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/409|busy/);
    expect(screen.getByTestId('delete').getAttribute('data-phase')).toBe('awaiting-approval');
    const retry = screen.getByRole('button', { name: 'Approve' }) as HTMLButtonElement;
    expect(retry.disabled).toBe(false);

    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByTestId('delete').textContent).toContain('Deleted 2'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(attempts).toBe(2);
  });

  it('a suspended tool shows what it asks for and resumes with the user-provided data', async () => {
    const resumes: Record<string, unknown>[] = [];
    server.use(
      http.post(STREAM_URL, () =>
        sseResponse([
          chunk('start'),
          chunk('tool-call', { toolCallId: 'c1', toolName: 'deleteFiles', args: { paths: ['a.txt'] } }),
          chunk('tool-call-suspended', {
            toolCallId: 'c1',
            toolName: 'deleteFiles',
            args: { paths: ['a.txt'] },
            suspendPayload: { ask: 'Keep a backup?' },
          }),
          finish('suspended'),
        ]),
      ),
      http.post(`${AGENT_URL}/resume-stream`, async ({ request }) => {
        resumes.push(await json(request));
        return sseResponse([
          chunk('tool-result', { toolCallId: 'c1', toolName: 'deleteFiles', result: { deleted: 1 } }),
          finish('stop'),
        ]);
      }),
    );
    renderWithProviders(<GenUIChat genUI={createGenUI({ tools: { deleteFiles } })} />);
    await send('clean up');

    expect(await screen.findByText('Asks: Keep a backup?')).toBeTruthy();
    expect(screen.getByTestId('delete').getAttribute('data-phase')).toBe('suspended');
    fireEvent.click(screen.getByRole('button', { name: 'Approve with backup' }));

    await waitFor(() => expect(screen.getByTestId('delete').textContent).toContain('Deleted 1'));
    expect(resumes).toHaveLength(1);
    expect(resumes[0]).toMatchObject({ toolCallId: 'c1', resumeData: { keepBackup: true } });
  });

  it('a suspension restored from history can still be resumed against its original run', async () => {
    const resumes: Record<string, unknown>[] = [];
    server.use(
      http.post(`${AGENT_URL}/resume-stream`, async ({ request }) => {
        resumes.push(await json(request));
        return sseResponse([
          chunk('tool-result', { toolCallId: 'c1', toolName: 'deleteFiles', result: { deleted: 1 } }),
          finish('stop'),
        ]);
      }),
    );
    const history: MastraDBMessage[] = [
      {
        id: 'u1',
        role: 'user',
        createdAt: new Date(0),
        threadId: 'thread-1',
        resourceId: 'resource-1',
        content: { format: 2, parts: [{ type: 'text', text: 'clean up' }] },
      },
      {
        id: 'a1',
        role: 'assistant',
        createdAt: new Date(1),
        threadId: 'thread-1',
        resourceId: 'resource-1',
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: { state: 'call', toolCallId: 'c1', toolName: 'deleteFiles', args: { paths: ['a.txt'] } },
            },
          ],
          metadata: {
            mode: 'stream',
            suspendedTools: {
              deleteFiles: {
                toolCallId: 'c1',
                toolName: 'deleteFiles',
                args: { paths: ['a.txt'] },
                suspendPayload: { ask: 'Keep a backup?' },
                runId: 'run-from-history',
              },
            },
          },
        },
      },
    ];
    renderWithProviders(<GenUIChat genUI={createGenUI({ tools: { deleteFiles } })} initialMessages={history} />);

    expect(await screen.findByText('Asks: Keep a backup?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Approve with backup' }));
    await waitFor(() => expect(screen.getByTestId('delete').textContent).toContain('Deleted 1'));
    expect(resumes[0]).toMatchObject({ runId: 'run-from-history', toolCallId: 'c1', resumeData: { keepBackup: true } });
  });
});
