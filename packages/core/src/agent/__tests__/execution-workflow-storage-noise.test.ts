/**
 * Regression test for https://github.com/mastra-ai/mastra/issues/17137
 *
 * When an agent is registered to a Mastra instance that has storage configured,
 * calling agent.generate()/stream() must:
 *   1. NOT emit the debug log "Cannot get workflow run. Mastra storage is not initialized".
 *      That log fired because the internal `execution-workflow` never received the parent's
 *      Mastra reference, so its createRun() saw no storage and took the no-storage branch.
 *   2. NOT persist a workflow snapshot for the throwaway internal `execution-workflow`.
 *      The execution-workflow is an internal implementation detail and is not resumable, so
 *      it must never write rows to the user's storage even after it can read storage.
 */
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { Workflow } from '../../workflows/workflow';
import { Agent } from '../agent';

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

function buildAgentWithStorage() {
  const storage = new InMemoryStore();
  const agent = new Agent({
    id: 'noise-agent',
    name: 'noise-agent',
    instructions: 'test',
    model: createDummyModel(),
  });
  const mastra = new Mastra({
    agents: { agent },
    storage,
    logger: false,
  });
  return { mastra, storage };
}

describe('agent execution-workflow storage noise (issue #17137)', () => {
  it('gives the internal execution-workflow access to storage (no "storage is not initialized" branch)', async () => {
    // The buggy execution-workflow used its own un-registered logger, so spying on the Mastra
    // logger does not see the noise. Instead, assert the root cause directly: when
    // createRun runs for the execution-workflow it now has storage, so the
    // no-storage debug branch is unreachable. (createRun is used rather than
    // getWorkflowRunById because #19028 skips the lookup entirely for transient
    // workflows that don't persist snapshots.)
    const seen: Array<{ id: string; hasStorage: boolean }> = [];
    const original = (Workflow.prototype as unknown as { createRun: (...a: unknown[]) => unknown }).createRun;
    const spy = vi
      .spyOn(Workflow.prototype as unknown as Record<string, any>, 'createRun')
      .mockImplementation(async function (this: any, ...args: unknown[]) {
        seen.push({ id: this.id, hasStorage: Boolean(this.mastra?.getStorage?.()) });
        return original.apply(this, args);
      });

    try {
      const { mastra } = buildAgentWithStorage();
      await mastra.getAgent('agent').generate('Hello!');
    } finally {
      spy.mockRestore();
    }

    const executionWorkflowRuns = seen.filter(s => s.id === 'execution-workflow');
    expect(executionWorkflowRuns.length).toBeGreaterThan(0);
    expect(executionWorkflowRuns.every(s => s.hasStorage)).toBe(true);
  });

  it('does not persist a snapshot for the internal execution-workflow on generate', async () => {
    const { mastra, storage } = buildAgentWithStorage();

    await mastra.getAgent('agent').generate('Hello!');

    const workflowsStore = await storage.getStore('workflows');
    const { runs, total } = await workflowsStore!.listWorkflowRuns({ workflowName: 'execution-workflow' });
    expect(total).toBe(0);
    expect(runs).toEqual([]);
  });
});
