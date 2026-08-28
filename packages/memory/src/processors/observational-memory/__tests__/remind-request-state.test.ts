import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RemindConversation, RemindRequestFailureStatus } from '../subconscious/remind-request-state';
import { REMINDER_TURN_DEADLINE_MS, RemindRequestRegistry } from '../subconscious/remind-request-state';

const conversation: RemindConversation = { remindThreadId: 'subconscious:alpha:remind', resourceId: 'user-42' };
const otherConversation: RemindConversation = { remindThreadId: 'subconscious:beta:remind', resourceId: 'user-99' };

function register(
  registry: RemindRequestRegistry,
  correlationId: string,
  conversationOverride: RemindConversation = conversation,
) {
  return registry.create({
    correlationId,
    conversation: conversationOverride,
    sourceAgentId: 'main-agent',
    sourceThreadId: 'alpha',
    sourceResourceId: 'user-42',
  });
}

const registries: RemindRequestRegistry[] = [];
function makeRegistry(options?: { deadlineMs?: number; maxTerminalEntries?: number }) {
  const registry = new RemindRequestRegistry(options);
  registries.push(registry);
  return registry;
}

afterEach(() => {
  while (registries.length) registries.pop()!.dispose();
  vi.useRealTimers();
});

describe('RemindRequestRegistry', () => {
  it('registers minimal pending lifecycle and routing state', () => {
    const registry = makeRegistry();
    const record = register(registry, 'remind-ask-1');

    expect(record).toMatchObject({
      correlationId: 'remind-ask-1',
      status: 'pending',
      conversation,
      sourceAgentId: 'main-agent',
      sourceThreadId: 'alpha',
      sourceResourceId: 'user-42',
    });
    expect(record.deadlineAt - record.createdAt).toBe(REMINDER_TURN_DEADLINE_MS);
    expect(record).not.toHaveProperty('answer');
    expect(record).not.toHaveProperty('settled');
  });

  it('rejects a second registration of the same correlation id', () => {
    const registry = makeRegistry();
    register(registry, 'remind-ask-dup');
    expect(() => register(registry, 'remind-ask-dup')).toThrow(/already exists/);
  });

  it('reserves deterministic terminal signal identity without storing an answer', () => {
    const registry = makeRegistry();
    register(registry, 'remind-ask-2');

    const reservation = registry.reserveTerminal('remind-ask-2', conversation);

    expect(reservation.outcome).toBe('reserved');
    expect(registry.get('remind-ask-2')).toMatchObject({
      status: 'terminal_sending',
      terminalSequence: 1,
      terminalSignalId: 'remind-answer:remind-ask-2:terminal',
    });
    expect(registry.get('remind-ask-2')).not.toHaveProperty('answer');
  });

  it('marks a reserved terminal reply as delivered', () => {
    const registry = makeRegistry();
    register(registry, 'remind-ask-3');
    registry.reserveTerminal('remind-ask-3', conversation);

    registry.markReplied('remind-ask-3');

    expect(registry.get('remind-ask-3')).toMatchObject({ status: 'replied', terminalSequence: 1 });
    expect(registry.get('remind-ask-3')?.terminalAt).toEqual(expect.any(Number));
  });

  it('treats a second terminal reservation as a duplicate', () => {
    const registry = makeRegistry();
    register(registry, 'remind-ask-4');
    registry.reserveTerminal('remind-ask-4', conversation);

    expect(registry.reserveTerminal('remind-ask-4', conversation).outcome).toBe('duplicate');
    registry.markReplied('remind-ask-4');
    expect(registry.reserveTerminal('remind-ask-4', conversation).outcome).toBe('duplicate');
  });

  it('rejects unknown and wrong-conversation terminal reservations', () => {
    const registry = makeRegistry();
    register(registry, 'remind-ask-5');

    expect(registry.reserveTerminal('missing', conversation)).toEqual({ outcome: 'rejected', reason: 'unknown' });
    expect(registry.reserveTerminal('remind-ask-5', otherConversation)).toMatchObject({
      outcome: 'rejected',
      reason: 'wrong_conversation',
    });
    expect(registry.get('remind-ask-5')?.status).toBe('pending');
  });

  const failureStatuses: RemindRequestFailureStatus[] = [
    'timed_out',
    'model_failed',
    'aborted',
    'delivery_failed',
    'delivery_unknown',
  ];

  it.each(failureStatuses)('records an inspectable %s failure without fabricating an answer', status => {
    const registry = makeRegistry();
    register(registry, `remind-ask-${status}`);

    registry.fail(`remind-ask-${status}`, status, `boom: ${status}`);

    expect(registry.get(`remind-ask-${status}`)).toMatchObject({
      status,
      failure: { status, message: `boom: ${status}` },
    });
    expect(registry.get(`remind-ask-${status}`)).not.toHaveProperty('answer');
  });

  it('keeps the first terminal state when a later failure races delivery', () => {
    const registry = makeRegistry();
    register(registry, 'remind-ask-6');
    registry.reserveTerminal('remind-ask-6', conversation);
    registry.markReplied('remind-ask-6');

    registry.fail('remind-ask-6', 'model_failed', 'late model failure');

    expect(registry.get('remind-ask-6')?.status).toBe('replied');
    expect(registry.get('remind-ask-6')?.failure).toBeUndefined();
  });

  it('times out a pending request at its deadline', async () => {
    vi.useFakeTimers();
    const registry = makeRegistry({ deadlineMs: 50 });
    register(registry, 'remind-ask-timeout');

    await vi.advanceTimersByTimeAsync(50);

    expect(registry.get('remind-ask-timeout')).toMatchObject({
      status: 'timed_out',
      failure: { status: 'timed_out', message: 'Memory question timed out after 50ms' },
    });
  });

  it('does not overwrite an in-flight terminal delivery with the question deadline', async () => {
    vi.useFakeTimers();
    const registry = makeRegistry({ deadlineMs: 50 });
    register(registry, 'remind-ask-in-flight');
    registry.reserveTerminal('remind-ask-in-flight', conversation);

    await vi.advanceTimersByTimeAsync(50);

    expect(registry.get('remind-ask-in-flight')).toMatchObject({ status: 'terminal_sending' });
    registry.markReplied('remind-ask-in-flight');
    expect(registry.get('remind-ask-in-flight')).toMatchObject({ status: 'replied' });
  });

  it('keeps terminal lifecycle state bounded', () => {
    const registry = makeRegistry({ maxTerminalEntries: 2 });
    for (const correlationId of ['first', 'second', 'third']) {
      register(registry, correlationId);
      registry.reserveTerminal(correlationId, conversation);
      registry.markReplied(correlationId);
    }

    expect(registry.get('first')).toBeUndefined();
    expect(registry.get('second')?.status).toBe('replied');
    expect(registry.get('third')?.status).toBe('replied');
  });

  it('disposal releases all lifecycle records', () => {
    const registry = makeRegistry();
    register(registry, 'pending');
    register(registry, 'sending');
    register(registry, 'replied');
    registry.reserveTerminal('sending', conversation);
    registry.reserveTerminal('replied', conversation);
    registry.markReplied('replied');

    registry.dispose();

    expect(registry.get('pending')).toBeUndefined();
    expect(registry.get('sending')).toBeUndefined();
    expect(registry.get('replied')).toBeUndefined();
  });
});
