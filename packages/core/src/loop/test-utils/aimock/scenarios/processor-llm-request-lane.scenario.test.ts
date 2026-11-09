import { createOpenAI } from '@ai-sdk/openai-v5';
import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../../../../agent';
import type { ErrorProcessor, Processor } from '../../../../processors/index';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * Story: an error processor can also rewrite the outbound provider request (processLLMRequest),
 * for example to repair history a provider would reject. That rewrite must reach the model,
 * whether the processor is configured on the agent or passed at call time, and it must not make
 * the processor run as an input processor. If this breaks, provider repairs silently stop.
 */

const REWRITTEN = 'REWRITTEN_BY_ERROR_PROCESSOR';

function rewritingErrorProcessor() {
  const calls = { processLLMRequest: 0, processInput: 0, processInputStep: 0 };
  const processor: ErrorProcessor = {
    id: 'prompt-rewriting-error-processor',
    processLLMRequest: ({ prompt }) => {
      calls.processLLMRequest += 1;
      return {
        prompt: prompt.map(message =>
          message.role === 'user' ? { ...message, content: [{ type: 'text' as const, text: REWRITTEN }] } : message,
        ),
      };
    },
    processInput: async ({ messages }: any) => {
      calls.processInput += 1;
      return messages;
    },
    processInputStep: async () => {
      calls.processInputStep += 1;
      return {};
    },
    processAPIError: async () => undefined,
  };
  return { processor, calls };
}

function userTexts(body: any): string[] {
  return (body?.messages ?? [])
    .filter((m: any) => m.role === 'user')
    .flatMap((m: any) => (typeof m.content === 'string' ? [m.content] : m.content.map((p: any) => p.text)));
}

describeForAllEngines('Error-lane processLLMRequest rewrites the provider request', engine => {
  const getMock = useLoopScenarioAimock();

  it('sends the rewrite from an agent-level error processor and never runs it as an input processor', async () => {
    const { processor, calls } = rewritingErrorProcessor();

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'hello',
      errorProcessors: [processor],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'ok' });
      },
    });

    expect(await output.text).toBe('ok');
    expect(requests).toHaveLength(1);
    expect(calls.processInput).toBe(0);
    expect(calls.processInputStep).toBe(0);
    expect(calls.processLLMRequest).toBe(1);
    expect(userTexts(requests[0]!.body)).toEqual([REWRITTEN]);
  });
});

/** Call-time errorProcessors and dynamic resolvers are plain-agent options, so these run on the plain agent. */
describe('Error-lane processLLMRequest on the plain agent', () => {
  const getMock = useLoopScenarioAimock();

  const plainAgent = (config: Record<string, unknown> = {}) => {
    const llm = getMock();
    llm.on({ endpoint: 'chat' }, { content: 'ok' });
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
    const agent = new Agent({
      id: 'llm-request-lane-agent',
      name: 'LLM Request Lane Agent',
      instructions: 'test',
      model: openai(SCENARIO_MODEL_ID),
      ...config,
    });
    return { agent, llm };
  };

  it('applies a call-time errorProcessors override to the provider request', async () => {
    const { processor, calls } = rewritingErrorProcessor();
    const { agent, llm } = plainAgent();

    const result = await agent.generate('hello', { errorProcessors: [processor] });

    expect(result.text).toBe('ok');
    expect(calls.processLLMRequest).toBe(1);
    expect(userTexts(llm.getRequests()[0]!.body)).toEqual([REWRITTEN]);
  });

  it('resolves a dynamic error-processor list once per run and uses that instance for the request', async () => {
    const { processor, calls } = rewritingErrorProcessor();
    const resolver = vi.fn((): Processor[] => [processor]);
    const { agent, llm } = plainAgent({ errorProcessorDefaults: false, errorProcessors: resolver });

    await agent.generate('hello');

    expect(resolver).toHaveBeenCalledTimes(1);
    expect(calls.processLLMRequest).toBe(1);
    expect(userTexts(llm.getRequests()[0]!.body)).toEqual([REWRITTEN]);
  });
});
