import { createWriteStream, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { describe, it, expect, beforeEach } from 'vitest';

import { PlayAIVoice, PLAYAI_VOICES } from './index.js';

describe('PlayAI Voice Integration Tests', () => {
  const voice = new PlayAIVoice({
    speechModel: {
      name: 'PlayDialog',
      apiKey: process.env.PLAYAI_API_KEY!,
      userId: process.env.PLAYAI_USER_ID!,
    },
  });
  const outputDir = path.join(process.cwd(), 'test-outputs');
  let voiceId: string;

  beforeEach(async () => {
    // Create output directory if it doesn't exist
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch {
      // Ignore if directory already exists
    }

    const speakers = await voice.getSpeakers();
    voiceId = speakers.find(
      v => v.voiceId === 's3://voice-cloning-zero-shot/1591b954-8760-41a9-bc58-9176a68c5726/original/manifest.json',
    )!.voiceId;
    expect(voiceId).toBeDefined();
  });

  it('should verify available speakers', async () => {
    const speakers = await voice.getSpeakers();
    expect(speakers.length).toBeGreaterThan(0);
    expect(speakers[0]).toHaveProperty('voiceId');
    expect(speakers[0].voiceId).toBe(PLAYAI_VOICES[0].id);
  });

  it('should allow immediate playback while streaming', async () => {
    // Create a longer text to ensure we get multiple chunks
    const longText = 'This is a longer text that will be streamed. '.repeat(5);

    const audioStream = await voice.speak(longText, {
      speaker: voiceId,
    });

    // Create a write stream to simulate real-time playback
    const outputPath = path.join(outputDir, 'playai-streaming-output.mp3');
    const writeStream = createWriteStream(outputPath);

    let firstChunkTime: number | null = null;
    let lastChunkTime: number | null = null;
    let totalChunks = 0;

    for await (const chunk of audioStream) {
      if (!firstChunkTime) {
        firstChunkTime = Date.now();
      }
      lastChunkTime = Date.now();
      totalChunks++;
      writeStream.write(chunk);
    }

    writeStream.end();
    expect(firstChunkTime).toBeDefined();
    expect(lastChunkTime).toBeDefined();
    expect(lastChunkTime! - firstChunkTime!).toBeGreaterThan(100); // Should take some time to receive all chunks
    console.log(`Total streaming time: ${lastChunkTime! - firstChunkTime!}ms for ${totalChunks} chunks`);
  }, 30000);

  it('should test speak method', async () => {
    const audioStream = await voice.speak('Hello from PlayAI!', {
      speaker: voiceId,
    });

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    const audioBuffer = Buffer.concat(chunks);

    await writeFile(path.join(outputDir, 'playai-generate-output.mp3'), audioBuffer);
    expect(audioBuffer.length).toBeGreaterThan(0);
  }, 30000);

  it('should handle stream input in speak method', async () => {
    // Create a readable stream from text
    const textStream = Readable.from(['Hello', ' from', ' stream', ' input!']);

    const audioStream = await voice.speak(textStream, {
      speaker: voiceId,
    });

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    const audioBuffer = Buffer.concat(chunks);

    await writeFile(path.join(outputDir, 'playai-stream-input-output.mp3'), audioBuffer);
    expect(audioBuffer.length).toBeGreaterThan(0);
  }, 30000);

  it('should handle errors gracefully', async () => {
    // Test with invalid voice ID
    await expect(
      voice.speak('Hello', {
        speaker: 'invalid-voice-id',
      }),
    ).rejects.toThrow();

    // Test with empty text
    await expect(
      voice.speak('', {
        speaker: voiceId,
      }),
    ).rejects.toThrow();
  });

  it('should work with default configuration', async () => {
    // Create instance with no args
    const defaultVoice = new PlayAIVoice();

    // Should use default model name and get API key and userId from env
    const audioStream = await defaultVoice.speak('Testing default configuration');

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    const audioBuffer = Buffer.concat(chunks);

    await writeFile(path.join(outputDir, 'playai-default-config-output.mp3'), audioBuffer);
    expect(audioBuffer.length).toBeGreaterThan(0);

    // Verify default speaker was used
    const speakers = await defaultVoice.getSpeakers();
    expect(speakers.length).toBeGreaterThan(0);
  }, 30000);
});
