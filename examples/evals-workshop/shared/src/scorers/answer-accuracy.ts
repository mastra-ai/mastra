/**
 * A custom scorer written with the full four-step pipeline.
 *
 *   preprocess → analyze → generateScore → generateReason
 *
 * All four steps here are plain functions, so this scorer is deterministic,
 * free, and instant — the kind you can afford to run on every commit. The same
 * four slots accept a prompt object instead of a function, which is how an LLM
 * judge is built (see `support-rubric.ts`). Learning the shape once gets you
 * both.
 *
 * Splitting the work across steps is not ceremony: each step's output is stored
 * and surfaced separately in Studio, so when a score is surprising you can see
 * which step went wrong instead of re-deriving it from a single number.
 */
import { createScorer } from '@mastra/core/evals';

/**
 * Pull plain text out of whatever the caller handed us.
 *
 * Worth knowing, because it trips everyone up the first time: calling a scorer
 * directly gives you the string you passed in, but `runEvals` hands scorers the
 * agent's `MastraDBMessage[]`, where each message's `content` is an object
 * (`{ format, parts, content }`) rather than a string. A scorer that only
 * handles strings silently scores 0 on every row instead of failing loudly.
 */
export function extractText(output: unknown): string {
  if (output == null) return '';
  if (typeof output === 'string') return output;

  if (Array.isArray(output)) {
    return output.map(extractText).filter(Boolean).join(' ');
  }

  if (typeof output === 'object') {
    const o = output as Record<string, any>;

    // MastraDBMessage: { role, content: { parts, content } }
    if (o.content !== undefined) return extractText(o.content);
    // MastraMessageContentV2: { format, parts: [...], content: '...' }
    if (Array.isArray(o.parts)) return extractText(o.parts);
    // A single text part, or an object that simply carries text.
    if (typeof o.text === 'string') return o.text;

    return '';
  }

  return String(output);
}

const REFUSAL_MARKERS = ["i don't have information", 'i do not have information', "i'm not sure", 'i cannot answer'];

export const answerAccuracyScorer = createScorer({
  id: 'answer-accuracy',
  name: 'Answer Accuracy',
  description: 'Did the answer state the expected fact, honestly decline, or get it wrong?',
})
  // 1. Normalize. Cheap text wrangling belongs here, not inside the scoring
  //    logic, so the scoring step stays readable.
  .preprocess(({ run }) => {
    const text = extractText(run.output).toLowerCase().replace(/\s+/g, ' ').trim();
    const expected = String(run.groundTruth ?? '')
      .toLowerCase()
      .trim();
    return { text, expected };
  })
  // 2. Decide *what is true* about the output, without deciding what it is worth.
  .analyze(({ results }) => {
    const { text, expected } = results.preprocessStepResult;
    return {
      statedFact: expected.length > 0 && text.includes(expected),
      refused: REFUSAL_MARKERS.some(m => text.includes(m)),
      empty: text.length === 0,
    };
  })
  // 3. Turn those observations into a number. Keeping this step trivial is the
  //    goal — if scoring needs branching logic, it belongs in analyze.
  .generateScore(({ results }) => {
    const { statedFact, refused, empty } = results.analyzeStepResult;
    if (statedFact) return 1;
    // An honest "I don't know" is worth more than a confident wrong answer.
    if (refused) return 0.5;
    if (empty) return 0;
    return 0;
  })
  // 4. Explain the number. This is what makes a red row in Studio actionable
  //    instead of merely alarming.
  .generateReason(({ results, score }) => {
    const { expected } = results.preprocessStepResult;
    const { statedFact, refused, empty } = results.analyzeStepResult;
    if (statedFact) return `Scored ${score}: the answer stated the expected fact ("${expected}").`;
    if (refused) return `Scored ${score}: the agent declined to answer instead of stating "${expected}".`;
    if (empty) return `Scored ${score}: the agent produced no output.`;
    return `Scored ${score}: the answer never mentioned "${expected}" and did not decline.`;
  });
