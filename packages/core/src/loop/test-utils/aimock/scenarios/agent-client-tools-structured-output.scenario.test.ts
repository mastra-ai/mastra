import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * A client tool (no `execute`) called while `structuredOutput` is set must end
 * the run on the pending client tool call, report it through `onFinish` and
 * `toolCalls`, and not try to parse the tool-call turn as the structured object.
 *
 * Replaces the hash-matched `agent.e2e` recording "stream - should pass and call
 * client side tools with experimental output".
 */
describeForAllEngines('AIMock loop scenario: client tools with structured output', engine => {
  const getMock = useLoopScenarioAimock();

  it('stops on the client tool call and reports it', async () => {
    let finishedToolCalls: string[] | undefined;

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Make it green',
      instructions: 'You are an agent that can change colors using client side tools.',
      clientTools: {
        changeColor: {
          id: 'changeColor',
          description: 'Changes the UI color',
          inputSchema: z.object({ color: z.string() }),
        },
      },
      structuredOutput: { schema: z.object({ color: z.string() }) },
      onFinish: (props: any) => {
        finishedToolCalls = props.toolCalls.map((call: any) => call.payload?.toolName ?? call.toolName);
      },
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_color', name: 'changeColor', arguments: { color: 'green' } }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: '{"color":"green"}' });
      },
    });

    expect(requests).toHaveLength(1);
    const offered = (requests[0]?.body?.tools ?? []).map((t: any) => t.function?.name);
    expect(offered).toEqual(['changeColor']);

    expect(await output.finishReason).toBe('tool-calls');
    const toolCalls = await output.toolCalls;
    expect(toolCalls.map(call => call.payload.toolName)).toEqual(['changeColor']);
    expect(toolCalls[0]!.payload.args).toEqual({ color: 'green' });
    expect(finishedToolCalls).toEqual(['changeColor']);
  });
});
