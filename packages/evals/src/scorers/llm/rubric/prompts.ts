export const RUBRIC_INSTRUCTIONS = `You are an exacting grader. Your job is to judge whether an agent's output satisfies each criterion in a rubric.

A rubric is a checklist of criteria. For each criterion you must decide, strictly and independently, whether the output satisfies it.

Grading guidelines:
- Judge each criterion on its own merits. Do not let one criterion's verdict influence another.
- A criterion is "satisfied" only when the output clearly and fully meets it. When in doubt, mark it as NOT satisfied.
- Base your judgement on evidence in the output (and the original task for context). Do not assume facts that are not present.
- Be concise but specific in your reasoning: say what is present or missing.
- Do not reward effort, intent, or partial progress. Only the actual output counts.`;

export interface RubricAnalysisCriterion {
  /** The criterion text, exactly as provided in the rubric. */
  criterion: string;
  /** Whether the output satisfies this criterion. */
  satisfied: boolean;
  /** Whether this criterion is required for the task to be considered complete. */
  required: boolean;
  /** Short explanation of why the criterion is or is not satisfied. */
  reasoning: string;
}

export interface RubricAnalysisResult {
  criteria: RubricAnalysisCriterion[];
  overallAssessment: string;
}

/**
 * A single rubric criterion as provided to the prompt builder.
 */
export interface RubricCriterionInput {
  criterion: string;
  required: boolean;
}

export function createAnalyzePrompt({
  originalTask,
  output,
  criteria,
}: {
  originalTask: string;
  output: string;
  criteria: RubricCriterionInput[];
}): string {
  const renderedCriteria = criteria
    .map((c, i) => `${i + 1}. [${c.required ? 'required' : 'optional'}] ${c.criterion}`)
    .join('\n');

  return `Grade the agent's output against the rubric below.

Original task:
${originalTask || '(no task provided)'}

Rubric criteria:
${renderedCriteria}

Agent output to grade:
${output || '(empty output)'}

For every criterion, decide whether the output satisfies it. Preserve the exact criterion text and its required/optional designation in your answer.

Return your judgement as JSON in this shape:
{
  "criteria": [
    {
      "criterion": "exact criterion text",
      "satisfied": true,
      "required": true,
      "reasoning": "why it is or is not satisfied"
    }
  ],
  "overallAssessment": "one or two sentence summary of what passed and what is missing"
}`;
}

/**
 * Format a human-readable, per-criterion explanation of the rubric result. This text is what
 * `isTaskComplete` injects back into the conversation as feedback, so it must clearly tell the
 * agent which criteria are unmet and why.
 */
export function formatRubricReason({
  score,
  analysis,
}: {
  score: number;
  analysis: RubricAnalysisResult;
}): string {
  const complete = score >= 1;
  const header = complete
    ? '✅ Rubric satisfied: every required criterion is met.'
    : '❌ Rubric not yet satisfied.';

  const lines = analysis.criteria.map(c => {
    const mark = c.satisfied ? '✅' : '❌';
    const tag = c.required ? 'required' : 'optional';
    return `${mark} [${tag}] ${c.criterion}\n   → ${c.reasoning}`;
  });

  const unmetRequired = analysis.criteria.filter(c => c.required && !c.satisfied);
  const footer = complete
    ? ''
    : `\n\nTo finish, address the ${unmetRequired.length} unmet required ${
        unmetRequired.length === 1 ? 'criterion' : 'criteria'
      } above.`;

  const assessment = analysis.overallAssessment ? `\n\n${analysis.overallAssessment}` : '';

  return `${header}\n\n${lines.join('\n')}${assessment}${footer}`;
}
