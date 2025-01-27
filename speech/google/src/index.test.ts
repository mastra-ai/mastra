import { describe, expect, it, vi } from 'vitest';

import { GoogleTTS } from './index';

describe('GoogleTTS', () => {
  it('should throw error if API key is not set', async () => {
    const tts = new GoogleTTS({ model: { name: 'en-US-Casual-K' } });
    await expect(tts.generate({ voice: 'en-US-Casual-K', text: 'Hello' })).rejects.toThrow('GOOGLE_API_KEY is not set');
  });

  it('should return a list of available voices', async () => {
    process.env.GOOGLE_API_KEY = 'test-key';
    const tts = new GoogleTTS({ model: { name: 'en-US-Casual-K' } });
    const voices = await tts.voices();
    expect(voices.length).toBeGreaterThan(0);
    expect(voices[0]).toHaveProperty('voice_id');
  });

  it('should generate audio content', async () => {
    // Mock environment variable
    process.env.GOOGLE_API_KEY = 'test-key';

    // Mock TextToSpeechClient
    vi.mock('@google-cloud/text-to-speech', () => ({
      default: {
        TextToSpeechClient: class {
          synthesizeSpeech() {
            return [{ audioContent: new Uint8Array([1, 2, 3]) }];
          }
        },
      },
    }));

    const tts = new GoogleTTS({ model: { name: 'en-US-Casual-K' } });
    const result = await tts.generate({ voice: 'en-US-Casual-K', text: 'Hello' });

    expect(result).toHaveProperty('audio');
    expect(result).toHaveProperty('type', 'audio/mpeg');
    expect(Buffer.isBuffer(result.audio)).toBe(true);
  });
});
