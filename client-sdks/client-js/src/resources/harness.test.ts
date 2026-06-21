import { describe, expect, beforeEach, it, vi } from 'vitest';

import { MastraClient } from '../client';
import { harnessMessageText } from './harness';
import type { HarnessEvent } from './harness';

global.fetch = vi.fn();

describe('Harness Resource', () => {
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

  const lastCall = () => (global.fetch as any).mock.calls.at(-1) as [string, RequestInit];

  beforeEach(() => {
    vi.clearAllMocks();
    client = new MastraClient(clientOptions);
  });

  it('lists harnesses', async () => {
    mockJson({ harnesses: [{ id: 'code' }, { id: 'docs' }] });
    const harnesses = await client.listHarnesses();
    expect(harnesses).toEqual([{ id: 'code' }, { id: 'docs' }]);
    const [url] = lastCall();
    expect(url).toBe('http://localhost:4111/api/harness');
  });

  it('creates (or resumes) a session', async () => {
    mockJson({ harnessId: 'code', resourceId: 'user-1', threadId: 't-123' });
    const res = await client.getHarness('code').session('user-1').create();
    expect(res).toEqual({ harnessId: 'code', resourceId: 'user-1', threadId: 't-123' });
    const [url, init] = lastCall();
    expect(url).toBe('http://localhost:4111/api/harness/code/sessions');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ resourceId: 'user-1' });
  });

  it('sends a message to the resource-scoped session', async () => {
    mockJson({ ok: true });
    await client.getHarness('code').session('user-1').sendMessage('hello');
    const [url, init] = lastCall();
    expect(url).toBe('http://localhost:4111/api/harness/code/sessions/user-1/messages');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ message: 'hello' });
  });

  it('aborts the in-flight run', async () => {
    mockJson({ ok: true });
    await client.getHarness('code').session('user-1').abort();
    const [url, init] = lastCall();
    expect(url).toBe('http://localhost:4111/api/harness/code/sessions/user-1/abort');
    expect(init.method).toBe('POST');
  });

  it('approves a pending tool call', async () => {
    mockJson({ ok: true });
    await client.getHarness('code').session('user-1').approveTool('call-7', true);
    const [url, init] = lastCall();
    expect(url).toBe('http://localhost:4111/api/harness/code/sessions/user-1/tool-approval');
    expect(JSON.parse(init.body as string)).toEqual({ toolCallId: 'call-7', approved: true });
  });

  it('responds to a suspended tool (ask_user)', async () => {
    mockJson({ ok: true });
    await client.getHarness('code').session('user-1').respondToToolSuspension('call-9', 'my answer');
    const [url, init] = lastCall();
    expect(url).toBe('http://localhost:4111/api/harness/code/sessions/user-1/tool-suspension');
    expect(JSON.parse(init.body as string)).toEqual({ toolCallId: 'call-9', resumeData: 'my answer' });
  });

  it('responds to a submit_plan suspension', async () => {
    mockJson({ ok: true });
    await client.getHarness('code').session('user-1').respondToToolSuspension('call-plan', { action: 'approved' });
    const [, init] = lastCall();
    expect(JSON.parse(init.body as string)).toEqual({ toolCallId: 'call-plan', resumeData: { action: 'approved' } });
  });

  it('steers the in-flight run', async () => {
    mockJson({ ok: true });
    await client.getHarness('code').session('user-1').steer('focus on tests');
    const [url, init] = lastCall();
    expect(url).toBe('http://localhost:4111/api/harness/code/sessions/user-1/steer');
    expect(JSON.parse(init.body as string)).toEqual({ message: 'focus on tests' });
  });

  it('reads session state', async () => {
    mockJson({ harnessId: 'code', resourceId: 'user-1', threadId: 't-1', modeId: 'build', modelId: 'm' });
    const state = await client.getHarness('code').session('user-1').state();
    expect(state).toEqual({ harnessId: 'code', resourceId: 'user-1', threadId: 't-1', modeId: 'build', modelId: 'm' });
    const [url] = lastCall();
    expect(url).toBe('http://localhost:4111/api/harness/code/sessions/user-1');
  });

  it('switches mode and model', async () => {
    mockJson({ ok: true });
    await client.getHarness('code').session('user-1').switchMode('plan');
    let [url, init] = lastCall();
    expect(url).toBe('http://localhost:4111/api/harness/code/sessions/user-1/mode');
    expect(JSON.parse(init.body as string)).toEqual({ modeId: 'plan' });

    mockJson({ ok: true });
    await client.getHarness('code').session('user-1').switchModel('openai/gpt-4o', { scope: 'thread' });
    [url, init] = lastCall();
    expect(url).toBe('http://localhost:4111/api/harness/code/sessions/user-1/model');
    expect(JSON.parse(init.body as string)).toMatchObject({ modelId: 'openai/gpt-4o', scope: 'thread' });
  });

  it('lists modes and threads, and switches thread', async () => {
    mockJson({ modes: [{ id: 'build', name: 'Build' }, { id: 'plan', name: 'Plan' }] });
    const modes = await client.getHarness('code').listModes();
    expect(modes).toEqual([{ id: 'build', name: 'Build' }, { id: 'plan', name: 'Plan' }]);
    expect(lastCall()[0]).toBe('http://localhost:4111/api/harness/code/modes');

    mockJson({ threads: [{ id: 't-1', title: 'One' }] });
    const threads = await client.getHarness('code').session('user-1').listThreads();
    expect(threads).toEqual([{ id: 't-1', title: 'One' }]);
    expect(lastCall()[0]).toBe('http://localhost:4111/api/harness/code/sessions/user-1/threads');

    mockJson({ ok: true });
    await client.getHarness('code').session('user-1').switchThread('t-1');
    const [url, init] = lastCall();
    expect(url).toBe('http://localhost:4111/api/harness/code/sessions/user-1/thread');
    expect(JSON.parse(init.body as string)).toEqual({ threadId: 't-1' });
  });

  it('parses SSE frames into events (skipping heartbeats)', async () => {
    const events = [
      { type: 'agent_start' },
      { type: 'message_update', message: { id: 'm1', role: 'assistant', content: [{ type: 'text', text: 'hi' }] } },
    ];
    mockSse([
      `data: ${JSON.stringify(events[0])}\n\n`,
      `: heartbeat\n\n`,
      `data: ${JSON.stringify(events[1])}\n\n`,
    ]);

    const received: HarnessEvent[] = [];
    const sub = await client.getHarness('code').session('user-1').subscribe({
      onEvent: e => received.push(e),
    });

    // Allow the async pump to drain the (already-closed) stream.
    await new Promise(r => setTimeout(r, 10));
    sub.unsubscribe();

    const [url] = lastCall();
    expect(url).toBe('http://localhost:4111/api/harness/code/sessions/user-1/stream');
    expect(received.map(e => e.type)).toEqual(['agent_start', 'message_update']);
    expect(received[1].type).toBe('message_update');
    if (received[1].type === 'message_update') {
      expect(harnessMessageText(received[1].message)).toBe('hi');
    }
  });

  it('handles a frame split across stream chunks', async () => {
    const event = { type: 'agent_end', reason: 'complete' };
    const serialized = `data: ${JSON.stringify(event)}\n\n`;
    const mid = Math.floor(serialized.length / 2);
    mockSse([serialized.slice(0, mid), serialized.slice(mid)]);

    const received: HarnessEvent[] = [];
    const sub = await client.getHarness('code').session('user-1').subscribe({
      onEvent: e => received.push(e),
    });
    await new Promise(r => setTimeout(r, 10));
    sub.unsubscribe();

    expect(received).toEqual([event]);
  });
});
