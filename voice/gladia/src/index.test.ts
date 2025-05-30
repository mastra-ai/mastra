import { createReadStream } from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { GladiaVoice } from './index';

describe('Gladia AI Voice Integration Tests', () => {
  const voice = new GladiaVoice({
    listeningModel: {
      apiKey: process.env.GLADIA_API_KEY!,
    },
  });

  it('should handle errors gracefully for speak', async () => {
    await expect(voice.speak('Hello', { speaker: 'invalid-voice-id' })).rejects.toThrow(
      'Gladia does not support text-to-speech.',
    );
  });

  it('should transcribe audio from fixture file', async () => {
    const fixturePath = path.join(process.cwd(), '__fixtures__', 'voice-test.m4a');
    const audioStream = createReadStream(fixturePath);

    const text = await voice.listen(audioStream, {
      fileName: 'test-audio.m4a',
      mimeType: 'audio/mp4',
    });
    console.log('Transcription:', text);
    expect(text).toBeTruthy();
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  }, 30000);
});
