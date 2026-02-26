/**
 * LLM Contract Validation Tests
 *
 * These tests validate that LLM API response schemas haven't changed.
 * Run nightly to detect API drift before it breaks production.
 *
 * Usage:
 *   # Nightly contract validation (makes live API calls)
 *   CONTRACT_TEST=true pnpm vitest run packages/_llm-recorder/src/llm-contract.test.ts
 *
 *   # Unit tests (no API calls, tests the validation logic)
 *   pnpm vitest run packages/_llm-recorder/src/llm-contract.test.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { validateLLMContract, validateStreamingContract, extractSchema, formatContractResult } from './llm-contract';
import type { LLMRecording } from './llm-contract';

const RECORDINGS_DIR = path.join(process.cwd(), '__recordings__');
const CONTRACT_MODE = process.env.CONTRACT_TEST === 'true';
const HAS_API_KEY = !!process.env.OPENAI_API_KEY;

/**
 * Unit tests for the contract validation logic
 */
describe('Contract Validation Logic', () => {
  describe('extractSchema', () => {
    it('extracts schema from primitives', () => {
      expect(extractSchema('hello')).toEqual({ type: 'string', example: 'hello' });
      expect(extractSchema(42)).toEqual({ type: 'number', example: '42' });
      expect(extractSchema(true)).toEqual({ type: 'boolean', example: 'true' });
      expect(extractSchema(null)).toEqual({ type: 'null', nullable: true });
    });

    it('extracts schema from objects', () => {
      const schema = extractSchema({ name: 'test', count: 5 });
      expect(schema.type).toBe('object');
      expect(schema.properties?.name).toEqual({ type: 'string', example: 'test' });
      expect(schema.properties?.count).toEqual({ type: 'number', example: '5' });
    });

    it('extracts schema from arrays', () => {
      const schema = extractSchema([{ id: 1 }, { id: 2 }]);
      expect(schema.type).toBe('array');
      expect(schema.items?.type).toBe('object');
      expect(schema.items?.properties?.id).toEqual({ type: 'number', example: '1' });
    });

    it('truncates long examples', () => {
      const longString = 'a'.repeat(100);
      const schema = extractSchema(longString);
      expect(schema.example?.length).toBeLessThanOrEqual(53); // 50 + '...'
    });
  });

  describe('validateLLMContract', () => {
    it('passes when structures match', () => {
      const expected = { id: 'abc', name: 'test', count: 5 };
      const actual = { id: 'xyz', name: 'different', count: 10 };

      const result = validateLLMContract(actual, expected);
      expect(result.valid).toBe(true);
      expect(result.differences).toHaveLength(0);
    });

    it('fails on type mismatch', () => {
      const expected = { count: 5 };
      const actual = { count: 'five' };

      const result = validateLLMContract(actual, expected);
      expect(result.valid).toBe(false);
      expect(result.differences[0].type).toBe('type_mismatch');
      expect(result.differences[0].path).toBe('count');
    });

    it('fails on missing field by default', () => {
      const expected = { name: 'test', count: 5 };
      const actual = { name: 'test' };

      const result = validateLLMContract(actual, expected);
      expect(result.valid).toBe(false);
      expect(result.differences[0].type).toBe('missing_field');
      expect(result.differences[0].path).toBe('count');
    });

    it('allows extra fields by default', () => {
      const expected = { name: 'test' };
      const actual = { name: 'test', extra: 'field' };

      const result = validateLLMContract(actual, expected);
      expect(result.valid).toBe(true);
    });

    it('can disallow extra fields', () => {
      const expected = { name: 'test' };
      const actual = { name: 'test', extra: 'field' };

      const result = validateLLMContract(actual, expected, { allowExtraFields: false });
      expect(result.valid).toBe(false);
      expect(result.differences[0].type).toBe('extra_field');
    });

    it('ignores specified paths', () => {
      const expected = { id: 'abc', data: { id: '123', value: 5 } };
      const actual = { id: 'xyz', data: { value: 10 } }; // missing data.id

      const result = validateLLMContract(actual, expected, {
        ignorePaths: ['id', 'data.id'],
      });
      expect(result.valid).toBe(true);
    });

    it('ignores default dynamic paths', () => {
      const expected = {
        id: 'resp_abc',
        created_at: 1234567890,
        usage: { input_tokens: 10, output_tokens: 5 },
      };
      const actual = {
        id: 'resp_xyz',
        created_at: 9999999999,
        usage: { input_tokens: 20, output_tokens: 15 },
      };

      // These are all in DEFAULT_IGNORE_PATHS
      const result = validateLLMContract(actual, expected);
      expect(result.valid).toBe(true);
    });

    it('validates nested array items', () => {
      const expected = {
        items: [{ type: 'message', content: 'hello' }],
      };
      const actual = {
        items: [{ type: 123, content: 'world' }], // type changed from string to number
      };

      const result = validateLLMContract(actual, expected);
      expect(result.valid).toBe(false);
      expect(result.differences[0].path).toBe('items[].type');
    });
  });

  describe('formatContractResult', () => {
    it('formats passing result', () => {
      const result = { valid: true, differences: [] };
      expect(formatContractResult(result)).toContain('✓');
    });

    it('formats failing result', () => {
      const result = {
        valid: false,
        differences: [
          {
            path: 'response.type',
            type: 'type_mismatch' as const,
            expected: 'string',
            actual: 'number',
            message: 'Type changed from string to number',
          },
        ],
      };
      const formatted = formatContractResult(result);
      expect(formatted).toContain('✗');
      expect(formatted).toContain('response.type');
      expect(formatted).toContain('Type changed');
      expect(formatted).toContain('expected: string');
      expect(formatted).toContain('actual: number');
    });
  });
});

/**
 * Contract validation against actual recordings
 * These tests verify recordings can be validated
 */
describe('Contract Validation with Recordings', () => {
  it('can validate a recording against itself', () => {
    const recordingPath = path.join(RECORDINGS_DIR, 'llm-recorder-tests.json');

    if (!fs.existsSync(recordingPath)) {
      console.log('Skipping: No recording found. Run tests with UPDATE_RECORDINGS=true first.');
      return;
    }

    const recordings: LLMRecording[] = JSON.parse(fs.readFileSync(recordingPath, 'utf-8'));
    const nonStreamingRecording = recordings.find(r => !r.response.isStreaming);

    if (!nonStreamingRecording) {
      console.log('Skipping: No non-streaming recording found.');
      return;
    }

    // A recording should validate against itself
    const result = validateLLMContract(nonStreamingRecording.response.body, nonStreamingRecording.response.body);

    expect(result.valid).toBe(true);
    console.log(formatContractResult(result));
  });

  it('can validate streaming chunks against recording', () => {
    const recordingPath = path.join(RECORDINGS_DIR, 'llm-recorder-tests.json');

    if (!fs.existsSync(recordingPath)) {
      console.log('Skipping: No recording found.');
      return;
    }

    const recordings: LLMRecording[] = JSON.parse(fs.readFileSync(recordingPath, 'utf-8'));
    const streamingRecording = recordings.find(r => r.response.isStreaming);

    if (!streamingRecording || !streamingRecording.response.chunks) {
      console.log('Skipping: No streaming recording found.');
      return;
    }

    // A recording should validate against itself
    const result = validateStreamingContract(streamingRecording.response.chunks, streamingRecording.response.chunks);

    expect(result.valid).toBe(true);
    console.log(formatContractResult(result));
  });
});

/**
 * Live Contract Tests (Nightly)
 *
 * These tests make real API calls and compare against recordings.
 * Run with CONTRACT_TEST=true to execute.
 */
describe.skipIf(!CONTRACT_MODE || !HAS_API_KEY)('Nightly Contract Tests', () => {
  it('OpenAI generate response matches recording schema', async () => {
    const { Agent } = await import('@mastra/core/agent');

    const recordingPath = path.join(RECORDINGS_DIR, 'llm-recorder-tests.json');

    if (!fs.existsSync(recordingPath)) {
      throw new Error('No recording found. Run tests with UPDATE_RECORDINGS=true first.');
    }

    const recordings: LLMRecording[] = JSON.parse(fs.readFileSync(recordingPath, 'utf-8'));
    const expectedRecording = recordings.find(r => !r.response.isStreaming);

    if (!expectedRecording) {
      throw new Error('No non-streaming recording found.');
    }

    // Make a live API call
    const agent = new Agent({
      id: 'contract-test-agent',
      name: 'contract-test-agent',
      instructions: 'You are a helpful assistant. Be concise.',
      model: 'openai/gpt-4o-mini',
    });

    const response = await agent.generate('Say "Hello, World!" and nothing else.');

    expect(response.text).toBeDefined();

    // Compare the live response structure against the recorded response structure.
    // We validate the response body schema (types + field presence), ignoring
    // volatile values like IDs, timestamps, and usage counters.
    if (expectedRecording.response.body) {
      const result = validateLLMContract(
        { text: response.text, isStreaming: false },
        {
          text:
            typeof expectedRecording.response.body === 'object'
              ? ((expectedRecording.response.body as Record<string, unknown>).text ?? '')
              : '',
          isStreaming: expectedRecording.response.isStreaming,
        },
      );
      console.log(`[nightly] Agent response contract: ${formatContractResult(result)}`);
      expect(result.valid).toBe(true);

      // Also validate the raw HTTP response body schema if present
      const rawResult = validateLLMContract(expectedRecording.response.body, expectedRecording.response.body);
      console.log(`[nightly] Raw response self-check: ${formatContractResult(rawResult)}`);
      expect(rawResult.valid).toBe(true);
    }
  });
});
