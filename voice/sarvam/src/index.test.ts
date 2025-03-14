import { mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { describe, it, expect, beforeEach } from 'vitest';

import { SARVAM_VOICES, SarvamVoiceId } from './voices';
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

  it('should test speak method', async () => {
    const audioStream = await voice.speak('Hello from Sarvam AI!', {
      speaker: voiceId,
    });

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    const audioBuffer = Buffer.concat(chunks);

    await writeFile(path.join(outputDir, 'sarvam-generate-output.mp3'), audioBuffer);
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

    await writeFile(path.join(outputDir, 'sarvam-stream-input-output.mp3'), audioBuffer);
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

    await writeFile(path.join(outputDir, 'sarvam-default-config-output.mp3'), audioBuffer);
    expect(audioBuffer.length).toBeGreaterThan(0);

    const speakers = await defaultVoice.getSpeakers();
    expect(speakers.length).toBeGreaterThan(0);
  }, 30000);
});
