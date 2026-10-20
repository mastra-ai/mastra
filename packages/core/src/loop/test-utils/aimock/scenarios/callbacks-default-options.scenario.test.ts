/**
 * AIMock Scenario: Callbacks from agent defaultOptions
 *
 * An agent can declare `onFinish` in its `defaultOptions`. Every engine must
 * honour it the way a user expects:
 * - with no call options, or `{}`, the default `onFinish` fires with the reply
 * - a call-time `onFinish` replaces the default one; the default never fires
 *
 * And `generate()` surfaces a provider failure to the caller: it rejects with
 * the provider's message instead of resolving an empty result.
 */

import { expect, it, vi } from 'vitest';
import type { AgentExecutionOptions } from '../../../../agent/agent.types';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  useLoopScenarioAimock,
} from '../aimock-scenario';

const REPLY = 'Default options reply.';

// The harness types defaultOptions narrowly (types.ts is owned by #27408) but forwards it verbatim to the Agent.
const onFinishDefaults = (onFinish: AgentExecutionOptions['onFinish']): AgentExecutionOptions => ({ onFinish });

describeForAllEngines('AIMock loop scenario: callbacks from defaultOptions', engine => {
  const getMock = useLoopScenarioAimock();

  async function streamToEnd(agent: any, ...args: unknown[]) {
    const result = await agent.stream('Hello.', ...args);
    const output = isDurableEngineVariant(engine) ? result.output : result;
    const text = await output.text;
    result.cleanup?.();
    return text;
  }

  for (const [label, args] of [
    ['no call options', []],
    ['empty call options', [{}]],
  ] as const) {
    it(`defaultOptions.onFinish fires with the reply when stream() gets ${label}`, async () => {
      const llm = getMock();
      llm.on({ endpoint: 'chat' }, { content: REPLY, usage: { input_tokens: 4, output_tokens: 6 } });
      const defaultOnFinish = vi.fn();
      const { agent } = await createSharedAgent(llm, { engine, defaultOptions: onFinishDefaults(defaultOnFinish) });

      expect(await streamToEnd(agent, ...args)).toBe(REPLY);

      await vi.waitFor(() => expect(defaultOnFinish).toHaveBeenCalledTimes(1));
      const finish = defaultOnFinish.mock.calls[0]![0];
      expect(finish.text).toBe(REPLY);
      expect(finish.finishReason).toBe('stop');
      expect(finish.usage).toMatchObject({ inputTokens: 4, outputTokens: 6, totalTokens: 10 });
    });
  }

  it('a call-time onFinish replaces defaultOptions.onFinish', async () => {
    const llm = getMock();
    llm.on({ endpoint: 'chat' }, { content: REPLY });
    const defaultOnFinish = vi.fn();
    const callOnFinish = vi.fn();
    const { agent } = await createSharedAgent(llm, { engine, defaultOptions: onFinishDefaults(defaultOnFinish) });

    expect(await streamToEnd(agent, { onFinish: callOnFinish })).toBe(REPLY);

    await vi.waitFor(() => expect(callOnFinish).toHaveBeenCalledTimes(1));
    expect(callOnFinish.mock.calls[0]![0].text).toBe(REPLY);
    expect(defaultOnFinish).not.toHaveBeenCalled();
  });

  it('generate() rejects with the provider error message', async () => {
    const llm = getMock();
    llm.on({ endpoint: 'chat' }, { error: { message: 'model exploded', type: 'invalid_request_error' }, status: 400 });
    const { agent } = await createSharedAgent(llm, { engine });

    await expect(agent.generate('Go.', { maxSteps: 2 })).rejects.toThrow(/model exploded/);
    expect(llm.getRequests()[0]!.body!.messages.at(-1)).toMatchObject({ role: 'user', content: 'Go.' });
  });
});
