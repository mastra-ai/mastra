import { describe, expect, it } from 'vitest';
import { MastraVoice } from './voice.js';

class TestVoice extends MastraVoice {
  // Subclasses commonly hold private SDK clients with auth; this simulates one.
  private sdkClient = { apiKey: 'client-secret-key' };

  async speak() {
    return Promise.resolve() as unknown as Promise<NodeJS.ReadableStream>;
  }

  async listen() {
    return '';
  }
}

describe('MastraVoice - serializeForSpan', () => {
  it('exposes only non-sensitive identity/config fields', () => {
    const voice = new TestVoice({
      name: 'test',
      speaker: 'alloy',
      listeningModel: { name: 'whisper-1', apiKey: 'listen-secret' },
      speechModel: { name: 'tts-1', apiKey: 'speech-secret' },
      realtimeConfig: { model: 'gpt-realtime', apiKey: 'realtime-secret' },
    });

    const serialized = voice.serializeForSpan();

    expect(serialized).toEqual({
      component: 'VOICE',
      name: 'test',
      speaker: 'alloy',
      listeningModel: { name: 'whisper-1' },
      speechModel: { name: 'tts-1' },
      realtimeModel: 'gpt-realtime',
    });
  });

  it('does not leak apiKeys from listeningModel/speechModel/realtimeConfig', () => {
    const voice = new TestVoice({
      listeningModel: { name: 'whisper-1', apiKey: 'listen-secret' },
      speechModel: { name: 'tts-1', apiKey: 'speech-secret' },
      realtimeConfig: { model: 'gpt-realtime', apiKey: 'realtime-secret' },
    });

    const serialized = JSON.stringify(voice.serializeForSpan());

    expect(serialized).not.toContain('listen-secret');
    expect(serialized).not.toContain('speech-secret');
    expect(serialized).not.toContain('realtime-secret');
  });

  it('does not leak subclass private fields', () => {
    const voice = new TestVoice();

    const serialized = JSON.stringify(voice.serializeForSpan());

    expect(serialized).not.toContain('client-secret-key');
    expect(serialized).not.toContain('sdkClient');
  });
});
