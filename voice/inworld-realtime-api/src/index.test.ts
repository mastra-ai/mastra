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

describe('InworldRealtimeVoice', () => {
  let voice: InworldRealtimeVoice;

  beforeEach(() => {
    vi.clearAllMocks();
    wsCalls.length = 0;
    voice = new InworldRealtimeVoice({ apiKey: 'test-api-key' });
    voice.waitForOpen = () => Promise.resolve();
    voice.waitForSessionCreated = () => Promise.resolve();
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

    it('should accept providerData', () => {
      const v = new InworldRealtimeVoice({ providerData: { speed: 1.25 } });
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

  describe('connect', () => {
    it('should send Basic auth header verbatim (not Bearer, not re-encoded)', async () => {
      const v = new InworldRealtimeVoice({ apiKey: 'pre-encoded-key' });
      v.waitForOpen = () => Promise.resolve();
      v.waitForSessionCreated = () => Promise.resolve();
      await v.connect();
      const { opts } = getLastInstance();
      expect(opts.headers.Authorization).toBe('Basic pre-encoded-key');
    });

    it('should target the Inworld realtime URL by default', async () => {
      const v = new InworldRealtimeVoice({ apiKey: 'k' });
      v.waitForOpen = () => Promise.resolve();
      v.waitForSessionCreated = () => Promise.resolve();
      await v.connect();
      const { url } = getLastInstance();
      expect(url).toContain('wss://api.inworld.ai/api/v1/realtime/session');
      expect(url).toContain('model=');
    });
  });

  describe('speak', () => {
    it('should handle string input', async () => {
      await voice.connect();
      await voice.speak('Hello, world!');
    });

    it('should throw error on empty input', async () => {
      await voice.connect();
      await expect(voice.speak('')).rejects.toThrow('Input text is empty');
    });
  });

  describe('send', () => {
    it('should handle Int16Array input', async () => {
      const testArray = new Int16Array([1, 2, 3]);
      await voice.connect();
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

  describe('updateConfig with providerData', () => {
    it('should shallow-merge providerData into the session payload', async () => {
      const v = new InworldRealtimeVoice({
        apiKey: 'k',
        providerData: { tool_choice: { type: 'mcp', server_label: 'mcp1' } },
      });
      v.waitForOpen = () => Promise.resolve();
      v.waitForSessionCreated = () => Promise.resolve();
      await v.connect();
      const { instance } = getLastInstance();
      const calls = (instance.send as ReturnType<typeof vi.fn>).mock.calls.map((c: any[]) =>
        JSON.parse(c[0] as string),
      );
      const sessionUpdate = calls.find((c: any) => c.type === 'session.update');
      expect(sessionUpdate).toBeDefined();
      expect(sessionUpdate.session.tool_choice).toEqual({ type: 'mcp', server_label: 'mcp1' });
    });
  });
});
