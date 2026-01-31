/**
 * LLM Recorder Tests
 *
 * Demonstrates the unified LLM recording/replay API with mode switching.
 *
 * ## Test Modes
 *
 * ```bash
 * # Auto mode (default) - replay if recording exists, record if not
 * pnpm vitest run src/llm-recorder.test.ts
 *
 * # Force re-record all recordings
 * UPDATE_RECORDINGS=true pnpm vitest run src/llm-recorder.test.ts
 *
 * # Skip recording entirely (real API calls)
 * LLM_TEST_MODE=live pnpm vitest run src/llm-recorder.test.ts
 * ```
 */

import { describe, it, expect } from 'vitest';
import { Agent } from '@mastra/core/agent';
import { useLLMRecording, withLLMRecording, getLLMTestMode } from './llm-recorder';

// Get current mode
const MODE = getLLMTestMode();
const HAS_API_KEY = !!process.env.OPENAI_API_KEY;

// For modes that may replay, set a dummy key if no real key available
if ((MODE === 'replay' || MODE === 'auto') && !HAS_API_KEY) {
  process.env.OPENAI_API_KEY = 'sk-dummy-for-replay-mode';
}

// Skip tests that need real API if no key available
const NEEDS_API = (MODE === 'live' || MODE === 'record' || MODE === 'update') && !HAS_API_KEY;

describe('LLM Recorder', () => {
  // One line setup - handles beforeAll/afterAll automatically
  // In live mode, this is a no-op (real API calls pass through)
  const recording = useLLMRecording('llm-recorder-tests');

  it.skipIf(NEEDS_API)('generates text response', async () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'You are a helpful assistant. Be concise.',
      model: 'openai/gpt-4o-mini',
    });

    const response = await agent.generate('Say "Hello, World!" and nothing else.');

    expect(response).toBeDefined();
    expect(response.text).toBeDefined();
    expect(response.text.toLowerCase()).toContain('hello');

    console.log(`[test] Response: ${response.text}`);
    console.log(`[test] Mode: ${recording.mode}`);
  });

  it.skipIf(NEEDS_API)('streams text response', async () => {
    const agent = new Agent({
      id: 'stream-agent',
      name: 'stream-agent',
      instructions: 'You are a helpful assistant.',
      model: 'openai/gpt-4o-mini',
    });

    const startTime = Date.now();
    const { textStream } = await agent.stream('Count from 1 to 3, one number per line.');

    const chunks: string[] = [];
    for await (const chunk of textStream) {
      chunks.push(chunk);
    }
    const duration = Date.now() - startTime;

    expect(chunks.length).toBeGreaterThan(0);
    const fullText = chunks.join('');
    expect(fullText).toContain('1');
    expect(fullText).toContain('2');
    expect(fullText).toContain('3');

    console.log(`[test] Chunks: ${chunks.length}, Duration: ${duration}ms`);
    console.log(`[test] Text: ${fullText}`);
    console.log(`[test] Mode: ${recording.mode}`);

    // In replay mode, should be very fast
    if (recording.mode === 'replay') {
      expect(duration).toBeLessThan(100);
    }
  });
});

/**
 * Mode detection tests
 */
describe('LLM Test Mode Detection', () => {
  it('reports current mode', () => {
    const mode = getLLMTestMode();
    console.log(`[test] Current LLM_TEST_MODE: ${mode}`);
    expect(['auto', 'update', 'replay', 'live', 'record']).toContain(mode);
  });

  it('useLLMRecording reflects correct mode', () => {
    const recording = useLLMRecording('mode-test');
    console.log(`[test] Recording mode: ${recording.mode}`);
    console.log(`[test] isLive: ${recording.isLive}`);
    console.log(`[test] isRecording: ${recording.isRecording}`);

    // Verify consistency
    if (recording.mode === 'live') {
      expect(recording.isLive).toBe(true);
      expect(recording.isRecording).toBe(false);
    } else if (recording.mode === 'record') {
      expect(recording.isLive).toBe(false);
      expect(recording.isRecording).toBe(true);
    } else {
      expect(recording.isLive).toBe(false);
      expect(recording.isRecording).toBe(false);
    }
  });
});

/**
 * withLLMRecording tests - callback wrapper for single tests
 */
describe('withLLMRecording', () => {
  it.skipIf(NEEDS_API)('records and replays within a callback', async () => {
    await withLLMRecording('with-recording-test', async () => {
      const agent = new Agent({
        id: 'with-recording-agent',
        name: 'with-recording-agent',
        instructions: 'You are a helpful assistant. Be concise.',
        model: 'openai/gpt-4o-mini',
      });

      const response = await agent.generate('Say "test" and nothing else.');
      expect(response.text).toBeDefined();
      console.log(`[test] withLLMRecording response: ${response.text}`);
    });
  });

  it.skipIf(NEEDS_API)('returns the callback result', async () => {
    const result = await withLLMRecording('with-recording-return-test', async () => {
      const agent = new Agent({
        id: 'return-agent',
        name: 'return-agent',
        instructions: 'You are a helpful assistant. Be concise.',
        model: 'openai/gpt-4o-mini',
      });

      const response = await agent.generate('Say "hello" and nothing else.');
      return response.text;
    });

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    console.log(`[test] withLLMRecording returned: ${result}`);
  });

  it.skipIf(NEEDS_API)('cleans up even if callback throws', async () => {
    const error = new Error('test error');
    await expect(
      withLLMRecording('with-recording-error-test', async () => {
        throw error;
      }),
    ).rejects.toThrow('test error');
  });
});
