import { writeFile } from 'fs/promises';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import type { VoiceId } from './index';
import { AzureTTS } from './index';

describe('AzureTTS', () => {
  it('should return a list of available voices', async () => {
    const tts = new AzureTTS({ model: { name: 'en-US-AriaNeural' as VoiceId } });
    const voices = await tts.voices();
    expect(voices.length).toBeGreaterThan(0);
    expect(voices[0]).toHaveProperty('voice_id');
  });

  it('should generate audio content', async () => {
    const tts = new AzureTTS({ model: { name: 'en-US-AriaNeural' as VoiceId } });
    const result = await tts.generate({ voice: 'en-US-AriaNeural', text: 'Hello from Mastra T T S - Azure' });

    expect(result).toHaveProperty('audioResult');
    expect(Buffer.isBuffer(result.audioResult)).toBe(true);

    // Write the audio to a file
    const outputPath = join(__dirname, '../test-outputs', 'test-audio.mp3');
    await writeFile(outputPath, result.audioResult);
  });
});
