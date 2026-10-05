/**
 * Port of harness case T53 (wf-agent-suspend), the `wf-evented-restart`/
 * `recover` cell: an evented workflow whose agent step suspended on a step
 * suspension, then resumed in a fresh module graph. The harness SIGKILLs the
 * process between the suspension and the resume.
 *
 * The helper restarts a *running* run; this one is suspended, so graph 2 is
 * built here with `loadGraph()` and resumed the way the harness does. The
 * suspension path itself (tool/step suspension without a restart) belongs to
 * the workflow cases, not here.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createRestartScenario, findRow, loadGraph } from './restart-harness';
import type { CoreGraph } from './restart-harness';

const scenarios: { stop(): Promise<void> }[] = [];
afterEach(async () => {
  await Promise.all(scenarios.splice(0).map(s => s.stop()));
});

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function createSayHiModel() {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      content: [{ type: 'text', text: 'agent says hi' }],
      finishReason: 'stop',
      usage,
      warnings: [],
    }),
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 't' },
        { type: 'text-delta', id: 't', delta: 'agent says hi' },
        { type: 'text-end', id: 't' },
        { type: 'finish', finishReason: 'stop', usage },
      ]),
    }),
  });
}

describe('T53 evented workflow agent suspend recovery in a fresh module graph', () => {
  it('resumes a suspended agent step in a fresh graph without calling the agent again', async () => {
    const runId = 't53-recover';
    const suspensions: number[] = [];
    const build = (core: CoreGraph, generation: number) => {
      const agent = new core.Agent({
        id: 't53-agent',
        name: 't53-agent',
        instructions: 'Say hi.',
        model: createSayHiModel(),
      });
      const approve = core.createEventedStep({
        id: 't53-wf-approve',
        inputSchema: z.object({ prompt: z.string() }),
        outputSchema: z.object({ text: z.string(), ok: z.boolean().optional() }),
        resumeSchema: z.object({ ok: z.boolean() }),
        suspendSchema: z.object({ text: z.string() }),
        execute: async ({ inputData, resumeData, suspend, suspendData }: any) => {
          if (resumeData) return { text: suspendData?.text ?? '', ok: resumeData.ok };
          const output = await agent.generate(inputData.prompt);
          suspensions.push(generation);
          return suspend({ text: output.text ?? '' });
        },
      });
      return core
        .createEventedWorkflow({
          id: 't53-wf',
          inputSchema: z.object({ prompt: z.string() }),
          outputSchema: z.object({ text: z.string(), ok: z.boolean().optional() }),
        })
        .then(approve)
        .commit();
    };

    const scenario = createRestartScenario({
      kind: 'workflow',
      runId,
      build: ({ core, generation }) => build(core, generation),
    });
    scenarios.push(scenario);
    const original = await scenario.start(async ({ workflow }) => {
      const run = await workflow.createRun({ runId });
      return run.start({ inputData: { prompt: 'go' } });
    });
    const first: any = await original.driven;
    if (first.status !== 'suspended') throw new Error(`not exercised: run ended ${first.status}`);
    const checkpoint = await original.checkpoint();
    expect(findRow(checkpoint, 't53-wf', runId)?.snapshot.status).toBe('suspended');

    // Graph 2: same rows, fresh module graph, resumed.
    const core = await loadGraph();
    const storage = new core.InMemoryStore();
    const workflow = build(core, 2);
    const mastra = new core.Mastra({ logger: false, storage, workflows: { [workflow.id]: workflow } });
    await mastra.startWorkers();
    try {
      const workflows = await mastra.getStorage()!.getStore('workflows');
      for (const row of checkpoint.rows) await workflows!.persistWorkflowSnapshot(structuredClone(row) as any);
      const run = await mastra.getWorkflowById('t53-wf').createRun({ runId });
      const resumed: any = await run.resume({ step: 't53-wf-approve', resumeData: { ok: true } });

      expect(resumed.status).toBe('success');
      expect(resumed.result).toMatchObject({ text: 'agent says hi', ok: true });
      // Resuming replays the suspended step's result; it must not re-ask the agent.
      expect(suspensions).toEqual([1]);
    } finally {
      await mastra.stopWorkers();
    }
  }, 60_000);
});
