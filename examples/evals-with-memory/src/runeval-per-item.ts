/**
 * Approach 2: per-item threads with `runEvals` — looped invocation
 *
 * `runEvals` accepts `targetOptions.memory` GLOBALLY (one thread for the
 * whole batch). It does NOT support per-item agent options today, and
 * pre-seeding `RequestContext.MastraMemory` does not drive the agent's
 * thread resolution (only `args.memory.thread` does).
 *
 * The pragmatic CI shape is therefore: call `runEvals` once per item (or
 * per group) with its own `targetOptions.memory`. Aggregate scores yourself.
 * This is what existing prebuilt scorers do for stateful agents in CI.
 */
import { randomUUID } from 'node:crypto';
import { runEvals } from '@mastra/core/evals';
import { buildAgent, containsScorer } from './shared.ts';

async function main() {
  const { agent, cleanup } = buildAgent({ observationalMemory: true });
  try {
    const memory = await agent.getMemory();
    if (!memory) {
      throw new Error('Memory not available — ensure observationalMemory is enabled');
    }
    const resourceId = 'ci-user';

    const items = [
      { input: 'Tell me about quicksort', groundTruth: 'quicksort' },
      { input: 'Tell me about heapsort', groundTruth: 'heapsort' },
      { input: 'Tell me about mergesort', groundTruth: 'mergesort' },
    ];

    const perItem: Array<{ thread: string; result: any }> = [];
    for (const it of items) {
      const thread = `t-${randomUUID()}`;
      await memory.createThread({ threadId: thread, resourceId, title: it.input });
      const result = await runEvals({
        target: agent,
        scorers: [containsScorer],
        targetOptions: { memory: { thread, resource: resourceId } },
        data: [{ input: it.input, groundTruth: it.groundTruth }],
      });
      perItem.push({ thread, result });
    }

    // Aggregate: simple mean per scorer
    const scoreSums: Record<string, number> = {};
    for (const { result } of perItem) {
      for (const [name, score] of Object.entries<number>(result.scores)) {
        scoreSums[name] = (scoreSums[name] ?? 0) + score;
      }
    }
    const aggregate = Object.fromEntries(Object.entries(scoreSums).map(([n, s]) => [n, s / perItem.length]));

    console.log('[runeval-per-item] aggregate scores:', aggregate);
    for (const { thread } of perItem) {
      const { messages } = await memory.recall({ threadId: thread, resourceId });
      console.log(`[runeval-per-item] thread ${thread}: ${messages.length} messages`);
    }
  } finally {
    cleanup();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
