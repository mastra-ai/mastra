import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, beforeEach, it, vi } from 'vitest';

import { MastraClient } from '../client';
import { agentControllerMessageText } from './agent-controller';
import type { AgentControllerEvent } from './agent-controller';

global.fetch = vi.fn();

describe('AgentController Resource', () => {
  let client: MastraClient;
  const clientOptions = { baseUrl: 'http://localhost:4111' };

  const mockJson = (data: any) => {
    const response = new Response(undefined, {
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'Content-Type': 'application/json' }),
    });
    response.json = () => Promise.resolve(data);
    (global.fetch as any).mockResolvedValueOnce(response);
  };

  const mockSse = (frames: string[]) => {
    const body = new ReadableStream({
      start(controller) {
        for (const frame of frames) controller.enqueue(new TextEncoder().encode(frame));
        controller.close();
      },
    });
    (global.fetch as any).mockResolvedValueOnce(
      new Response(body, { status: 200, headers: new Headers({ 'Content-Type': 'text/event-stream' }) }),
    );
  };

  const sseResponse = (frames: string[]) =>
    new Response(
      new ReadableStream({
        start(controller) {
          for (const frame of frames) controller.enqueue(new TextEncoder().encode(frame));
          controller.close();
        },
      }),
      { status: 200, headers: new Headers({ 'Content-Type': 'text/event-stream' }) },
    );

  const lastCall = () => (global.fetch as any).mock.calls.at(-1) as [string, RequestInit];

  beforeEach(() => {
    vi.clearAllMocks();
    client = new MastraClient(clientOptions);
  });

  it('lists agent controllers via the canonical route', async () => {
    mockJson({ agentControllers: [{ id: 'code' }, { id: 'docs' }] });
    const controllers = await client.listAgentControllers();
    expect(controllers).toEqual([{ id: 'code' }, { id: 'docs' }]);
    const [url] = lastCall();
    expect(url).toBe('http://localhost:4111/api/agent-controller');
  });

  it('creates (or resumes) a session via the canonical agent-controller route', async () => {
    mockJson({ controllerId: 'code', resourceId: 'user-1', threadId: 't-123' });
    const res = await client.getAgentController('code').session('user-1').create();
    expect(res).toEqual({ controllerId: 'code', resourceId: 'user-1', threadId: 't-123' });
    const [url, init] = lastCall();
    expect(url).toBe('http://localhost:4111/api/agent-controller/code/sessions');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ resourceId: 'user-1' });
  });

  it('sends a message to the resource-scoped session', async () => {
    mockJson({ ok: true });
    await client.getAgentController('code').session('user-1').sendMessage('hello');
    const [url, init] = lastCall();
    expect(url).toBe('http://localhost:4111/api/agent-controller/code/sessions/user-1/messages');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ message: 'hello' });
  });

  it('sends a message with file attachments', async () => {
    mockJson({ ok: true });
    const files = [{ data: 'aGVsbG8=', mediaType: 'image/png', filename: 'shot.png' }];
    await client.getAgentController('code').session('user-1').sendMessage({ content: 'see attached', files });
    const [url, init] = lastCall();
    expect(url).toBe('http://localhost:4111/api/agent-controller/code/sessions/user-1/messages');
    expect(JSON.parse(init.body as string)).toEqual({ message: 'see attached', files });
  });

  it('sends requestContext in the body for run-triggering methods', async () => {
    const session = client.getAgentController('code').session('user-1');
    const requestContext = { userId: 'u-42', tier: 'pro' };

    mockJson({ ok: true });
    await session.sendMessage('hello', { requestContext });
    expect(JSON.parse(lastCall()[1].body as string)).toEqual({ message: 'hello', requestContext });

    mockJson({ ok: true });
    await session.steer('focus', { requestContext });
    expect(JSON.parse(lastCall()[1].body as string)).toEqual({ message: 'focus', requestContext });

    mockJson({ ok: true });
    await session.followUp('later', { requestContext });
    expect(JSON.parse(lastCall()[1].body as string)).toEqual({ message: 'later', requestContext });

    mockJson({ ok: true });
    await session.approveTool('call-7', true, { requestContext });
    expect(JSON.parse(lastCall()[1].body as string)).toEqual({ toolCallId: 'call-7', approved: true, requestContext });

    mockJson({ ok: true });
    await session.respondToToolSuspension('call-9', 'answer', { requestContext });
    expect(JSON.parse(lastCall()[1].body as string)).toEqual({
      toolCallId: 'call-9',
      resumeData: 'answer',
      requestContext,
    });
  });

  it('serializes a RequestContext instance passed to sendMessage', async () => {
    const requestContext = new RequestContext();
    requestContext.set('userId', 'u-42');
    mockJson({ ok: true });
    await client.getAgentController('code').session('user-1').sendMessage('hello', { requestContext });
    expect(JSON.parse(lastCall()[1].body as string)).toEqual({ message: 'hello', requestContext: { userId: 'u-42' } });
  });

  it('aborts the in-flight run', async () => {
    mockJson({ ok: true });
    await client.getAgentController('code').session('user-1').abort();
    const [url, init] = lastCall();
    expect(url).toBe('http://localhost:4111/api/agent-controller/code/sessions/user-1/abort');
    expect(init.method).toBe('POST');
  });

  it('approves a pending tool call', async () => {
    mockJson({ ok: true });
    await client.getAgentController('code').session('user-1').approveTool('call-7', true);
    const [url, init] = lastCall();
    expect(url).toBe('http://localhost:4111/api/agent-controller/code/sessions/user-1/tool-approval');
    expect(JSON.parse(init.body as string)).toEqual({ toolCallId: 'call-7', approved: true });
  });

  it('responds to a suspended tool (ask_user)', async () => {
    mockJson({ ok: true });
    await client.getAgentController('code').session('user-1').respondToToolSuspension('call-9', 'my answer');
    const [url, init] = lastCall();
    expect(url).toBe('http://localhost:4111/api/agent-controller/code/sessions/user-1/tool-suspension');
    expect(JSON.parse(init.body as string)).toEqual({ toolCallId: 'call-9', resumeData: 'my answer' });
  });

  it('responds to a submit_plan suspension', async () => {
    mockJson({ ok: true });
    await client
      .getAgentController('code')
      .session('user-1')
      .respondToToolSuspension('call-plan', { action: 'approved' });
    const [, init] = lastCall();
    expect(JSON.parse(init.body as string)).toEqual({ toolCallId: 'call-plan', resumeData: { action: 'approved' } });
  });

  it('steers the in-flight run', async () => {
    mockJson({ ok: true });
    await client.getAgentController('code').session('user-1').steer('focus on tests');
    const [url, init] = lastCall();
    expect(url).toBe('http://localhost:4111/api/agent-controller/code/sessions/user-1/steer');
    expect(JSON.parse(init.body as string)).toEqual({ message: 'focus on tests' });
  });

  it('reads session state', async () => {
    mockJson({ controllerId: 'code', resourceId: 'user-1', threadId: 't-1', modeId: 'build', modelId: 'm' });
    const state = await client.getAgentController('code').session('user-1').state();
    expect(state).toEqual({
      controllerId: 'code',
      resourceId: 'user-1',
      threadId: 't-1',
      modeId: 'build',
      modelId: 'm',
    });
    const [url] = lastCall();
    expect(url).toBe('http://localhost:4111/api/agent-controller/code/sessions/user-1');
  });

  it('switches mode and model', async () => {
    mockJson({ ok: true });
    await client.getAgentController('code').session('user-1').switchMode('plan');
    let [url, init] = lastCall();
    expect(url).toBe('http://localhost:4111/api/agent-controller/code/sessions/user-1/mode');
    expect(JSON.parse(init.body as string)).toEqual({ modeId: 'plan' });

    mockJson({ ok: true });
    await client.getAgentController('code').session('user-1').switchModel('openai/gpt-4o', { scope: 'thread' });
    [url, init] = lastCall();
    expect(url).toBe('http://localhost:4111/api/agent-controller/code/sessions/user-1/model');
    expect(JSON.parse(init.body as string)).toMatchObject({ modelId: 'openai/gpt-4o', scope: 'thread' });
  });

  it('lists modes and threads, and switches thread', async () => {
    mockJson({
      modes: [
        { id: 'build', name: 'Build' },
        { id: 'plan', name: 'Plan' },
      ],
    });
    const modes = await client.getAgentController('code').listModes();
    expect(modes).toEqual([
      { id: 'build', name: 'Build' },
      { id: 'plan', name: 'Plan' },
    ]);
    expect(lastCall()[0]).toBe('http://localhost:4111/api/agent-controller/code/modes');

    mockJson({ threads: [{ id: 't-1', title: 'One' }] });
    const threads = await client.getAgentController('code').session('user-1').listThreads();
    expect(threads).toEqual([{ id: 't-1', title: 'One' }]);
    expect(lastCall()[0]).toBe('http://localhost:4111/api/agent-controller/code/sessions/user-1/threads');

    // `tags` is JSON-encoded into the query string so worktrees sharing a
    // resourceId can scope the listing to their own threads.
    mockJson({ threads: [{ id: 't-1', title: 'One', tags: { projectPath: '/repo/wt-a' } }] });
    const scoped = await client
      .getAgentController('code')
      .session('user-1')
      .listThreads({ tags: { projectPath: '/repo/wt-a' } });
    expect(scoped).toEqual([{ id: 't-1', title: 'One', tags: { projectPath: '/repo/wt-a' } }]);
    const scopedUrl = new URL(lastCall()[0] as string);
    expect(scopedUrl.searchParams.get('tags')).toBe(JSON.stringify({ projectPath: '/repo/wt-a' }));

    mockJson({ ok: true });
    await client.getAgentController('code').session('user-1').switchThread('t-1');
    const [url, init] = lastCall();
    expect(url).toBe('http://localhost:4111/api/agent-controller/code/sessions/user-1/thread');
    expect(JSON.parse(init.body as string)).toEqual({ threadId: 't-1' });
  });

  it('parses SSE frames into events (skipping heartbeats)', async () => {
    const events = [
      { type: 'agent_start' },
      { type: 'message_update', message: { id: 'm1', role: 'assistant', content: [{ type: 'text', text: 'hi' }] } },
    ];
    mockSse([`data: ${JSON.stringify(events[0])}\n\n`, `: heartbeat\n\n`, `data: ${JSON.stringify(events[1])}\n\n`]);

    const received: AgentControllerEvent[] = [];
    const sub = await client
      .getAgentController('code')
      .session('user-1')
      .subscribe({
        onEvent: e => received.push(e),
      });

    // Allow the async pump to drain the (already-closed) stream.
    await new Promise(r => setTimeout(r, 10));
    sub.unsubscribe();

    const [url] = lastCall();
    expect(url).toBe('http://localhost:4111/api/agent-controller/code/sessions/user-1/stream');
    expect(received.map(e => e.type)).toEqual(['agent_start', 'message_update']);
    expect(received[1].type).toBe('message_update');
    if (received[1].type === 'message_update') {
      expect(agentControllerMessageText(received[1].message)).toBe('hi');
    }
  });

  it('handles a frame split across stream chunks', async () => {
    const event = { type: 'agent_end', reason: 'complete' };
    const serialized = `data: ${JSON.stringify(event)}\n\n`;
    const mid = Math.floor(serialized.length / 2);
    mockSse([serialized.slice(0, mid), serialized.slice(mid)]);

    const received: AgentControllerEvent[] = [];
    const sub = await client
      .getAgentController('code')
      .session('user-1')
      .subscribe({
        onEvent: e => received.push(e),
      });
    await new Promise(r => setTimeout(r, 10));
    sub.unsubscribe();

    expect(received).toEqual([event]);
  });

  it('calls onError when the stream ends without reconnect enabled', async () => {
    mockSse([`data: ${JSON.stringify({ type: 'agent_start' })}\n\n`]);

    const onError = vi.fn();
    const sub = await client
      .getAgentController('code')
      .session('user-1')
      .subscribe({
        onEvent: () => {},
        onError,
      });

    await new Promise(r => setTimeout(r, 10));
    sub.unsubscribe();

    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0]![0] as Error).message).toBe('Agent controller session stream ended unexpectedly');
    expect((global.fetch as any).mock.calls).toHaveLength(1);
  });

  it('reconnects when the stream ends cleanly and reconnect is enabled', async () => {
    const firstEvent = { type: 'agent_start' };
    const secondEvent = { type: 'agent_end', reason: 'complete' };
    (global.fetch as any)
      .mockResolvedValueOnce(sseResponse([`data: ${JSON.stringify(firstEvent)}\n\n`]))
      .mockResolvedValueOnce(sseResponse([`data: ${JSON.stringify(secondEvent)}\n\n`]));

    const received: AgentControllerEvent[] = [];
    const done = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 2000);
      void client
        .getAgentController('code')
        .session('user-1')
        .subscribe({
          onEvent: event => {
            received.push(event);
            if (received.length === 2) {
              clearTimeout(timer);
              resolve();
            }
          },
          onError: error => {
            clearTimeout(timer);
            reject(error);
          },
          reconnect: { maxRetries: 1, delayMs: 0 },
        })
        .then(sub => {
          void done.then(() => sub.unsubscribe());
        });
    });

    await done;

    expect((global.fetch as any).mock.calls).toHaveLength(2);
    expect(received).toEqual([firstEvent, secondEvent]);
  });

  it('retries failed resubscribe requests within the reconnect limit', async () => {
    const firstEvent = { type: 'agent_start' };
    const secondEvent = { type: 'agent_end', reason: 'complete' };
    (global.fetch as any)
      .mockResolvedValueOnce(sseResponse([`data: ${JSON.stringify(firstEvent)}\n\n`]))
      .mockRejectedValueOnce(new Error('temporary reconnect failure'))
      .mockResolvedValueOnce(sseResponse([`data: ${JSON.stringify(secondEvent)}\n\n`]));

    const received: AgentControllerEvent[] = [];
    const done = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 2000);
      void client
        .getAgentController('code')
        .session('user-1')
        .subscribe({
          onEvent: event => {
            received.push(event);
            if (received.length === 2) {
              clearTimeout(timer);
              resolve();
            }
          },
          onError: error => {
            clearTimeout(timer);
            reject(error);
          },
          reconnect: { maxRetries: 2, delayMs: 0 },
        })
        .then(sub => {
          void done.then(() => sub.unsubscribe());
        });
    });

    await done;

    expect((global.fetch as any).mock.calls).toHaveLength(3);
    expect(received).toEqual([firstEvent, secondEvent]);
  });

  it('does not reconnect after unsubscribe', async () => {
    const firstEvent = { type: 'agent_start' };
    (global.fetch as any).mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(firstEvent)}\n\n`));
          },
        }),
        { status: 200, headers: new Headers({ 'Content-Type': 'text/event-stream' }) },
      ),
    );

    const sub = await client
      .getAgentController('code')
      .session('user-1')
      .subscribe({
        onEvent: () => {},
        reconnect: { maxRetries: 5, delayMs: 100 },
      });

    await new Promise(r => setTimeout(r, 10));
    sub.unsubscribe();
    await new Promise(r => setTimeout(r, 250));

    expect((global.fetch as any).mock.calls).toHaveLength(1);
  });

  it('does not reconnect when the onEvent callback throws', async () => {
    mockSse([`data: ${JSON.stringify({ type: 'agent_start' })}\n\n`]);

    const callbackError = new Error('boom from onEvent');
    const onError = vi.fn();
    const sub = await client
      .getAgentController('code')
      .session('user-1')
      .subscribe({
        onEvent: () => {
          throw callbackError;
        },
        onError,
        reconnect: { maxRetries: 5, delayMs: 0 },
      });

    await new Promise(r => setTimeout(r, 10));
    sub.unsubscribe();

    expect(onError).toHaveBeenCalledWith(callbackError);
    expect((global.fetch as any).mock.calls).toHaveLength(1);
  });

  it('sends a notification signal', async () => {
    mockJson({ accepted: true, notificationId: 'n-1', decision: 'deliver', runId: 'run-1' });
    const result = await client
      .getAgentController('code')
      .session('user-1')
      .sendNotification({
        source: 'github',
        kind: 'pr_review',
        summary: 'PR #42 was approved',
        priority: 'high',
        payload: { pr: 42 },
      });

    const [url, init] = lastCall();
    expect(url).toBe('http://localhost:4111/api/agent-controller/code/sessions/user-1/notifications');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.source).toBe('github');
    expect(body.kind).toBe('pr_review');
    expect(body.summary).toBe('PR #42 was approved');
    expect(body.priority).toBe('high');
    expect(result.accepted).toBe(true);
    expect(result.notificationId).toBe('n-1');
    expect(result.decision).toBe('deliver');
  });
});
