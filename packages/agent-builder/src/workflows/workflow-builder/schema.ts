import { z } from 'zod';
import { PlanningIterationResultSchema, QuestionSchema, TaskSchema } from '../shared/schema';

// Workflow Builder schemas and types
export const WorkflowBuilderInputSchema = z.object({
  workflowName: z.string().optional().describe('Name of the workflow to create or edit'),
  action: z.enum(['create', 'edit']).describe('Action to perform: create new or edit existing workflow'),
  description: z.string().optional().describe('Description of what the workflow should do'),
  requirements: z.string().optional().describe('Detailed requirements for the workflow'),
  projectPath: z.string().optional().describe('Path to the Mastra project (defaults to current directory)'),
});

export const DiscoveredWorkflowSchema = z.object({
  name: z.string(),
  file: z.string(),
  description: z.string().optional(),
  inputSchema: z.any().optional(),
  outputSchema: z.any().optional(),
  steps: z.array(z.string()).optional(),
});

export const WorkflowDiscoveryResultSchema = z.object({
  success: z.boolean(),
  workflows: z.array(DiscoveredWorkflowSchema),
  mastraIndexExists: z.boolean(),
  message: z.string(),
  error: z.string().optional(),
});

export const ProjectDiscoveryResultSchema = z.object({
  success: z.boolean(),
  structure: z.object({
    hasWorkflowsDir: z.boolean(),
    hasAgentsDir: z.boolean(),
    hasToolsDir: z.boolean(),
    hasMastraIndex: z.boolean(),
    existingWorkflows: z.array(z.string()),
    existingAgents: z.array(z.string()),
    existingTools: z.array(z.string()),
  }),
  dependencies: z.record(z.string()),
  message: z.string(),
  error: z.string().optional(),
});

export const WorkflowResearchResultSchema = z.object({
  success: z.boolean(),
  documentation: z.object({
    workflowPatterns: z.array(z.string()),
    stepExamples: z.array(z.string()),
    bestPractices: z.array(z.string()),
  }),
  webResources: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      snippet: z.string(),
      relevance: z.number(),
    }),
  ),
  message: z.string(),
  error: z.string().optional(),
});

export const TaskManagementResultSchema = z.object({
  success: z.boolean(),
  tasks: TaskSchema,
  message: z.string(),
  error: z.string().optional(),
});

export const TaskExecutionInputSchema = z.object({
  action: z.enum(['create', 'edit']),
  workflowName: z.string().optional(),
  description: z.string().optional(),
  requirements: z.string().optional(),
  tasks: TaskSchema,
  discoveredWorkflows: z.array(z.any()),
  projectStructure: z.any(),
  research: z.any(),
  projectPath: z.string().optional(),
});

export const TaskExecutionSuspendSchema = z.object({
  questions: QuestionSchema,
  currentProgress: z.string(),
  completedTasks: z.array(z.string()),
  message: z.string(),
});

export const TaskExecutionResumeSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string(),
      answer: z.string(),
    }),
  ),
});

export const TaskExecutionResultSchema = z.object({
  success: z.boolean(),
  filesModified: z.array(z.string()),
  validationResults: z.object({
    passed: z.boolean(),
    errors: z.array(z.string()),
    warnings: z.array(z.string()),
  }),
  completedTasks: z.array(z.string()),
  message: z.string(),
  error: z.string().optional(),
});

export const UserClarificationInputSchema = z.object({
  questions: QuestionSchema,
});

export const UserClarificationResultSchema = z.object({
  answers: z.record(z.string()),
  hasAnswers: z.boolean(),
});

export const WorkflowBuilderResultSchema = z.object({
  success: z.boolean(),
  action: z.enum(['create', 'edit']),
  workflowName: z.string().optional(),
  workflowFile: z.string().optional(),
  discovery: WorkflowDiscoveryResultSchema.optional(),
  projectStructure: ProjectDiscoveryResultSchema.optional(),
  research: WorkflowResearchResultSchema.optional(),
  planning: PlanningIterationResultSchema.optional(),
  taskManagement: TaskManagementResultSchema.optional(),
  execution: TaskExecutionResultSchema.optional(),
  needsUserInput: z.boolean().optional(),
  questions: QuestionSchema.optional(),
  message: z.string(),
  nextSteps: z.array(z.string()).optional(),
  error: z.string().optional(),
});

export const TaskExecutionIterationInputSchema = (taskLength: number) =>
  z.object({
    status: z
      .enum(['in_progress', 'completed', 'needs_clarification'])
      .describe('Status - only use "completed" when ALL remaining tasks are finished'),
    progress: z.string().describe('Current progress description'),
    completedTasks: z
      .array(z.string())
      .describe('List of ALL completed task IDs (including previously completed ones)'),
    totalTasksRequired: z.number().describe(`Total number of tasks that must be completed (should be ${taskLength})`),
    tasksRemaining: z.array(z.string()).describe('List of task IDs that still need to be completed'),
    filesModified: z
      .array(z.string())
      .describe('List of files that were created or modified - use these exact paths for validateCode tool'),
    questions: QuestionSchema.optional().describe('Questions for user if clarification is needed'),
    message: z.string().describe('Summary of work completed or current status'),
    error: z.string().optional().describe('Any errors encountered'),
  });
