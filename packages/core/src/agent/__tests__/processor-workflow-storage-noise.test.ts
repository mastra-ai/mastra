/**
 * Regression test for the processor-workflow variant of
 * https://github.com/mastra-ai/mastra/issues/17137 (follow-up to #17344).
 *
 * #17344 fixed the internal `execution-workflow`, but agents that use memory or any
 * input/output processors also build an internal *processor* workflow
 * (Agent.combineProcessorsIntoWorkflow, executed by ProcessorRunner.executeWorkflowAsProcessor).
 * That workflow never received the parent Mastra reference, so its createRun() ->
 * getWorkflowRunById() saw no storage and emitted, on every run:
 *   "Cannot get workflow run. Mastra storage is not initialized"
 * before falling back to in-memory state.
 *
 * When an agent with a processor is registered to a Mastra instance that has storage
 * configured, calling agent.generate()/stream() must:
 *   1. NOT take the no-storage branch for the internal `<agentId>-input-processor` workflow
 *      (it now receives the parent Mastra reference).
 *   2. NOT persist a workflow snapshot for that throwaway internal processor workflow.
 */
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { Mastra } from '../../mastra';
import type { Processor } from '../../processors';
import { InMemoryStore } from '../../storage';
import { Workflow } from '../../workflows/workflow';
import { Agent } from '../agent';

const AGENT_ID = 'processor-noise-agent';
const PROCESSOR_WORKFLOW_ID = `${AGENT_ID}-input-processor`;

function createDummyModel() {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      content: [{ type: 'text', text: 'Dummy response' }],
      warnings: [],
    }),
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Dummy response' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
      ]),
    }),
  });
}

// A minimal no-op input processor. A single non-workflow processor forces the agent to build
// the internal `createWorkflow(...)` processor workflow (the branch that triggers the bug),
// without pulling in @mastra/memory.
const noopInputProcessor: Processor = {
  id: 'noop-input-processor',
  processInput: async ({ messages }) => messages,
};

function buildAgentWithProcessor() {
  const storage = new InMemoryStore();
  const agent = new Agent({
    id: AGENT_ID,
    name: AGENT_ID,
    instructions: 'test',
    model: createDummyModel(),
    inputProcessors: [noopInputProcessor],
  });
  const mastra = new Mastra({
    agents: { [AGENT_ID]: agent },
    storage,
    logger: false,
  });
  return { mastra, storage };
}

describe('agent processor-workflow storage noise (issue #17137 follow-up to #17344)', () => {
  it('gives the internal processor workflow access to storage (no "storage is not initialized" branch)', async () => {
    // The buggy processor workflow used its own un-registered logger, so spying on the Mastra
    // logger does not see the noise. Instead, assert the root cause directly: when
    // getWorkflowRunById runs for the processor workflow it now has storage, so the
    // no-storage debug branch is unreachable.
    const seen: Array<{ id: string; hasStorage: boolean }> = [];
    const original = (Workflow.prototype as unknown as { getWorkflowRunById: (...a: unknown[]) => unknown })
      .getWorkflowRunById;
    const spy = vi
      .spyOn(Workflow.prototype as unknown as Record<string, any>, 'getWorkflowRunById')
      .mockImplementation(async function (this: any, ...args: unknown[]) {
        seen.push({ id: this.id, hasStorage: Boolean(this.mastra?.getStorage?.()) });
        return original.apply(this, args);
      });

    try {
      const { mastra } = buildAgentWithProcessor();
      await mastra.getAgent(AGENT_ID).generate('Hello!');
    } finally {
      spy.mockRestore();
    }

    const processorLookups = seen.filter(s => s.id === PROCESSOR_WORKFLOW_ID);
    expect(processorLookups.length).toBeGreaterThan(0);
    expect(processorLookups.every(s => s.hasStorage)).toBe(true);
  });

  it('does not persist a snapshot for the internal processor workflow on generate', async () => {
    const { mastra, storage } = buildAgentWithProcessor();

    await mastra.getAgent(AGENT_ID).generate('Hello!');

    const workflowsStore = await storage.getStore('workflows');
    const { runs, total } = await workflowsStore!.listWorkflowRuns({ workflowName: PROCESSOR_WORKFLOW_ID });
    expect(total).toBe(0);
    expect(runs).toEqual([]);
  });
});
