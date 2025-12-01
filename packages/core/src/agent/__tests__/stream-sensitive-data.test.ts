/**
 * Tests for Mastra server's agent `stream` API endpoint is leaking sensitive info
 *
 * This test file verifies that sensitive data (system prompts, tool definitions, etc.)
 * is NOT leaked to clients through the stream API when streaming agent responses.
 *
 * @see https://github.com/mastra-ai/mastra/issues/10363
 * @see https://github.com/mastra-ai/mastra/issues/9915
 */

import { describe, expect, it } from 'vitest';
import type { ChunkType } from '../../stream/types';
import { Agent } from '../agent';
import { getModelWithSensitiveRequestData } from './mock-model';

function runSensitiveDataTest(version: 'v1' | 'v2') {
  describe(`${version} - Stream API should not leak sensitive data`, () => {
    it('should NOT include system prompt in step-start chunk payload', async () => {
      const { model, sensitiveSystemPrompt } = getModelWithSensitiveRequestData(version);

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: sensitiveSystemPrompt,
        model,
      });

      let result;
      if (version === 'v1') {
        result = await agent.streamLegacy('hello');
      } else {
        result = await agent.stream('hello');
      }

      const chunks: ChunkType[] = [];
      for await (const chunk of result.fullStream) {
        chunks.push(chunk);
      }

      // Find step-start chunks
      const stepStartChunks = chunks.filter(chunk => chunk.type === 'step-start');

      // There should be at least one step-start chunk
      expect(stepStartChunks.length).toBeGreaterThan(0);

      // The step-start chunk should NOT contain the system prompt
      for (const chunk of stepStartChunks) {
        const chunkStr = JSON.stringify(chunk);

        // This assertion should FAIL currently (reproducing the bug)
        // After the fix, it should PASS
        expect(chunkStr).not.toContain(sensitiveSystemPrompt);
        expect(chunkStr).not.toContain('SECRET');
        expect(chunkStr).not.toContain('CONFIDENTIAL');
        expect(chunkStr).not.toContain('API_KEY');
        expect(chunkStr).not.toContain('sk-secret-12345');
      }
    });

    it('should NOT include tool definitions in step-start chunk payload', async () => {
      const { model, sensitiveSystemPrompt, sensitiveToolDefinition } = getModelWithSensitiveRequestData(version);

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: sensitiveSystemPrompt,
        model,
      });

      let result;
      if (version === 'v1') {
        result = await agent.streamLegacy('hello');
      } else {
        result = await agent.stream('hello');
      }

      const chunks: ChunkType[] = [];
      for await (const chunk of result.fullStream) {
        chunks.push(chunk);
      }

      // Find step-start chunks
      const stepStartChunks = chunks.filter(chunk => chunk.type === 'step-start');

      // The step-start chunk should NOT contain tool definitions
      for (const chunk of stepStartChunks) {
        const chunkStr = JSON.stringify(chunk);

        // This assertion should FAIL currently (reproducing the bug)
        // After the fix, it should PASS
        expect(chunkStr).not.toContain(sensitiveToolDefinition.name);
        expect(chunkStr).not.toContain('sensitive internal details');
        expect(chunkStr).not.toContain('Internal secret ID');
      }
    });

    it('should NOT include request body in step-finish chunk metadata', async () => {
      const { model, sensitiveSystemPrompt } = getModelWithSensitiveRequestData(version);

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: sensitiveSystemPrompt,
        model,
      });

      let result;
      if (version === 'v1') {
        result = await agent.streamLegacy('hello');
      } else {
        result = await agent.stream('hello');
      }

      const chunks: ChunkType[] = [];
      for await (const chunk of result.fullStream) {
        chunks.push(chunk);
      }

      // Find step-finish chunks
      const stepFinishChunks = chunks.filter(chunk => chunk.type === 'step-finish');

      // The step-finish chunk should NOT contain the request body with system prompt
      for (const chunk of stepFinishChunks) {
        const chunkStr = JSON.stringify(chunk);

        // This assertion should FAIL currently (reproducing the bug)
        // After the fix, it should PASS
        expect(chunkStr).not.toContain(sensitiveSystemPrompt);
        expect(chunkStr).not.toContain('SECRET');
        expect(chunkStr).not.toContain('CONFIDENTIAL');
      }
    });

    it('should NOT include request body in finish chunk metadata', async () => {
      const { model, sensitiveSystemPrompt } = getModelWithSensitiveRequestData(version);

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: sensitiveSystemPrompt,
        model,
      });

      let result;
      if (version === 'v1') {
        result = await agent.streamLegacy('hello');
      } else {
        result = await agent.stream('hello');
      }

      const chunks: ChunkType[] = [];
      for await (const chunk of result.fullStream) {
        chunks.push(chunk);
      }

      // Find finish chunks
      const finishChunks = chunks.filter(chunk => chunk.type === 'finish');

      // The finish chunk should NOT contain the request body with system prompt
      for (const chunk of finishChunks) {
        const chunkStr = JSON.stringify(chunk);

        // This assertion should FAIL currently (reproducing the bug)
        // After the fix, it should PASS
        expect(chunkStr).not.toContain(sensitiveSystemPrompt);
        expect(chunkStr).not.toContain('SECRET');
        expect(chunkStr).not.toContain('CONFIDENTIAL');
      }
    });

    it('should still allow internal access to request data via onStepFinish callback', async () => {
      const { model, sensitiveSystemPrompt } = getModelWithSensitiveRequestData(version);

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: sensitiveSystemPrompt,
        model,
      });

      let capturedRequest: unknown = null;

      let result;
      if (version === 'v1') {
        result = await agent.streamLegacy('hello', {
          onStepFinish: async (stepResult: any) => {
            capturedRequest = stepResult.request;
          },
        });
      } else {
        result = await agent.stream('hello', {
          onStepFinish: async stepResult => {
            capturedRequest = stepResult.request;
          },
        });
      }

      // Consume the stream
      await result.consumeStream();

      // The onStepFinish callback SHOULD still have access to the request data
      // This is for internal use (debugging, observability, etc.)
      expect(capturedRequest).toBeDefined();
      // Note: After the fix, we need to ensure internal callbacks still get the data
      // but the streamed chunks don't
    });
  });
}

runSensitiveDataTest('v1');
runSensitiveDataTest('v2');
