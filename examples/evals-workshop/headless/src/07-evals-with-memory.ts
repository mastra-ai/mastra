/**
 * Exercise 7 — Evaluating an agent that has memory.
 *
 * Memory turns a stateless scoring problem into a stateful one: what the agent
 * answers now depends on what it was told earlier, so *which thread each item
 * runs on* becomes part of the experiment design. Three shapes, and the choice
 * is about isolation:
 *
 *   a) one shared thread   every item sees the previous items. Right when you
 *                          are testing recall across a conversation; wrong for
 *                          independent questions, because item N is
 *                          contaminated by item N-1.
 *   b) thread per item     items cannot see each other. The default you want
 *                          for a QA dataset.
 *   c) dataset + memory    experiments do not forward memory options, so an
 *                          inline `task` is how you drive per-item threads.
 *
 * Historical note worth keeping: (b) used to require calling runEvals once per
 * item in a loop and aggregating by hand. It does not any more — `inputs: [x]`
 * makes runEvals own a thread per item. If you find that loop in older code,
 * it can be deleted.
 *
 * No API key required.
 */
import { randomUUID } from 'node:crypto';
import { runEvals } from '@mastra/core/evals';
import { buildSupportAgent } from '@workshop/shared/agent';
import { SUPPORT_QA } from '@workshop/shared/data';
import { answerAccuracyScorer } from '@workshop/shared/scorers';

const RESOURCE = 'workshop-user';

async function main() {
  // -------------------------------------------------------------------
  // a) One shared thread across every item.
  //
  // Single `input` means runEvals passes your memory options through
  // untouched — so all three items land on the thread you named.
  // -------------------------------------------------------------------
  console.log('── a) one shared thread (single `input`) ──');
  {
    const { agent, cleanup } = buildSupportAgent();
    try {
      const memory = await agent.getMemory();
      const threadId = `shared-${randomUUID()}`;
      await memory!.createThread({ threadId, resourceId: RESOURCE, title: 'shared eval thread' });

      const result = await runEvals({
        target: agent,
        scorers: [answerAccuracyScorer],
        targetOptions: { memory: { thread: threadId, resource: RESOURCE } },
        data: SUPPORT_QA.slice(0, 3).map(i => ({ input: i.input, groundTruth: i.groundTruth })),
      });

      const { messages } = await memory!.recall({ threadId, resourceId: RESOURCE });
      console.log(`  scores  : ${JSON.stringify(result.scores)}`);
      console.log(`  messages: ${messages.length} in ONE thread (3 items × user+assistant)`);
    } finally {
      cleanup();
    }
  }

  // -------------------------------------------------------------------
  // b) A thread per item — the supported one-liner.
  // -------------------------------------------------------------------
  console.log('\n── b) thread per item (`inputs: [x]`) ──');
  {
    const { agent, cleanup } = buildSupportAgent();
    try {
      const memory = await agent.getMemory();
      const result = await runEvals({
        target: agent,
        scorers: [answerAccuracyScorer],
        targetOptions: { memory: { resource: RESOURCE } },
        data: SUPPORT_QA.slice(0, 3).map(i => ({ inputs: [i.input], groundTruth: i.groundTruth })),
      });

      const listed: any = await memory!.listThreads({ resourceId: RESOURCE } as any);
      const threads = listed.threads ?? listed;
      console.log(`  scores : ${JSON.stringify(result.scores)}`);
      console.log(`  threads: ${threads.length} — isolated, no manual loop`);
    } finally {
      cleanup();
    }
  }

  // -------------------------------------------------------------------
  // c) A dataset experiment that still needs per-item memory.
  //
  // The experiment runner passes `metadata` but not memory options, so the
  // inline task reads the thread id out of metadata and makes the call.
  // -------------------------------------------------------------------
  console.log('\n── c) dataset experiment + per-item memory (inline task) ──');
  {
    const { mastra, agent, cleanup } = buildSupportAgent();
    try {
      const memory = await agent.getMemory();
      const items = SUPPORT_QA.slice(0, 3).map(i => ({ ...i, thread: `ds-${randomUUID()}` }));
      for (const it of items) {
        await memory!.createThread({ threadId: it.thread, resourceId: RESOURCE, title: it.input });
      }

      const dataset = await mastra.datasets.create({
        name: `memory-experiment-${randomUUID().slice(0, 8)}`,
        description: 'Per-item threads driven from item metadata',
      });
      await dataset.addItems({
        items: items.map(it => ({
          input: it.input,
          groundTruth: it.groundTruth,
          metadata: { threadId: it.thread, resourceId: RESOURCE },
        })),
      });

      const summary = await dataset.startExperiment({
        scorers: [answerAccuracyScorer],
        task: async ({ input, metadata }) => {
          const { threadId, resourceId } = (metadata ?? {}) as Record<string, string>;
          if (typeof input !== 'string') throw new Error('expected string input');
          const r = await agent.generate(input, { memory: { thread: threadId!, resource: resourceId! } });
          return r.text;
        },
      });

      console.log(`  status   : ${summary.status}`);
      console.log(`  succeeded: ${summary.succeededCount}/${summary.totalItems}`);
      for (const it of items) {
        const { messages } = await memory!.recall({ threadId: it.thread, resourceId: RESOURCE });
        console.log(`    ${it.thread.slice(0, 16)}… → ${messages.length} messages`);
      }
    } finally {
      cleanup();
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
