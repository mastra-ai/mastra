/**
 * Ported from validation harness case T44 (input-processors), `throws` variant.
 *
 * A throwing input processor is a failed guardrail and must stop every engine
 * before the model is called.
 */
import { describe, expect, it } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import type { InputProcessor } from '../../../processors';
import { InMemoryStore } from '../../../storage';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import type { DurableAgent } from '../durable-agent';
import type { ParityEngine } from './parity-harness';
import { createRecordingModel, snapshotFromOutput, textOnlyTape } from './parity-harness';

const ENGINES: ParityEngine[] = ['plain', 'durable', 'evented'];
const ERROR_MESSAGE = '[Agent:script] - Input processor error';

const throwingProcessor: InputProcessor = {
  id: 'throwing-input',
  name: 'Throwing Input',
  processInput: () => {
    throw new Error('guardrail exploded');
  },
};

describe('T44 input processors (plain, durable, evented)', () => {
  it('fails closed when processInput throws', async () => {
    for (const engine of ENGINES) {
      const { model, requests } = createRecordingModel({ tapes: [textOnlyTape('model reached')] });
      const agent = new Agent({
        id: `t44-throws-${engine}`,
        name: 'script',
        instructions: 'Respond.',
        model,
        inputProcessors: [throwingProcessor],
      });

      let wrapper: DurableAgent<string, any, any> | undefined;
      if (engine === 'durable') {
        wrapper = createDurableAgent({ agent, pubsub: new EventEmitterPubSub() });
      } else if (engine === 'evented') {
        wrapper = createEventedAgent({ agent });
      }

      const host = new Mastra({
        agents: { [agent.id]: wrapper ?? agent },
        storage: new InMemoryStore(),
        logger: false,
      });

      let cleanup: (() => void | Promise<void>) | undefined;
      let thrown: unknown;
      let text: string | null = null;
      try {
        const output = wrapper
          ? await wrapper.stream('hello', { runId: `t44-throws-${engine}-run` }).then(result => {
              cleanup = result.cleanup;
              return result.output;
            })
          : await agent.stream('hello', { runId: `t44-throws-${engine}-run` });
        text = (await snapshotFromOutput(output)).text;
      } catch (error) {
        thrown = error;
      } finally {
        await cleanup?.();
        await host.shutdown();
      }

      expect(
        {
          thrown: thrown instanceof Error ? thrown.message : null,
          modelCalls: requests.length,
          text,
        },
        engine,
      ).toEqual({
        thrown: ERROR_MESSAGE,
        modelCalls: 0,
        text: null,
      });

      if (engine !== 'plain') {
        expect(thrown, engine).toMatchObject({
          id: 'AGENT_INPUT_PROCESSOR_ERROR',
          cause: {
            id: 'PROCESSOR_WORKFLOW_FAILED',
            message: expect.stringContaining('guardrail exploded'),
          },
        });
      }
    }
  });

  it('fails closed when input processor resolution throws', async () => {
    for (const engine of ENGINES) {
      const { model, requests } = createRecordingModel({ tapes: [textOnlyTape('model reached')] });
      const agent = new Agent({
        id: `t44-resolver-throws-${engine}`,
        name: 'script',
        instructions: 'Respond.',
        model,
        inputProcessors: () => {
          throw new Error('resolver exploded');
        },
      });

      let wrapper: DurableAgent<string, any, any> | undefined;
      if (engine === 'durable') {
        wrapper = createDurableAgent({ agent, pubsub: new EventEmitterPubSub() });
      } else if (engine === 'evented') {
        wrapper = createEventedAgent({ agent });
      }

      const host = new Mastra({
        agents: { [agent.id]: wrapper ?? agent },
        storage: new InMemoryStore(),
        logger: false,
      });

      let cleanup: (() => void | Promise<void>) | undefined;
      let thrown: unknown;
      let text: string | null = null;
      try {
        const output = wrapper
          ? await wrapper.stream('hello', { runId: `t44-resolver-throws-${engine}-run` }).then(result => {
              cleanup = result.cleanup;
              return result.output;
            })
          : await agent.stream('hello', { runId: `t44-resolver-throws-${engine}-run` });
        text = (await snapshotFromOutput(output)).text;
      } catch (error) {
        thrown = error;
      } finally {
        await cleanup?.();
        await host.shutdown();
      }

      expect(
        {
          thrown: thrown instanceof Error ? thrown.message : null,
          modelCalls: requests.length,
          text,
        },
        engine,
      ).toEqual({
        thrown: 'resolver exploded',
        modelCalls: 0,
        text: null,
      });
    }
  });
});
