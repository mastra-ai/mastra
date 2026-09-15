/**
 * Coverage for the scorer execution shared by every durable engine.
 *
 * Regression context (#19843): scorers ran on core's durable engine but not on
 * Inngest, because the Inngest workflow builder was a copy that never gained
 * the step core added. The behavior lives here so both engines run the same
 * code; these tests pin what that code must do.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createScorer } from '../../../../evals';
import type { ScoringHookInput } from '../../../../evals';
import { AvailableHooks, registerHook } from '../../../../hooks';
import { Mastra } from '../../../../mastra';
import { MessageList } from '../../../message-list';
import type { DurableAgenticExecutionOutput, DurableAgenticWorkflowInput } from '../../types';
import { executeDurableAgentScorers } from './execute-scorers';

const SUITE_SCORER_ID = 'shared-execute-scorers-suite-scorer';
const payloads: ScoringHookInput[] = [];

beforeAll(() => {
  // Hook registration is process-wide with no unregister API, so payloads are
  // filtered to this suite's scorer id to stay isolated from other suites.
  registerHook(AvailableHooks.ON_SCORER_RUN, (payload: ScoringHookInput) => {
    if ((payload as { scorer?: { id?: string } }).scorer?.id === SUITE_SCORER_ID) {
      payloads.push(payload);
    }
  });
});

afterAll(() => {
  payloads.length = 0;
});

beforeEach(() => {
  payloads.length = 0;
});

async function waitForPayloads(count: number, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (payloads.length < count && Date.now() - start < timeoutMs) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

function buildScorer() {
  return createScorer({
    id: SUITE_SCORER_ID,
    name: SUITE_SCORER_ID,
    description: 'records that it ran',
  }).generateScore(() => 1);
}

function buildInitData(overrides: Partial<DurableAgenticWorkflowInput> = {}): DurableAgenticWorkflowInput {
  const inputList = new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' });
  inputList.add({ role: 'user', content: 'what is the weather?' }, 'input');

  return {
    runId: 'run-1',
    agentId: 'weather-agent',
    agentName: 'Weather Agent',
    messageListState: inputList.serialize(),
    state: { threadId: 'thread-1', resourceId: 'resource-1' },
    scorers: { myScorer: { scorerName: SUITE_SCORER_ID } },
    ...overrides,
  } as DurableAgenticWorkflowInput;
}

function buildFinalOutput(): DurableAgenticExecutionOutput {
  const outputList = new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' });
  outputList.add({ role: 'assistant', content: 'it is sunny' }, 'response');

  return { messageListState: outputList.serialize() } as DurableAgenticExecutionOutput;
}

describe('executeDurableAgentScorers', () => {
  describe('when the agent has a scorer configured', () => {
    it('runs the scorer against the run input and output', async () => {
      const mastra = new Mastra({ scorers: { myScorer: buildScorer() }, logger: false });

      executeDurableAgentScorers({
        initData: buildInitData(),
        finalOutput: buildFinalOutput(),
        mastra,
      });
      await waitForPayloads(1);

      expect(payloads).toHaveLength(1);
      expect(payloads[0]).toMatchObject({
        runId: 'run-1',
        entityType: 'AGENT',
        source: 'LIVE',
        entity: { id: 'weather-agent', name: 'Weather Agent' },
        threadId: 'thread-1',
        resourceId: 'resource-1',
      });
    });

    it('scores the assistant response, not the user input', async () => {
      const mastra = new Mastra({ scorers: { myScorer: buildScorer() }, logger: false });

      executeDurableAgentScorers({
        initData: buildInitData(),
        finalOutput: buildFinalOutput(),
        mastra,
      });
      await waitForPayloads(1);

      expect(JSON.stringify(payloads[0]?.output)).toContain('it is sunny');
      expect(JSON.stringify(payloads[0]?.input)).toContain('what is the weather?');
    });
  });

  describe('when the agent has no scorers configured', () => {
    it('runs nothing', async () => {
      const mastra = new Mastra({ scorers: { myScorer: buildScorer() }, logger: false });

      executeDurableAgentScorers({
        initData: buildInitData({ scorers: undefined }),
        finalOutput: buildFinalOutput(),
        mastra,
      });
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(payloads).toHaveLength(0);
    });
  });

  describe('when a configured scorer cannot be resolved', () => {
    it('skips it instead of failing the run', async () => {
      const mastra = new Mastra({ scorers: { myScorer: buildScorer() }, logger: false });

      expect(() =>
        executeDurableAgentScorers({
          initData: buildInitData({
            scorers: { missing: { scorerName: 'not-registered-anywhere' } },
          } as Partial<DurableAgenticWorkflowInput>),
          finalOutput: buildFinalOutput(),
          mastra,
        }),
      ).not.toThrow();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(payloads).toHaveLength(0);
    });
  });

  describe('when there is no Mastra instance to resolve scorers from', () => {
    it('skips scoring instead of failing the run', async () => {
      expect(() =>
        executeDurableAgentScorers({
          initData: buildInitData(),
          finalOutput: buildFinalOutput(),
          mastra: undefined,
        }),
      ).not.toThrow();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(payloads).toHaveLength(0);
    });
  });
});
