import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { wsCalls, getLastInstance } = vi.hoisted(() => {
  const calls: Array<{ url: string; opts: any; instance: any }> = [];
  return {
    wsCalls: calls,
    getLastInstance: () => calls[calls.length - 1],
  };
});

vi.mock('ws', () => {
  class MockWebSocket {
    send = vi.fn();
    close = vi.fn();
    on = vi.fn();
    readyState = 1;
    OPEN = 1;
    constructor(
      public url: string,
      _protocols: unknown,
      public opts: any,
    ) {
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

/** Connect a voice instance after stubbing the open / session-ready promises. */
async function connectStubbed(voice: InworldRealtimeVoice) {
  voice.waitForOpen = () => Promise.resolve();
  voice.waitForSessionCreated = () => Promise.resolve();
  await voice.connect();
}

describe('InworldRealtimeVoice', () => {
  let voice: InworldRealtimeVoice;

  beforeEach(() => {
    vi.clearAllMocks();
    wsCalls.length = 0;
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
        model: 'anthropic/claude-sonnet-4-6',
        speaker: 'Hades',
        instructions: 'Be brief.',
      });
      await connectStubbed(v);
      const { instance } = getLastInstance();
      const sessionUpdate = sentEvents(instance).find(e => e.type === 'session.update');
      expect(sessionUpdate).toBeDefined();
      expect(sessionUpdate.session).toMatchObject({
        model: 'anthropic/claude-sonnet-4-6',
        instructions: 'Be brief.',
        audio: { output: { voice: 'Hades' } },
      });
    });

    it('should propagate instructions set via addInstructions', async () => {
      const v = new InworldRealtimeVoice({ apiKey: 'k' });
      v.addInstructions('You are calm.');
      await connectStubbed(v);
      const { instance } = getLastInstance();
      const sessionUpdate = sentEvents(instance).find(e => e.type === 'session.update');
      expect(sessionUpdate.session.instructions).toBe('You are calm.');
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

    it('should merge providerData into the session payload', async () => {
      const v = new InworldRealtimeVoice({
        apiKey: 'k',
        providerData: { tool_choice: { type: 'mcp', server_label: 'mcp1' } },
      });
      await connectStubbed(v);
      const { instance } = getLastInstance();
      const sessionUpdate = sentEvents(instance).find(e => e.type === 'session.update');
      expect(sessionUpdate.session.tool_choice).toEqual({ type: 'mcp', server_label: 'mcp1' });
    });

    it('should let providerData override `session` when keys collide (escape-hatch wins)', async () => {
      const v = new InworldRealtimeVoice({
        apiKey: 'k',
        session: { audio: { output: { speed: 1.0 } } },
        providerData: { audio: { output: { speed: 1.4 } } },
      });
      await connectStubbed(v);
      const { instance } = getLastInstance();
      const sessionUpdate = sentEvents(instance).find(e => e.type === 'session.update');
      expect(sessionUpdate.session.audio.output.speed).toBe(1.4);
    });
  });

  describe('speak', () => {
    it('should handle string input', async () => {
      await connectStubbed(voice);
      await voice.speak('Hello, world!');
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

      await v.speak('Hello there', { speaker: 'Hades' });

      const events = sentEvents(instance);
      expect(events.find(e => e.type === 'session.update')).toBeUndefined();
      const response = events.find(e => e.type === 'response.create');
      expect(response.response.audio.output.voice).toBe('Hades');
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
  });
});
