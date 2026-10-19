import type { ChatCompletionRequest } from '@copilotkit/aimock';
import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import { createSharedAgent, runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: `onIterationComplete` continue/feedback control.
 *
 * Moved from `agent/__tests__/supervisor-integration.test.ts`. Basic iteration
 * context, `continue: false` and feedback-with-continue live in
 * `iteration-complete`. This file pins the combinations that have regressed:
 *  - `continue: false` with feedback grants exactly one more model turn that
 *    sees the feedback, then stops,
 *  - that extra turn is the last one even if the model keeps calling tools,
 *  - `continue: true` overrides a model `stop` (issue #14134),
 *  - feedback returned when the model stops reaches the next request.
 */
const lookupTool = createTool({
  id: 'lookup-tool',
  description: 'Looks up data',
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }) => ({ result: `Found: ${query}` }),
});

const lastUserText = (req: ChatCompletionRequest) =>
  JSON.stringify(req.messages.filter(m => m.role === 'user').at(-1)?.content ?? '');

describeForAllEngines('AIMock loop scenario: supervisor onIterationComplete control', engine => {
  // Inngest's agentic loop has no isTaskComplete, goal, or onIterationComplete steps yet.
  const itFailsOnInngest = engine === 'inngest' ? it.fails : it;
  const getMock = useLoopScenarioAimock();

  itFailsOnInngest('continue:false with feedback grants one more turn that sees the feedback', async () => {
    const iterations: number[] = [];

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Find items',
      tools: { lookupTool },
      maxSteps: 10,
      errorProcessors: [],
      onIterationComplete: (ctx: any) => {
        iterations.push(ctx.iteration);
        return ctx.iteration >= 2
          ? { continue: false, feedback: 'Stop and summarize your findings.' }
          : { continue: true };
      },
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', sequenceIndex: 0 },
          { toolCalls: [{ id: 'call-1', name: 'lookupTool', arguments: { query: 'item-1' } }] },
        );
        llm.on(
          { endpoint: 'chat', sequenceIndex: 1 },
          { toolCalls: [{ id: 'call-2', name: 'lookupTool', arguments: { query: 'item-2' } }] },
        );
        llm.on({ endpoint: 'chat', sequenceIndex: 2 }, { content: 'Summary of findings' });
      },
    });

    expect(requests).toHaveLength(3);
    expect(JSON.stringify((requests[2]!.body as ChatCompletionRequest).messages)).toContain(
      'Stop and summarize your findings.',
    );
    expect(iterations).toEqual([1, 2, 3]);
    expect(await output.text).toBe('Summary of findings');
  });

  itFailsOnInngest('force-stops after the feedback turn even if the model keeps calling tools', async () => {
    const iterations: number[] = [];

    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Fetch everything',
      tools: { lookupTool },
      maxSteps: 20,
      errorProcessors: [],
      onIterationComplete: (ctx: any) => {
        iterations.push(ctx.iteration);
        if (ctx.iteration === 1) return { continue: false, feedback: 'Wrap up now.' };
      },
      fixtures: llm => {
        for (let i = 0; i < 4; i++) {
          llm.on(
            { endpoint: 'chat', sequenceIndex: i },
            { toolCalls: [{ id: `call-${i + 1}`, name: 'lookupTool', arguments: { query: `item-${i + 1}` } }] },
          );
        }
      },
    });

    expect(JSON.stringify((requests[1]!.body as ChatCompletionRequest).messages)).toContain('Wrap up now.');
    expect(iterations).toEqual([1, 2]);
    expect(requests).toHaveLength(2);
  });

  itFailsOnInngest('continue:true overrides a model stop (issue #14134)', async () => {
    const iterations: number[] = [];

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Take multiple turns',
      maxSteps: 5,
      errorProcessors: [],
      onIterationComplete: (ctx: any) => {
        iterations.push(ctx.iteration);
        if (ctx.iteration === 1) return { continue: true };
      },
      fixtures: llm => {
        llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'First response ' });
        llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Second response' });
      },
    });

    expect(iterations).toEqual([1, 2]);
    expect(requests).toHaveLength(2);
    expect(await output.text).toBe('First response Second response');
  });

  itFailsOnInngest('feedback returned when the model stops reaches the next request', async () => {
    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Generate response',
      maxSteps: 3,
      errorProcessors: [],
      onIterationComplete: (ctx: any) =>
        ctx.iteration === 1
          ? { continue: true, feedback: 'Please improve your response with more details.' }
          : { continue: false },
      fixtures: llm => {
        llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'First response' });
        llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Improved response after feedback' });
      },
    });

    expect(requests).toHaveLength(2);
    expect(lastUserText(requests[0]!.body as ChatCompletionRequest)).not.toContain('Please improve');
    expect(JSON.stringify((requests[1]!.body as ChatCompletionRequest).messages)).toContain(
      'Please improve your response with more details.',
    );
    expect(await output.text).toContain('Improved response after feedback');
  });
});

/**
 * `agent.generate()` drives the same iteration loop through a separate entry
 * point; `runLoopScenario` only streams, so these run on the plain Agent.
 */
describe('AIMock loop scenario: supervisor onIterationComplete via generate()', () => {
  const getMock = useLoopScenarioAimock();

  it('fires once per iteration and stops on continue:false', async () => {
    const mock = getMock();
    mock.on(
      { endpoint: 'chat', sequenceIndex: 0 },
      { toolCalls: [{ id: 'call-1', name: 'lookupTool', arguments: { query: 'a' } }] },
    );
    mock.on(
      { endpoint: 'chat', sequenceIndex: 1 },
      { toolCalls: [{ id: 'call-2', name: 'lookupTool', arguments: { query: 'b' } }] },
    );
    mock.on({ endpoint: 'chat', sequenceIndex: 2 }, { content: 'never reached' });

    const { agent } = await createSharedAgent(mock, {
      tools: { lookupTool },
      memory: new MockMemory(),
      errorProcessors: [],
    });
    const iterations: Array<[number, boolean]> = [];
    await agent.generate('Keep counting', {
      maxSteps: 10,
      onIterationComplete: ctx => {
        iterations.push([ctx.iteration, ctx.isFinal]);
        return { continue: ctx.iteration < 2 };
      },
    });

    expect(iterations.map(([i]) => i)).toEqual([1, 2]);
    expect(mock.getRequests()).toHaveLength(2);
  });

  it('delivers feedback to the next request when the model stops', async () => {
    const mock = getMock();
    mock.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'First response' });
    mock.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Improved response after feedback' });

    const { agent } = await createSharedAgent(mock, { memory: new MockMemory(), errorProcessors: [] });
    const result = await agent.generate('Generate response', {
      maxSteps: 3,
      onIterationComplete: ctx =>
        ctx.iteration === 1
          ? { continue: true, feedback: 'Please improve your response with more details.' }
          : { continue: false },
    });

    const requests = mock.getRequests();
    expect(requests).toHaveLength(2);
    expect(JSON.stringify((requests[1]!.body as ChatCompletionRequest).messages)).toContain(
      'Please improve your response with more details.',
    );
    expect(result.text).toContain('Improved response after feedback');
  });
});
