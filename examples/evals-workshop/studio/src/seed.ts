/**
 * Seed the Studio Evaluation dashboard.
 *
 * An empty dashboard demos nothing, and a dashboard where every run is
 * identical demos almost as little. This seeds three experiments over one
 * dataset that tell a story you can point at:
 *
 *   1. baseline    the agent as shipped
 *   2. regression  a change that quietly breaks two answers
 *   3. fix         the repair, back to baseline
 *
 * Open the dataset in Studio afterwards and the three runs line up side by
 * side: the middle one dips, the third recovers. That shape — noticing a
 * regression you did not intend — is the entire argument for evals.
 *
 * Note on determinism: this script runs `tsx` without `--env-file-if-exists`,
 * so it does NOT pick up `.env` and the agent falls back to the mock model.
 * That is deliberate — the seeded history is teaching material and should be
 * byte-identical on every machine in the room, which an LLM cannot promise.
 * The dev server does load `.env`, so live chat uses the real model. Seeded
 * history: reproducible. Live traffic: real. Both visible in one dashboard.
 *
 * Run:  pnpm seed
 */
import { SUPPORT_QA } from '@workshop/shared/data';
import { answerAccuracyScorer } from '@workshop/shared/scorers';
import { mastra, observability, supportAgent } from './mastra/index.ts';

/** Answers the way the shipped agent does. */
async function baselineTask({ input }: { input: unknown }) {
  const result = await supportAgent.generate(String(input));
  return result.text;
}

/**
 * A plausible regression: someone "improves" the agent by making it hedge, and
 * the hedging swallows the specific numbers the scorer looks for.
 */
async function regressedTask({ input }: { input: unknown }) {
  const result = await supportAgent.generate(String(input));
  const text = result.text;
  // Two of the four rows lose their fact to a vague rewrite.
  if (text.includes('15 GB') || text.includes('30 days')) {
    return 'That depends on your plan — please check your account settings for details.';
  }
  return text;
}

async function main() {
  console.log('Seeding the Evaluation dashboard…\n');

  const dataset = await mastra.datasets.create({
    name: 'nimbus-support-qa',
    description: 'Support questions with known-good answers — workshop dataset',
  });

  await dataset.addItems({
    items: SUPPORT_QA.map(item => ({
      input: item.input,
      groundTruth: item.groundTruth,
      metadata: { topic: item.id, expectedToFail: Boolean(item.expectedToFail) },
    })),
  });
  console.log(`  dataset "nimbus-support-qa" — ${SUPPORT_QA.length} items`);

  const runs = [
    { label: 'baseline', description: 'The agent as shipped', task: baselineTask },
    { label: 'regression', description: 'A hedging "improvement" that swallowed the facts', task: regressedTask },
    { label: 'fix', description: 'Hedging reverted — back to baseline', task: baselineTask },
  ];

  for (const run of runs) {
    const summary = await dataset.startExperiment({
      // Name them. Without this the Studio experiments list shows three
      // opaque uuids and the whole baseline→regression→fix story is invisible.
      name: run.label,
      description: run.description,
      scorers: [answerAccuracyScorer],
      task: run.task,
    });
    const scores = (summary.results ?? []).map((r: any) => r.scores?.[0]?.score ?? 0);
    const mean = scores.length ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0;
    console.log(
      `  experiment "${run.label.padEnd(10)}" → mean ${mean.toFixed(3)}  (${summary.succeededCount}/${summary.totalItems} ok)`,
    );
  }

  // Flush the trace spans this seed just produced. Spans export in batches and
  // this script is about to exit, so without the flush the Observability →
  // Traces view is empty on a fresh clone — silently, with no error. Doing it
  // here means the trace panel has something to show before anyone has chatted.
  await observability.shutdown();

  console.log(`
Done. Now:

  pnpm dev     # API + Studio UI, both on :4111

Then open http://localhost:4111 → Evaluation → Datasets → "nimbus-support-qa".
The three experiments are listed newest-first; the middle one is the regression.

Chat with the agent too — it is wired for live scoring, so each reply is graded
as it arrives and shows up alongside the dataset runs.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
