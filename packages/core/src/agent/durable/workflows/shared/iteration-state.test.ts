import { describe, expect, it } from 'vitest';
import { createWorkflow } from '../../../../workflows/create';
import { MessageList } from '../../../message-list';
import { globalRunRegistry } from '../../run-registry';
import { createDurableLLMExecutionStep } from '../steps/llm-execution';
import { createDurableLLMMappingStep } from '../steps/llm-mapping';
import { calculateAccumulatedUsage, createBaseIterationStateUpdate } from './iteration-state';
import { baseIterationStateSchema } from './schemas';

const providerRequest = {
  body: {
    prompt: 'p'.repeat(10_000),
    tools: Array.from({ length: 20 }, (_, index) => ({
      name: `tool-${index}`,
      inputSchema: {
        description: 's'.repeat(1_000),
      },
    })),
  },
};

function createUpdate() {
  return createBaseIterationStateUpdate({
    currentState: {
      runId: 'run-1',
      agentId: 'agent-1',
      agentName: 'Agent',
      iterationCount: 0,
      accumulatedSteps: [],
      accumulatedUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    } as any,
    executionOutput: {
      messageListState: { messages: [] },
      messageId: 'message-1',
      stepResult: {
        reason: 'tool-calls',
        isContinued: true,
        warnings: ['warning'],
        totalUsage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
        request: providerRequest,
      },
      output: {
        text: '',
        toolCalls: [],
        toolResults: [],
        usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
        steps: [],
      },
      state: {},
    } as any,
  });
}

function executionOutput(usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number }) {
  return {
    output: { text: 'done', usage },
    toolResults: [],
    stepResult: { reason: 'stop' },
    messageListState: {},
    state: {},
    messageId: 'message-1',
  } as any;
}

function iterationState(overrides: Record<string, unknown> = {}) {
  return {
    runId: 'run-1',
    agentId: 'agent-1',
    messageListState: {},
    toolsMetadata: [],
    modelConfig: {},
    options: {},
    state: {},
    messageId: 'message-0',
    iterationCount: 0,
    accumulatedSteps: [],
    accumulatedUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    ...overrides,
  } as any;
}

describe('calculateAccumulatedUsage', () => {
  it('adds complete usage and preserves explicit zeroes', () => {
    expect(
      calculateAccumulatedUsage(
        { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        { inputTokens: 0, outputTokens: 5, totalTokens: 5 },
      ),
    ).toEqual({ inputTokens: 10, outputTokens: 25, totalTokens: 35 });
  });

  it('marks only omitted counters unknown and keeps them unknown', () => {
    const incomplete = calculateAccumulatedUsage(
      { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      { outputTokens: 5 },
    );

    expect(incomplete).toEqual({ inputTokens: undefined, outputTokens: 25, totalTokens: undefined });
    expect(calculateAccumulatedUsage(incomplete, { inputTokens: 7, outputTokens: 3, totalTokens: 10 })).toEqual({
      inputTokens: undefined,
      outputTokens: 28,
      totalTokens: undefined,
    });
  });

  it('sums cache and reasoning token details across steps', () => {
    const first = calculateAccumulatedUsage(
      { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      {
        inputTokens: 100,
        outputTokens: 10,
        totalTokens: 110,
        cachedInputTokens: 80,
        cacheCreationInputTokens: 5,
        reasoningTokens: 4,
      },
    );
    const second = calculateAccumulatedUsage(first, {
      inputTokens: 50,
      outputTokens: 20,
      totalTokens: 70,
      cachedInputTokens: 40,
      reasoningTokens: 6,
    });
    expect(second).toEqual({
      inputTokens: 150,
      outputTokens: 30,
      totalTokens: 180,
      cachedInputTokens: 120,
      cacheCreationInputTokens: 5,
      reasoningTokens: 10,
    });
  });

  it('leaves detail fields undefined when no step reports them', () => {
    const result = calculateAccumulatedUsage(
      { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
    );
    expect(result).toEqual({ inputTokens: 1, outputTokens: 2, totalTokens: 3 });
  });
});

describe('createBaseIterationStateUpdate', () => {
  it('does not carry the provider request into the next iteration', () => {
    const update = createUpdate();

    expect(update.lastStepResult).toEqual({
      reason: 'tool-calls',
      isContinued: true,
      warnings: ['warning'],
      totalUsage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
    });
    expect(JSON.stringify(update)).not.toContain('tool-19');
  });

  it('carries preemption through cold schemas, actual mapping and snapshots, then clears it on acceptance', async () => {
    const runId = 'cold-signal-preemption';
    expect(globalRunRegistry.get(runId)).toBeUndefined();
    const messages = new MessageList({ threadId: 'cold-thread', resourceId: 'cold-resource' });
    messages.add(
      {
        id: 'earlier',
        role: 'assistant',
        createdAt: new Date(),
        content: { format: 2, parts: [{ type: 'text', text: 'earlier accepted' }] },
      },
      'memory',
    );
    const llm = createDurableLLMExecutionStep();
    const mapping = createDurableLLMMappingStep();
    const workflow = createWorkflow({
      id: 'cold-mapping',
      inputSchema: mapping.inputSchema,
      outputSchema: mapping.outputSchema,
    })
      .then(mapping)
      .commit();
    const currentState = baseIterationStateSchema.parse(
      iterationState({
        runId,
        messageListState: messages.serialize(),
        iterationCount: 1,
        accumulatedSteps: [{ text: 'earlier accepted' }],
        accumulatedUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        usageAggregationVersion: 1,
      }),
    );
    const discarded = llm.outputSchema.parse(
      JSON.parse(
        JSON.stringify({
          messageListState: messages.serialize(),
          text: '',
          toolCalls: [],
          stepResult: { reason: 'other', warnings: [], isContinued: true, signalPreempted: true },
          metadata: {},
          state: { threadId: 'cold-thread', resourceId: 'cold-resource', threadExists: true },
        }),
      ),
    );
    const run = await workflow.createRun();
    const result = await run.start({
      inputData: mapping.inputSchema.parse(
        JSON.parse(
          JSON.stringify({
            llmOutput: discarded,
            toolResults: [],
            runId,
            agentId: 'agent-1',
            messageId: 'replacement',
            state: discarded.state,
          }),
        ),
      ),
    });
    if (result.status !== 'success') throw new Error(`Cold mapping failed: ${result.status}`);
    const mapped = mapping.outputSchema.parse(JSON.parse(JSON.stringify(result.result)));
    const snapshot = baseIterationStateSchema.parse(
      JSON.parse(JSON.stringify(createBaseIterationStateUpdate({ currentState, executionOutput: mapped }))),
    );
    expect(snapshot.lastStepResult).toMatchObject({ signalPreempted: true, isContinued: true });
    expect(snapshot.iterationCount).toBe(1);
    expect(snapshot.accumulatedSteps).toEqual(currentState.accumulatedSteps);
    expect(snapshot.accumulatedUsage).toEqual(currentState.accumulatedUsage);
    const accepted = llm.outputSchema.parse(
      JSON.parse(
        JSON.stringify({
          ...discarded,
          text: 'replacement answer',
          stepResult: {
            reason: 'stop',
            warnings: [],
            isContinued: false,
            totalUsage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
          },
        }),
      ),
    );
    const replacementRun = await workflow.createRun();
    const replacement = await replacementRun.start({
      inputData: mapping.inputSchema.parse(
        JSON.parse(
          JSON.stringify({
            llmOutput: accepted,
            toolResults: [],
            runId,
            agentId: 'agent-1',
            messageId: 'replacement',
            state: accepted.state,
          }),
        ),
      ),
    });
    if (replacement.status !== 'success') throw new Error(`Cold replacement mapping failed: ${replacement.status}`);
    const completed = baseIterationStateSchema.parse(
      JSON.parse(
        JSON.stringify(
          createBaseIterationStateUpdate({
            currentState: snapshot,
            executionOutput: mapping.outputSchema.parse(JSON.parse(JSON.stringify(replacement.result))),
          }),
        ),
      ),
    );
    expect(completed.lastStepResult.signalPreempted).toBeUndefined();
    expect(completed.iterationCount).toBe(2);
    expect(completed.accumulatedSteps).toHaveLength(2);
    expect(completed.accumulatedUsage).toEqual({ inputTokens: 15, outputTokens: 23, totalTokens: 38 });
    expect(globalRunRegistry.get(runId)).toBeUndefined();
  });

  it('uses the zero identity for a legacy pre-first-step state', () => {
    const result = createBaseIterationStateUpdate({
      currentState: iterationState(),
      executionOutput: executionOutput({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
    });

    expect(result.accumulatedUsage).toEqual({ inputTokens: 10, outputTokens: 20, totalTokens: 30 });
    expect(result.usageAggregationVersion).toBe(1);
  });

  it('fails closed for a legacy state that already contains steps', () => {
    const result = createBaseIterationStateUpdate({
      currentState: iterationState({
        iterationCount: 1,
        accumulatedSteps: [{ text: 'earlier' }],
        accumulatedUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      }),
      executionOutput: executionOutput({ inputTokens: 5, outputTokens: 5, totalTokens: 10 }),
    });

    expect(result.accumulatedUsage).toEqual({
      inputTokens: undefined,
      outputTokens: undefined,
      totalTokens: undefined,
    });
    expect(result.usageAggregationVersion).toBe(1);
  });

  it.each([undefined, 1])(
    'preserves accepted state and usage-version %s through serialized signal discards',
    version => {
      const currentState = iterationState({
        iterationCount: 1,
        accumulatedSteps: [{ text: 'earlier accepted' }],
        accumulatedUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30, reasoningTokens: 4 },
        usageAggregationVersion: version,
      });
      for (const usage of [
        undefined,
        { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        { inputTokens: 7, outputTokens: 5, totalTokens: 12 },
      ]) {
        const discarded = executionOutput(usage);
        discarded.stepResult = { reason: 'other', isContinued: true, signalPreempted: true };
        const update = createBaseIterationStateUpdate({
          currentState,
          executionOutput: JSON.parse(JSON.stringify(discarded)),
        });
        expect(update.iterationCount).toBe(currentState.iterationCount);
        expect(update.accumulatedSteps).toBe(currentState.accumulatedSteps);
        expect(update.accumulatedUsage).toBe(currentState.accumulatedUsage);
        expect(update.usageAggregationVersion).toBe(version);
        expect(update.lastStepResult).toMatchObject({ isContinued: true, signalPreempted: true });
        expect(JSON.parse(JSON.stringify(update)).lastStepResult.signalPreempted).toBe(true);
      }
    },
  );
});
