/**
 * Integration tests against the real Inworld API.
 * Run with: INWORLD_API_KEY=<key> pnpm vitest run src/integration.test.ts
 *
 * These tests are skipped if INWORLD_API_KEY is not set.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { InworldVoice } from './index';
import { Readable } from 'node:stream';

const API_KEY = process.env.INWORLD_API_KEY;
const describeIf = API_KEY ? describe : describe.skip;

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as any));
  }
  return Buffer.concat(chunks);
}

describeIf('InworldVoice — real API integration', () => {
  let voice: InworldVoice;

  beforeAll(() => {
    voice = new InworldVoice({
      speechModel: { apiKey: API_KEY! },
    });
  });

  it('lists voices from the real API', async () => {
    const speakers = await voice.getSpeakers();
    expect(speakers.length).toBeGreaterThan(0);
    const dennis = speakers.find(s => s.voiceId === 'Dennis' || s.name === 'Dennis');
    expect(dennis).toBeDefined();
  }, 15_000);

  it('generates streaming TTS audio (inworld-tts-1.5-max)', async () => {
    const start = performance.now();
    const stream = await voice.speak('Hello, this is a test of Inworld text to speech.');
    const ttfb = performance.now() - start;

    const buffer = await streamToBuffer(stream);
    const totalTime = performance.now() - start;

    console.log(`TTS (max): TTFB=${ttfb.toFixed(0)}ms, total=${totalTime.toFixed(0)}ms, size=${buffer.length} bytes`);

    expect(buffer.length).toBeGreaterThan(1000); // should be real audio
    expect(ttfb).toBeLessThan(5000); // TTFB should be reasonable
  }, 30_000);

  it('generates streaming TTS audio (inworld-tts-1.5-mini)', async () => {
    const miniVoice = new InworldVoice({
      speechModel: { apiKey: API_KEY!, name: 'inworld-tts-1.5-mini' },
    });

    const start = performance.now();
    const stream = await miniVoice.speak('Hello from the mini model.');
    const ttfb = performance.now() - start;

    const buffer = await streamToBuffer(stream);
    const totalTime = performance.now() - start;

    console.log(`TTS (mini): TTFB=${ttfb.toFixed(0)}ms, total=${totalTime.toFixed(0)}ms, size=${buffer.length} bytes`);

    expect(buffer.length).toBeGreaterThan(500);
  }, 30_000);

  it('generates TTS with different voices', async () => {
    const start = performance.now();
    const stream = await voice.speak('Testing voice selection.', { speaker: 'Olivia' });
    const buffer = await streamToBuffer(stream);
    const totalTime = performance.now() - start;

    console.log(`TTS (Olivia): total=${totalTime.toFixed(0)}ms, size=${buffer.length} bytes`);
    expect(buffer.length).toBeGreaterThan(500);
  }, 30_000);

  it('transcribes audio via STT', async () => {
    // First generate some audio, then transcribe it back
    const ttsStream = await voice.speak('The quick brown fox jumps over the lazy dog.', {
      audioEncoding: 'MP3',
    });
    const audioBuffer = await streamToBuffer(ttsStream);

    const start = performance.now();
    const audioInput = Readable.from(audioBuffer);
    const transcript = await voice.listen(audioInput, {
      audioEncoding: 'MP3',
    });
    const sttTime = performance.now() - start;

    console.log(`STT: time=${sttTime.toFixed(0)}ms, transcript="${transcript}"`);

    expect(transcript.length).toBeGreaterThan(0);
    // Should contain at least some of the original words
    const lower = transcript.toLowerCase();
    expect(lower.includes('fox') || lower.includes('dog') || lower.includes('quick')).toBe(true);
  }, 60_000);

  it('handles speaking rate adjustment', async () => {
    const stream = await voice.speak('This is spoken at a faster rate.', {
      speakingRate: 1.4,
    });
    const buffer = await streamToBuffer(stream);
    expect(buffer.length).toBeGreaterThan(500);
  }, 30_000);
});
