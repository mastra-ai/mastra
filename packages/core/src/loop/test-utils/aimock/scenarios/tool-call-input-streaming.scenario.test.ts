import { stepCountIs } from '@internal/ai-v7';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Tool-call arguments streamed by the provider surface as input-streaming
 * chunks whose deltas reassemble into the final tool-call arguments, followed
 * by the tool-call and its tool-result.
 */
describeForAllEngines('AIMock loop scenario: tool-call input streaming', engine => {
  const getMock = useLoopScenarioAimock();

  it('streams tool-call argument deltas before the tool call and result', async () => {
    const lookup = createTool({
      id: 'lookup',
      description: 'Looks up a key',
      inputSchema: z.object({ key: z.string(), detail: z.string() }),
      execute: async ({ key }) => ({ value: `VALUE_${key}` }),
    });
    const args = { key: 'alpha', detail: 'a fairly long detail string so the arguments stream in pieces' };

    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Look up alpha.',
      tools: { lookup },
      stopWhen: stepCountIs(3),
      collectChunks: true,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_lookup', name: 'lookup', arguments: args }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'alpha is VALUE_alpha' });
      },
    });

    expect(await output.text).toBe('alpha is VALUE_alpha');

    const types = chunks!.map(c => c.type);
    const start = types.indexOf('tool-call-input-streaming-start');
    const end = types.indexOf('tool-call-input-streaming-end');
    const call = types.indexOf('tool-call');
    const result = types.indexOf('tool-result');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(start).toBeLessThan(end);
    expect(end).toBeLessThan(call);
    expect(call).toBeLessThan(result);

    const startChunk = chunks![start];
    expect(startChunk.payload).toMatchObject({ toolCallId: 'call_lookup', toolName: 'lookup' });

    const deltas = chunks!.filter(c => c.type === 'tool-call-delta');
    expect(deltas.every(d => d.payload.toolCallId === 'call_lookup')).toBe(true);
    expect(JSON.parse(deltas.map(d => d.payload.argsTextDelta).join(''))).toEqual(args);

    expect(chunks![call].payload).toMatchObject({ toolCallId: 'call_lookup', args });
    expect(chunks![result].payload).toMatchObject({ toolCallId: 'call_lookup', result: { value: 'VALUE_alpha' } });
  });
});
