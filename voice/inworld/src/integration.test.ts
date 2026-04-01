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

  it('lists voices from the real API', async () => {
    const speakers = await voice.getSpeakers();
    expect(speakers.length).toBeGreaterThan(0);
    const dennis = speakers.find(s => s.voiceId === 'Dennis' || s.name === 'Dennis');
    expect(dennis).toBeDefined();
  }, 15_000);

  it('TTS max — first audio chunk', async () => {
    const start = performance.now();
    const stream = await voice.speak('Hello, this is a test of Inworld text to speech.');
    const { buffer, ttfaMs } = await consumeStream(stream, start);

    expect(buffer.length, `audio=${buffer.length}B`).toBeGreaterThan(1000);
    expect(ttfaMs, `TTFA=${ttfaMs}ms`).toBeLessThan(3000);

    console.info(`  ⏱ TTFA: ${ttfaMs}ms`);
  }, 30_000);

  it('TTS mini — first audio chunk', async () => {
    const miniVoice = new InworldVoice({
      speechModel: { apiKey: API_KEY!, name: 'inworld-tts-1.5-mini' },
    });
    await warmupConnection(miniVoice);

    const start = performance.now();
    const stream = await miniVoice.speak('Hello from the mini model.');
    const { buffer, ttfaMs } = await consumeStream(stream, start);

    expect(buffer.length, `audio=${buffer.length}B`).toBeGreaterThan(500);
    expect(ttfaMs, `TTFA=${ttfaMs}ms`).toBeLessThan(2000);

    console.info(`  ⏱ TTFA: ${ttfaMs}ms`);
  }, 30_000);

  it('TTS voice (Olivia) — first audio chunk', async () => {
    const start = performance.now();
    const stream = await voice.speak('Testing voice selection.', { speaker: 'Olivia' });
    const { buffer, ttfaMs } = await consumeStream(stream, start);

    expect(buffer.length, `audio=${buffer.length}B`).toBeGreaterThan(500);
    expect(ttfaMs, `TTFA=${ttfaMs}ms`).toBeLessThan(3000);

    console.info(`  ⏱ TTFA: ${ttfaMs}ms`);
  }, 30_000);

  it('STT round-trip', async () => {
    const ttsStream = await voice.speak('The quick brown fox jumps over the lazy dog.', {
      audioEncoding: 'MP3',
    });
    const start = performance.now();
    const { buffer: audioBuffer } = await consumeStream(ttsStream, start);

    const sttStart = performance.now();
    const audioInput = Readable.from(audioBuffer);
    const transcript = await voice.listen(audioInput, { audioEncoding: 'MP3' });
    const sttMs = Math.round(performance.now() - sttStart);

    expect(transcript.length).toBeGreaterThan(0);
    const lower = transcript.toLowerCase();
    expect(lower.includes('fox') || lower.includes('dog') || lower.includes('quick')).toBe(true);
    expect(sttMs, `STT=${sttMs}ms`).toBeLessThan(10000);

    console.info(`  ⏱ STT: ${sttMs}ms`);
  }, 60_000);
});
