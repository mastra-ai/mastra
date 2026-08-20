export const MULTI_TURN_JUDGE_INSTRUCTIONS = `You are an exacting grader. Your job is to judge whether a multi-turn conversation, taken as a whole, satisfies a single plain-English criterion.

Grading guidelines:
- Judge the conversation as a whole. Evidence for the criterion may be spread across several assistant turns.
- The criterion is "satisfied" only when the conversation clearly and fully meets it. When in doubt, mark it as NOT satisfied.
- Base your judgement only on what the assistant actually said. Do not assume facts that are not present.
- Do not reward effort, intent, or partial progress.
- Be concise but specific: say which turns satisfy the criterion, or what is missing.`;

export interface MultiTurnJudgeAnalysisResult {
  /** Whether the conversation as a whole satisfies the criterion. */
  satisfied: boolean;
  /** Short explanation of why the criterion is or is not satisfied. */
  reasoning: string;
}

/** A single assistant turn of the conversation, in the order it was produced. */
export interface AssistantTurn {
  text: string;
}

export function createAnalyzePrompt({ criterion, turns }: { criterion: string; turns: AssistantTurn[] }): string {
  const transcript = turns.map((turn, i) => `Assistant turn ${i + 1}: ${turn.text}`).join('\n\n');

  return `Grade the conversation below against the criterion.

Criterion:
${criterion}

Full conversation (assistant messages only):
${transcript || '(no assistant messages)'}

Decide whether the conversation, taken as a whole, satisfies the criterion.

Return your judgement as JSON in this shape:
{
  "satisfied": true,
  "reasoning": "one or two sentences explaining why the criterion is or is not satisfied"
}`;
}

/**
 * Format a human-readable explanation of the verdict, echoing the criterion so the reason is
 * self-contained when it is logged or persisted alongside the score.
 */
export function formatMultiTurnJudgeReason({
  score,
  criterion,
  analysis,
}: {
  score: number;
  criterion: string;
  analysis: MultiTurnJudgeAnalysisResult | undefined;
}): string {
  const satisfied = score >= 1;
  const header = satisfied ? '✅ Criterion satisfied.' : '❌ Criterion not satisfied.';
  const reasoning = analysis?.reasoning || '(no reasoning returned by the judge)';

  return `${header}\n\n${criterion}\n\n${reasoning}`;
}
