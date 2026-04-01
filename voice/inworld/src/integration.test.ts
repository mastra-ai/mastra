/**
 * Integration tests against the real Inworld API.
 * Run with: INWORLD_API_KEY=<key> npx vitest run src/integration.test.ts
 *
 * These tests are skipped if INWORLD_API_KEY is not set.
 *
 * Uses a warmup request to pre-establish the TCP+TLS connection before
 * measuring latency, following the pattern from inworld-api-examples.
 */
import { Readable } from 'node:stream';
import { describe, it, expect, beforeAll } from 'vitest';
import { InworldVoice } from './index';

const API_KEY = process.env.INWORLD_API_KEY;
const describeIf = API_KEY ? describe : describe.skip;

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as any));
  }
  return Buffer.concat(chunks);
}

/**
 * Warmup: send a short TTS request to pre-establish TCP+TLS connection.
 * The connection pool reuses the socket for subsequent requests, so we
 * measure only synthesis latency, not handshake overhead.
 */
async function warmupConnection(voice: InworldVoice) {
  const stream = await voice.speak('hi');
  await streamToBuffer(stream);
}

describeIf('InworldVoice — real API integration', () => {
  let voice: InworldVoice;

  beforeAll(async () => {
    voice = new InworldVoice({
      speechModel: { apiKey: API_KEY! },
    });
    // Warmup: establish keep-alive connection before benchmarking
    await warmupConnection(voice);
  }, 30_000);

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

    console.info(`TTS (max): TTFB=${ttfb.toFixed(0)}ms, total=${totalTime.toFixed(0)}ms, size=${buffer.length} bytes`);

    expect(buffer.length).toBeGreaterThan(1000);
    expect(ttfb).toBeLessThan(3000);
  }, 30_000);

  it('generates streaming TTS audio (inworld-tts-1.5-mini)', async () => {
    const miniVoice = new InworldVoice({
      speechModel: { apiKey: API_KEY!, name: 'inworld-tts-1.5-mini' },
    });
    await warmupConnection(miniVoice);

    const start = performance.now();
    const stream = await miniVoice.speak('Hello from the mini model.');
    const ttfb = performance.now() - start;

    const buffer = await streamToBuffer(stream);
    const totalTime = performance.now() - start;

    console.info(`TTS (mini): TTFB=${ttfb.toFixed(0)}ms, total=${totalTime.toFixed(0)}ms, size=${buffer.length} bytes`);

    expect(buffer.length).toBeGreaterThan(500);
    expect(ttfb).toBeLessThan(2000);
  }, 30_000);

  it('generates TTS with different voices', async () => {
    const start = performance.now();
    const stream = await voice.speak('Testing voice selection.', { speaker: 'Olivia' });
    const buffer = await streamToBuffer(stream);
    const totalTime = performance.now() - start;

    console.info(`TTS (Olivia): total=${totalTime.toFixed(0)}ms, size=${buffer.length} bytes`);
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

    console.info(`STT: time=${sttTime.toFixed(0)}ms, transcript="${transcript}"`);

    expect(transcript.length).toBeGreaterThan(0);
    const lower = transcript.toLowerCase();
    expect(lower.includes('fox') || lower.includes('dog') || lower.includes('quick')).toBe(true);
  }, 60_000);
});
