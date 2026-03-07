import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';
import type { HarnessEvent } from './types';
import { defaultDisplayState } from './types';

function createHarness() {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  return new Harness({
    id: 'test-harness',
    storage: new InMemoryStore(),
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
  });
}

function emit(harness: Harness, event: HarnessEvent) {
  (harness as any).emit(event);
}

// ===========================================================================
// MessageDeliveryMode
// ===========================================================================

describe('MessageDeliveryMode', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = createHarness();
  });

  it('defaults to queue mode', () => {
    expect(harness.getMessageDeliveryMode()).toBe('queue');
  });

  it('can be set to interrupt mode', () => {
    harness.setMessageDeliveryMode({ mode: 'interrupt' });
    expect(harness.getMessageDeliveryMode()).toBe('interrupt');
  });

  it('can be set back to queue mode', () => {
    harness.setMessageDeliveryMode({ mode: 'interrupt' });
    harness.setMessageDeliveryMode({ mode: 'queue' });
    expect(harness.getMessageDeliveryMode()).toBe('queue');
  });

  it('emits message_delivery_mode_changed event', () => {
    const events: HarnessEvent[] = [];
    harness.subscribe(event => {
      if (event.type === 'message_delivery_mode_changed') {
        events.push(event);
      }
    });

    harness.setMessageDeliveryMode({ mode: 'interrupt' });

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'message_delivery_mode_changed', mode: 'interrupt' });
  });

  it('does not emit event when mode is unchanged', () => {
    const events: HarnessEvent[] = [];
    harness.subscribe(event => {
      if (event.type === 'message_delivery_mode_changed') {
        events.push(event);
      }
    });

    harness.setMessageDeliveryMode({ mode: 'queue' });
    expect(events).toHaveLength(0);
  });

  it('updates display state when mode changes', () => {
    expect(harness.getDisplayState().messageDeliveryMode).toBe('queue');

    harness.setMessageDeliveryMode({ mode: 'interrupt' });
    expect(harness.getDisplayState().messageDeliveryMode).toBe('interrupt');
  });
});

// ===========================================================================
// defaultDisplayState
// ===========================================================================

describe('defaultDisplayState includes messageDeliveryMode', () => {
  it('defaults messageDeliveryMode to queue', () => {
    const ds = defaultDisplayState();
    expect(ds.messageDeliveryMode).toBe('queue');
  });
});

// ===========================================================================
// display_state_changed event
// ===========================================================================

describe('message_delivery_mode_changed display state', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = createHarness();
  });

  it('updates display state via event', () => {
    emit(harness, { type: 'message_delivery_mode_changed', mode: 'interrupt' });
    expect(harness.getDisplayState().messageDeliveryMode).toBe('interrupt');
  });

  it('emits display_state_changed after mode change', () => {
    const events: HarnessEvent[] = [];
    harness.subscribe(event => {
      if (event.type === 'display_state_changed') {
        events.push(event);
      }
    });

    harness.setMessageDeliveryMode({ mode: 'interrupt' });
    const dsEvent = events.find(
      e => e.type === 'display_state_changed' && (e as any).displayState.messageDeliveryMode === 'interrupt',
    );
    expect(dsEvent).toBeDefined();
  });
});

// ===========================================================================
// send() routing
// ===========================================================================

describe('send() method', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = createHarness();
  });

  it('calls sendMessage when agent is not running', async () => {
    const sendMessageSpy = vi.spyOn(harness, 'sendMessage' as any).mockResolvedValue(undefined);
    const steerSpy = vi.spyOn(harness, 'steer').mockResolvedValue(undefined);
    const followUpSpy = vi.spyOn(harness, 'followUp').mockResolvedValue(undefined);

    await harness.send({ content: 'hello' });

    expect(sendMessageSpy).toHaveBeenCalledWith({ content: 'hello', requestContext: undefined });
    expect(steerSpy).not.toHaveBeenCalled();
    expect(followUpSpy).not.toHaveBeenCalled();
  });

  it('calls steer when running in interrupt mode', async () => {
    const steerSpy = vi.spyOn(harness, 'steer').mockResolvedValue(undefined);
    const followUpSpy = vi.spyOn(harness, 'followUp').mockResolvedValue(undefined);
    vi.spyOn(harness, 'isRunning').mockReturnValue(true);

    harness.setMessageDeliveryMode({ mode: 'interrupt' });
    await harness.send({ content: 'steer me' });

    expect(steerSpy).toHaveBeenCalledWith({ content: 'steer me', requestContext: undefined });
    expect(followUpSpy).not.toHaveBeenCalled();
  });

  it('calls followUp when running in queue mode', async () => {
    const steerSpy = vi.spyOn(harness, 'steer').mockResolvedValue(undefined);
    const followUpSpy = vi.spyOn(harness, 'followUp').mockResolvedValue(undefined);
    vi.spyOn(harness, 'isRunning').mockReturnValue(true);

    await harness.send({ content: 'queue me' });

    expect(followUpSpy).toHaveBeenCalledWith({ content: 'queue me', requestContext: undefined });
    expect(steerSpy).not.toHaveBeenCalled();
  });

  it('defaults to queue mode when running', async () => {
    const followUpSpy = vi.spyOn(harness, 'followUp').mockResolvedValue(undefined);
    const steerSpy = vi.spyOn(harness, 'steer').mockResolvedValue(undefined);
    vi.spyOn(harness, 'isRunning').mockReturnValue(true);

    await harness.send({ content: 'test' });

    expect(followUpSpy).toHaveBeenCalled();
    expect(steerSpy).not.toHaveBeenCalled();
  });
});
