import { describe, expect, it, vi, beforeEach } from 'vitest';

import { TwilioVoice, generateTwiML, twiml } from './index';

// Mock WebSocket
function createMockWebSocket() {
  const handlers = new Map<string, ((...args: unknown[]) => void)[]>();

  return {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!handlers.has(event)) {
        handlers.set(event, []);
      }
      handlers.get(event)!.push(handler);
    }),
    send: vi.fn(),
    close: vi.fn(),
    // Helper to simulate events
    emit: (event: string, data?: unknown) => {
      handlers.get(event)?.forEach(handler => handler(data));
    },
  };
}

describe('TwilioVoice', () => {
  let twilioVoice: TwilioVoice;
  let mockWs: ReturnType<typeof createMockWebSocket>;

  beforeEach(() => {
    twilioVoice = new TwilioVoice();
    mockWs = createMockWebSocket();
  });

  describe('connect', () => {
    it('should set up WebSocket event listeners', () => {
      twilioVoice.connect(mockWs as any);

      expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('handleMessage', () => {
    it('should emit call-started on start event', () => {
      const handler = vi.fn();
      twilioVoice.on('call-started', handler);
      twilioVoice.connect(mockWs as any);

      // Simulate Twilio start message
      const startMessage = JSON.stringify({
        event: 'start',
        start: {
          streamSid: 'MZ123',
          callSid: 'CA456',
          accountSid: 'AC789',
          tracks: ['inbound'],
          customParameters: {},
          mediaFormat: {
            encoding: 'audio/x-mulaw',
            sampleRate: 8000,
            channels: 1,
          },
        },
      });

      mockWs.emit('message', Buffer.from(startMessage));

      expect(handler).toHaveBeenCalledWith({
        callSid: 'CA456',
        streamSid: 'MZ123',
      });
    });

    it('should emit audio-received on media event', () => {
      const handler = vi.fn();
      twilioVoice.on('audio-received', handler);
      twilioVoice.connect(mockWs as any);

      // First send start to set streamSid
      mockWs.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            event: 'start',
            start: { streamSid: 'MZ123', callSid: 'CA456' },
          }),
        ),
      );

      // Then send media
      const mulawSilence = Buffer.from([0xff, 0xff, 0xff, 0xff]).toString('base64');
      mockWs.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            event: 'media',
            media: {
              payload: mulawSilence,
            },
          }),
        ),
      );

      expect(handler).toHaveBeenCalled();
      const call = handler.mock.calls[0][0];
      expect(call.audio).toBeInstanceOf(Int16Array);
      expect(call.streamSid).toBe('MZ123');
    });

    it('should emit call-ended on stop event', () => {
      const handler = vi.fn();
      twilioVoice.on('call-ended', handler);
      twilioVoice.connect(mockWs as any);

      // First send start
      mockWs.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            event: 'start',
            start: { streamSid: 'MZ123', callSid: 'CA456' },
          }),
        ),
      );

      // Then send stop
      mockWs.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            event: 'stop',
            stop: { callSid: 'CA456' },
          }),
        ),
      );

      expect(handler).toHaveBeenCalledWith({ callSid: 'CA456' });
    });

    it('should emit call-ended on WebSocket close', () => {
      const handler = vi.fn();
      twilioVoice.on('call-ended', handler);
      twilioVoice.connect(mockWs as any);

      mockWs.emit('close');

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('sendAudio', () => {
    it('should send audio as base64 mulaw', () => {
      twilioVoice.connect(mockWs as any);

      // Set up streamSid
      mockWs.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            event: 'start',
            start: { streamSid: 'MZ123', callSid: 'CA456' },
          }),
        ),
      );

      const pcmAudio = new Int16Array([0, 1000, -1000, 5000]);
      twilioVoice.sendAudio(pcmAudio);

      expect(mockWs.send).toHaveBeenCalled();
      const sentData = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sentData.event).toBe('media');
      expect(sentData.streamSid).toBe('MZ123');
      expect(sentData.media.payload).toBeDefined();
    });
  });

  describe('sendMark', () => {
    it('should send mark event', () => {
      twilioVoice.connect(mockWs as any);

      mockWs.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            event: 'start',
            start: { streamSid: 'MZ123', callSid: 'CA456' },
          }),
        ),
      );

      twilioVoice.sendMark('test-mark');

      expect(mockWs.send).toHaveBeenCalled();
      const sentData = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sentData.event).toBe('mark');
      expect(sentData.mark.name).toBe('test-mark');
    });
  });

  describe('clearAudio', () => {
    it('should send clear event', () => {
      twilioVoice.connect(mockWs as any);

      mockWs.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            event: 'start',
            start: { streamSid: 'MZ123', callSid: 'CA456' },
          }),
        ),
      );

      twilioVoice.clearAudio();

      expect(mockWs.send).toHaveBeenCalled();
      const sentData = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sentData.event).toBe('clear');
    });
  });

  describe('close', () => {
    it('should close the WebSocket', () => {
      twilioVoice.connect(mockWs as any);
      twilioVoice.close();

      expect(mockWs.close).toHaveBeenCalled();
    });
  });
});

describe('generateTwiML', () => {
  it('should generate basic stream TwiML', () => {
    const result = generateTwiML({ url: 'wss://example.com/media' });

    expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(result).toContain('<Response>');
    expect(result).toContain('<Connect>');
    expect(result).toContain('<Stream url="wss://example.com/media">');
    expect(result).toContain('encoding');
    expect(result).toContain('audio/x-mulaw');
  });

  it('should include custom parameters', () => {
    const result = generateTwiML({
      url: 'wss://example.com/media',
      parameters: { agentId: 'support', sessionId: '123' },
    });

    expect(result).toContain('name="agentId" value="support"');
    expect(result).toContain('name="sessionId" value="123"');
  });

  it('should escape XML special characters', () => {
    const result = generateTwiML({
      url: 'wss://example.com/media?foo=bar&baz=qux',
    });

    expect(result).toContain('&amp;');
  });
});

describe('twiml', () => {
  describe('say', () => {
    it('should generate Say TwiML', () => {
      const result = twiml.say({ text: 'Hello world' });

      expect(result).toContain('<Say>Hello world</Say>');
    });

    it('should include voice attribute', () => {
      const result = twiml.say({ text: 'Hello', voice: 'alice' });

      expect(result).toContain('voice="alice"');
    });
  });

  describe('reject', () => {
    it('should generate Reject TwiML', () => {
      const result = twiml.reject('busy');

      expect(result).toContain('<Reject reason="busy" />');
    });
  });

  describe('hangup', () => {
    it('should generate Hangup TwiML', () => {
      const result = twiml.hangup();

      expect(result).toContain('<Hangup />');
    });
  });

  describe('response builder', () => {
    it('should build complex TwiML', () => {
      const result = twiml
        .response()
        .say({ text: 'Please wait' })
        .pause(2)
        .stream({ url: 'wss://example.com/media' })
        .build();

      expect(result).toContain('<Say>Please wait</Say>');
      expect(result).toContain('<Pause length="2" />');
      expect(result).toContain('<Stream url="wss://example.com/media">');
    });
  });
});
