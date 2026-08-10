/**
 * The same four-step pipeline, but with an LLM doing the judging.
 *
 * Note that the steps are mixed: `preprocess` and `generateScore` are plain
 * functions, only `analyze` and `generateReason` call the model. There is no
 * reason to spend a model call on string extraction or on dividing two numbers,
 * and each avoided call is latency and money saved on every row of every
 * dataset. Reach for the model only where judgement is actually required.
 *
 * Requires OPENAI_API_KEY. Unlike `answer-accuracy`, this scorer is *not*
 * deterministic — two runs on the same input can disagree. That is the reason
 * judges grade quality trends rather than gate merges.
 */
import { createScorer } from '@mastra/core/evals';
import { z } from 'zod';
import { JUDGE_MODEL } from '../models.ts';
import { extractText } from './answer-accuracy.ts';

/**
 * Worth discussing in class: this rubric penalises extra information as
 * "invented", because the judge only sees `groundTruth` and cannot tell true
 * additions from fabrications.
 *
 * Run it on "The Nimbus Free plan includes 15 GB of storage and syncs up to 3
 * devices." with groundTruth "15 GB" and it scores 0.667 — ACCURATE fails,
 * reasoning that the device count "was not part of the expected fact". The
 * device count is true and sits in the knowledge base; the judge just has no
 * way to know that.
 *
 * That is a judge-design bug, not a model failure, and the fix is a design
 * choice you have to make deliberately: widen what the judge sees (pass the
 * full documentation), or narrow the criterion (grade "contradicts the
 * expected fact" rather than "invents nothing"). Either is defensible. What
 * is not defensible is shipping the rubric without noticing which one you
 * picked.
 */
const CRITERIA = [
  'ACCURATE: the answer conveys the expected fact and invents nothing.',
  'CONCISE: the answer is at most two sentences and has no filler.',
  'ON_TOPIC: the answer addresses the question that was actually asked.',
] as const;

const analyzeSchema = z.object({
  verdicts: z
    .array(
      z.object({
        criterion: z.string().describe('The criterion being judged'),
        satisfied: z.boolean().describe('Whether the answer satisfies it'),
        reasoning: z.string().describe('One sentence justifying the verdict'),
      }),
    )
    .describe('One entry per criterion, in the order given'),
});

export const supportRubricScorer = createScorer({
  id: 'support-rubric',
  name: 'Support Rubric (LLM judge)',
  description: 'Grades a support answer on accuracy, concision, and topicality',
  judge: {
    model: JUDGE_MODEL,
    instructions: `You grade customer-support answers. You are strict but fair.
Judge only what is in front of you — never assume facts that are not in the
documentation provided. Answer with the requested structure and nothing else.`,
  },
})
  // Plain function: no model call needed to pull strings out of a payload.
  //
  // Anchoring on `groundTruth` rather than a retrieved-context field is
  // deliberate. `groundTruth` is carried by every eval path — runEvals data
  // items, dataset items, and live scoring — so this one scorer works
  // unchanged in all three. Per-item retrieved context is *not* on
  // `RunEvalsDataItem`, which is why the prebuilt RAG scorers
  // (faithfulness, context-*) take their context at construction time
  // instead; exercise 2 shows that path.
  .preprocess(({ run }) => ({
    question: extractText(run.input),
    answer: extractText(run.output),
    expectedFact: String(run.groundTruth ?? '(none given)'),
  }))
  // Model call: this is the part that genuinely needs judgement.
  .analyze({
    description: 'Judge the answer against each rubric criterion',
    outputSchema: analyzeSchema,
    createPrompt: ({ results }) => {
      const { question, answer, expectedFact } = results.preprocessStepResult;
      return `Expected fact the answer should convey: ${expectedFact}

Question: ${question}

Answer: ${answer}

Judge the answer against each criterion below. Return one verdict per criterion,
in this order:
${CRITERIA.map((c, i) => `${i + 1}. ${c}`).join('\n')}`;
    },
  })
  // Plain function again: arithmetic does not need a model.
  .generateScore(({ results }) => {
    const verdicts = results.analyzeStepResult?.verdicts ?? [];
    if (verdicts.length === 0) return 0;
    return verdicts.filter((v: { satisfied: boolean }) => v.satisfied).length / verdicts.length;
  })
  // Model call: turn the verdicts into something a human wants to read.
  .generateReason({
    description: 'Summarise the grading for a human reviewer',
    createPrompt: ({ results, score }) => {
      const verdicts = results.analyzeStepResult?.verdicts ?? [];
      return `The answer scored ${score}. The per-criterion verdicts were:
${verdicts.map((v: any) => `- ${v.criterion}: ${v.satisfied ? 'PASS' : 'FAIL'} — ${v.reasoning}`).join('\n')}

Write two sentences for the reviewer: what the answer did well, and the single
most important thing to fix. If everything passed, say so and stop.`;
    },
  });
