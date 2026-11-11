import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createDurableAgent, createEventedAgent, DurableStepIds } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import * as defaultWorkflows from '@mastra/core/workflows';
import * as eventedWorkflows from '@mastra/core/workflows/evented';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { LibSQLStore } from '../storage';
import { createStepAgent, gate } from './cross-process/step-agent';

function guard<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} (hang guard)`)), 10_000);
    }),
  ]).finally(() => clearTimeout(timer));
}

// COR-1410 / harness T62 at 23f640a: real independent LibSQL handles, but
// observation stays in-process. Promise gates replace the harness's tool delays.
describe.each(['default', 'evented'] as const)('T62 %s workflow hand-off', engine => {
  it('returns before the agent finishes, then observes the whole run and persisted completion', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mastra-t62-'));
    const url = `file:${join(dir, 'runs.db')}`;
    const storage = new LibSQLStore({ id: 't62-producer', url });
    const freshStorage = new LibSQLStore({ id: 't62-reader', url });
    const release = gate();
    const reached = gate();
    const replayed = gate();
    const commits: number[] = [];
    const { agent } = createStepAgent({
      id: `t62-${engine}`,
      steps: 2,
      blockAt: 2,
      release: release.promise,
      onToolEvent: event => {
        if (event.event === 'reached') reached.resolve();
        if (event.event === 'commit') commits.push(event.n);
      },
    });
    const runner =
      engine === 'default' ? createDurableAgent({ agent, cleanupTimeoutMs: 0 }) : createEventedAgent({ agent });
    const { createStep } = defaultWorkflows;
    const { createWorkflow } = engine === 'default' ? defaultWorkflows : eventedWorkflows;
    const runId = `t62-run-${engine}`;
    let commitsWhenStepReturned = -1;
    let cleanupProducer: (() => void) | undefined;
    const step = createStep({
      id: 'hand-off',
      inputSchema: z.object({ prompt: z.string() }),
      outputSchema: z.object({ runId: z.string() }),
      execute: async ({ inputData }) => {
        const producer = await runner.stream(inputData.prompt, { runId });
        cleanupProducer = producer.cleanup;
        commitsWhenStepReturned = commits.length;
        return { runId };
      },
    });
    const workflow = createWorkflow({
      id: `t62-workflow-${engine}`,
      inputSchema: z.object({ prompt: z.string() }),
      outputSchema: z.object({ runId: z.string() }),
    })
      .then(step)
      .commit();
    const mastra = new Mastra({ agents: { runner }, workflows: { workflow }, storage, logger: false });
    let freshMastra: Mastra | undefined;
    try {
      await mastra.startWorkers();
      const run = await workflow.createRun();
      const result = await guard(run.start({ inputData: { prompt: 'go' } }), 'workflow waited for agent');
      expect(result.status).toBe('success');
      if (result.status !== 'success') throw new Error(`Workflow ${result.status}`);
      expect(result.result).toEqual({ runId });
      expect(commitsWhenStepReturned).toBeLessThan(2);
      await guard(reached.promise, 'second tool did not start');
      expect(commits).toEqual([1]);

      const observer = await runner.observe(runId);
      const types: string[] = [];
      const observed = (async () => {
        for await (const chunk of observer.fullStream) {
          types.push(chunk.type);
          // Step 1 committed before attachment; its result can only be replayed.
          if (chunk.type === 'tool-result' && chunk.payload.toolCallId === 'call-1') replayed.resolve();
        }
      })();
      const output = observer.output.getFullOutput();
      const settled = Promise.allSettled([observed, output]);
      try {
        await guard(replayed.promise, 'pre-attachment result was not replayed');
        expect(commits).toEqual([1]);
        release.resolve();
        await guard(observed, 'observer did not finish');
        expect((await output).text).toBe('finished 2 steps');
        expect(types).toContain('finish');
        expect(types).not.toContain('error');
        expect(commits).toEqual([1, 2]);
      } finally {
        release.resolve();
        try {
          await observer.detach();
        } finally {
          await settled;
        }
      }
      await cleanupProducer?.();

      const freshRunner = createDurableAgent({
        agent: createStepAgent({ id: agent.id, steps: 2 }).agent,
      });
      freshMastra = new Mastra({ agents: { runner: freshRunner }, storage: freshStorage, logger: false });
      expect(await freshRunner.listActiveRuns()).toEqual({ runs: [], total: 0 });
      const workflows = await freshStorage.getStore('workflows');
      const persisted = await workflows!.getWorkflowRunById({ runId, workflowName: DurableStepIds.AGENTIC_LOOP });
      const snapshot = typeof persisted?.snapshot === 'string' ? JSON.parse(persisted.snapshot) : persisted?.snapshot;
      expect(snapshot == null || snapshot.status === 'success').toBe(true);
    } finally {
      release.resolve();
      try {
        await cleanupProducer?.();
      } finally {
        try {
          await freshMastra?.shutdown();
        } finally {
          try {
            await mastra.shutdown();
          } finally {
            try {
              await freshStorage.close();
            } finally {
              try {
                await storage.close();
              } finally {
                await rm(dir, { recursive: true, force: true });
              }
            }
          }
        }
      }
    }
  }, 30_000);
});
