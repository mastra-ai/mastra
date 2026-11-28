import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { OpenAILiveVoice } from './index';

// Wire names are written out literally so a mismatch with the published
// protocol fails here instead of being hidden behind shared constants.

const { FakeSocket, sockets } = await vi.hoisted(async () => {
  const { EventEmitter } = await import('node:events');
  const sockets: any[] = [];

  class FakeSocket extends EventEmitter {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    readyState = FakeSocket.CONNECTING;
    sent: any[] = [];
    constructor(
      public url: string,
      public protocols: unknown,
      public options: any,
    ) {
      super();
      sockets.push(this);
    }
    send(raw: string) {
      this.sent.push(JSON.parse(raw));
    }
    close() {
      if (this.readyState === FakeSocket.CLOSED) return;
      this.readyState = FakeSocket.CLOSED;
      this.emit('close', 1000, Buffer.from(''));
    }
    /** Server side: accept the socket. */
    accept() {
      this.readyState = FakeSocket.OPEN;
      this.emit('open');
    }
    /** Server side: push an event to the client. */
    push(event: Record<string, unknown>) {
      this.emit('message', Buffer.from(JSON.stringify(event)));
    }
    types() {
      return this.sent.map(e => e.type);
    }
  }

  return { FakeSocket, sockets };
});

vi.mock('ws', () => ({ WebSocket: FakeSocket }));

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

/** Drives a full handshake: open, wait for session.start, reply session.started. */
async function connectVoice(voice: OpenAILiveVoice) {
  const connecting = voice.connect();
  const ws = sockets.at(-1)! as InstanceType<typeof FakeSocket>;
  ws.accept();
  await tick();
  expect(ws.sent[0]?.type).toBe('session.start');
  ws.push({ type: 'session.started', session: { id: 'sess_1', status: 'active' } });
  await connecting;
  return ws;
}

describe('OpenAILiveVoice', () => {
  let voice: OpenAILiveVoice;

  beforeEach(() => {
    sockets.length = 0;
    voice = new OpenAILiveVoice({ apiKey: 'test-api-key' });
  });

  afterEach(() => {
    voice?.disconnect();
  });

  describe('initialization', () => {
    it('rejects an invalid connectTimeoutMs', () => {
      expect(() => new OpenAILiveVoice({ connectTimeoutMs: -1 })).toThrow(/connectTimeoutMs/);
    });

    it('returns available voices', async () => {
      const speakers = await voice.getSpeakers();
      expect(speakers.map(s => s.voiceId)).toContain('marin');
    });
  });

  describe('handshake', () => {
    it('connects to the Live endpoint with auth and user-agent headers', async () => {
      const ws = await connectVoice(voice);
      expect(ws.url).toBe('wss://api.openai.com/v1/live/sessions');
      expect(ws.options.headers.Authorization).toBe('Bearer test-api-key');
      expect(ws.options.headers['User-Agent']).toBe('mastra-voice-openai-live');
    });

    it('sends session.start first with model, audio and delegation', async () => {
      voice = new OpenAILiveVoice({ apiKey: 'k', instructions: 'Be concise.', speaker: 'cedar' });
      const ws = await connectVoice(voice);
      expect(ws.sent[0]).toEqual({
        type: 'session.start',
        session: {
          model: 'gpt-live-1',
          instructions: 'Be concise.',
          audio: { format: { type: 'audio/pcm', rate: 24000 }, output: { voice: 'cedar' } },
          delegation: { type: 'responses', responses: { model: 'gpt-6-luna' } },
        },
      });
      expect(ws.sent).toHaveLength(1);
    });

    it('does not resolve until session.started arrives', async () => {
      let resolved = false;
      const connecting = voice.connect().then(() => (resolved = true));
      const ws = sockets.at(-1)! as InstanceType<typeof FakeSocket>;
      ws.accept();
      await tick();
      expect(resolved).toBe(false);
      ws.push({ type: 'session.started', session: { id: 'sess_1' } });
      await connecting;
      expect(resolved).toBe(true);
    });

    it('times out when the server never starts the session', async () => {
      const connecting = voice.connect({ timeout: 20 });
      sockets.at(-1)!.accept();
      await expect(connecting).rejects.toThrow(/timed out/);
    });

    it('rejects with the server error during startup', async () => {
      const connecting = voice.connect();
      const ws = sockets.at(-1)! as InstanceType<typeof FakeSocket>;
      ws.accept();
      await tick();
      ws.push({ type: 'error', error: { type: 'invalid_request_error', message: 'bad model' } });
      await expect(connecting).rejects.toThrow('bad model');
    });
  });

  describe('audio and speech', () => {
    it('appends base64 audio with session.input_audio.append', async () => {
      const ws = await connectVoice(voice);
      await voice.send(new Int16Array([1, 2, 3]));
      expect(ws.sent.at(-1)).toEqual({
        type: 'session.input_audio.append',
        audio: Buffer.from(new Int16Array([1, 2, 3]).buffer).toString('base64'),
      });
    });

    it('speaks with session.commentary.append', async () => {
      const ws = await connectVoice(voice);
      await voice.speak('Hello there');
      expect(ws.sent.at(-1)).toEqual({
        type: 'session.commentary.append',
        delegation_id: null,
        content: 'Hello there',
      });
    });

    it('throws on empty speak input', async () => {
      await expect(voice.speak('   ')).rejects.toThrow('Input text is empty');
    });

    it('does not carry calls made while disconnected into the next session', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await voice.speak('too early');
      await voice.send(new Int16Array([1]));
      const ws = await connectVoice(voice);
      expect(ws.types()).toEqual(['session.start']);
      warn.mockRestore();
    });

    it('streams output audio to one speaker stream and emits transcripts', async () => {
      const ws = await connectVoice(voice);
      const speaker = vi.fn();
      const writing = vi.fn();
      voice.on('speaker', speaker);
      voice.on('writing', writing);

      ws.push({
        type: 'session.output_audio.delta',
        delta: Buffer.from('ab').toString('base64'),
        start_ms: 0,
        end_ms: 50,
      });
      ws.push({
        type: 'session.output_audio.delta',
        delta: Buffer.from('cd').toString('base64'),
        start_ms: 50,
        end_ms: 100,
      });
      ws.push({ type: 'session.input_transcript.delta', delta: 'What is', start_ms: 0, end_ms: 10 });
      ws.push({ type: 'session.output_transcript.delta', delta: 'It is', start_ms: 20, end_ms: 30 });

      expect(speaker).toHaveBeenCalledTimes(1);
      expect(speaker.mock.calls[0]![0].read().toString()).toBe('abcd');
      expect(writing).toHaveBeenCalledWith(expect.objectContaining({ text: 'What is', role: 'user' }));
      expect(writing).toHaveBeenCalledWith(expect.objectContaining({ text: 'It is', role: 'assistant' }));
    });

    it('propagates error events', async () => {
      const ws = await connectVoice(voice);
      const onError = vi.fn();
      voice.on('error', onError);
      ws.push({ type: 'error', error: { message: 'boom' } });
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ error: { message: 'boom' } }));
    });
  });

  describe('responses delegation', () => {
    const weatherTool = () => ({
      id: 'getWeather',
      description: 'Get weather',
      inputSchema: z.object({ city: z.string() }),
      execute: vi.fn(async (input: { city: string }) => ({ city: input.city, temp: 20 })),
    });

    it('answers a function call with response.item.create and continues with response.create', async () => {
      const tool = weatherTool();
      voice.addTools({ getWeather: tool as any });
      const ws = await connectVoice(voice);
      expect(ws.sent[0].session.delegation.responses.tools[0]).toMatchObject({ type: 'function', name: 'getWeather' });

      ws.push({
        type: 'response.event',
        delegation_id: 'item_1',
        event: {
          type: 'response.output_item.done',
          item: { type: 'function_call', name: 'getWeather', call_id: 'call_1', arguments: '{"city":"Paris"}' },
        },
      });
      ws.push({ type: 'response.event', delegation_id: 'item_1', event: { type: 'response.completed' } });
      await tick();
      await tick();

      expect(tool.execute).toHaveBeenCalledWith({ city: 'Paris' }, expect.anything());
      expect(ws.sent.slice(1)).toEqual([
        {
          type: 'response.item.create',
          item: {
            type: 'function_call_output',
            call_id: 'call_1',
            output: JSON.stringify({ city: 'Paris', temp: 20 }),
          },
        },
        { type: 'response.create' },
      ]);
    });

    it('returns an error result for an unknown tool', async () => {
      const ws = await connectVoice(voice);
      ws.push({
        type: 'response.event',
        delegation_id: 'item_2',
        event: {
          type: 'response.output_item.done',
          item: { type: 'function_call', name: 'nope', call_id: 'call_2', arguments: '{}' },
        },
      });
      ws.push({ type: 'response.event', delegation_id: 'item_2', event: { type: 'response.completed' } });
      await tick();
      await tick();

      expect(ws.sent.slice(1)).toEqual([
        {
          type: 'response.item.create',
          item: {
            type: 'function_call_output',
            call_id: 'call_2',
            output: JSON.stringify({ error: 'Tool "nope" not found' }),
          },
        },
        { type: 'response.create' },
      ]);
    });

    it('sends the new tool list with session.update without mutating the caller config', async () => {
      const delegation = { type: 'responses' as const, responses: { model: 'gpt-6-sol' } };
      voice = new OpenAILiveVoice({ apiKey: 'k', delegation });
      const ws = await connectVoice(voice);

      voice.addTools({ getWeather: weatherTool() as any });
      expect(ws.sent.at(-1)).toEqual({
        type: 'session.update',
        session: {
          delegation: {
            type: 'responses',
            responses: { model: 'gpt-6-sol', tools: [expect.objectContaining({ name: 'getWeather' })] },
          },
        },
      });
      expect(delegation).toEqual({ type: 'responses', responses: { model: 'gpt-6-sol' } });

      voice.addTools({ other: { ...weatherTool(), id: 'other' } as any });
      expect(ws.sent.at(-1).session.delegation.responses.tools.map((t: any) => t.name)).toEqual(['other']);
    });
  });

  describe('client delegation', () => {
    it('acknowledges quietly, emits delegation and reports the result as commentary', async () => {
      voice = new OpenAILiveVoice({ apiKey: 'k', delegation: { type: 'client' } });
      const ws = await connectVoice(voice);
      expect(ws.sent[0].session.delegation).toEqual({ type: 'client' });
      const onDelegation = vi.fn();
      voice.on('delegation', onDelegation);

      ws.push({
        type: 'session.delegation.created',
        offset_ms: 1000,
        delegation: { id: 'item_9', type: 'delegation', target: 'client' },
      });
      expect(ws.sent.at(-1)).toEqual({ type: 'session.thinking.append', delegation_id: 'item_9', content: '' });
      expect(onDelegation).toHaveBeenCalledWith({ delegationId: 'item_9', target: 'client', offsetMs: 1000 });

      voice.sendDelegationResult('item_9', 'Booked for Thursday.');
      expect(ws.sent.at(-1)).toEqual({
        type: 'session.commentary.append',
        delegation_id: 'item_9',
        content: 'Booked for Thursday.',
      });
    });
  });

  describe('close', () => {
    it('sends session.close before closing the socket', async () => {
      const ws = await connectVoice(voice);
      voice.close();
      expect(ws.types().at(-1)).toBe('session.close');
      expect(ws.readyState).toBe(FakeSocket.CLOSED);
    });
  });
});
