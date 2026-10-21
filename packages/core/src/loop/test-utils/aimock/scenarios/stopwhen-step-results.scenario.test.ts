import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: what a custom `stopWhen` predicate sees.
 *
 * The loop evaluates `stopWhen` after every step that ends in tool calls (a
 * step that finishes with text ends the run on its own, so the predicate is
 * not consulted). Each call must receive the steps accumulated so far, and the
 * last step's content must match what `stream.steps` later reports.
 *
 * Script: turn 1 calls `weather`, turn 2 calls `plan_activities` (optionally
 * with explanatory text in the same step), turn 3 answers with text.
 */
type StopWhenArgs = { steps: Array<{ content: Array<{ type: string }>; toolCalls: unknown[] }> };

const weatherTool = createTool({
  id: 'weather',
  description: 'Get weather for a location',
  inputSchema: z.object({ location: z.string() }),
  execute: async ({ location }) => ({ temperature: 70, conditions: 'sunny', location }),
});

const planActivitiesTool = createTool({
  id: 'plan_activities',
  description: 'Plan activities based on the weather',
  inputSchema: z.object({ temperature: z.string() }),
  execute: async () => ({ activities: 'Walk along the waterfront' }),
});

const tools = { weather: weatherTool, plan_activities: planActivitiesTool };

const weatherCall = { id: 'call_weather', name: 'weather', arguments: { location: 'Toronto' } };
const planCall = { id: 'call_plan', name: 'plan_activities', arguments: { temperature: '70' } };

function scriptThreeTurns(
  llm: Parameters<NonNullable<Parameters<typeof runLoopScenario>[0]['fixtures']>>[0],
  turn2Text?: string,
) {
  llm.on({ endpoint: 'chat', hasToolResult: false }, { toolCalls: [weatherCall] });
  llm.on(
    { endpoint: 'chat', toolCallId: 'call_weather', hasToolResult: true },
    turn2Text ? { content: turn2Text, toolCalls: [planCall] } : { toolCalls: [planCall] },
  );
  llm.on({ endpoint: 'chat', toolCallId: 'call_plan', hasToolResult: true }, { content: 'Go for a walk.' });
}

describeForAllEngines('AIMock loop scenario: stopWhen step results', engine => {
  const getMock = useLoopScenarioAimock();

  it('stops after the first tool step when the predicate sees a tool call', async () => {
    const { output, requests, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'What should I be doing in Toronto today?',
      tools,
      collectChunks: true,
      stopWhen: (({ steps }: StopWhenArgs) => {
        return steps.some(step => step.toolCalls.length > 0);
      }) as any,
      fixtures: llm => scriptThreeTurns(llm),
    });

    await output.consumeStream();

    expect(requests).toHaveLength(1);
    expect(chunks!.filter(chunk => chunk.type === 'step-start')).toHaveLength(1);
    expect(chunks!.some(chunk => chunk.type === 'tool-call')).toBe(true);
    expect(chunks!.some(chunk => chunk.type === 'text-delta')).toBe(false);
  });

  it('is called once per tool step with the accumulated steps, never on the final text step', async () => {
    const seenStepCounts: number[] = [];
    const { output, requests, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'What should I be doing in Toronto today?',
      tools,
      collectChunks: true,
      stopWhen: (({ steps }: StopWhenArgs) => {
        seenStepCounts.push(steps.length);
        return false;
      }) as any,
      fixtures: llm => scriptThreeTurns(llm),
    });

    await output.consumeStream();

    expect(requests).toHaveLength(3);
    expect((await output.steps).length).toBe(3);
    expect(chunks!.filter(chunk => chunk.type === 'step-start')).toHaveLength(3);
    expect(chunks!.filter(chunk => chunk.type === 'step-finish')).toHaveLength(3);
    expect(seenStepCounts).toEqual([1, 2]);
  });

  for (const withText of [false, true]) {
    const variant = withText ? ' (text and tool call in one step)' : '';
    const step2Types = withText ? ['text', 'tool-call', 'tool-result'] : ['tool-call', 'tool-result'];
    const types = (content: Array<{ type: string }>) => content.map(part => part.type);
    const withoutProviderFields = (content: unknown[]) =>
      content.map(part => {
        const { providerOptions: _o, providerMetadata: _m, ...rest } = part as Record<string, unknown>;
        return rest;
      });

    const runRecordingLastContent = async () => {
      const seenLastContent: Array<Array<{ type: string }>> = [];
      const { output } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'What should I be doing in Toronto today?',
        tools,
        stopWhen: (({ steps }: StopWhenArgs) => {
          seenLastContent.push(structuredClone(steps.at(-1)?.content ?? []));
          return false;
        }) as any,
        fixtures: llm => scriptThreeTurns(llm, withText ? 'It is sunny, so let me plan. ' : undefined),
      });
      await output.consumeStream();
      return { seenLastContent, steps: await output.steps };
    };

    it(`reports every step's content on stream.steps${variant}`, async () => {
      const { steps } = await runRecordingLastContent();
      expect(steps.map(step => types(step.content))).toEqual([['tool-call', 'tool-result'], step2Types, ['text']]);
    });

    it(`passes stopWhen the same last-step content stream.steps reports${variant}`, async () => {
      const { seenLastContent, steps } = await runRecordingLastContent();
      expect(seenLastContent.map(types)).toEqual([['tool-call', 'tool-result'], step2Types]);
      expect(seenLastContent.map(withoutProviderFields)).toEqual(
        steps.slice(0, 2).map(step => withoutProviderFields(step.content)),
      );
    });
  }
});
