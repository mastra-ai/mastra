import { describe, expect, it, vi, beforeEach } from 'vitest';

import { TelephonySession } from './telephony-session';
import type { MastraVoice } from '../voice';

// Mock voice provider for testing
function createMockVoice(): MastraVoice & {
  mockEmit: (event: string, data?: unknown) => void;
} {
  const handlers = new Map<string, Set<(...args: unknown[]) => void>>();

  const mock = {
    name: 'mock-voice',
    speak: vi.fn().mockResolvedValue(undefined),
    listen: vi.fn().mockResolvedValue('test transcript'),
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
    send: vi.fn(),
    answer: vi.fn(),
    addTools: vi.fn(),
    addInstructions: vi.fn(),
    on: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
      if (!handlers.has(event)) {
        handlers.set(event, new Set());
      }
      handlers.get(event)!.add(callback);
    }),
    off: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
      handlers.get(event)?.delete(callback);
    }),
    mockEmit: (event: string, data?: unknown) => {
      const eventHandlers = handlers.get(event);
      if (eventHandlers) {
        eventHandlers.forEach(handler => handler(data));
      }
    },
  } as unknown as MastraVoice & { mockEmit: (event: string, data?: unknown) => void };

  return mock;
}

describe('TelephonySession', () => {
  let telephonyVoice: ReturnType<typeof createMockVoice>;
  let aiVoice: ReturnType<typeof createMockVoice>;

  beforeEach(() => {
    telephonyVoice = createMockVoice();
    aiVoice = createMockVoice();
  });

  describe('constructor', () => {
    it('should create a session with required config', () => {
      const session = new TelephonySession({
        telephony: telephonyVoice,
        ai: aiVoice,
      });

      expect(session.getState()).toBe('idle');
      expect(session.getSpeaker()).toBe('none');
    });

    it('should accept optional config', () => {
      const session = new TelephonySession({
        telephony: telephonyVoice,
        ai: aiVoice,
        codec: 'alaw',
        bargeIn: false,
        speechThreshold: 0.05,
        name: 'test-session',
      });

      expect(session.getState()).toBe('idle');
    });
  });

  describe('start', () => {
    it('should connect AI provider', async () => {
      const session = new TelephonySession({
        telephony: telephonyVoice,
        ai: aiVoice,
      });

      await session.start();

      expect(aiVoice.connect).toHaveBeenCalled();
      expect(session.getState()).toBe('connecting');
    });

    it('should throw if started when not idle', async () => {
      const session = new TelephonySession({
        telephony: telephonyVoice,
        ai: aiVoice,
      });

      await session.start();
      await expect(session.start()).rejects.toThrow('Cannot start session in state');
    });

    it('should wire up telephony events', async () => {
      const session = new TelephonySession({
        telephony: telephonyVoice,
        ai: aiVoice,
      });

      await session.start();

      expect(telephonyVoice.on).toHaveBeenCalledWith('audio-received', expect.any(Function));
      expect(telephonyVoice.on).toHaveBeenCalledWith('call-started', expect.any(Function));
      expect(telephonyVoice.on).toHaveBeenCalledWith('call-ended', expect.any(Function));
      expect(telephonyVoice.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should wire up AI events', async () => {
      const session = new TelephonySession({
        telephony: telephonyVoice,
        ai: aiVoice,
      });

      await session.start();

      expect(aiVoice.on).toHaveBeenCalledWith('audio', expect.any(Function));
      expect(aiVoice.on).toHaveBeenCalledWith('speaking.done', expect.any(Function));
      expect(aiVoice.on).toHaveBeenCalledWith('writing', expect.any(Function));
      expect(aiVoice.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should emit error and reset state on AI connect failure', async () => {
      const error = new Error('Connection failed');
      (aiVoice.connect as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

      const session = new TelephonySession({
        telephony: telephonyVoice,
        ai: aiVoice,
      });

      const errorHandler = vi.fn();
      session.on('error', errorHandler);

      await expect(session.start()).rejects.toThrow('Connection failed');
      expect(errorHandler).toHaveBeenCalledWith(error);
      expect(session.getState()).toBe('idle');
    });
  });

  describe('end', () => {
    it('should close providers and emit ended', async () => {
      const session = new TelephonySession({
        telephony: telephonyVoice,
        ai: aiVoice,
      });

      await session.start();

      const endedHandler = vi.fn();
      session.on('ended', endedHandler);

      session.end('test-reason');

      expect(aiVoice.close).toHaveBeenCalled();
      expect(telephonyVoice.close).toHaveBeenCalled();
      expect(endedHandler).toHaveBeenCalledWith({ reason: 'test-reason' });
      expect(session.getState()).toBe('ended');
    });

    it('should not emit ended twice', async () => {
      const session = new TelephonySession({
        telephony: telephonyVoice,
        ai: aiVoice,
      });

      await session.start();

      const endedHandler = vi.fn();
      session.on('ended', endedHandler);

      session.end('first');
      session.end('second');

      expect(endedHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('events', () => {
    it('should emit ready when call starts', async () => {
      const session = new TelephonySession({
        telephony: telephonyVoice,
        ai: aiVoice,
      });

      const readyHandler = vi.fn();
      session.on('ready', readyHandler);

      await session.start();
      telephonyVoice.mockEmit('call-started', { callSid: 'CA123', streamSid: 'MZ456' });

      expect(readyHandler).toHaveBeenCalledWith({ callSid: 'CA123', streamSid: 'MZ456' });
      expect(session.getState()).toBe('active');
    });

    it('should emit ended when call ends', async () => {
      const session = new TelephonySession({
        telephony: telephonyVoice,
        ai: aiVoice,
      });

      const endedHandler = vi.fn();
      session.on('ended', endedHandler);

      await session.start();
      telephonyVoice.mockEmit('call-ended');

      expect(endedHandler).toHaveBeenCalledWith({ reason: 'call-ended' });
    });

    it('should emit user:speaking on audio with energy above threshold', async () => {
      const session = new TelephonySession({
        telephony: telephonyVoice,
        ai: aiVoice,
        speechThreshold: 0.01,
      });

      const speakingHandler = vi.fn();
      session.on('user:speaking', speakingHandler);

      await session.start();

      // Send audio with significant energy (loud sound)
      const loudAudio = new Int16Array([5000, -5000, 5000, -5000]);
      telephonyVoice.mockEmit('audio-received', loudAudio);

      expect(speakingHandler).toHaveBeenCalled();
      expect(session.getSpeaker()).toBe('user');
    });

    it('should emit agent:speaking when AI sends audio', async () => {
      const session = new TelephonySession({
        telephony: telephonyVoice,
        ai: aiVoice,
      });

      const speakingHandler = vi.fn();
      session.on('agent:speaking', speakingHandler);

      await session.start();

      aiVoice.mockEmit('audio', new Int16Array([1000, -1000]));

      expect(speakingHandler).toHaveBeenCalled();
      expect(session.getSpeaker()).toBe('agent');
    });

    it('should emit agent:stopped when AI finishes speaking', async () => {
      const session = new TelephonySession({
        telephony: telephonyVoice,
        ai: aiVoice,
      });

      const stoppedHandler = vi.fn();
      session.on('agent:stopped', stoppedHandler);

      await session.start();

      // First, agent starts speaking
      aiVoice.mockEmit('audio', new Int16Array([1000, -1000]));
      // Then, agent stops
      aiVoice.mockEmit('speaking.done');

      expect(stoppedHandler).toHaveBeenCalled();
      expect(session.getSpeaker()).toBe('none');
    });
  });

  describe('barge-in', () => {
    it('should emit barge-in when user speaks during agent speech', async () => {
      const session = new TelephonySession({
        telephony: telephonyVoice,
        ai: aiVoice,
        bargeIn: true,
        speechThreshold: 0.01,
      });

      const bargeInHandler = vi.fn();
      session.on('barge-in', bargeInHandler);

      await session.start();

      // Agent starts speaking
      aiVoice.mockEmit('audio', new Int16Array([1000, -1000]));

      // User speaks over the agent (loud audio)
      const loudAudio = new Int16Array([5000, -5000, 5000, -5000]);
      telephonyVoice.mockEmit('audio-received', loudAudio);

      expect(bargeInHandler).toHaveBeenCalled();
      expect(session.getSpeaker()).toBe('user');
    });

    it('should not emit barge-in when disabled', async () => {
      const session = new TelephonySession({
        telephony: telephonyVoice,
        ai: aiVoice,
        bargeIn: false,
        speechThreshold: 0.01,
      });

      const bargeInHandler = vi.fn();
      session.on('barge-in', bargeInHandler);

      await session.start();

      // Agent starts speaking
      aiVoice.mockEmit('audio', new Int16Array([1000, -1000]));

      // User speaks over the agent
      const loudAudio = new Int16Array([5000, -5000, 5000, -5000]);
      telephonyVoice.mockEmit('audio-received', loudAudio);

      expect(bargeInHandler).not.toHaveBeenCalled();
    });

    it('should not emit barge-in for quiet audio', async () => {
      const session = new TelephonySession({
        telephony: telephonyVoice,
        ai: aiVoice,
        bargeIn: true,
        speechThreshold: 0.1, // High threshold
      });

      const bargeInHandler = vi.fn();
      session.on('barge-in', bargeInHandler);

      await session.start();

      // Agent starts speaking
      aiVoice.mockEmit('audio', new Int16Array([1000, -1000]));

      // Very quiet audio (below threshold)
      const quietAudio = new Int16Array([10, -10, 10, -10]);
      telephonyVoice.mockEmit('audio-received', quietAudio);

      expect(bargeInHandler).not.toHaveBeenCalled();
    });
  });

  describe('audio routing', () => {
    it('should send telephony audio to AI provider', async () => {
      const session = new TelephonySession({
        telephony: telephonyVoice,
        ai: aiVoice,
      });

      await session.start();

      const pcmAudio = new Int16Array([1000, -1000, 500, -500]);
      telephonyVoice.mockEmit('audio-received', pcmAudio);

      expect(aiVoice.send).toHaveBeenCalledWith(pcmAudio);
    });

    it('should handle audio received as object with audio property', async () => {
      const session = new TelephonySession({
        telephony: telephonyVoice,
        ai: aiVoice,
      });

      await session.start();

      const pcmAudio = new Int16Array([1000, -1000, 500, -500]);
      telephonyVoice.mockEmit('audio-received', { audio: pcmAudio, streamSid: 'MZ123' });

      expect(aiVoice.send).toHaveBeenCalledWith(pcmAudio);
    });
  });

  describe('event handler management', () => {
    it('should register and call event handlers', async () => {
      const session = new TelephonySession({
        telephony: telephonyVoice,
        ai: aiVoice,
      });

      const handler1 = vi.fn();
      const handler2 = vi.fn();

      session.on('ready', handler1);
      session.on('ready', handler2);

      await session.start();
      telephonyVoice.mockEmit('call-started', { callSid: 'CA123' });

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should remove event handlers with off', async () => {
      const session = new TelephonySession({
        telephony: telephonyVoice,
        ai: aiVoice,
      });

      const handler = vi.fn();
      session.on('ready', handler);
      session.off('ready', handler);

      await session.start();
      telephonyVoice.mockEmit('call-started', { callSid: 'CA123' });

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
