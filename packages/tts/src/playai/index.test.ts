import { createWriteStream } from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach } from 'vitest';

import { writeFile } from 'fs/promises';

import { PlayAITTS, PLAYAI_VOICES } from './index.js';

describe('PlayAI TTS Integration Tests', () => {
  const tts = new PlayAITTS({
    model: {
      name: 'PlayDialog', // Update with actual model name if Play.ai has specific model identifiers
      apiKey: process.env.PLAYAI_API_KEY!,
    },
    userId: process.env.PLAYAI_USER_ID!,
  });

  let voiceId: string;

  beforeEach(async () => {
    const voices = await tts.voices();
    // Get first conversational voice ID
    voiceId = voices.find(v => v.style === 'Conversational')?.id!;
    expect(voiceId).toBeDefined();
  });

  it('should verify available voices', async () => {
    const voices = await tts.voices();
    expect(voices).toEqual(PLAYAI_VOICES);
    expect(voices.length).toBeGreaterThan(0);
    expect(voices[0]).toHaveProperty('id');
    expect(voices[0]).toHaveProperty('name');
  });

  it('should allow immediate playback while streaming', async () => {
    // Create a longer text to ensure we get multiple chunks
    const longText = 'This is a longer text that will be streamed. '.repeat(5);

    console.log(voiceId);

    const { audioResult } = await tts.stream({
      text: longText,
      voice: voiceId,
    });

    // Create a write stream to simulate real-time playback
    const outputPath = path.join(process.cwd(), '/test-outputs/playai-streaming-output.mp3');
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
      text: 'Hello from PlayAI!',
      voice: voiceId,
    });

    await writeFile(path.join(process.cwd(), '/test-outputs/playai-generate-output.mp3'), audioResult);

    expect(audioResult.length).toBeGreaterThan(0);
  }, 30000);

  it('should handle errors gracefully', async () => {
    // Test with invalid voice ID
    await expect(
      tts.generate({
        text: 'Hello',
        voice: 'invalid-voice-id',
      }),
    ).rejects.toThrow();

    // Test with empty text
    await expect(
      tts.generate({
        text: '',
        voice: voiceId,
      }),
    ).rejects.toThrow();
  });
});
