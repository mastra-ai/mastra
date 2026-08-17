/**
 * Exercise 8 — Comparing two experiments, and the CI gate that actually works.
 *
 * Exercise 6 stored experiments. This one answers the question storing them was
 * for: *did the thing I just changed make the agent worse?*
 *
 * Up to now the workshop has compared runs by printing numbers and looking at
 * them. That does not scale past a demo, and it is not something CI can do.
 * `compareExperiments` is the real version: give it two experiment IDs and it
 * returns per-scorer deltas, per-item diffs, and a single `hasRegression`
 * boolean you can exit on.
 *
 * Three things in here are worth more than the API surface:
 *
 *   1. Thresholds have a DIRECTION. Not every metric improves by going up.
 *   2. It warns when the two runs used different dataset versions — comparing
 *      those is meaningless, and it is the mistake everyone makes eventually.
 *   3. `hasRegression` is the CI signal. Exercise 3's gates catch *absolute*
 *      failure ("this answer is toxic"); this catches *relative* failure
 *      ("this is worse than last week"), which is the one that actually ships.
 *
 * No API key required.
 */
import { compareExperiments } from '@mastra/core/datasets';
import { buildSupportAgent } from '@workshop/shared/agent';
import { SUPPORT_QA } from '@workshop/shared/data';
import { answerAccuracyScorer } from '@workshop/shared/scorers';

async function main() {
  const { mastra, agent, cleanup } = buildSupportAgent();

  try {
    const dataset = await mastra.datasets.create({
      name: 'nimbus-support-qa',
      description: 'Support questions with known-good answers',
    });

    await dataset.addItems({
      items: SUPPORT_QA.map(item => ({
        input: item.input,
        groundTruth: item.groundTruth,
        metadata: { topic: item.id },
      })),
    });

    // -------------------------------------------------------------------
    // Two runs of the same dataset. The candidate has a plausible-looking
    // change in it: someone made the agent hedge more, and the hedging ate
    // the specific numbers the scorer is looking for. This is what a real
    // regression looks like — nobody sets out to break the agent.
    // -------------------------------------------------------------------
    const ask = async (input: unknown) => (await agent.generate(String(input))).text;

    console.log('── running baseline ──');
    const baseline = await dataset.startExperiment({
      name: 'baseline',
      scorers: [answerAccuracyScorer],
      task: async ({ input }) => ask(input),
    });

    console.log('── running candidate ──');
    const candidate = await dataset.startExperiment({
      name: 'candidate',
      scorers: [answerAccuracyScorer],
      task: async ({ input }) => {
        const text = await ask(input);
        if (text.includes('15 GB') || text.includes('30 days')) {
          return 'That depends on your plan — please check your account settings.';
        }
        return text;
      },
    });

    // -------------------------------------------------------------------
    // The comparison.
    //
    // `thresholds` is keyed by scorer id. `value` is how much movement you
    // tolerate before calling it a regression, and `direction` says which way
    // is good. `lower-is-better` exists because plenty of things you score are
    // costs, not qualities — latency, token count, number of tool calls, hedge
    // words per answer. Defaulting everything to higher-is-better would
    // silently invert those.
    // -------------------------------------------------------------------
    const result = await compareExperiments(mastra, {
      experimentIdA: baseline.experimentId,
      experimentIdB: candidate.experimentId,
      thresholds: {
        'answer-accuracy': { value: 0.05, direction: 'higher-is-better' },
      },
    });

    console.log('\n── per-scorer ──');
    for (const [scorerId, cmp] of Object.entries(result.scorers)) {
      const delta = cmp.delta >= 0 ? `+${cmp.delta.toFixed(3)}` : cmp.delta.toFixed(3);
      console.log(
        `  ${scorerId.padEnd(18)} ${cmp.statsA.avgScore.toFixed(3)} → ${cmp.statsB.avgScore.toFixed(3)}` +
          `  (${delta})  ${cmp.regressed ? 'REGRESSED' : 'ok'}`,
      );
    }

    // Per-item diffs are how you find *which* rows moved. An average that
    // slips 0.2 could be every row sagging slightly or one row falling off a
    // cliff, and those call for completely different responses.
    // `items` is keyed by item id, which is a uuid — readable to a database and
    // to nobody else. The experiment summary carries the inputs, so join them.
    const questionById = new Map(baseline.results.map(r => [r.itemId, String(r.input)]));

    console.log('\n── per-item ──');
    for (const item of result.items) {
      const a = item.scoresA['answer-accuracy'];
      const b = item.scoresB['answer-accuracy'];
      if (a === b) continue;
      const question = questionById.get(item.itemId) ?? item.itemId;
      console.log(`  ${fmt(a)} → ${fmt(b)}   ${question.slice(0, 52)}`);
    }

    for (const warning of result.warnings) console.log(`\n  warning: ${warning}`);

    // -------------------------------------------------------------------
    // The CI gate. One boolean.
    //
    // Note this is a different check from exercise 3. A gate there asks "is
    // this output acceptable at all". This asks "is this build worse than the
    // last one" — and a build can be entirely free of gate failures while
    // still being a clear regression.
    //
    // Real CI would `process.exit(1)` here. This script does not, so that
    // `pnpm ex:all` can run to completion.
    // -------------------------------------------------------------------
    console.log(`\n  hasRegression: ${result.hasRegression}`);
    console.log(`  CI would exit ${result.hasRegression ? 1 : 0}`);

    // -------------------------------------------------------------------
    // The trap, demonstrated.
    //
    // Editing the dataset creates a new version (exercise 9 covers this).
    // Compare a run from before the edit against one from after and the two
    // numbers are not measuring the same thing — different questions were
    // asked. `compareExperiments` notices and says so rather than handing you
    // a confident, meaningless delta.
    // -------------------------------------------------------------------
    console.log('\n── comparing across a dataset edit ──');
    await dataset.addItems({
      items: [{ input: 'Can I change my plan mid-month?', groundTruth: 'at any time', metadata: { topic: 'plan' } }],
    });

    const afterEdit = await dataset.startExperiment({
      name: 'after-edit',
      scorers: [answerAccuracyScorer],
      task: async ({ input }) => ask(input),
    });

    const crossVersion = await compareExperiments(mastra, {
      experimentIdA: baseline.experimentId,
      experimentIdB: afterEdit.experimentId,
    });

    console.log(`  baseline ran on dataset version ${crossVersion.experimentA.datasetVersion}`);
    console.log(`  after-edit ran on dataset version ${crossVersion.experimentB.datasetVersion}`);
    console.log(`  versionMismatch: ${crossVersion.versionMismatch}`);
    for (const warning of crossVersion.warnings) console.log(`  warning: ${warning}`);
    console.log(
      '\n  It still returns a delta — the mismatch is a warning, not an error.\n' +
        '  Treating it as one in CI is your job, and worth doing: an unnoticed\n' +
        '  dataset edit is indistinguishable from a model regression otherwise.',
    );
  } finally {
    cleanup();
  }
}

function fmt(value: number | null): string {
  return value === null ? '  —  ' : value.toFixed(3);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
