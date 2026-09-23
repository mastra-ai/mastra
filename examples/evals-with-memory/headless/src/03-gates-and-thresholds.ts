/**
 * Exercise 3 — Make evals block a bad merge.
 *
 * A dashboard nobody looks at changes nothing. What makes evals matter is a
 * non-zero exit code. Two mechanisms, and the difference between them is the
 * whole lesson:
 *
 *   gates       must score exactly 1.0. Binary, non-negotiable. Use for
 *               correctness invariants — "never leaks another customer's
 *               data", "always emits valid JSON".
 *   thresholds  a scorer plus a minimum (or a {min, max} band). Use for
 *               quality that degrades gradually — "relevance stays above 0.7".
 *
 * Together they produce `verdict`, and its exact semantics matter more than
 * they look (see core/src/evals/run/index.ts, "Determine verdict"):
 *
 *   'failed'  a GATE failed
 *   'scored'  every gate passed but a THRESHOLD was missed
 *   'passed'  everything satisfied
 *
 * ⚠ Read that again: a missed threshold does NOT produce 'failed'. A CI job
 * written as `if (verdict === 'failed') exit(1)` will happily merge a run
 * whose quality thresholds all regressed. Check `thresholdResults` explicitly,
 * or express the requirement as a gate. The last section does it correctly.
 *
 * No API key required.
 */
import { createScorer, runEvals } from '@mastra/core/evals';
import { buildSupportAgent } from '@workshop/shared/agent';
import { SUPPORT_QA } from '@workshop/shared/data';
import { answerAccuracyScorer, extractText } from '@workshop/shared/scorers';

/**
 * A gate: an invariant that must hold on every single row.
 *
 * Gates should be cheap and unambiguous. This one asserts the agent never
 * invents a competitor's name — the kind of thing where "usually fine" is not
 * an acceptable answer.
 */
const noCompetitorMentions = createScorer({
  id: 'no-competitor-mentions',
  name: 'No Competitor Mentions',
  description: 'Fails if the answer names a competing product',
}).generateScore(({ run }) => {
  const text = extractText(run.output).toLowerCase();
  const competitors = ['dropbox', 'google drive', 'onedrive', 'icloud'];
  return competitors.some(c => text.includes(c)) ? 0 : 1;
});

async function main() {
  const { agent, cleanup } = buildSupportAgent({
    scorers: { 'no-competitor-mentions': noCompetitorMentions },
  });
  const data = SUPPORT_QA.map(item => ({ input: item.input, groundTruth: item.groundTruth }));

  try {
    // -------------------------------------------------------------------
    // A gate that holds. Verdict: passed.
    // -------------------------------------------------------------------
    console.log('── gate that holds ──');
    const passing = await runEvals({
      target: agent,
      gates: [noCompetitorMentions],
      data,
    });
    console.log(`  verdict: ${passing.verdict}`);
    console.log(`  gates  : ${JSON.stringify(passing.gateResults)}`);

    // -------------------------------------------------------------------
    // A threshold the agent cannot meet. Verdict: failed.
    //
    // answer-accuracy averages 0.875 on this dataset (one row is wrong on
    // purpose), so a 0.9 minimum fails — deliberately, to show what CI sees.
    // -------------------------------------------------------------------
    console.log('\n── threshold set too high ──');
    const failing = await runEvals({
      target: agent,
      scorers: [{ scorer: answerAccuracyScorer, threshold: 0.9 }],
      data,
    });
    console.log(`  verdict   : ${failing.verdict}   ← NOT "failed"!`);
    console.log(`  thresholds: ${JSON.stringify(failing.thresholdResults)}`);
    console.log('  The threshold was missed (passed: false) yet the verdict is "scored".');
    console.log('  Only gates produce "failed". This is the trap worth remembering.');

    // -------------------------------------------------------------------
    // A gate that genuinely fails, for contrast — this one *does* produce
    // verdict 'failed'.
    // -------------------------------------------------------------------
    console.log('\n── gate that fails ──');
    const impossibleGate = createScorer({
      id: 'always-fails',
      name: 'Always Fails',
      description: 'Stand-in for a violated invariant',
    }).generateScore(() => 0);

    const gateFailed = await runEvals({
      target: agent,
      gates: [impossibleGate],
      data,
    });
    console.log(`  verdict: ${gateFailed.verdict}`);
    console.log(`  gates  : ${JSON.stringify(gateFailed.gateResults)}`);

    // -------------------------------------------------------------------
    // A realistic bar the agent clears. Note {min, max}: an upper bound is
    // how you catch a scorer that is suspiciously perfect — a toxicity
    // scorer pinned at exactly 0 usually means it never ran.
    // -------------------------------------------------------------------
    console.log('\n── realistic threshold ──');
    const realistic = await runEvals({
      target: agent,
      gates: [noCompetitorMentions],
      scorers: [{ scorer: answerAccuracyScorer, threshold: { min: 0.8, max: 1 } }],
      data,
    });
    console.log(`  verdict: ${realistic.verdict}`);

    // -------------------------------------------------------------------
    // This is the whole point: turn the outcome into an exit code —
    // correctly, covering both gates and thresholds.
    // -------------------------------------------------------------------
    console.log('\n── what CI should do ──');

    function shouldBlockMerge(result: {
      verdict?: string;
      thresholdResults?: Array<{ passed: boolean }>;
    }): boolean {
      // Gates failing is unambiguous.
      if (result.verdict === 'failed') return true;
      // Thresholds have to be checked by hand — 'scored' hides them.
      return (result.thresholdResults ?? []).some(t => !t.passed);
    }

    for (const [label, result] of [
      ['realistic run', realistic],
      ['threshold missed', failing],
      ['gate failed', gateFailed],
    ] as const) {
      const block = shouldBlockMerge(result);
      console.log(
        `  ${label.padEnd(18)} verdict=${String(result.verdict).padEnd(7)} → exit(${block ? 1 : 0})${
          block ? '  BLOCKED' : ''
        }`,
      );
    }
    console.log('\n  Note the middle row: verdict "scored", but the merge is still blocked.');
  } finally {
    cleanup();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
