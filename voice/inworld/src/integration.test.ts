/**
 * Integration tests against the real Inworld API.
 * Run with: INWORLD_API_KEY=<key> npx vitest run src/integration.test.ts
 *
 * These tests are skipped if INWORLD_API_KEY is not set.
 *
 * Uses a warmup request to pre-establish the TCP+TLS connection before
 * measuring latency, following the pattern from inworld-api-examples.
 *
 * TTFB = time from speak() call to first audio chunk arriving on the stream.
 */
import { Readable } from 'node:stream';
import { describe, it, expect, beforeAll } from 'vitest';
import { InworldVoice } from './index';

const API_KEY = process.env.INWORLD_API_KEY;
const describeIf = API_KEY ? describe : describe.skip;
const RUN_PERF = process.env.PERF_TESTS === 'true';

/**
 * Consume a stream, measuring time-to-first-audio-byte from a given start time.
 * Returns { buffer, ttfaMs } where ttfaMs is ms from startMs to first data event.
 */
async function consumeStream(
  stream: NodeJS.ReadableStream,
  startMs: number,
): Promise<{ buffer: Buffer; ttfaMs: number }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let ttfaMs = -1;

    stream.on('data', (chunk: Buffer) => {
      if (ttfaMs < 0) {
        ttfaMs = Math.round(performance.now() - startMs);
      }
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as any));
    });

    stream.on('end', () => {
      resolve({ buffer: Buffer.concat(chunks), ttfaMs });
    });

    stream.on('error', reject);
  });
}

/**
 * Warmup: send a short TTS request to pre-establish TCP+TLS connection.
 */
async function warmupConnection(voice: InworldVoice) {
  const start = performance.now();
  const stream = await voice.speak('hi');
  await consumeStream(stream, start);
}

describeIf('InworldVoice — real API integration', () => {
  let voice: InworldVoice;

  beforeAll(async () => {
    voice = new InworldVoice({
      speechModel: { apiKey: API_KEY! },
    });
    await warmupConnection(voice);
  }, 30_000);

  it('List Voices API', async () => {
    const speakers = await voice.getSpeakers();
    expect(speakers.length).toBeGreaterThan(0);
    const dennis = speakers.find(s => s.voiceId === 'Dennis' || s.name === 'Dennis');
    expect(dennis).toBeDefined();
  }, 15_000);

  it('TTS 2', async () => {
    const start = performance.now();
    const stream = await voice.speak('Hello, this is a test of Inworld text to speech.');
    const { buffer, ttfaMs } = await consumeStream(stream, start);

    console.log(`TTS 2 — TTFA: ${ttfaMs}ms, size: ${buffer.length} bytes`);
    expect(buffer.length).toBeGreaterThan(1000);
  }, 30_000);

  it('TTS 2 with deliveryMode CREATIVE', async () => {
    const start = performance.now();
    const stream = await voice.speak('Testing creative delivery mode on TTS 2.', {
      deliveryMode: 'CREATIVE',
    });
    const { buffer, ttfaMs } = await consumeStream(stream, start);

    console.log(`TTS 2 (CREATIVE) — TTFA: ${ttfaMs}ms, size: ${buffer.length} bytes`);
    expect(buffer.length).toBeGreaterThan(1000);
  }, 30_000);

  it('TTS 1.5 Max', async () => {
    const maxVoice = new InworldVoice({
      speechModel: { apiKey: API_KEY!, name: 'inworld-tts-1.5-max' },
    });
    await warmupConnection(maxVoice);

    const start = performance.now();
    const stream = await maxVoice.speak('Hello, this is a test of Inworld text to speech.');
    const { buffer, ttfaMs } = await consumeStream(stream, start);

    console.log(`TTS Max — TTFA: ${ttfaMs}ms, size: ${buffer.length} bytes`);
    expect(buffer.length).toBeGreaterThan(1000);
  }, 30_000);

  it('TTS 1.5 Mini', async () => {
    const miniVoice = new InworldVoice({
      speechModel: { apiKey: API_KEY!, name: 'inworld-tts-1.5-mini' },
    });
    await warmupConnection(miniVoice);

    const start = performance.now();
    const stream = await miniVoice.speak('Hello from the mini model.');
    const { buffer, ttfaMs } = await consumeStream(stream, start);

    console.log(`TTS Mini — TTFA: ${ttfaMs}ms, size: ${buffer.length} bytes`);
    expect(buffer.length).toBeGreaterThan(500);
  }, 30_000);

  it('STT 1', async () => {
    const ttsStream = await voice.speak('The quick brown fox jumps over the lazy dog.', {
      audioEncoding: 'MP3',
    });
    const start = performance.now();
    const { buffer: audioBuffer } = await consumeStream(ttsStream, start);

    const sttStart = performance.now();
    const audioInput = Readable.from(audioBuffer);
    const transcript = await voice.listen(audioInput, { audioEncoding: 'MP3' });
    const sttMs = Math.round(performance.now() - sttStart);

    console.log(`STT — latency: ${sttMs}ms, transcript: "${transcript}"`);
    expect(transcript.length).toBeGreaterThan(0);
    const lower = transcript.toLowerCase();
    expect(lower.includes('fox') || lower.includes('dog') || lower.includes('quick')).toBe(true);
  }, 60_000);
});

describeIf('InworldVoice — performance thresholds', () => {
  if (!RUN_PERF) {
    it.skip('skipped (set PERF_TESTS=true to enable)', () => {});
    return;
  }

  let voice: InworldVoice;

  beforeAll(async () => {
    voice = new InworldVoice({
      speechModel: { apiKey: API_KEY! },
    });
    await warmupConnection(voice);
  }, 30_000);

  it('TTS Max TTFA < 3000ms', async () => {
    const start = performance.now();
    const stream = await voice.speak('Hello, this is a latency test.');
    const { ttfaMs } = await consumeStream(stream, start);
    expect(ttfaMs).toBeLessThan(3000);
  }, 30_000);

  it('TTS Mini TTFA < 2000ms', async () => {
    const miniVoice = new InworldVoice({
      speechModel: { apiKey: API_KEY!, name: 'inworld-tts-1.5-mini' },
    });
    await warmupConnection(miniVoice);

    const start = performance.now();
    const stream = await miniVoice.speak('Hello from the mini model.');
    const { ttfaMs } = await consumeStream(stream, start);
    expect(ttfaMs).toBeLessThan(2000);
  }, 30_000);

  it('STT latency < 10000ms', async () => {
    const ttsStream = await voice.speak('The quick brown fox jumps over the lazy dog.', {
      audioEncoding: 'MP3',
    });
    const { buffer: audioBuffer } = await consumeStream(ttsStream, performance.now());

    const sttStart = performance.now();
    const audioInput = Readable.from(audioBuffer);
    await voice.listen(audioInput, { audioEncoding: 'MP3' });
    const sttMs = Math.round(performance.now() - sttStart);
    expect(sttMs).toBeLessThan(10000);
  }, 60_000);
});
