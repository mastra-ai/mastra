/**
 * Approach 3: dataset.startExperiment with per-item memory via inline task
 *
 * The dataset / experiment runner does NOT pass memory options to the agent.
 * Only `requestContext` is plumbed per item, and pre-seeding
 * `RequestContext.MastraMemory` does not drive the agent's thread resolution
 * (only `args.memory.thread` does).
 *
 * The supported way to run memory-enabled agents from a dataset today is to
 * skip the `target: agent` registry path and use an inline `task` instead.
 * The inline task receives per-item `metadata`, so we stash `{ threadId,
 * resourceId }` there at insert time and invoke `agent.generate(input, {
 * memory: { thread, resource } })` ourselves.
 */
import { randomUUID } from 'node:crypto';
import { buildAgent, containsScorer } from './shared.ts';

async function main() {
  const { mastra, agent, cleanup } = buildAgent({ observationalMemory: true });
  try {
    const memory = await agent.getMemory();
    if (!memory) {
      throw new Error('Memory not available — ensure observationalMemory is enabled');
    }
    const resourceId = 'ci-user';

    const items = [
      { input: 'Cats are mammals', groundTruth: 'mammals', thread: `ds-${randomUUID()}` },
      { input: 'Dogs are mammals too', groundTruth: 'mammals', thread: `ds-${randomUUID()}` },
    ];
    for (const it of items) {
      await memory.createThread({ threadId: it.thread, resourceId, title: it.input });
    }

    const dataset = await mastra.datasets.create({
      name: 'evals-with-memory-ds',
      description: 'Per-item memory via inline task + item metadata',
    });

    await dataset.addItems({
      items: items.map(it => ({
        input: it.input,
        groundTruth: it.groundTruth,
        metadata: { threadId: it.thread, resourceId },
      })),
    });

    const summary = await dataset.startExperiment({
      scorers: [containsScorer],
      task: async ({ input, metadata }) => {
        const { threadId, resourceId: rid } = (metadata ?? {}) as {
          threadId?: unknown;
          resourceId?: unknown;
        };
        if (typeof input !== 'string' || !input) {
          throw new Error(`Expected non-empty string input, got ${typeof input}`);
        }
        if (typeof threadId !== 'string' || typeof rid !== 'string') {
          throw new Error('Item metadata is missing string threadId/resourceId');
        }
        const result = await agent.generate(input, {
          memory: { thread: threadId, resource: rid },
        });
        return result.text;
      },
    });

    console.log('[dataset] result:', JSON.stringify(summary, null, 2));

    for (const it of items) {
      const { messages } = await memory.recall({ threadId: it.thread, resourceId });
      console.log(`[dataset] thread ${it.thread}: ${messages.length} messages`);
    }
  } finally {
    cleanup();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
