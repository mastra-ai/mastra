/**
 * Regression tests for https://github.com/mastra-ai/mastra/issues/23671
 *
 * Processor steps created with the Inngest adapter's createStep must persist
 * processor state via the shared processorStates Map, matching the behavior of
 * steps created with @mastra/core/workflows: state written in one phase (e.g.
 * processInput) must be visible in later phases (e.g. processInputStep) and the
 * Map must be forwarded so chained processor steps keep it.
 *
 * No Inngest dev server is required — createStep(processor) returns a plain
 * step whose execute function can be called directly.
 */

import type { Processor, ProcessorState } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import { describe, it, expect } from 'vitest';

import { createStep } from '../index';

const makeMessage = (id: string) => ({
  id,
  role: 'user' as const,
  createdAt: new Date(),
  content: { format: 2 as const, parts: [{ type: 'text' as const, text: 'hello' }] },
});

const executeStep = (
  step: ReturnType<typeof createStep>,
  inputData: Record<string, unknown>,
): Promise<Record<string, unknown>> =>
  (step.execute as (args: unknown) => Promise<Record<string, unknown>>)({
    inputData,
    requestContext: new RequestContext(),
    tracingContext: {},
  });

describe('Inngest createStep(processor) state handling', () => {
  it('persists state written in processInput into the processorStates map', async () => {
    const processor = {
      id: 'tracking-processor',
      async processInput({ messages, state }) {
        state.messageCount = messages.length;
        return messages;
      },
    } satisfies Processor;

    const step = createStep(processor);
    expect(step.id).toBe('processor:tracking-processor');

    const processorStates = new Map<string, ProcessorState>();
    await executeStep(step, {
      phase: 'input',
      messages: [makeMessage('msg-1')],
      processorStates,
    });

    expect(processorStates.get('tracking-processor')?.customState).toEqual({ messageCount: 1 });
  });

  it('makes state written in one call visible to a later call with the same map', async () => {
    let observedState: Record<string, unknown> | undefined;
    const processor = {
      id: 'stateful-processor',
      async processInput({ messages, state }) {
        state.token = 'written-in-input';
        return messages;
      },
      async processInputStep({ state }) {
        observedState = { ...state };
        return undefined;
      },
    } satisfies Processor;

    const step = createStep(processor);
    const processorStates = new Map<string, ProcessorState>();
    const messages = [makeMessage('msg-1')];

    await executeStep(step, { phase: 'input', messages, processorStates });
    await executeStep(step, { phase: 'inputStep', messages, stepNumber: 0, processorStates });

    expect(observedState).toEqual({ token: 'written-in-input' });
  });

  it('forwards the processorStates map to chained steps via the step output', async () => {
    const processor = {
      id: 'chained-processor',
      async processInput({ messages, state }) {
        state.seen = true;
        return messages;
      },
    } satisfies Processor;

    const step = createStep(processor);
    const processorStates = new Map<string, ProcessorState>();
    const result = await executeStep(step, {
      phase: 'input',
      messages: [makeMessage('msg-1')],
      processorStates,
    });

    expect(result.processorStates).toBe(processorStates);
    expect(result.state).toEqual({ seen: true });
  });

  it('still works when no processorStates map is provided', async () => {
    const processor = {
      id: 'no-map-processor',
      async processInput({ messages, state }) {
        state.ignored = true;
        return messages;
      },
    } satisfies Processor;

    const step = createStep(processor);
    const result = await executeStep(step, {
      phase: 'input',
      messages: [makeMessage('msg-1')],
    });

    expect(result.messages).toHaveLength(1);
    expect(result.processorStates).toBeUndefined();
  });
});
