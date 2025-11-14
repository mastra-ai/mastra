import { z } from 'zod';
import { QuestionSchema, TaskSchema } from '../shared/schema';
import {
  ProjectDiscoveryResultSchema,
  WorkflowResearchResultSchema,
  DiscoveredWorkflowSchema,
} from '../workflow-builder/schema';

export const PlanningIterationInputSchema = z.object({
  action: z.enum(['create', 'edit']),
  workflowName: z.string().optional(),
  description: z.string().optional(),
  requirements: z.string().optional(),
  discoveredWorkflows: z.array(DiscoveredWorkflowSchema),
  projectStructure: ProjectDiscoveryResultSchema,
  research: WorkflowResearchResultSchema,

  userAnswers: z.record(z.string()).optional(),
});

export const PlanningIterationSuspendSchema = z.object({
  questions: QuestionSchema,
  message: z.string(),
  currentPlan: z.object({
    tasks: TaskSchema,
    reasoning: z.string(),
  }),
});

export const PlanningIterationResumeSchema = z.object({
  answers: z.record(z.string()),
});

export const PlanningAgentOutputSchema = z.object({
  tasks: TaskSchema,
  questions: QuestionSchema.optional(),
  reasoning: z.string().describe('Explanation of the plan and any questions'),
  planComplete: z.boolean().describe('Whether the plan is ready for execution (no more questions)'),
});

export const TaskApprovalOutputSchema = z.object({
  approved: z.boolean(),
  tasks: TaskSchema,
  message: z.string(),
  userFeedback: z.string().optional(),
});

export const TaskApprovalSuspendSchema = z.object({
  taskList: TaskSchema,
  summary: z.string(),
  message: z.string(),
});

export const TaskApprovalResumeSchema = z.object({
  approved: z.boolean(),
  modifications: z.string().optional(),
});
