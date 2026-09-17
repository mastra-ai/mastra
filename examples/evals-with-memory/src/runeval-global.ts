import { runEvals } from '@mastra/core/evals';
import { buildAgent, containsScorer } from './shared.ts';

async function main() {
  const { agent, cleanup } = buildAgent({ observationalMemory: true });
  const threadId = `eval-global-${globalThis.crypto.randomUUID()}`;
  const resourceId = 'ci-user';

  // Pre-create the thread so observational-memory thread scope doesn't bail.
  const memory = await agent.getMemory();
  await memory!.createThread({ threadId, resourceId, title: 'eval-global' });

  const result = await runEvals({
    target: agent,
    scorers: [containsScorer],
    targetOptions: {
      memory: { thread: threadId, resource: resourceId },
    },
    data: [
      { input: 'My name is Ada', groundTruth: 'Ada' },
      { input: 'What did I just say my name was?', groundTruth: 'Ada' },
      { input: 'I work on numerical analysis', groundTruth: 'numerical' },
    ],
  });

  console.log('[runeval-global] result:', JSON.stringify(result, null, 2));

  // Verify memory was actually written.
  const { messages } = await memory!.recall({ threadId, resourceId });
  console.log(`[runeval-global] stored ${messages.length} messages in thread`);

  cleanup();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
