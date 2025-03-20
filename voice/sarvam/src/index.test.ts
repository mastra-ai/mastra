import { createWriteStream, createReadStream, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { describe, it, expect, beforeEach } from 'vitest';
import { SARVAM_VOICES } from './voices';
import type { SarvamVoiceId } from './voices';
import { SarvamVoice } from './index';

describe('Sarvam AI Voice Integration Tests', () => {
  const voice = new SarvamVoice({
    speechModel: {
      model: 'bulbul:v1',
      apiKey: process.env.SARVAM_API_KEY!,
      language: 'en-IN',
    },
  });

  const outputDir = path.join(process.cwd(), 'test-outputs');
  let voiceId: SarvamVoiceId;

  beforeEach(async () => {
    // Create output directory if it doesn't exist
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch {
      // Ignore if directory already exists
    }

    const speakers = await voice.getSpeakers();
    voiceId = speakers.find(v => v.voiceId === 'meera')!.voiceId as SarvamVoiceId;
    expect(voiceId).toBeDefined();
  });

  it('should verify available speakers', async () => {
    const speakers = await voice.getSpeakers();
    expect(speakers.length).toBeGreaterThan(0);
    expect(speakers[0]).toHaveProperty('voiceId');
    expect(speakers[0].voiceId).toBe(SARVAM_VOICES[0]);
  });

  it('should allow immediate playback while streaming', async () => {
    const longText = 'This is a longer text that will be streamed. '.repeat(5);

    const audioStream = await voice.speak(longText, { speaker: voiceId });
    const outputPath = path.join(outputDir, 'sarvam-streaming-output.wav');
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
    console.log(`Total streaming time: ${lastChunkTime! - firstChunkTime!}ms for ${totalChunks} chunks`);
  }, 30000);

  it('should test speak method', async () => {
    const audioStream = await voice.speak('Hello from Sarvam AI!', {
      speaker: voiceId,
    });

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    const audioBuffer = Buffer.concat(chunks);

    await writeFile(path.join(outputDir, 'sarvam-generate-output.wav'), audioBuffer);
    expect(audioBuffer.length).toBeGreaterThan(0);
  }, 30000);

  it('should handle stream input in speak method', async () => {
    const textStream = Readable.from(['Hello', ' from', ' stream', ' input!']);

    const audioStream = await voice.speak(textStream, { speaker: voiceId });

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    const audioBuffer = Buffer.concat(chunks);

    await writeFile(path.join(outputDir, 'sarvam-stream-input-output.wav'), audioBuffer);
    expect(audioBuffer.length).toBeGreaterThan(0);
  }, 30000);

  it('should handle errors gracefully', async () => {
    // @ts-expect-error: Testing invalid speaker ID
    await expect(voice.speak('Hello', { speaker: 'invalid-voice-id' })).rejects.toThrow();

    await expect(voice.speak('', { speaker: voiceId })).rejects.toThrow();
  });

  it('should work with default configuration', async () => {
    const defaultVoice = new SarvamVoice();

    const audioStream = await defaultVoice.speak('Testing default configuration');

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    const audioBuffer = Buffer.concat(chunks);

    await writeFile(path.join(outputDir, 'sarvam-default-config-output.wav'), audioBuffer);
    expect(audioBuffer.length).toBeGreaterThan(0);
    const speakers = await defaultVoice.getSpeakers();
    expect(speakers.length).toBeGreaterThan(0);
  }, 30000);

  it('should listen with default parameters', async () => {
    const defaultVoice = new SarvamVoice();
    const audioStream = await defaultVoice.speak('Listening test with defaults');

    const text = await defaultVoice.listen(audioStream);
    console.log(text);
    expect(text).toBeTruthy();
    expect(typeof text).toBe('string');
    expect(text.toLowerCase()).toContain('listening test');
  });

  it('should transcribe audio from fixture file', async () => {
    const fixturePath = path.join(process.cwd(), '__fixtures__', 'voice-test.m4a');

    const audioStream = createReadStream(fixturePath);

    const text = await voice.listen(audioStream);
    console.log(text);
    expect(text).toBeTruthy();
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  }, 15000);
});
