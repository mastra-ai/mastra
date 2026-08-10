/**
 * Exercise 6 — Datasets and experiments.
 *
 * `runEvals` is ephemeral: it scores, prints, and forgets. A dataset is the
 * durable version — a named, versioned collection of items you can re-run over
 * time and compare. Each run is an *experiment*, and experiments are what the
 * Studio Evaluation dashboard displays.
 *
 * This is the bridge between the two halves of the workshop. Everything up to
 * here printed to a terminal; from here it is stored, and exercise 8 (the
 * Studio surface) looks at it.
 *
 * Two ways to run one:
 *   targetType + targetId   the registry path — name a thing already
 *                           registered on the Mastra instance. Note it is a
 *                           type + id pair, NOT an object reference; passing
 *                           `target: agent` fails with "No task: provide
 *                           targetType+targetId or task".
 *   task: fn                an inline function — use when you need control
 *                           over the call, e.g. per-item memory (the
 *                           experiment runner does not forward memory options)
 *
 * No API key required.
 */
import { buildSupportAgent } from '@workshop/shared/agent';
import { SUPPORT_QA } from '@workshop/shared/data';
import { answerAccuracyScorer } from '@workshop/shared/scorers';

async function main() {
  const { mastra, agent, cleanup } = buildSupportAgent();

  try {
    // -------------------------------------------------------------------
    // Create a dataset and fill it. `metadata` is free-form and rides along
    // with each item — handy for slicing results later (by topic, by tier,
    // by which release introduced the row).
    // -------------------------------------------------------------------
    const dataset = await mastra.datasets.create({
      name: 'nimbus-support-qa',
      description: 'Support questions with known-good answers',
    });

    await dataset.addItems({
      items: SUPPORT_QA.map(item => ({
        input: item.input,
        groundTruth: item.groundTruth,
        metadata: {
          topic: item.id,
          expectedToFail: Boolean(item.expectedToFail),
        },
      })),
    });
    console.log(`── dataset created: ${SUPPORT_QA.length} items ──`);

    // -------------------------------------------------------------------
    // a) Registry path: point the experiment at the agent.
    // -------------------------------------------------------------------
    console.log('\n── a) startExperiment({ targetType, targetId }) ──');
    const viaTarget = await dataset.startExperiment({
      targetType: 'agent',
      targetId: 'support-agent', // the key it was registered under
      scorers: [answerAccuracyScorer],
    });
    summarize(viaTarget);

    // -------------------------------------------------------------------
    // b) Inline task: you make the call yourself.
    //
    // The task receives each item, including its `metadata`, so anything the
    // runner will not pass for you (memory options, request context, a
    // different model per row) you can do here.
    // -------------------------------------------------------------------
    console.log('\n── b) startExperiment({ task }) ──');
    const viaTask = await dataset.startExperiment({
      scorers: [answerAccuracyScorer],
      task: async ({ input, metadata }) => {
        if (typeof input !== 'string') throw new Error('expected a string input');
        // Per-item control lives here — this is where memory options would go.
        const result = await agent.generate(input, {
          memory: { thread: `ds-${(metadata as any)?.topic ?? 'item'}`, resource: 'workshop-user' },
        });
        return result.text;
      },
    });
    summarize(viaTask);

    console.log(
      '\n  Same dataset, same scorer, two execution paths, same scores.\n' +
        '  Each run is a separate experiment — that is what makes them comparable\n' +
        '  over time, and what the Studio dashboard charts.',
    );
  } finally {
    cleanup();
  }
}

function summarize(summary: any) {
  console.log(`  experimentId : ${summary.experimentId}`);
  console.log(`  status       : ${summary.status}`);
  console.log(`  succeeded    : ${summary.succeededCount}/${summary.totalItems}`);
  for (const r of summary.results ?? []) {
    const score = r.scores?.[0]?.score;
    const flag = score === 1 ? ' ' : '←';
    console.log(`    ${flag} ${String(r.input).slice(0, 46).padEnd(48)} score=${score}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
