/**
 * LLM Recorder Tests
 *
 * Demonstrates the unified LLM recording/replay API with mode switching.
 *
 * ## Test Modes
 *
 * ```bash
 * # Live mode (default) - real API calls
 * pnpm vitest run src/test-utils/__tests__/llm-recorder.test.ts
 *
 * # Replay mode - use recordings (fast, no API)
 * LLM_TEST_MODE=replay pnpm vitest run src/test-utils/__tests__/llm-recorder.test.ts
 *
 * # Record mode - real API calls + save recordings
 * LLM_TEST_MODE=record pnpm vitest run src/test-utils/__tests__/llm-recorder.test.ts
 * ```
 */

import { describe, it, expect } from 'vitest';
import { Agent } from '@mastra/core/agent';
import { useLLMRecording, getLLMTestMode } from './llm-recorder';

// Get current mode
const MODE = getLLMTestMode();
const HAS_API_KEY = !!process.env.OPENAI_API_KEY;

// For replay mode without a real key, set a dummy (HTTP is mocked anyway)
if (MODE === 'replay' && !HAS_API_KEY) {
  process.env.OPENAI_API_KEY = 'sk-dummy-for-replay-mode';
}

// Skip tests that need real API if no key available
const NEEDS_API = (MODE === 'live' || MODE === 'record') && !HAS_API_KEY;

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
    expect(['live', 'record', 'replay']).toContain(mode);
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
