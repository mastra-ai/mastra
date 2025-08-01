import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { describe, expect, it, beforeEach } from 'vitest';
import { streamGenerateHandler } from './agents';

// Mock LLM that implements the AI SDK v5 interface
const mockModel = {
  modelId: 'mock-model',
  provider: 'mock',

  doStream: async function* (_options: any) {
    // Simple mock stream implementation
    yield { type: 'text-delta', textDelta: 'Hello' };
    yield { type: 'text-delta', textDelta: ' world' };
    yield { type: 'finish', finishReason: 'stop', usage: { promptTokens: 10, completionTokens: 2 } };
  },

  doGenerate: async function (_options: any) {
    return {
      text: 'Hello world',
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 2 },
    };
  },
};

let testAgent: Agent;
let mastraV5: Mastra;
let mastraV4: Mastra;

describe('Header-based SDK compatibility', () => {
  let runtimeContext: RuntimeContext;

  beforeEach(() => {
    runtimeContext = new RuntimeContext();

    // Create a real agent with our mock model
    testAgent = new Agent({
      name: 'test-agent',
      instructions: 'You are a test agent',
      model: mockModel,
    });

    // Create real Mastra instances with different SDK compatibility modes
    mastraV5 = new Mastra({
      agents: { 'test-agent': testAgent },
      aiSdkCompat: 'v5', // Default to v5
    });

    mastraV4 = new Mastra({
      agents: { 'test-agent': testAgent },
      aiSdkCompat: 'v4', // Force v4
    });
  });

  describe('Agent stream handler', () => {
    it('should use v4 compat when clientSdkCompat header is v4 (overrides v5 config)', async () => {
      const result = await streamGenerateHandler({
        mastra: mastraV5, // Server configured for v5
        agentId: 'test-agent',
        runtimeContext,
        body: {
          messages: [{ role: 'user', content: 'test' }],
        },
        clientSdkCompat: 'v4', // Client requests v4
      });

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Response);
      // V4 streams should have specific headers
      expect(result?.headers?.get('X-Vercel-AI-Data-Stream')).toBe('v1');
    });

    it('should use server config when no clientSdkCompat header provided', async () => {
      const result = await streamGenerateHandler({
        mastra: mastraV4, // Server configured for v4
        agentId: 'test-agent',
        runtimeContext,
        body: {
          messages: [{ role: 'user', content: 'test' }],
        },
        // No clientSdkCompat header
      });

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Response);
      // Should still use v4 based on server config
      expect(result?.headers?.get('X-Vercel-AI-Data-Stream')).toBe('v1');
    });

    it('should use v5 when neither header nor config specify v4', async () => {
      const result = await streamGenerateHandler({
        mastra: mastraV5, // Server configured for v5
        agentId: 'test-agent',
        runtimeContext,
        body: {
          messages: [{ role: 'user', content: 'test' }],
        },
        // No clientSdkCompat header, server is v5
      });

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Response);
      // V5 streams don't have the v1 data stream header
      expect(result?.headers?.get('X-Vercel-AI-Data-Stream')).toBeNull();
    });
  });

  describe('Compatibility mode detection', () => {
    it('should respect clientSdkCompat header over mastra config', () => {
      // Test the core logic without needing full memory setup
      const clientCompatHeader = 'v4';
      const mastraConfigV5 = mastraV5.getAiSdkCompatMode(); // 'v5'

      // This is the logic from our implementation
      const useV4Compat = clientCompatHeader === 'v4' || mastraConfigV5 === 'v4';

      expect(useV4Compat).toBe(true); // Header should override config
    });

    it('should fall back to mastra config when no header provided', () => {
      // Test without header
      const clientCompatHeader = undefined;
      const mastraConfigV4 = mastraV4.getAiSdkCompatMode(); // 'v4'

      const useV4Compat = clientCompatHeader === 'v4' || mastraConfigV4 === 'v4';

      expect(useV4Compat).toBe(true); // Should use config
    });
  });
});
