import type { EventEmitter } from 'node:events';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { wsCalls, getLastInstance, wsConfig } = vi.hoisted(() => {
  const calls: Array<{ url: string; opts: any; instance: any }> = [];
  const config = { initialReadyState: 1 };
  return {
    wsCalls: calls,
    getLastInstance: () => calls[calls.length - 1],
    wsConfig: config,
  };
});

vi.mock('ws', async () => {
  const { EventEmitter } = await import('node:events');
  class MockWebSocket extends EventEmitter {
    send = vi.fn();
    close = vi.fn(() => {
      this.readyState = 3;
    });
    readyState: number;
    OPEN = 1;
    constructor(
      public url: string,
      _protocols: unknown,
      public opts: any,
    ) {
      super();
      this.readyState = wsConfig.initialReadyState;
      wsCalls.push({ url, opts, instance: this });
    }
  }
  return { WebSocket: MockWebSocket };
});

import { InworldRealtimeVoice } from './index';

/** Returns every JSON event the client sent through `ws.send`. */
function sentEvents(instance: any): any[] {
  return (instance.send as ReturnType<typeof vi.fn>).mock.calls.map((c: any[]) => JSON.parse(c[0] as string));
}

/**
 * Connect a voice instance after stubbing the open / session-ready promises.
 * Used for tests that focus on what `connect()` sends, not the WS handshake.
 */
async function connectStubbed(voice: InworldRealtimeVoice) {
  voice.waitForOpen = () => Promise.resolve();
  voice.waitForSessionCreated = () => Promise.resolve();
  await voice.connect();
}

/** Drive a complete response lifecycle through the internal `client` bus. */
function simulateResponse(voice: InworldRealtimeVoice, id: string, options: { withAudio?: boolean } = {}) {
  const client = (voice as any).client as EventEmitter;
  client.emit('response.created', { type: 'response.created', response: { id } });
  if (options.withAudio) {
    client.emit('response.output_audio.delta', { response_id: id, delta: Buffer.from('hi').toString('base64') });
    client.emit('response.output_audio.done', { response_id: id });
  }
  client.emit('response.done', { type: 'response.done', response: { id, output: [] } });
}

describe('InworldRealtimeVoice', () => {
  let voice: InworldRealtimeVoice;

  beforeEach(() => {
    vi.clearAllMocks();
    wsCalls.length = 0;
    wsConfig.initialReadyState = 1;
    voice = new InworldRealtimeVoice({ apiKey: 'test-api-key' });
  });

  afterEach(() => {
    voice?.disconnect();
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      expect(voice).toBeInstanceOf(InworldRealtimeVoice);
    });

    it('should initialize with custom speaker', () => {
      const customVoice = new InworldRealtimeVoice({ speaker: 'Hades' });
      expect(customVoice).toBeInstanceOf(InworldRealtimeVoice);
    });

    it('should accept session and providerData', () => {
      const v = new InworldRealtimeVoice({
        session: { audio: { output: { speed: 1.25 } } },
        providerData: { tool_choice: 'required' },
      });
      expect(v).toBeInstanceOf(InworldRealtimeVoice);
    });
  });

  describe('getSpeakers', () => {
    it('should return array of available voices', async () => {
      const speakers = await voice.getSpeakers();
      expect(Array.isArray(speakers)).toBe(true);
      expect(speakers.length).toBeGreaterThan(0);
      expect(speakers[0]).toHaveProperty('voiceId');
    });

    it('should include Dennis as a default voice', async () => {
      const speakers = await voice.getSpeakers();
      const ids = speakers.map(s => s.voiceId);
      expect(ids).toContain('Dennis');
    });
  });

  describe('connect URL contract', () => {
    it('should send Basic auth header verbatim (not Bearer, not re-encoded)', async () => {
      const v = new InworldRealtimeVoice({ apiKey: 'pre-encoded-key' });
      await connectStubbed(v);
      const { opts } = getLastInstance();
      expect(opts.headers.Authorization).toBe('Basic pre-encoded-key');
    });

    it('should throw when no apiKey is configured', async () => {
      const prev = process.env.INWORLD_API_KEY;
      delete process.env.INWORLD_API_KEY;
      try {
        const v = new InworldRealtimeVoice();
        v.waitForOpen = () => Promise.resolve();
        v.waitForSessionCreated = () => Promise.resolve();
        await expect(v.connect()).rejects.toThrow(/INWORLD_API_KEY/);
      } finally {
        if (prev !== undefined) process.env.INWORLD_API_KEY = prev;
      }
    });

    it('should target the Inworld realtime URL with key + protocol params (no model in URL)', async () => {
      const v = new InworldRealtimeVoice({ apiKey: 'k' });
      await connectStubbed(v);
      const { url } = getLastInstance();
      expect(url).toContain('wss://api.inworld.ai/api/v1/realtime/session');
      const parsed = new URL(url.replace(/^wss:/, 'https:'));
      expect(parsed.searchParams.get('key')).toMatch(/^voice-/);
      expect(parsed.searchParams.get('protocol')).toBe('realtime');
      expect(parsed.searchParams.has('model')).toBe(false);
    });

    it('should honor a constructor-supplied sessionId', async () => {
      const v = new InworldRealtimeVoice({ apiKey: 'k', sessionId: 'voice-fixed-123' });
      await connectStubbed(v);
      const { url } = getLastInstance();
      const parsed = new URL(url.replace(/^wss:/, 'https:'));
      expect(parsed.searchParams.get('key')).toBe('voice-fixed-123');
    });
  });

  describe('initial session.update', () => {
    it('should send model, instructions, and voice in the first session.update', async () => {
      const v = new InworldRealtimeVoice({
        apiKey: 'k',
        model: 'openai/gpt-5.4-nano',
        speaker: 'Hades',
        instructions: 'Be brief.',
      });
      await connectStubbed(v);
      const { instance } = getLastInstance();
      const sessionUpdate = sentEvents(instance).find(e => e.type === 'session.update');
      expect(sessionUpdate).toBeDefined();
      expect(sessionUpdate.session).toMatchObject({
        model: 'openai/gpt-5.4-nano',
        instructions: 'Be brief.',
        audio: { output: { voice: 'Hades' } },
      });
    });

    it('should default model, speaker, and STT when none are supplied', async () => {
      const v = new InworldRealtimeVoice({ apiKey: 'k' });
      await connectStubbed(v);
      const { instance } = getLastInstance();
      const sessionUpdate = sentEvents(instance).find(e => e.type === 'session.update');
      expect(sessionUpdate.session.model).toBe('inworld/models/gemma-4-26b-a4b-it');
      expect(sessionUpdate.session.audio.output.voice).toBe('Sarah');
      expect(sessionUpdate.session.audio.input.transcription).toEqual({ model: 'inworld/inworld-stt-1' });
    });

    it('should drop the transcription default when session sets it to null', async () => {
      const v = new InworldRealtimeVoice({
        apiKey: 'k',
        session: { audio: { input: { transcription: null } } },
      });
      await connectStubbed(v);
      const { instance } = getLastInstance();
      const sessionUpdate = sentEvents(instance).find(e => e.type === 'session.update');
      expect(sessionUpdate.session.audio.input.transcription).toBeNull();
    });

    it('should respect a user-supplied transcription without bleeding the default model in', async () => {
      const v = new InworldRealtimeVoice({
        apiKey: 'k',
        session: { audio: { input: { transcription: { language: 'es-ES' } } } },
      });
      await connectStubbed(v);
      const { instance } = getLastInstance();
      const sessionUpdate = sentEvents(instance).find(e => e.type === 'session.update');
      expect(sessionUpdate.session.audio.input.transcription).toEqual({ language: 'es-ES' });
    });

    it('should propagate instructions set via addInstructions', async () => {
      const v = new InworldRealtimeVoice({ apiKey: 'k' });
      v.addInstructions('You are calm.');
      await connectStubbed(v);
      const { instance } = getLastInstance();
      const sessionUpdate = sentEvents(instance).find(e => e.type === 'session.update');
      expect(sessionUpdate.session.instructions).toBe('You are calm.');
    });

    it('should default audio.input.turn_detection to semantic_vad', async () => {
      const v = new InworldRealtimeVoice({ apiKey: 'k' });
      await connectStubbed(v);
      const { instance } = getLastInstance();
      const sessionUpdate = sentEvents(instance).find(e => e.type === 'session.update');
      expect(sessionUpdate.session.audio.input.turn_detection).toEqual({
        type: 'semantic_vad',
        eagerness: 'medium',
        create_response: true,
        interrupt_response: true,
      });
    });

    it('should drop the turn_detection default when session sets it to null', async () => {
      const v = new InworldRealtimeVoice({
        apiKey: 'k',
        session: { audio: { input: { turn_detection: null } } },
      });
      await connectStubbed(v);
      const { instance } = getLastInstance();
      const sessionUpdate = sentEvents(instance).find(e => e.type === 'session.update');
      expect(sessionUpdate.session.audio.input.turn_detection).toBeNull();
    });

    it('should respect a user-supplied turn_detection without bleeding defaults in', async () => {
      const v = new InworldRealtimeVoice({
        apiKey: 'k',
        session: { audio: { input: { turn_detection: { type: 'server_vad', threshold: 0.4 } } } },
      });
      await connectStubbed(v);
      const { instance } = getLastInstance();
      const sessionUpdate = sentEvents(instance).find(e => e.type === 'session.update');
      expect(sessionUpdate.session.audio.input.turn_detection).toEqual({
        type: 'server_vad',
        threshold: 0.4,
      });
    });
  });

  describe('deep merge of session + providerData', () => {
    it('should compose nested audio.output keys instead of overwriting voice', async () => {
      const v = new InworldRealtimeVoice({
        apiKey: 'k',
        speaker: 'Dennis',
        session: { audio: { output: { speed: 1.1 } } },
      });
      await connectStubbed(v);
      const { instance } = getLastInstance();
      const sessionUpdate = sentEvents(instance).find(e => e.type === 'session.update');
      expect(sessionUpdate.session.audio.output).toEqual(expect.objectContaining({ voice: 'Dennis', speed: 1.1 }));
    });

    it('should nest providerData under session.providerData in the payload', async () => {
      const v = new InworldRealtimeVoice({
        apiKey: 'k',
        providerData: { tts: { delivery_mode: 'CREATIVE' } },
      });
      await connectStubbed(v);
      const { instance } = getLastInstance();
      const sessionUpdate = sentEvents(instance).find(e => e.type === 'session.update');
      expect(sessionUpdate.session.providerData.tts.delivery_mode).toBe('CREATIVE');
    });

    it('should let constructor providerData override `session.providerData` on key collision', async () => {
      const v = new InworldRealtimeVoice({
        apiKey: 'k',
        session: { providerData: { tts: { language: 'en-US', delivery_mode: 'STABLE' } } },
        providerData: { tts: { delivery_mode: 'CREATIVE' } },
      });
      await connectStubbed(v);
      const { instance } = getLastInstance();
      const sessionUpdate = sentEvents(instance).find(e => e.type === 'session.update');
      // Constructor option wins on collision; other keys are preserved.
      expect(sessionUpdate.session.providerData.tts).toEqual({ language: 'en-US', delivery_mode: 'CREATIVE' });
    });

    it('should pass through typed session config additions unchanged (noise_reduction, format object, tracing, include)', async () => {
      const v = new InworldRealtimeVoice({
        apiKey: 'k',
        session: {
          audio: {
            input: {
              noise_reduction: { type: 'near_field' },
              format: { type: 'audio/pcm', rate: 16000 },
            },
          },
          tracing: 'auto',
          include: ['item.input_audio_transcription.logprobs'],
        },
      });
      await connectStubbed(v);
      const { instance } = getLastInstance();
      const sessionUpdate = sentEvents(instance).find(e => e.type === 'session.update');
      expect(sessionUpdate.session.audio.input.noise_reduction).toEqual({ type: 'near_field' });
      expect(sessionUpdate.session.audio.input.format).toEqual({ type: 'audio/pcm', rate: 16000 });
      expect(sessionUpdate.session.tracing).toBe('auto');
      expect(sessionUpdate.session.include).toEqual(['item.input_audio_transcription.logprobs']);
    });
  });

  describe('speak', () => {
    it('should resolve only after response.done', async () => {
      await connectStubbed(voice);
      let resolved = false;
      const promise = voice.speak('Hello, world!').then(() => {
        resolved = true;
      });
      // Synchronously: the response.create has been sent, but no response.done yet.
      await Promise.resolve();
      expect(resolved).toBe(false);
      simulateResponse(voice, 'resp-1');
      await promise;
      expect(resolved).toBe(true);
    });

    it('should reject when interrupted mid-response', async () => {
      await connectStubbed(voice);
      const promise = voice.speak('Hello, world!');
      const client = (voice as any).client as EventEmitter;
      client.emit('response.created', { response: { id: 'resp-2' } });
      // Simulate user barge-in while response is in flight.
      client.emit('input_audio_buffer.speech_started', { type: 'input_audio_buffer.speech_started' });
      await expect(promise).rejects.toThrow(/interrupted/i);
    });

    it('should throw error on empty input', async () => {
      await connectStubbed(voice);
      await expect(voice.speak('')).rejects.toThrow('Input text is empty');
    });

    it('should scope per-call speaker via response.create (no session.update)', async () => {
      const v = new InworldRealtimeVoice({ apiKey: 'k', speaker: 'Dennis' });
      await connectStubbed(v);
      const { instance } = getLastInstance();
      (instance.send as ReturnType<typeof vi.fn>).mockClear();

      const promise = v.speak('Hello there', { speaker: 'Hades' });
      simulateResponse(v, 'resp-x');
      await promise;

      const events = sentEvents(instance);
      expect(events.find(e => e.type === 'session.update')).toBeUndefined();
      const response = events.find(e => e.type === 'response.create');
      // Per-response voice is a FLAT field (`response.voice`), not nested under
      // `response.audio.output.voice`.
      expect(response.response.voice).toBe('Hades');
      expect(response.response.audio).toBeUndefined();
    });

    it('should reject the pending speak() when close() runs mid-response', async () => {
      await connectStubbed(voice);
      const promise = voice.speak('Hello, world!');
      // Let the speak() body run far enough to register the lifecycle awaiter.
      await Promise.resolve();
      voice.close();
      await expect(promise).rejects.toThrow(/closed while a response was in flight/);
    });
  });

  describe('send', () => {
    it('should handle Int16Array input', async () => {
      const testArray = new Int16Array([1, 2, 3]);
      await connectStubbed(voice);
      voice.send(testArray);
    });
  });

  describe('event handling', () => {
    it('should register and trigger event listeners', () => {
      const cb = vi.fn();
      voice.on('speak', cb);
      (voice as any).emit('speak', 'test');
      expect(cb).toHaveBeenCalledWith('test');
    });

    it('should remove event listeners', () => {
      const cb = vi.fn();
      voice.on('speak', cb);
      voice.off('speak', cb);
      (voice as any).emit('speak', 'test');
      expect(cb).not.toHaveBeenCalled();
    });

    it('should not stack internal listeners across reconnects', async () => {
      await connectStubbed(voice);
      const client = (voice as any).client as EventEmitter;
      const firstCount = client.listenerCount('response.created');
      voice.disconnect();
      await connectStubbed(voice);
      const secondCount = client.listenerCount('response.created');
      expect(secondCount).toBe(firstCount);
    });

    it('should emit speech-started and a synthetic interrupted for each in-flight response', async () => {
      await connectStubbed(voice);
      const speechStartedSpy = vi.fn();
      const interruptedSpy = vi.fn();
      voice.on('speech-started', speechStartedSpy);
      voice.on('interrupted', interruptedSpy);

      const client = (voice as any).client as EventEmitter;
      client.emit('response.created', { response: { id: 'r-active' } });
      client.emit('input_audio_buffer.speech_started', { type: 'input_audio_buffer.speech_started' });

      expect(speechStartedSpy).toHaveBeenCalledTimes(1);
      expect(interruptedSpy).toHaveBeenCalledWith({ response_id: 'r-active' });
    });

    it('should dedupe writing across output_audio_transcript + output_text deltas', async () => {
      await connectStubbed(voice);
      const writingSpy = vi.fn();
      voice.on('writing', writingSpy);

      const client = (voice as any).client as EventEmitter;
      client.emit('response.output_audio_transcript.delta', { response_id: 'r-dup', delta: 'Hi' });
      client.emit('response.output_text.delta', { response_id: 'r-dup', delta: 'Hi' });

      expect(writingSpy).toHaveBeenCalledTimes(1);
      expect(writingSpy).toHaveBeenCalledWith({ text: 'Hi', response_id: 'r-dup', role: 'assistant' });
    });

    it('should dedupe writing when text-delta lands before audio-transcript-delta (text wins)', async () => {
      await connectStubbed(voice);
      const writingSpy = vi.fn();
      voice.on('writing', writingSpy);

      const client = (voice as any).client as EventEmitter;
      // Reverse the order that the round-1 fix assumed — text first.
      client.emit('response.output_text.delta', { response_id: 'r-text-first', delta: 'Hi' });
      client.emit('response.output_audio_transcript.delta', { response_id: 'r-text-first', delta: 'Hi' });

      expect(writingSpy).toHaveBeenCalledTimes(1);
      expect(writingSpy).toHaveBeenCalledWith({ text: 'Hi', response_id: 'r-text-first', role: 'assistant' });
    });

    it('should still emit writing for text-only responses (no audio transcript)', async () => {
      await connectStubbed(voice);
      const writingSpy = vi.fn();
      voice.on('writing', writingSpy);

      const client = (voice as any).client as EventEmitter;
      client.emit('response.output_text.delta', { response_id: 'r-text', delta: 'Hi' });

      expect(writingSpy).toHaveBeenCalledTimes(1);
    });

    it('should treat input_audio_transcription.delta as a barge-in signal when an in-flight response is active', async () => {
      // Semantic VAD can be slow/quiet to emit `speech_started`; STT deltas
      // are a faster fallback. Verify we fire `interrupted` + `response.cancel`
      // when a transcription delta lands during an active response.
      await connectStubbed(voice);
      const { instance } = getLastInstance();
      const interruptedSpy = vi.fn();
      voice.on('interrupted', interruptedSpy);

      const client = (voice as any).client as EventEmitter;
      client.emit('response.created', { response: { id: 'r-stt-interrupt' } });
      const sentBefore = sentEvents(instance).length;
      client.emit('conversation.item.input_audio_transcription.delta', { item_id: 'x', delta: 'he' });

      expect(interruptedSpy).toHaveBeenCalledWith({ response_id: 'r-stt-interrupt' });
      const cancels = sentEvents(instance)
        .slice(sentBefore)
        .filter(e => e.type === 'response.cancel');
      expect(cancels).toHaveLength(1);
    });

    it('should dedupe interrupted across multiple barge-in signals for the same response', async () => {
      await connectStubbed(voice);
      const { instance } = getLastInstance();
      const interruptedSpy = vi.fn();
      voice.on('interrupted', interruptedSpy);

      const client = (voice as any).client as EventEmitter;
      client.emit('response.created', { response: { id: 'r-dedupe' } });
      const sentBefore = sentEvents(instance).length;
      client.emit('input_audio_buffer.speech_started', { type: 'input_audio_buffer.speech_started' });
      client.emit('conversation.item.input_audio_transcription.delta', { item_id: 'x', delta: 'he' });
      client.emit('conversation.item.input_audio_transcription.delta', { item_id: 'x', delta: 'hello' });

      expect(interruptedSpy).toHaveBeenCalledTimes(1);
      const cancels = sentEvents(instance)
        .slice(sentBefore)
        .filter(e => e.type === 'response.cancel');
      expect(cancels).toHaveLength(1);
    });

    it('should send response.cancel when speech_started lands during an in-flight response', async () => {
      await connectStubbed(voice);
      const { instance } = getLastInstance();
      const client = (voice as any).client as EventEmitter;

      client.emit('response.created', { response: { id: 'r-cancel' } });
      const sentBefore = sentEvents(instance).length;
      client.emit('input_audio_buffer.speech_started', { type: 'input_audio_buffer.speech_started' });

      const cancels = sentEvents(instance)
        .slice(sentBefore)
        .filter(e => e.type === 'response.cancel');
      expect(cancels).toHaveLength(1);
      expect(cancels[0]).toMatchObject({ type: 'response.cancel', response_id: 'r-cancel' });
    });

    it('should NOT send response.cancel when user opts out via interrupt_response: false', async () => {
      const v = new InworldRealtimeVoice({
        apiKey: 'k',
        session: { audio: { input: { turn_detection: { type: 'semantic_vad', interrupt_response: false } } } },
      });
      await connectStubbed(v);
      const { instance } = getLastInstance();
      const client = (v as any).client as EventEmitter;

      client.emit('response.created', { response: { id: 'r-no-cancel' } });
      const sentBefore = sentEvents(instance).length;
      client.emit('input_audio_buffer.speech_started', { type: 'input_audio_buffer.speech_started' });

      const cancels = sentEvents(instance)
        .slice(sentBefore)
        .filter(e => e.type === 'response.cancel');
      expect(cancels).toHaveLength(0);
      v.disconnect();
    });

    it('should emit writing/role=user from input_audio_transcription.completed', async () => {
      await connectStubbed(voice);
      const writingSpy = vi.fn();
      voice.on('writing', writingSpy);

      const client = (voice as any).client as EventEmitter;
      client.emit('conversation.item.input_audio_transcription.completed', {
        item_id: 'item-1',
        transcript: 'hello there',
      });

      expect(writingSpy).toHaveBeenCalledWith({ text: 'hello there', response_id: 'item-1', role: 'user' });
    });

    it('should ignore input_audio_transcription deltas and emit only the final transcript on completed', async () => {
      // Inworld sends rolling-rewrite deltas (each delta is the full transcript
      // so far), so emitting them would duplicate text. Verify that only the
      // `.completed` event produces a user-side `writing`.
      await connectStubbed(voice);
      const writingSpy = vi.fn();
      voice.on('writing', writingSpy);

      const client = (voice as any).client as EventEmitter;
      client.emit('conversation.item.input_audio_transcription.delta', { item_id: 'item-2', delta: 'Hey,' });
      client.emit('conversation.item.input_audio_transcription.delta', { item_id: 'item-2', delta: 'Hey, man.' });
      client.emit('conversation.item.input_audio_transcription.delta', { item_id: 'item-2', delta: 'Hey, man! Hi.' });
      client.emit('conversation.item.input_audio_transcription.completed', {
        item_id: 'item-2',
        transcript: 'Hey, man! Hi.',
      });

      const userTexts = writingSpy.mock.calls
        .map((c: any[]) => c[0])
        .filter((p: any) => p.role === 'user' && p.text !== '\n');
      expect(userTexts.map((p: any) => p.text)).toEqual(['Hey, man! Hi.']);
    });

    it('should surface voiceProfile on the user writing event when present', async () => {
      await connectStubbed(voice);
      const writingSpy = vi.fn();
      voice.on('writing', writingSpy);

      const voiceProfile = {
        emotion: [{ label: 'happy', confidence: 0.9 }],
        gender: [{ label: 'female', confidence: 0.8 }],
      };
      const client = (voice as any).client as EventEmitter;
      client.emit('conversation.item.input_audio_transcription.completed', {
        item_id: 'item-vp',
        transcript: 'hi there',
        providerData: { voiceProfile },
      });

      const userTexts = writingSpy.mock.calls.map((c: any[]) => c[0]).filter((p: any) => p.text !== '\n');
      expect(userTexts).toEqual([{ text: 'hi there', response_id: 'item-vp', role: 'user', voiceProfile }]);
    });
  });

  describe('memory', () => {
    it('should emit memory state from session.updated and dedupe by version', async () => {
      await connectStubbed(voice);
      const memorySpy = vi.fn();
      voice.on('memory', memorySpy);

      const client = (voice as any).client as EventEmitter;
      const state1 = { version: 1, summary: 's', facts: ['f'] };
      client.emit('session.updated', { session: { providerData: { memory: { state: state1 } } } });
      expect(memorySpy).toHaveBeenCalledTimes(1);
      expect(memorySpy).toHaveBeenCalledWith(state1);

      // Same version -> no re-emit.
      client.emit('session.updated', { session: { providerData: { memory: { state: state1 } } } });
      expect(memorySpy).toHaveBeenCalledTimes(1);

      // New version -> emit again.
      const state2 = { version: 2, summary: 's2', facts: ['f', 'g'] };
      client.emit('session.updated', { session: { providerData: { memory: { state: state2 } } } });
      expect(memorySpy).toHaveBeenCalledTimes(2);
      expect(memorySpy).toHaveBeenLastCalledWith(state2);
    });
  });

  describe('back-channel', () => {
    it('should emit a backchannel stream that receives decoded audio bytes', async () => {
      await connectStubbed(voice);
      const backchannelSpy = vi.fn();
      voice.on('backchannel', backchannelSpy);

      const client = (voice as any).client as EventEmitter;
      const delta = Buffer.from('hi').toString('base64');
      client.emit('response.backchannel.audio.delta', { backchannel_id: 'b1', delta });

      expect(backchannelSpy).toHaveBeenCalledTimes(1);
      const stream = backchannelSpy.mock.calls[0][0] as NodeJS.ReadableStream;
      const received = stream.read() as Buffer;
      expect(received.toString()).toBe('hi');
    });

    it('should emit backchannel.done with the phrase and clean up the stream', async () => {
      await connectStubbed(voice);
      const doneSpy = vi.fn();
      voice.on('backchannel.done', doneSpy);

      const client = (voice as any).client as EventEmitter;
      client.emit('response.backchannel.audio.delta', {
        backchannel_id: 'b1',
        delta: Buffer.from('hi').toString('base64'),
      });
      client.emit('response.backchannel.audio.done', { backchannel_id: 'b1', phrase: 'uh-huh' });

      expect(doneSpy).toHaveBeenCalledWith({ backchannel_id: 'b1', phrase: 'uh-huh' });
    });

    it('should emit backchannel.skipped with the reason', async () => {
      await connectStubbed(voice);
      const skippedSpy = vi.fn();
      voice.on('backchannel.skipped', skippedSpy);

      const client = (voice as any).client as EventEmitter;
      client.emit('response.backchannel.skipped', { reason: 'min_gap_not_elapsed' });

      expect(skippedSpy).toHaveBeenCalledWith({ reason: 'min_gap_not_elapsed' });
    });
  });

  describe('manual turn-taking & playback signals', () => {
    it('should send parameterless input_audio_buffer.commit on commitInput()', async () => {
      await connectStubbed(voice);
      const { instance } = getLastInstance();
      (instance.send as ReturnType<typeof vi.fn>).mockClear();

      voice.commitInput();

      const events = sentEvents(instance);
      expect(events).toEqual([{ type: 'input_audio_buffer.commit' }]);
    });

    it('should send parameterless input_audio_buffer.clear on clearInput()', async () => {
      await connectStubbed(voice);
      const { instance } = getLastInstance();
      (instance.send as ReturnType<typeof vi.fn>).mockClear();

      voice.clearInput();

      const events = sentEvents(instance);
      expect(events).toEqual([{ type: 'input_audio_buffer.clear' }]);
    });

    it('should send parameterless output_audio_buffer.clear on clearOutput()', async () => {
      await connectStubbed(voice);
      const { instance } = getLastInstance();
      (instance.send as ReturnType<typeof vi.fn>).mockClear();

      voice.clearOutput();

      const events = sentEvents(instance);
      expect(events).toEqual([{ type: 'output_audio_buffer.clear' }]);
    });

    it('should re-emit input_audio_buffer.turn_suggestion as turn-suggestion', async () => {
      await connectStubbed(voice);
      const spy = vi.fn();
      voice.on('turn-suggestion', spy);

      const client = (voice as any).client as EventEmitter;
      client.emit('input_audio_buffer.turn_suggestion', { item_id: 'i1', utterance_index: 2, probability: 0.8 });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ item_id: 'i1', utterance_index: 2, probability: 0.8 }),
      );
    });

    it('should re-emit input_audio_buffer.turn_suggestion_revoked as turn-suggestion-revoked', async () => {
      await connectStubbed(voice);
      const spy = vi.fn();
      voice.on('turn-suggestion-revoked', spy);

      const client = (voice as any).client as EventEmitter;
      client.emit('input_audio_buffer.turn_suggestion_revoked', { item_id: 'i1', utterance_index: 2 });

      expect(spy).toHaveBeenCalledWith({ item_id: 'i1', utterance_index: 2 });
    });

    it('should re-emit output_audio_buffer.started as output-audio-started', async () => {
      await connectStubbed(voice);
      const spy = vi.fn();
      voice.on('output-audio-started', spy);

      const client = (voice as any).client as EventEmitter;
      client.emit('output_audio_buffer.started', { type: 'output_audio_buffer.started' });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({});
    });
  });

  describe('tool calls', () => {
    it('should treat empty/missing arguments as {} for zero-arg tools', async () => {
      const execute = vi.fn(async () => ({ time: '12:34' }));
      voice.addTools({
        'get-time': {
          id: 'get-time',
          description: 'get time',
          inputSchema: undefined as any,
          execute,
        } as any,
      });
      await connectStubbed(voice);
      const { instance } = getLastInstance();
      const client = (voice as any).client as EventEmitter;

      client.emit('response.done', {
        response: {
          id: 'r-tool',
          output: [{ type: 'function_call', call_id: 'call-1', name: 'get-time', arguments: '' }],
        },
      });
      await new Promise(r => setImmediate(r));

      expect(execute).toHaveBeenCalledWith({}, expect.objectContaining({ toolCallId: 'call-1' }));
      const outputs = sentEvents(instance).filter(e => e.type === 'conversation.item.create');
      expect(outputs).toHaveLength(1);
      expect(outputs[0].item).toMatchObject({ type: 'function_call_output', call_id: 'call-1' });
      expect(JSON.parse(outputs[0].item.output)).toEqual({ time: '12:34' });
    });
  });

  describe('WebSocket lifecycle', () => {
    it('should reject connect() when the WebSocket errors before opening', async () => {
      // Force the mock socket to start in CONNECTING so the real waitForOpen
      // takes the listener path rather than the OPEN early-return.
      wsConfig.initialReadyState = 0;
      const v = new InworldRealtimeVoice({ apiKey: 'k', connectTimeoutMs: 1000 });
      v.waitForSessionCreated = () => Promise.resolve();
      const promise = v.connect();
      const { instance } = getLastInstance();
      setImmediate(() => {
        instance.emit('error', new Error('econnrefused'));
      });
      await expect(promise).rejects.toThrow(/failed to open/i);
    });

    it('should reject connect() when waitForOpen exceeds connectTimeoutMs', async () => {
      wsConfig.initialReadyState = 0;
      const v = new InworldRealtimeVoice({ apiKey: 'k', connectTimeoutMs: 50 });
      v.waitForSessionCreated = () => Promise.resolve();
      await expect(v.connect()).rejects.toThrow(/timed out/i);
    });

    it('should reject connect() when waitForSessionCreated never fires', async () => {
      const v = new InworldRealtimeVoice({ apiKey: 'k', connectTimeoutMs: 50 });
      v.waitForOpen = () => Promise.resolve();
      // Leave the real waitForSessionCreated in place; never emit session.updated.
      await expect(v.connect()).rejects.toThrow(/handshake timed out/i);
    });

    it('should reject waitForSessionCreated immediately if the socket errors during handshake', async () => {
      // Don't sit until the full timeout when the WS dies mid-handshake.
      const v = new InworldRealtimeVoice({ apiKey: 'k', connectTimeoutMs: 60_000 });
      v.waitForOpen = () => Promise.resolve();
      const promise = v.connect();
      const { instance } = getLastInstance();
      // Mock WS starts in OPEN — fire error after the listener attaches.
      setImmediate(() => instance.emit('error', new Error('boom')));
      await expect(promise).rejects.toThrow(/boom/);
    });

    it('should reject waitForSessionCreated immediately if the socket closes during handshake', async () => {
      const v = new InworldRealtimeVoice({ apiKey: 'k', connectTimeoutMs: 60_000 });
      v.waitForOpen = () => Promise.resolve();
      const promise = v.connect();
      const { instance } = getLastInstance();
      setImmediate(() => instance.emit('close', 1011, Buffer.from('server error')));
      await expect(promise).rejects.toThrow(/closed during handshake/i);
    });

    it('should NOT reject ready from waitForSessionCreated on a pre-open WS error', async () => {
      // Pre-open transport failures are owned by waitForOpen(). The session
      // promise must not pre-attach transport listeners — otherwise a pre-open
      // error rejects BOTH promises and surfaces as an unhandled rejection
      // because connect() only awaits the open one on that path.
      wsConfig.initialReadyState = 0; // CONNECTING
      const v = new InworldRealtimeVoice({ apiKey: 'k', connectTimeoutMs: 30_000 });
      // Drive the real path of both helpers and capture any unhandled rejection.
      const unhandled: unknown[] = [];
      const onUnhandled = (reason: unknown) => unhandled.push(reason);
      process.on('unhandledRejection', onUnhandled);
      try {
        const promise = v.connect();
        const { instance } = getLastInstance();
        setImmediate(() => instance.emit('error', new Error('preopen-boom')));
        await expect(promise).rejects.toThrow(/preopen-boom|failed to open/i);
        // Flush the microtask + macrotask queues so any unhandled rejection has
        // time to be reported.
        await new Promise(r => setImmediate(r));
        await new Promise(r => setTimeout(r, 0));
        expect(unhandled).toHaveLength(0);
      } finally {
        process.off('unhandledRejection', onUnhandled);
      }
    });

    it('should emit an error event (not crash) on a malformed inbound frame', async () => {
      await connectStubbed(voice);
      const errorSpy = vi.fn();
      voice.on('error', errorSpy);
      const { instance } = getLastInstance();
      // Simulate the server sending a non-JSON frame.
      instance.emit('message', Buffer.from('not-json-{'));
      expect(errorSpy).toHaveBeenCalledTimes(1);
      const err = errorSpy.mock.calls[0][0];
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('response.done ordering', () => {
    it('should emit response.done before awaiting tool work', async () => {
      const order: string[] = [];
      const execute = vi.fn(async () => {
        order.push('tool-executed');
        return { ok: true };
      });
      voice.addTools({
        'slow-tool': {
          id: 'slow-tool',
          description: 'd',
          inputSchema: undefined as any,
          execute,
        } as any,
      });
      await connectStubbed(voice);
      voice.on('response.done', () => order.push('response.done'));

      const client = (voice as any).client as EventEmitter;
      client.emit('response.done', {
        response: {
          id: 'r-order',
          output: [{ type: 'function_call', call_id: 'c1', name: 'slow-tool', arguments: '' }],
        },
      });
      // Let the microtask queue drain so the tool's async execute runs.
      await new Promise(r => setImmediate(r));
      expect(order).toEqual(['response.done', 'tool-executed']);
    });
  });
});
