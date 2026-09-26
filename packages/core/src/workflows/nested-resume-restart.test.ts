/**
 * Regression for https://github.com/mastra-ai/mastra/issues/25187
 *
 * A process that dies while a resumed nested-workflow step is running leaves
 * both parent and nested snapshots `running`. restart() on the parent must
 * recover the run and re-execute the nested step with its resume data.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createStep } from './workflow';

function build(onResume: (data: any) => Promise<void>) {
  const gate = createStep({
    id: 'gate',
    inputSchema: z.object({}),
    outputSchema: z.object({ approved: z.boolean() }),
    resumeSchema: z.object({ approved: z.boolean() }),
    execute: async ({ resumeData, suspend }) => {
      if (!resumeData) {
        return suspend({});
      }
      await onResume(resumeData);
      return { approved: resumeData.approved };
    },
  });
  const nested = createWorkflow({
    id: 'nested',
    inputSchema: z.object({}),
    outputSchema: z.object({ approved: z.boolean() }),
  })
    .then(gate)
    .commit();
  const parent = createWorkflow({
    id: 'parent',
    inputSchema: z.object({}),
    outputSchema: z.object({ approved: z.boolean() }),
  })
    .then(nested)
    .commit();
  return { parent, nested };
}

describe('nested workflow restart after crash during resume (issue #25187)', () => {
  it('restarts the resumed nested step with its resume data', async () => {
    const storage1 = new MockStore();
    let markRunning!: () => void;
    const running = new Promise<void>(r => (markRunning = r));
    const p1 = build(async () => {
      markRunning();
      await new Promise(() => {}); // process "dies" here
    });
    new Mastra({ logger: false, storage: storage1, workflows: { parent: p1.parent, nested: p1.nested } });

    const run1 = await p1.parent.createRun();
    const started = await run1.start({ inputData: {} });
    expect(started.status).toBe('suspended');

    void run1.resume({ step: ['nested', 'gate'], resumeData: { approved: true } });
    await running;

    // Crash: copy persisted snapshots into fresh storage used by a new process.
    const store1 = (await storage1.getStore('workflows'))!;
    const storage2 = new MockStore();
    const store2 = (await storage2.getStore('workflows'))!;
    for (const name of ['parent', 'nested']) {
      const snapshot = await store1.loadWorkflowSnapshot({ workflowName: name, runId: run1.runId });
      expect(snapshot?.status).toBe('running');
      await store2.persistWorkflowSnapshot({
        workflowName: name,
        runId: run1.runId,
        snapshot: JSON.parse(JSON.stringify(snapshot)),
      });
    }

    const seen: any[] = [];
    const p2 = build(async data => {
      seen.push(data);
    });
    new Mastra({ logger: false, storage: storage2, workflows: { parent: p2.parent, nested: p2.nested } });

    const run2 = await p2.parent.createRun({ runId: run1.runId });
    const result = await run2.restart();

    expect(result.status).toBe('success');
    expect(seen).toEqual([{ approved: true }]);
    if (result.status === 'success') {
      expect(result.result).toEqual({ approved: true });
    }
    const nestedSnapshot = await store2.loadWorkflowSnapshot({ workflowName: 'nested', runId: run1.runId });
    expect(nestedSnapshot?.status).toBe('success');
  });
});
