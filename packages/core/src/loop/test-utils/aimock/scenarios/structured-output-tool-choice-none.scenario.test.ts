/**
 * AIMock Scenario: structured output with toolChoice 'none' drops tool definitions (#14459)
 *
 * Gemini rejects a request that combines tool definitions with a native JSON
 * response schema. When a step sets `toolChoice: 'none'` and the call carries a
 * structured-output schema, the loop must send no tool definitions at all, even
 * though the agent has a workflow registered as a tool. Without structured output,
 * tools stay on the request (AI SDK semantics, #25908).
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google-v5';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createStep, createWorkflow } from '../../../../workflows';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  useLoopScenarioAimock,
} from '../aimock-scenario';

function summarizeWorkflow() {
  const step = createStep({
    id: 'summarize-topic-step',
    inputSchema: z.object({ topic: z.string() }),
    outputSchema: z.object({ summary: z.string() }),
    execute: async ({ inputData }) => ({ summary: `Summary for ${inputData.topic}` }),
  });
  return createWorkflow({
    id: 'summarize-topic-workflow',
    description: 'Workflow for summarizing topics',
    inputSchema: z.object({ topic: z.string() }),
    outputSchema: z.object({ summary: z.string() }),
  })
    .then(step)
    .commit();
}

describeForAllEngines('AIMock loop scenario: structured output with toolChoice none', engine => {
  const getMock = useLoopScenarioAimock();

  async function run(options: Record<string, unknown>) {
    const llm = getMock();
    const gemini = createGoogleGenerativeAI({
      apiKey: 'aimock-test-key',
      baseURL: `${llm.url.replace(/\/+$/, '')}/v1beta`,
    });
    const { agent } = await createSharedAgent(llm, {
      engine,
      workflows: { summarizeWorkflow: summarizeWorkflow() },
      model: () => gemini('gemini-2.5-flash'),
    });
    const result = await agent.stream('Return a short structured summary about exercise.', options);
    const output = isDurableEngineVariant(engine) ? result.output : result;
    await output.consumeStream();
    return { llm, output };
  }

  it('sends no tool definitions when a step sets toolChoice none with a structured-output schema', async () => {
    getMock().on({}, { content: JSON.stringify({ summary: 'Exercise keeps you healthy.' }) });

    const { llm, output } = await run({
      structuredOutput: { schema: z.object({ summary: z.string() }) },
      prepareStep: () => ({ toolChoice: 'none' }),
    });

    expect(await output.object).toEqual({ summary: 'Exercise keeps you healthy.' });
    const [request] = llm.getRequests();
    expect(request!.path).toContain('gemini-2.5-flash:streamGenerateContent');
    expect(request!.body.tools ?? []).toEqual([]);
  });

  it('keeps tool definitions for toolChoice none without a structured-output schema', async () => {
    getMock().on({}, { content: 'Exercise keeps you healthy.' });

    const { llm, output } = await run({ prepareStep: () => ({ toolChoice: 'none' }) });

    expect(await output.text).toBe('Exercise keeps you healthy.');
    const [request] = llm.getRequests();
    expect(request!.body.tools?.map(tool => tool.function.name)).toEqual(['workflow-summarizeWorkflow']);
  });
});
