import { z } from 'zod';

export const TaskSchema = z.array(
  z.object({
    id: z.string().describe('Unique task ID using kebab-case'),
    content: z.string().describe('Specific, actionable task description'),
    status: z.enum(['pending', 'in_progress', 'completed', 'blocked']).default('pending'),
    priority: z.enum(['high', 'medium', 'low']).describe('Task priority'),
    dependencies: z.array(z.string()).optional().describe('IDs of tasks this depends on'),
    notes: z.string().describe('Detailed implementation notes and specifics'),
  }),
);

export const QuestionSchema = z.array(
  z.object({
    id: z.string().describe('Unique question ID'),
    question: z.string().describe('Clear, specific question for the user'),
    type: z.enum(['choice', 'text', 'boolean']).describe('Type of answer expected'),
    options: z.array(z.string()).optional().describe('Options for choice questions'),
    context: z.string().optional().describe('Additional context or explanation'),
  }),
);
export const PlanningIterationResultSchema = z.object({
  success: z.boolean(),
  tasks: TaskSchema,
  questions: QuestionSchema,
  reasoning: z.string(),
  planComplete: z.boolean(),
  message: z.string(),
  error: z.string().optional(),
  allPreviousQuestions: z.array(z.any()).optional(),
  allPreviousAnswers: z.record(z.string()).optional(),
});
