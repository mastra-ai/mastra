/**
 * AIMock Scenario: onChunk receives tool-error chunks
 *
 * A tool throws during a multi-step run. The `onChunk` callback is how callers
 * observe the run chunk by chunk, so it must be handed the `tool-error` chunk for
 * the failed call, exactly once and keyed to the original call, on every engine.
 * The run then continues and the model recovers with text.
 *
 * The agent is driven through `agent.stream()` directly because `runLoopScenario`
 * does not forward `onChunk` to the durable engines (#27408).
 */

import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import type { ChunkType } from '../../../../stream/types';
import { createTool } from '../../../../tools';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  useLoopScenarioAimock,
} from '../aimock-scenario';

describeForAllEngines('AIMock loop scenario: onChunk tool-error', engine => {
  const getMock = useLoopScenarioAimock();

  it('passes the tool-error chunk for a throwing tool to onChunk', async () => {
    const llm = getMock();
    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'call_failing', name: 'failingTool', arguments: { value: 'test' } }] },
    );
    llm.on({ endpoint: 'chat', toolCallId: 'call_failing', hasToolResult: true }, { content: 'Tool failed' });

    const failingTool = createTool({
      id: 'failingTool',
      description: 'A tool that always throws.',
      inputSchema: z.object({ value: z.string() }),
      execute: async () => {
        throw new Error('Tool execution failed');
      },
    });
    const { agent } = await createSharedAgent(llm, { engine, tools: { failingTool } });

    const onChunkChunks: ChunkType[] = [];
    const result: any = await agent.stream('Call the failing tool.', {
      maxSteps: 3,
      onChunk: (chunk: ChunkType) => {
        onChunkChunks.push(chunk);
      },
    });
    const output = isDurableEngineVariant(engine) ? result.output : result;
    const text = await output.text;
    result.cleanup?.();

    expect(text).toBe('Tool failed');
    expect(llm.getRequests()).toHaveLength(2);

    const toolErrors = onChunkChunks.filter(chunk => chunk.type === 'tool-error');
    expect(toolErrors).toHaveLength(1);
    expect(toolErrors[0]).toMatchObject({
      type: 'tool-error',
      payload: { toolCallId: 'call_failing', toolName: 'failingTool' },
    });
    expect(JSON.stringify((toolErrors[0] as any).payload.error)).toContain('Tool execution failed');
  });
});
