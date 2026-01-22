import { z } from 'zod';

/**
 * Default prompt template for creating LLM-as-judge scorers.
 * Contains template variables that will be replaced at evaluation time:
 * - {{minScore}}: Minimum score from scoreRange
 * - {{maxScore}}: Maximum score from scoreRange
 * - {{input}}: The input to the evaluated agent/tool
 * - {{output}}: The output from the evaluated agent/tool
 */
export const DEFAULT_PROMPT_TEMPLATE = `You are an expert evaluator assessing the quality of an AI assistant's response.

## Evaluation Criteria
- Relevance: Does the response address the user's question?
- Accuracy: Is the information provided correct?
- Completeness: Does the response fully answer the question?
- Clarity: Is the response easy to understand?

## Scoring Guidelines
- {{maxScore}}: Excellent - Fully addresses all criteria
- 0.75: Good - Addresses most criteria with minor issues
- 0.5: Fair - Partially addresses criteria, some gaps
- 0.25: Poor - Significant issues or missing information
- {{minScore}}: Unacceptable - Does not address the question

## Your Task
Evaluate the response and provide a score between {{minScore}} and {{maxScore}}.

Input: {{input}}
Response: {{output}}

Provide only the numeric score.`;

/**
 * Zod schema for scorer form validation.
 * Validates all required fields for creating or updating a stored scorer.
 */
export const scorerFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
  model: z.object({
    provider: z.string().min(1, 'Provider is required'),
    name: z.string().min(1, 'Model is required'),
    toolChoice: z.string().optional(),
    reasoningEffort: z.string().optional(),
  }),
  prompt: z.string().min(1, 'Prompt is required'),
  scoreRange: z
    .object({
      min: z.number().default(0),
      max: z.number().default(1),
    })
    .refine(data => data.min < data.max, {
      message: 'Minimum score must be less than maximum score',
      path: ['min'],
    }),
  metadata: z.record(z.string(), z.unknown()).optional(),
  ownerId: z.string().optional(),
});

/**
 * TypeScript type inferred from the Zod schema.
 * Represents the shape of the scorer form values.
 */
export type ScorerFormValues = z.infer<typeof scorerFormSchema>;

/**
 * Default values for the scorer form.
 * Used when creating a new scorer.
 */
export const defaultScorerFormValues: ScorerFormValues = {
  name: '',
  description: '',
  model: {
    provider: '',
    name: '',
  },
  prompt: DEFAULT_PROMPT_TEMPLATE,
  scoreRange: {
    min: 0,
    max: 1,
  },
};
