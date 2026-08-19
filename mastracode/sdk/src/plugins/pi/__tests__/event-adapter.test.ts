import type { AgentControllerEvent } from '@mastra/core/agent-controller';
import { describe, expect, it, vi } from 'vitest';

import { PiEventAdapter, type PiSessionEventSource } from '../event-adapter.js';
import { MastraPiExtensionGeneration } from '../runtime.js';

class TestSession implements PiSessionEventSource {
  listener?: (event: AgentControllerEvent) => void | Promise<void>;
  beforeEnd?: (event: Extract<AgentControllerEvent, { type: 'agent_end' }>) => void | Promise<void>;
  unsubscribe = vi.fn();
  unsubscribeBeforeEnd = vi.fn();

  subscribe(listener: (event: AgentControllerEvent) => void | Promise<void>) {
    this.listener = listener;
    return this.unsubscribe;
  }

  onBeforeAgentEnd(listener: (event: Extract<AgentControllerEvent, { type: 'agent_end' }>) => void | Promise<void>) {
    this.beforeEnd = listener;
    return this.unsubscribeBeforeEnd;
  }

  async emit(event: AgentControllerEvent) {
    await this.listener?.(event);
  }
}

function generation(id: string) {
  const value = new MastraPiExtensionGeneration(id, id, `/tmp/${id}.ts`);
  return { value, api: value.createApi() };
}

describe('Pi event adapter', () => {
  it('normalizes lifecycle, message, tool, model, mode, and thread events in deterministic order', async () => {
    const first = generation('first');
    const second = generation('second');
    const seen: string[] = [];
    for (const current of [first, second]) {
      for (const event of [
        'agent_start',
        'agent_end',
        'turn_start',
        'turn_end',
        'message_update',
        'tool_execution_start',
        'model_select',
        'thinking_level_select',
        'session_info_changed',
      ]) {
        current.api.on(event, payload => seen.push(`${current.value.extensionId}:${event}:${JSON.stringify(payload)}`));
      }
      current.value.bind();
    }
    const adapter = new PiEventAdapter({ cwd: '/workspace' });
    await adapter.setGenerations([first.value, second.value]);
    const session = new TestSession();
    await adapter.attach(session);

    await session.emit({ type: 'agent_start' });
    await session.emit({
      type: 'message_update',
      message: { id: 'm1', role: 'assistant', content: { format: 2, parts: [] }, createdAt: new Date() },
    });
    await session.emit({ type: 'tool_start', toolCallId: 'call-1', toolName: 'read', args: { path: 'a' } });
    await session.emit({ type: 'model_changed', modelId: 'openai/gpt-5' });
    await session.emit({ type: 'mode_changed', modeId: 'plan', previousModeId: 'default' });
    await session.emit({ type: 'thread_changed', threadId: 'next', previousThreadId: 'old' });
    const finalMessage = {
      id: 'm2',
      role: 'assistant' as const,
      content: { format: 2 as const, parts: [{ type: 'text' as const, text: 'done' }] },
      createdAt: new Date(),
    };
    await session.emit({ type: 'message_end', message: finalMessage });
    await session.emit({ type: 'agent_end', reason: 'complete' });

    expect(seen.map(entry => entry.split(':').slice(0, 2).join(':'))).toEqual([
      'first:agent_start',
      'second:agent_start',
      'first:turn_start',
      'second:turn_start',
      'first:message_update',
      'second:message_update',
      'first:tool_execution_start',
      'second:tool_execution_start',
      'first:model_select',
      'second:model_select',
      'first:thinking_level_select',
      'second:thinking_level_select',
      'first:session_info_changed',
      'second:session_info_changed',
      'first:agent_end',
      'first:turn_end',
      'second:agent_end',
      'second:turn_end',
    ]);
    expect(seen.some(entry => entry.includes('"messages":[{"id":"m2"'))).toBe(true);
    expect(first.value.compatibility.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ capability: 'event:turn-granularity' }),
        expect.objectContaining({ capability: 'event:agent_end-messages' }),
      ]),
    );
  });

  it('pairs the adapted run-level turn lifecycle when a run ends without a final message', async () => {
    const current = generation('empty-run');
    const seen: unknown[] = [];
    current.api.on('turn_start', event => seen.push(event));
    current.api.on('turn_end', event => seen.push(event));
    current.value.bind();
    const adapter = new PiEventAdapter({ cwd: '/workspace' });
    await adapter.setGenerations([current.value]);
    const session = new TestSession();
    await adapter.attach(session);

    await session.emit({ type: 'agent_start' });
    await session.emit({ type: 'agent_end', reason: 'error' });

    expect(seen).toEqual([
      { type: 'turn_start', turnIndex: 0, timestamp: 0 },
      { type: 'turn_end', turnIndex: 0, message: undefined, toolResults: [] },
    ]);
  });

  it('preserves active-run state when generation reconciliation is a no-op', async () => {
    const current = generation('unchanged');
    const turnEnd = vi.fn();
    current.api.on('turn_end', turnEnd);
    current.value.bind();
    const adapter = new PiEventAdapter({ cwd: '/workspace' });
    await adapter.setGenerations([current.value]);
    const session = new TestSession();
    await adapter.attach(session);

    await session.emit({ type: 'agent_start' });
    await adapter.setGenerations([current.value]);
    await session.emit({ type: 'agent_end', reason: 'complete' });

    expect(turnEnd).toHaveBeenCalledOnce();
  });

  it('isolates normalized message payloads between sibling generations', async () => {
    const first = generation('message-mutator');
    const second = generation('message-observer');
    const observed = vi.fn();
    first.api.on('message_update', payload => {
      (payload as { message: { id: string } }).message.id = 'mutated';
    });
    second.api.on('message_update', payload => observed(payload));
    first.value.bind();
    second.value.bind();
    const adapter = new PiEventAdapter({ cwd: '/workspace' });
    await adapter.setGenerations([first.value, second.value]);
    const session = new TestSession();
    await adapter.attach(session);

    await session.emit({
      type: 'message_update',
      message: { id: 'original', role: 'assistant', content: { format: 2, parts: [] }, createdAt: new Date() },
    });

    expect(observed).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.objectContaining({ id: 'original' }) }),
    );
  });

  it('serializes source callbacks when the source does not await listener promises', async () => {
    let release!: () => void;
    const blocked = new Promise<void>(resolve => {
      release = resolve;
    });
    const current = generation('ordered');
    const seen: string[] = [];
    current.api.on('agent_start', async () => {
      seen.push('agent_start:begin');
      await blocked;
      seen.push('agent_start:end');
    });
    current.api.on('message_update', () => seen.push('message_update'));
    current.value.bind();
    const adapter = new PiEventAdapter({ cwd: '/workspace' });
    await adapter.setGenerations([current.value]);
    const session = new TestSession();
    await adapter.attach(session);

    const first = session.emit({ type: 'agent_start' });
    const second = session.emit({
      type: 'message_update',
      message: { id: 'm1', role: 'assistant', content: { format: 2, parts: [] }, createdAt: new Date() },
    });
    await Promise.resolve();
    expect(seen).toEqual(['agent_start:begin']);
    release();
    await Promise.all([first, second]);

    expect(seen).toEqual(['agent_start:begin', 'agent_start:end', 'message_update']);
  });

  it('does not deliver queued pre-reload events to replacement generations', async () => {
    let release!: () => void;
    const blocked = new Promise<void>(resolve => {
      release = resolve;
    });
    const original = generation('queued-original');
    original.api.on('agent_start', () => blocked);
    original.value.bind();
    const replacement = generation('queued-replacement');
    const replacementHandler = vi.fn();
    replacement.api.on('message_update', replacementHandler);
    replacement.value.bind();
    const adapter = new PiEventAdapter({ cwd: '/workspace' });
    await adapter.setGenerations([original.value]);
    const session = new TestSession();
    await adapter.attach(session);

    const first = session.emit({ type: 'agent_start' });
    const queued = session.emit({
      type: 'message_update',
      message: { id: 'm1', role: 'assistant', content: { format: 2, parts: [] }, createdAt: new Date() },
    });
    await Promise.resolve();
    const replacing = adapter.setGenerations([replacement.value]);
    release();
    await Promise.all([first, queued, replacing]);

    expect(replacementHandler).not.toHaveBeenCalled();
  });

  it('does not deliver an in-flight old-session event to replacement generations', async () => {
    let release!: () => void;
    const blocked = new Promise<void>(resolve => {
      release = resolve;
    });
    const original = generation('original');
    const originalEvents: string[] = [];
    original.api.on('agent_start', async () => {
      originalEvents.push('agent_start:begin');
      await blocked;
      originalEvents.push('agent_start:end');
    });
    original.api.on('turn_start', () => originalEvents.push('turn_start'));
    original.api.on('session_shutdown', () => originalEvents.push('session_shutdown'));
    original.value.bind();
    const replacement = generation('replacement');
    const replacementHandler = vi.fn();
    const replacementEnd = vi.fn();
    replacement.api.on('agent_start', replacementHandler);
    replacement.api.on('agent_end', replacementEnd);
    replacement.value.bind();
    const adapter = new PiEventAdapter({ cwd: '/workspace' });
    await adapter.setGenerations([original.value]);
    const firstSession = new TestSession();
    await adapter.attach(firstSession);

    const inFlight = firstSession.emit({ type: 'agent_start' });
    await Promise.resolve();
    const replacing = adapter.setGenerations([replacement.value]);
    release();
    await Promise.all([inFlight, replacing]);
    const secondSession = new TestSession();
    await adapter.attach(secondSession);

    expect(replacementHandler).not.toHaveBeenCalled();
    expect(originalEvents).toEqual(['agent_start:begin', 'agent_start:end', 'session_shutdown']);
    await secondSession.emit({ type: 'agent_end', reason: 'complete' });
    expect(replacementEnd).not.toHaveBeenCalled();
    await secondSession.emit({ type: 'agent_start' });
    expect(replacementHandler).toHaveBeenCalledOnce();
  });

  it('omits non-serializable host tool payloads from Pi lifecycle events', async () => {
    const current = generation('safe-events');
    const payloads: unknown[] = [];
    for (const name of ['tool_execution_start', 'tool_execution_update', 'tool_execution_end', 'turn_end']) {
      current.api.on(name, payload => payloads.push(payload));
    }
    current.value.bind();
    const adapter = new PiEventAdapter({ cwd: '/workspace' });
    await adapter.setGenerations([current.value]);
    const session = new TestSession();
    await adapter.attach(session);
    await session.emit({ type: 'agent_start' });
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    await session.emit({ type: 'tool_start', toolCallId: 'call-1', toolName: 'unsafe', args: circular });
    await session.emit({ type: 'tool_update', toolCallId: 'call-1', partialResult: { run: () => undefined } });
    await session.emit({ type: 'tool_end', toolCallId: 'call-1', result: circular, isError: false });
    await session.emit({ type: 'agent_end', reason: 'complete' });

    expect(payloads).toEqual([
      { type: 'tool_execution_start', toolCallId: 'call-1', toolName: 'unsafe' },
      { type: 'tool_execution_update', toolCallId: 'call-1' },
      { type: 'tool_execution_end', toolCallId: 'call-1', isError: false },
      { type: 'turn_end', turnIndex: 0 },
    ]);
    expect(current.value.compatibility.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ capability: 'event:tool_execution_start:non-serializable' }),
        expect.objectContaining({ capability: 'event:tool_execution_update:non-serializable' }),
        expect.objectContaining({ capability: 'event:tool_execution_end:non-serializable' }),
        expect.objectContaining({ capability: 'event:turn_end:non-serializable' }),
      ]),
    );
  });

  it('isolates sibling failures and unsubscribes exact session listeners on replacement and detach', async () => {
    const failing = generation('failing');
    const sibling = generation('sibling');
    const handled = vi.fn();
    failing.api.on('agent_start', () => {
      throw new Error('boom');
    });
    sibling.api.on('agent_start', handled);
    failing.value.bind();
    sibling.value.bind();
    const adapter = new PiEventAdapter({ cwd: '/workspace' });
    await adapter.setGenerations([failing.value, sibling.value]);
    const firstSession = new TestSession();
    const secondSession = new TestSession();

    await adapter.attach(firstSession);
    const staleListener = firstSession.listener;
    await firstSession.emit({ type: 'agent_start' });
    expect(handled).toHaveBeenCalledOnce();
    expect(
      failing.value.compatibility.diagnostics.some(item => item.message.includes('agent_start handler failed')),
    ).toBe(true);

    await adapter.setGenerations([sibling.value]);
    await adapter.attach(secondSession);
    expect(firstSession.unsubscribe).toHaveBeenCalledOnce();
    expect(firstSession.unsubscribeBeforeEnd).toHaveBeenCalledOnce();
    await secondSession.emit({ type: 'agent_start' });
    expect(handled).toHaveBeenCalledTimes(2);
    await staleListener?.({ type: 'agent_start' });
    expect(handled).toHaveBeenCalledTimes(2);
    await adapter.detach();
    expect(secondSession.unsubscribe).toHaveBeenCalledOnce();
    expect(secondSession.unsubscribeBeforeEnd).toHaveBeenCalledOnce();
  });

  it('emits session mount and teardown events for the bound session', async () => {
    const current = generation('lifecycle');
    const seen: string[] = [];
    current.api.on('session_start', event => seen.push((event as { type: string }).type));
    current.api.on('session_shutdown', event => seen.push((event as { type: string }).type));
    current.value.bind();
    const adapter = new PiEventAdapter({ cwd: '/workspace' });
    await adapter.setGenerations([current.value]);

    await adapter.attach(new TestSession());
    await Promise.resolve();
    const replacement = generation('replacement');
    replacement.api.on('session_start', event => seen.push(`replacement:${(event as { type: string }).type}`));
    replacement.api.on('session_shutdown', event => seen.push(`replacement:${(event as { type: string }).type}`));
    replacement.value.bind();
    await adapter.setGenerations([replacement.value]);
    await Promise.resolve();
    await adapter.detach();
    await Promise.resolve();

    expect(seen).toEqual([
      'session_start',
      'session_shutdown',
      'replacement:session_start',
      'replacement:session_shutdown',
    ]);
  });

  it('awaits agent-settled hooks and diagnoses unsupported veto returns', async () => {
    const current = generation('settled');
    let release: (() => void) | undefined;
    current.api.on('agent_settled', () => new Promise(resolve => (release = () => resolve({ veto: true }))));
    current.value.bind();
    const adapter = new PiEventAdapter({ cwd: '/workspace' });
    await adapter.setGenerations([current.value]);
    const session = new TestSession();
    await adapter.attach(session);

    const completion = session.beforeEnd?.({ type: 'agent_end', reason: 'complete' });
    await Promise.resolve();
    expect(current.value.compatibility.diagnostics).toHaveLength(0);
    release?.();
    await completion;
    expect(
      current.value.compatibility.diagnostics.some(item => item.message.includes('cannot use it to veto completion')),
    ).toBe(true);
  });
});
