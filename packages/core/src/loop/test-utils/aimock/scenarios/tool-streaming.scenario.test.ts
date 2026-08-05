import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: tool streaming with context.writer.
 *
 * Tools can emit intermediate results via `context.writer.write()` or custom
 * chunks via `context.writer.custom()`. These chunks appear in the stream
 * before the tool's final result is returned. A refactor that drops the writer
 * from the execution context or stops plumbing chunks through would silently
 * break long-running tool observability. These scenarios pin the streaming
 * contract.
 */
describeForAllEngines(
  'AIMock loop scenario: tool streaming with context.writer',
  engine => {
    const getMock = useLoopScenarioAimock();

    it('emits tool-output chunks when tool writes intermediate results', async () => {
      const streamingTool = createTool({
        id: 'streaming_tool',
        description: 'A tool that streams intermediate results.',
        inputSchema: z.object({ query: z.string() }),
        outputSchema: z.object({ final: z.string() }),
        execute: async ({ query }, context) => {
          // Stream intermediate progress
          if (context?.writer) {
            await context.writer.write({ progress: 0.25 });
            await context.writer.write({ progress: 0.5 });
            await context.writer.write({ progress: 0.75 });
          }
          // Return final result
          return { final: `completed: ${query}` };
        },
      });

      const { output, chunks } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Stream some progress.',
        tools: { streaming_tool: streamingTool },
        stopWhen: stepCountIs(5),
        collectChunks: true,
        fixtures: llm => {
          // Turn 1: call the streaming tool.
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_stream', name: 'streaming_tool', arguments: { query: 'test' } }] },
          );
          // Turn 2: wrap up after tool result.
          llm.on(
            { endpoint: 'chat', toolCallId: 'call_stream', hasToolResult: true },
            { content: 'The tool completed: test' },
          );
        },
      });

      // The run completed with the final text.
      const text = await output.text;
      expect(text).toContain('completed: test');

      // Tool-output chunks were emitted (from context.writer.write calls).
      // The chunks are wrapped with metadata (toolCallId, toolName) by ToolStream.
      const outputChunks = chunks?.filter(c => c.type === 'tool-output');
      expect(outputChunks).toBeDefined();
      expect(outputChunks!.length).toBeGreaterThanOrEqual(3);

      // Each chunk carries the progress data.
      const progresses = outputChunks!.map(c => (c as any).payload?.output?.progress).filter(p => p !== undefined);
      expect(progresses).toContain(0.25);
      expect(progresses).toContain(0.5);
      expect(progresses).toContain(0.75);
    });

    it('emits custom chunks when tool uses writer.custom()', async () => {
      const customChunkTool = createTool({
        id: 'custom_chunk_tool',
        description: 'A tool that emits custom chunks.',
        inputSchema: z.object({}),
        outputSchema: z.object({ done: z.boolean() }),
        execute: async (_, context) => {
          // Emit custom chunks (must have a 'type' field).
          if (context?.writer) {
            await context.writer.custom({
              type: 'data-progress',
              data: { step: 'analyzing' },
            });
            await context.writer.custom({
              type: 'data-progress',
              data: { step: 'processing' },
            });
          }
          return { done: true };
        },
      });

      const { output, chunks } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Emit custom chunks.',
        tools: { custom_chunk_tool: customChunkTool },
        stopWhen: stepCountIs(5),
        collectChunks: true,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_custom', name: 'custom_chunk_tool', arguments: {} }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Custom chunks emitted.' });
        },
      });

      const text = await output.text;
      expect(text).toContain('Custom chunks');

      // Custom chunks were emitted with their original type.
      const customChunks = chunks?.filter(c => c.type === 'data-progress');
      expect(customChunks).toBeDefined();
      expect(customChunks!.length).toBeGreaterThanOrEqual(2);

      // Each chunk carries the step data.
      const steps = customChunks!.map(c => (c as any).data?.step).filter(s => s !== undefined);
      expect(steps).toContain('analyzing');
      expect(steps).toContain('processing');
    });
  },
  {},
);
