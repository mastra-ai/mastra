import { EventEmitter } from 'node:events';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { z } from 'zod';
import { CLIENT_EVENTS, SERVER_EVENTS, LIVE_WS_URL } from './protocol';
import { OpenAILiveVoice } from './index';

vi.mock('ws', () => {
  return {
    WebSocket: vi.fn().mockImplementation(function () {
      return {
        readyState: 1,
        OPEN: 1,
        send: vi.fn(),
        close: vi.fn(),
        on: vi.fn(),
        once: vi.fn(),
        removeListener: vi.fn(),
      };
    }),
  };
});

const sentEvents = (voice: OpenAILiveVoice) =>
  ((voice as any).ws.send as ReturnType<typeof vi.fn>).mock.calls.map(([raw]: [string]) => JSON.parse(raw));

/** Give the provider a fake, already-open socket without a real handshake. */
const attachOpenSocket = (voice: OpenAILiveVoice) => {
  const ws = { readyState: 1, OPEN: 1, send: vi.fn(), close: vi.fn(), on: vi.fn(), once: vi.fn() };
  (voice as any).ws = ws;
  (voice as any).state = 'open';
  return ws;
};

describe('OpenAILiveVoice', () => {
  let voice: OpenAILiveVoice;

  beforeEach(() => {
    vi.clearAllMocks();
    voice = new OpenAILiveVoice({ apiKey: 'test-api-key' });
    voice.waitForOpen = () => Promise.resolve();
    voice.waitForSessionReady = () => Promise.resolve();
  });

  afterEach(() => {
    voice?.disconnect();
  });

  describe('initialization', () => {
    it('initializes with defaults', () => {
      expect(voice).toBeInstanceOf(OpenAILiveVoice);
    });

    it('initializes with a custom speaker', () => {
      const custom = new OpenAILiveVoice({ speaker: 'cedar' });
      expect(custom).toBeInstanceOf(OpenAILiveVoice);
    });

    it('rejects an invalid connectTimeoutMs', () => {
      expect(() => new OpenAILiveVoice({ connectTimeoutMs: -1 })).toThrow(/connectTimeoutMs/);
    });
  });

  describe('getSpeakers', () => {
    it('returns available voices', async () => {
      const speakers = await voice.getSpeakers();
      expect(Array.isArray(speakers)).toBe(true);
      expect(speakers.length).toBeGreaterThan(0);
      expect(speakers[0]).toHaveProperty('voiceId');
    });
  });

  describe('getListener', () => {
    it('reports enabled', async () => {
      await expect(voice.getListener()).resolves.toEqual({ enabled: true });
    });
  });

  describe('connect', () => {
    it('connects to the Live endpoint with auth + user-agent headers', async () => {
      await voice.connect();

      expect(WebSocket).toHaveBeenCalledTimes(1);
      const [url, , opts] = vi.mocked(WebSocket).mock.calls[0]!;
      expect(url).toBe(LIVE_WS_URL);
      const headers = (opts as { headers: Record<string, string> }).headers;
      expect(headers.Authorization).toBe('Bearer test-api-key');
      expect(headers['User-Agent']).toBeDefined();
    });

    it('sends a session.update after connecting', async () => {
      await voice.connect();
      const updates = sentEvents(voice).filter((ev: any) => ev.type === CLIENT_EVENTS.sessionUpdate);
      expect(updates).toHaveLength(1);
      expect(updates[0].session.model).toBe('gpt-live-1');
      expect(updates[0].session.voice).toBe('marin');
    });

    it('defaults to responses delegation with tools nested under responses', async () => {
      await voice.connect();
      const update = sentEvents(voice).find((ev: any) => ev.type === CLIENT_EVENTS.sessionUpdate);
      expect(update.session.delegation.type).toBe('responses');
      // Tools live under responses.tools, never at the top level of the session.
      expect(update.session).not.toHaveProperty('tools');
      expect(update.session.delegation.responses).toHaveProperty('tools');
      expect(update.session.delegation.responses.model).toBeDefined();
    });

    it('honors an explicit delegation config', async () => {
      const delegated = new OpenAILiveVoice({
        apiKey: 'k',
        delegation: { type: 'responses', responses: { model: 'gpt-4o' } },
      });
      delegated.waitForOpen = () => Promise.resolve();
      delegated.waitForSessionReady = () => Promise.resolve();
      await delegated.connect();
      const update = sentEvents(delegated).find((ev: any) => ev.type === CLIENT_EVENTS.sessionUpdate);
      expect(update.session.delegation.type).toBe('responses');
      expect(update.session.delegation.responses.model).toBe('gpt-4o');
    });
  });

  describe('send', () => {
    it('appends base64 audio for an Int16Array', async () => {
      const ws = attachOpenSocket(voice);
      await voice.send(new Int16Array([1, 2, 3]));
      const appends = ws.send.mock.calls
        .map(([raw]: [string]) => JSON.parse(raw))
        .filter((ev: any) => ev.type === CLIENT_EVENTS.inputAudioAppend);
      expect(appends).toHaveLength(1);
      expect(typeof appends[0].audio).toBe('string');
    });

    it('warns and does nothing when not connected', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await voice.send(new Int16Array([1]));
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  describe('speak', () => {
    it('appends session context (GPT-Live has no response.create)', async () => {
      const ws = attachOpenSocket(voice);
      await voice.speak('Hello there');
      const sent = ws.send.mock.calls.map(([raw]: [string]) => JSON.parse(raw));
      const contexts = sent.filter((ev: any) => ev.type === CLIENT_EVENTS.sessionContextAppend);
      expect(contexts).toHaveLength(1);
      expect(contexts[0].context).toContain('Hello there');
      // response.create does not exist in the Live protocol.
      expect(sent.some((ev: any) => ev.type === 'response.create')).toBe(false);
    });

    it('throws on empty input', async () => {
      attachOpenSocket(voice);
      await expect(voice.speak('')).rejects.toThrow('Input text is empty');
    });
  });

  describe('close', () => {
    it('sends session.close before closing the socket', () => {
      const ws = attachOpenSocket(voice);
      voice.close();
      const sent = ws.send.mock.calls.map(([raw]: [string]) => JSON.parse(raw));
      expect(sent.some((ev: any) => ev.type === CLIENT_EVENTS.sessionClose)).toBe(true);
      expect(ws.close).toHaveBeenCalled();
      expect((voice as any).state).toBe('close');
      expect((voice as any).ws).toBeUndefined();
    });
  });

  describe('inbound events', () => {
    beforeEach(() => {
      // wire up the client emitter + listeners against a fake socket
      (voice as any).ws = { readyState: 1, OPEN: 1, send: vi.fn(), on: vi.fn(), once: vi.fn(), close: vi.fn() };
      (voice as any).client = new EventEmitter();
      (voice as any).setupEventListeners();
      (voice as any).state = 'open';
    });

    it('emits speaker + speaking on output audio delta', () => {
      const audioChunks: Buffer[] = [];
      let gotStream = false;
      voice.on('speaker', (stream: any) => {
        gotStream = true;
        stream.on('data', (c: Buffer) => audioChunks.push(c));
      });
      voice.on('speaking', ({ audio }: any) => audioChunks.push(audio));

      const payload = Buffer.from('hello').toString('base64');
      (voice as any).client.emit(SERVER_EVENTS.outputAudioDelta, {
        type: SERVER_EVENTS.outputAudioDelta,
        audio: payload,
      });

      expect(gotStream).toBe(true);
      expect(audioChunks.length).toBeGreaterThan(0);
    });

    it('emits writing on transcript delta', () => {
      const texts: string[] = [];
      voice.on('writing', ({ text, role }: any) => {
        if (role === 'assistant') texts.push(text);
      });
      (voice as any).client.emit(SERVER_EVENTS.outputTranscriptDelta, {
        type: SERVER_EVENTS.outputTranscriptDelta,
        delta: 'partial text',
      });
      expect(texts).toContain('partial text');
    });

    it('propagates error events', () => {
      const errors: any[] = [];
      voice.on('error', e => errors.push(e));
      (voice as any).client.emit(SERVER_EVENTS.error, { type: SERVER_EVENTS.error, error: { message: 'boom' } });
      expect(errors).toHaveLength(1);
    });
  });

  describe('delegation (tool) dispatch', () => {
    it('executes the tool and returns its result via delegation.function_call_output.create', async () => {
      const ws = attachOpenSocket(voice);
      const execute = vi.fn().mockResolvedValue({ ok: true });
      voice.addTools({
        my_tool: { description: 'T', inputSchema: z.object({ q: z.string() }), execute } as any,
      } as any);

      await (voice as any).handleDelegation({
        type: SERVER_EVENTS.delegationCreated,
        delegation_id: 'del-1',
        function_call: { name: 'my_tool', arguments: '{"q":"x"}' },
      });

      expect(execute).toHaveBeenCalledTimes(1);
      const sent = ws.send.mock.calls.map(([raw]: [string]) => JSON.parse(raw));
      const outputs = sent.filter((ev: any) => ev.type === CLIENT_EVENTS.delegationFunctionCallOutputCreate);
      expect(outputs).toHaveLength(1);
      expect(outputs[0].delegation_id).toBe('del-1');
      expect(JSON.parse(outputs[0].output)).toEqual({ ok: true });
      // Server-driven: no response.create is ever sent to resume.
      expect(sent.some((ev: any) => ev.type === 'response.create')).toBe(false);
    });

    it('does nothing for an unknown tool without throwing', async () => {
      const ws = attachOpenSocket(voice);
      await expect(
        (voice as any).handleDelegation({
          type: SERVER_EVENTS.delegationCreated,
          delegation_id: 'd',
          function_call: { name: 'nope', arguments: '{}' },
        }),
      ).resolves.toBeUndefined();
      const sent = ws.send.mock.calls.map(([raw]: [string]) => JSON.parse(raw));
      expect(sent.filter((ev: any) => ev.type === CLIENT_EVENTS.delegationFunctionCallOutputCreate)).toHaveLength(0);
    });
  });
});
