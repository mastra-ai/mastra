/**
 * Regression for https://github.com/mastra-ai/mastra/issues/22636
 *
 * On crash-restart, `pruneRunningHistory()` has stripped running-history fields
 * (e.g. the durable agent's `messageListState`) from *terminal* steps in the
 * running snapshot — the pruner assumes restart will feed the active step its
 * own recorded `payload`, which is exempt from pruning. But the payload
 * fallback in `executeEntry` was gated on `isResumedStep`, which is false on
 * restart, so the active step received the predecessor's pruned output and
 * crashed (TypeError: Cannot read properties of undefined (reading 'messages')).
 */

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createStep } from './workflow';

describe('restart with pruned predecessor output (issue #22636)', () => {
  const looseObject = z.looseObject({});

  type StepExecute = (params: { inputData: any }) => Promise<any>;

  function makeWorkflow(mapExecute: StepExecute, llmExecute: StepExecute) {
    const mapStep = createStep({
      id: 'map-input',
      execute: mapExecute,
      inputSchema: looseObject,
      outputSchema: looseObject,
    });
    const llmStep = createStep({
      id: 'llm-exec',
      execute: llmExecute,
      inputSchema: looseObject,
      outputSchema: looseObject,
    });
    const workflow = createWorkflow({
      id: 'pruned-predecessor-wf',
      inputSchema: looseObject,
      outputSchema: looseObject,
      steps: [mapStep, llmStep],
    })
      .then(mapStep)
      .then(llmStep)
      .commit();
    return workflow;
  }

  it('feeds the active step its own recorded payload instead of the pruned predecessor output', async () => {
    const storage = new MockStore();
    const mastra = new Mastra({ logger: false, storage });

    const mockMap = vi.fn(async () => ({ iteration: 1 }));
    // Mirrors MessageStateManager.deserializeAll: crashes when the input lost
    // `messageListState` to pruning.
    const mockLlm = vi.fn(async ({ inputData }: { inputData: any }) => ({
      count: inputData.messageListState.messages.length,
    }));

    const workflow = makeWorkflow(mockMap, mockLlm);
    workflow.__registerMastra(mastra);

    const workflowsStore = await storage.getStore('workflows');
    expect(workflowsStore).toBeTruthy();

    const runId = `pruned-predecessor-${Date.now()}`;
    const startedAt = Date.now();
    const input = { value: 'go' };

    // The active step's payload keeps the full state the pruner stripped from
    // its terminal predecessor.
    const intactPayload = {
      iteration: 1,
      messageListState: { messages: [{ role: 'user', content: 'hi' }] },
    };

    await workflowsStore!.persistWorkflowSnapshot({
      workflowName: workflow.id,
      runId,
      snapshot: {
        runId,
        status: 'running',
        activePaths: [1],
        activeStepsPath: { 'llm-exec': [1] },
        value: {},
        context: {
          input,
          // Terminal predecessor: output pruned (no messageListState), as
          // pruneRunningHistory leaves it on a running snapshot.
          'map-input': {
            payload: input,
            startedAt,
            status: 'success',
            output: { iteration: 1 },
            endedAt: startedAt + 50,
          },
          // Active step: recorded at step start, exempt from pruning.
          'llm-exec': {
            payload: intactPayload,
            startedAt: startedAt + 60,
            status: 'running',
          },
        } as any,
        serializedStepGraph: (workflow as any).serializedStepGraph,
        suspendedPaths: {},
        waitingPaths: {},
        resumeLabels: {},
        timestamp: Date.now(),
      },
    });

    const run = await workflow.createRun({ runId });
    const restartResult = await run.restart();

    expect(restartResult.status).toBe('success');
    expect((restartResult as any).result).toEqual({ count: 1 });

    // The completed predecessor must not re-execute.
    expect(mockMap).toHaveBeenCalledTimes(0);

    // The active step re-ran from its own preserved payload.
    expect(mockLlm).toHaveBeenCalledTimes(1);
    expect(mockLlm.mock.calls[0]![0].inputData).toEqual(intactPayload);
  });

  it('falls back to the predecessor output when the active step has no recorded payload', async () => {
    const storage = new MockStore();
    const mastra = new Mastra({ logger: false, storage });

    const mapOutput = { iteration: 1, messageListState: { messages: [{ role: 'user', content: 'hi' }] } };
    const mockMap = vi.fn(async () => mapOutput);
    const mockLlm = vi.fn(async ({ inputData }: { inputData: any }) => ({
      count: inputData.messageListState.messages.length,
    }));

    const workflow = makeWorkflow(mockMap, mockLlm);
    workflow.__registerMastra(mastra);

    const workflowsStore = await storage.getStore('workflows');
    const runId = `no-recorded-payload-${Date.now()}`;
    const startedAt = Date.now();
    const input = { value: 'go' };

    await workflowsStore!.persistWorkflowSnapshot({
      workflowName: workflow.id,
      runId,
      snapshot: {
        runId,
        status: 'running',
        activePaths: [1],
        activeStepsPath: { 'llm-exec': [1] },
        value: {},
        context: {
          input,
          'map-input': {
            payload: input,
            startedAt,
            status: 'success',
            output: mapOutput,
            endedAt: startedAt + 50,
          },
          // No 'llm-exec' entry: the step never recorded a payload before the
          // crash, so restart must derive its input from the predecessor.
        } as any,
        serializedStepGraph: (workflow as any).serializedStepGraph,
        suspendedPaths: {},
        waitingPaths: {},
        resumeLabels: {},
        timestamp: Date.now(),
      },
    });

    const run = await workflow.createRun({ runId });
    const restartResult = await run.restart();

    expect(restartResult.status).toBe('success');
    expect(mockLlm).toHaveBeenCalledTimes(1);
    expect(mockLlm.mock.calls[0]![0].inputData).toEqual(mapOutput);
  });
});
