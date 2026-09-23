/**
 * Exercise 2 — Don't write scorers you don't have to.
 *
 * Mastra ships 23 of them in `@mastra/evals/scorers/prebuilt`, split along the
 * line that should shape your whole strategy:
 *
 *   CODE (8)   deterministic, free, milliseconds, no API key.
 *              completeness · content-similarity · keyword-coverage ·
 *              textual-difference · tone · tool-call-accuracy · trajectory ·
 *              checks
 *
 *   LLM (15)   a model grades the output. Non-deterministic, costs money,
 *              takes seconds.
 *              answer-relevancy · answer-similarity · bias · faithfulness ·
 *              hallucination · noise-sensitivity · prompt-alignment · rubric ·
 *              summarization · toxicity · tool-call-accuracy · trajectory ·
 *              context-precision · context-recall · context-relevance
 *
 * Rule of thumb: code scorers gate merges, LLM judges track quality.
 *
 * One gotcha shown below: most prebuilt scorers are declared `type: 'agent'`,
 * meaning they read `run.input.inputMessages` and a `MastraDBMessage[]` output.
 * They are built to run against an agent through `runEvals` — hand them bare
 * strings via `scorer.run()` and they will score 0 rather than complain.
 *
 * The LLM half needs OPENAI_API_KEY and skips cleanly without it.
 */
import { runEvals } from '@mastra/core/evals';
import { buildSupportAgent } from '@workshop/shared/agent';
import { SUPPORT_QA } from '@workshop/shared/data';
import { hasApiKey } from '@workshop/shared/models';
import {
  answerRelevancy,
  completeness,
  faithfulnessFor,
  keywordCoverage,
  tone,
  toxicity,
} from '@workshop/shared/scorers';

async function main() {
  const data = SUPPORT_QA.map(item => ({ input: item.input, groundTruth: item.groundTruth }));

  // -------------------------------------------------------------------
  // a) Code scorers. No key, deterministic, fast enough to run on every commit.
  // -------------------------------------------------------------------
  console.log('── a) code scorers (no API key) ──');
  {
    const { agent, cleanup } = buildSupportAgent({
      scorers: {
        'keyword-coverage-scorer': keywordCoverage,
        'completeness-scorer': completeness,
        'tone-scorer': tone,
      },
    });
    try {
      const started = Date.now();
      const result = await runEvals({
        target: agent,
        scorers: [keywordCoverage, completeness, tone],
        data,
      });
      console.log(`  scores: ${JSON.stringify(result.scores, null, 2)}`);
      console.log(`  took  : ${Date.now() - started}ms for ${result.summary.totalItems} items × 3 scorers`);
    } finally {
      cleanup();
    }
  }

  // -------------------------------------------------------------------
  // b) LLM judges. Real model calls — slower, non-deterministic, and the
  //    reason they belong on sampled traffic rather than in a merge gate.
  // -------------------------------------------------------------------
  console.log('\n── b) LLM judges (needs OPENAI_API_KEY) ──');
  if (!hasApiKey()) {
    console.log('  SKIPPED — set OPENAI_API_KEY to run this section.');
    console.log('  Everything above ran without one; that is the point of the split.');
    return;
  }

  {
    const { agent, cleanup } = buildSupportAgent({
      scorers: {
        'answer-relevancy-scorer': answerRelevancy,
        'toxicity-scorer': toxicity,
      },
    });
    try {
      const started = Date.now();
      const result = await runEvals({
        target: agent,
        scorers: [answerRelevancy, toxicity],
        data,
      });
      console.log(`  scores: ${JSON.stringify(result.scores, null, 2)}`);
      console.log(`  took  : ${Date.now() - started}ms — compare with the code scorers above`);
    } finally {
      cleanup();
    }
  }

  // -------------------------------------------------------------------
  // c) The RAG scorers, and the shape that surprises people.
  //
  // faithfulness / context-precision / context-recall / context-relevance
  // grade an answer against retrieved passages. That context is given at
  // CONSTRUCTION time, not per data item — `RunEvalsDataItem` has no context
  // field. So when each row has its own passages, build a scorer per row.
  // -------------------------------------------------------------------
  console.log('\n── c) RAG scorers — context is per-scorer, not per-item ──');
  {
    const item = SUPPORT_QA[0]!;
    const { agent, cleanup } = buildSupportAgent({
      scorers: { 'faithfulness-scorer': faithfulnessFor(item.context) },
    });
    try {
      const result = await runEvals({
        target: agent,
        scorers: [faithfulnessFor(item.context)],
        data: [{ input: item.input, groundTruth: item.groundTruth }],
      });
      console.log(`  question: ${item.input}`);
      console.log(`  context : ${item.context.length} passage(s) fixed at construction`);
      console.log(`  scores  : ${JSON.stringify(result.scores)}`);
    } finally {
      cleanup();
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
