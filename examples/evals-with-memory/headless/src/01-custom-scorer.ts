/**
 * Exercise 1 — Write a scorer.
 *
 * A scorer is a function from (input, output, groundTruth) to a number in
 * [0, 1], built as four named steps. Run it two ways:
 *
 *   a) directly with `scorer.run(...)`  — the unit-test shape, no agent needed
 *   b) through `runEvals(...)`          — against a real agent over a dataset
 *
 * (a) is how you develop a scorer. (b) is how you use it.
 *
 * No API key required.
 */
import { runEvals } from '@mastra/core/evals';
import { buildSupportAgent } from '@workshop/shared/agent';
import { SUPPORT_QA } from '@workshop/shared/data';
import { answerAccuracyScorer } from '@workshop/shared/scorers';

async function main() {
  // ---------------------------------------------------------------------
  // a) Run the scorer on its own. No agent, no model, no network — just the
  //    grading logic. Develop scorers here; it is a fast feedback loop.
  // ---------------------------------------------------------------------
  console.log('── a) scorer.run() directly ──');

  const cases = [
    { label: 'correct', output: 'The Free plan includes 15 GB of storage.', groundTruth: '15 GB' },
    { label: 'honest refusal', output: "I don't have information about that.", groundTruth: '15 GB' },
    { label: 'confidently wrong', output: 'The Free plan includes 500 GB of storage.', groundTruth: '15 GB' },
  ];

  for (const c of cases) {
    const result = await answerAccuracyScorer.run({
      input: 'How much storage do I get on the free plan?',
      output: c.output,
      groundTruth: c.groundTruth,
    });
    console.log(`  ${c.label.padEnd(20)} score=${result.score}`);
    console.log(`  ${''.padEnd(20)} reason: ${result.reason}`);
  }

  // Note the middle case: an honest "I don't know" scores 0.5, above a
  // confident wrong answer at 0. Scorers encode product judgement, not just
  // string matching — decide deliberately what partial credit means.

  // ---------------------------------------------------------------------
  // b) Same scorer, now grading a real agent across the dataset.
  // ---------------------------------------------------------------------
  console.log('\n── b) same scorer through runEvals() ──');

  const { agent, cleanup } = buildSupportAgent();
  try {
    const result = await runEvals({
      target: agent,
      scorers: [answerAccuracyScorer],
      data: SUPPORT_QA.map(item => ({
        input: item.input,
        groundTruth: item.groundTruth,
      })),
    });

    console.log('  scores:', JSON.stringify(result.scores));
    console.log('  items :', result.summary.totalItems);
    console.log(
      `\n  Not 1.0 — item "${SUPPORT_QA.find(i => i.expectedToFail)?.id}" is wrong on purpose.` +
        '\n  A dataset where everything passes cannot show you what failure looks like.',
    );
  } finally {
    cleanup();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
