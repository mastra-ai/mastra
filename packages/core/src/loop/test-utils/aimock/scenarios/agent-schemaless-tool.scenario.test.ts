import { expect, it } from 'vitest';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * A tool declared without `inputSchema` or `outputSchema` must still be offered
 * to the model, execute when called, and pass its arbitrary result through to
 * the step results and the next model request unchanged.
 *
 * Replaces the hash-matched `agent.e2e` recording "should call tool without
 * input or output schemas".
 */
describeForAllEngines('AIMock loop scenario: tool without schemas', engine => {
  const getMock = useLoopScenarioAimock();

  it('executes a schemaless tool and returns its arbitrary result', async () => {
    const payload = { success: true, data: { arbitrary: 'value', count: 42 } };
    let executions = 0;
    const noSchemaTool = createTool({
      id: 'noSchemaTool',
      description: 'Returns test data with arbitrary structure',
      execute: async () => {
        executions++;
        return payload;
      },
    });

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Use the noSchemaTool to get test data',
      tools: { noSchemaTool },
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_noschema', name: 'noSchemaTool', arguments: {} }] },
        );
        llm.on({ endpoint: 'chat', toolCallId: 'call_noschema', hasToolResult: true }, { content: 'Got the data.' });
      },
    });

    expect(await output.text).toBe('Got the data.');
    expect(executions).toBe(1);
    expect(requests).toHaveLength(2);

    const offered = (requests[0]?.body?.tools ?? []).map((t: any) => t.function?.name);
    expect(offered).toEqual(['noSchemaTool']);

    const toolResults = await output.toolResults;
    const result = toolResults.find(r => r.payload.toolName === 'noSchemaTool')?.payload;
    expect(result?.result).toEqual(payload);
    expect(result?.isError).toBeFalsy();

    const toolMessage = (requests[1]?.body?.messages ?? []).find((m: any) => m.role === 'tool') as any;
    expect(toolMessage?.tool_call_id).toBe('call_noschema');
    expect(JSON.parse(toolMessage?.content)).toEqual(payload);
  });
});
