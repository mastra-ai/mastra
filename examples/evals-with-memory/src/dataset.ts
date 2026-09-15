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
      { input: 'Cats are mammals', groundTruth: 'mammals', thread: `ds-${globalThis.crypto.randomUUID()}` },
      { input: 'Dogs are mammals too', groundTruth: 'mammals', thread: `ds-${globalThis.crypto.randomUUID()}` },
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
