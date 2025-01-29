import { createWriteStream } from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach } from 'vitest';

import { writeFile } from 'fs/promises';

import { ElevenLabsTTS } from './index.js';

describe('TTS Integration Tests', () => {
  const tts = new ElevenLabsTTS({
    model: {
      name: 'eleven_multilingual_v2',
      apiKey: process.env.ELEVENLABS_API_KEY!,
    },
  });

  let voiceId: string;

  beforeEach(async () => {
    const voices = await tts.voices();
    voiceId = voices?.[0]?.voice_id!;
    expect(voiceId).toBeDefined();
  });

  it('should allow immediate playback while streaming', async () => {
    const voices = await tts.voices();
    const voiceId = voices?.[0]?.voice_id!;

    // Create a longer text to ensure we get multiple chunks
    const longText = 'This is a longer text that will be streamed. '.repeat(5);

    const { audioResult } = await tts.stream({
      text: longText,
      voice: voiceId,
    });

    // Create a write stream to simulate real-time playback
    const outputPath = path.join(process.cwd(), '/test-outputs/streaming-output.mp3');
    const writeStream = createWriteStream(outputPath);

    let firstChunkTime: number | null = null;
    let lastChunkTime: number | null = null;
    let totalChunks = 0;

    // Process chunks as they arrive
    for await (const chunk of audioResult) {
      if (!firstChunkTime) {
        firstChunkTime = Date.now();
      }
      lastChunkTime = Date.now();
      totalChunks++;

      // Write chunk immediately as it arrives
      writeStream.write(chunk);

      // Log timing of chunk arrival
      console.log(`Received chunk ${totalChunks} at ${lastChunkTime - firstChunkTime!}ms`);
    }

    writeStream.end();

    // Verify we received chunks over time
    expect(firstChunkTime).toBeDefined();
    expect(lastChunkTime).toBeDefined();
    expect(lastChunkTime! - firstChunkTime!).toBeGreaterThan(100); // Should take some time to receive all chunks
    console.log(`Total streaming time: ${lastChunkTime! - firstChunkTime!}ms for ${totalChunks} chunks`);
  }, 30000);

  it('should test generate method', async () => {
    const { audioResult } = await tts.generate({
      text: 'Goodbye!',
      voice: voiceId,
    });

    await writeFile(path.join(process.cwd(), '/test-outputs/generate-output.mp3'), audioResult);

    expect(audioResult.length).toBeGreaterThan(0);
  }, 30000);
});
