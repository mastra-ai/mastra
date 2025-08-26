import type { MastraLanguageModel, ToolsInput } from '@mastra/core/agent';
import { z } from 'zod';

/**
 * Configuration options for the AgentBuilder
 */
export interface AgentBuilderConfig {
  /** The language model to use for agent generation */
  model: MastraLanguageModel;
  /** Storage provider for memory (optional) */
  storage?: any;
  /** Vector provider for memory (optional) */
  vectorProvider?: any;
  /** Additional tools to include beyond the default set */
  tools?: ToolsInput;
  /** Custom instructions to append to the default system prompt */
  instructions?: string;
  /** Memory configuration options */
  memoryConfig?: {
    maxMessages?: number;
    tokenLimit?: number;
  };
  /** Project path */
  projectPath: string;
  /** Summary model */
  summaryModel?: MastraLanguageModel;
  /** Mode */
  mode?: 'template' | 'code-editor';
}

/**
 * Options for generating agents with AgentBuilder
 */
export interface GenerateAgentOptions {
  /** Runtime context for the generation */
  runtimeContext?: any;
  /** Output format preference */
  outputFormat?: 'code' | 'explanation' | 'both';
}

/**
 * Project management action types
 */
export type ProjectAction = 'create' | 'install' | 'upgrade' | 'check';

/**
 * Project types that can be created
 */
export type ProjectType = 'standalone' | 'api' | 'nextjs';

/**
 * Package manager options
 */
export type PackageManager = 'npm' | 'pnpm' | 'yarn';

/**
 * Validation types for code validation
 */
export type ValidationType = 'types' | 'schemas' | 'tests' | 'integration';

// Processing order for units (lower index = higher priority)
export const UNIT_KINDS = ['mcp-server', 'tool', 'workflow', 'agent', 'integration', 'network', 'other'] as const;

// Types for the merge template workflow
export type UnitKind = (typeof UNIT_KINDS)[number];

export interface TemplateUnit {
  kind: UnitKind;
  id: string;
  file: string;
}

export interface TemplateManifest {
  slug: string;
  ref?: string;
  description?: string;
  units: TemplateUnit[];
}

export interface MergePlan {
  slug: string;
  commitSha: string;
  templateDir: string;
  units: TemplateUnit[];
}

// Schema definitions
export const TemplateUnitSchema = z.object({
  kind: z.enum(UNIT_KINDS),
  id: z.string(),
  file: z.string(),
});

export const TemplateManifestSchema = z.object({
  slug: z.string(),
  ref: z.string().optional(),
  description: z.string().optional(),
  units: z.array(TemplateUnitSchema),
});

export const AgentBuilderInputSchema = z.object({
  repo: z.string().describe('Git URL or local path of the template repo'),
  ref: z.string().optional().describe('Tag/branch/commit to checkout (defaults to main/master)'),
  slug: z.string().optional().describe('Slug for branch/scripts; defaults to inferred from repo'),
  targetPath: z.string().optional().describe('Project path to merge into; defaults to current directory'),
});

export const MergePlanSchema = z.object({
  slug: z.string(),
  commitSha: z.string(),
  templateDir: z.string(),
  units: z.array(TemplateUnitSchema),
});

// File copy schemas and types
export const CopiedFileSchema = z.object({
  source: z.string(),
  destination: z.string(),
  unit: z.object({
    kind: z.string(),
    id: z.string(),
  }),
});

export const ConflictSchema = z.object({
  unit: z.object({
    kind: z.string(),
    id: z.string(),
  }),
  issue: z.string(),
  sourceFile: z.string(),
  targetFile: z.string(),
});

export const FileCopyInputSchema = z.object({
  orderedUnits: z.array(TemplateUnitSchema),
  templateDir: z.string(),
  commitSha: z.string(),
  slug: z.string(),
  targetPath: z.string().optional(),
});

export const FileCopyResultSchema = z.object({
  success: z.boolean(),
  copiedFiles: z.array(CopiedFileSchema),
  conflicts: z.array(ConflictSchema),
  message: z.string(),
  error: z.string().optional(),
});

// Intelligent merge schemas and types
export const ConflictResolutionSchema = z.object({
  unit: z.object({
    kind: z.string(),
    id: z.string(),
  }),
  issue: z.string(),
  resolution: z.string(),
});

export const IntelligentMergeInputSchema = z.object({
  conflicts: z.array(ConflictSchema),
  copiedFiles: z.array(CopiedFileSchema),
  templateDir: z.string(),
  commitSha: z.string(),
  slug: z.string(),
  targetPath: z.string().optional(),
  branchName: z.string().optional(),
});

export const IntelligentMergeResultSchema = z.object({
  success: z.boolean(),
  applied: z.boolean(),
  message: z.string(),
  conflictsResolved: z.array(ConflictResolutionSchema),
  error: z.string().optional(),
});

// Validation schemas and types
export const ValidationResultsSchema = z.object({
  valid: z.boolean(),
  errorsFixed: z.number(),
  remainingErrors: z.number(),
});

export const ValidationFixInputSchema = z.object({
  commitSha: z.string(),
  slug: z.string(),
  targetPath: z.string().optional(),
  templateDir: z.string(),
  orderedUnits: z.array(TemplateUnitSchema),
  copiedFiles: z.array(CopiedFileSchema),
  conflictsResolved: z.array(ConflictResolutionSchema).optional(),
  maxIterations: z.number().optional().default(5),
});

export const ValidationFixResultSchema = z.object({
  success: z.boolean(),
  applied: z.boolean(),
  message: z.string(),
  validationResults: ValidationResultsSchema,
  error: z.string().optional(),
});

// Final workflow result schema
export const ApplyResultSchema = z.object({
  success: z.boolean(),
  applied: z.boolean(),
  branchName: z.string().optional(),
  message: z.string(),
  validationResults: ValidationResultsSchema.optional(),
  error: z.string().optional(),
  errors: z.array(z.string()).optional(),
  stepResults: z
    .object({
      cloneSuccess: z.boolean().optional(),
      analyzeSuccess: z.boolean().optional(),
      discoverSuccess: z.boolean().optional(),
      orderSuccess: z.boolean().optional(),
      prepareBranchSuccess: z.boolean().optional(),
      packageMergeSuccess: z.boolean().optional(),
      installSuccess: z.boolean().optional(),
      copySuccess: z.boolean().optional(),
      mergeSuccess: z.boolean().optional(),
      validationSuccess: z.boolean().optional(),
      filesCopied: z.number(),
      conflictsSkipped: z.number(),
      conflictsResolved: z.number(),
    })
    .optional(),
});

export const CloneTemplateResultSchema = z.object({
  templateDir: z.string(),
  commitSha: z.string(),
  slug: z.string(),
  success: z.boolean().optional(),
  error: z.string().optional(),
});

// Package analysis schemas and types
export const PackageAnalysisSchema = z.object({
  name: z.string().optional(),
  version: z.string().optional(),
  description: z.string().optional(),
  dependencies: z.record(z.string()).optional(),
  devDependencies: z.record(z.string()).optional(),
  peerDependencies: z.record(z.string()).optional(),
  scripts: z.record(z.string()).optional(),
  success: z.boolean().optional(),
  error: z.string().optional(),
});

// Discovery step schemas and types
export const DiscoveryResultSchema = z.object({
  units: z.array(TemplateUnitSchema),
  success: z.boolean().optional(),
  error: z.string().optional(),
});

// Unit ordering schemas and types
export const OrderedUnitsSchema = z.object({
  orderedUnits: z.array(TemplateUnitSchema),
  success: z.boolean().optional(),
  error: z.string().optional(),
});

// Package merge schemas and types
export const PackageMergeInputSchema = z.object({
  commitSha: z.string(),
  slug: z.string(),
  targetPath: z.string().optional(),
  packageInfo: PackageAnalysisSchema,
});

export const PackageMergeResultSchema = z.object({
  success: z.boolean(),
  applied: z.boolean(),
  message: z.string(),
  error: z.string().optional(),
});

// Install schemas and types
export const InstallInputSchema = z.object({
  targetPath: z.string().describe('Path to the project to install packages in'),
});

export const InstallResultSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
});

export const PrepareBranchInputSchema = z.object({
  slug: z.string(),
  commitSha: z.string().optional(), // from clone-template if relevant
  targetPath: z.string().optional(),
});

export const PrepareBranchResultSchema = z.object({
  branchName: z.string(),
  success: z.boolean().optional(),
  error: z.string().optional(),
});

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
  tasks: z.array(
    z.object({
      id: z.string(),
      content: z.string(),
      status: z.enum(['pending', 'in_progress', 'completed', 'blocked']),
      priority: z.enum(['high', 'medium', 'low']),
      dependencies: z.array(z.string()).optional(),
      notes: z.string().optional(),
    }),
  ),
  message: z.string(),
  error: z.string().optional(),
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

// Planning iteration schemas
export const PlanningIterationInputSchema = z.object({
  action: z.enum(['create', 'edit']),
  workflowName: z.string().optional(),
  description: z.string().optional(),
  requirements: z.string().optional(),
  discoveredWorkflows: z.array(DiscoveredWorkflowSchema),
  projectStructure: ProjectDiscoveryResultSchema,
  research: WorkflowResearchResultSchema,
  previousPlan: z
    .object({
      tasks: z.array(
        z.object({
          id: z.string(),
          content: z.string(),
          status: z.enum(['pending', 'in_progress', 'completed', 'blocked']),
          priority: z.enum(['high', 'medium', 'low']),
          dependencies: z.array(z.string()).optional(),
          notes: z.string().optional(),
        }),
      ),
      questions: z.array(z.string()),
      reasoning: z.string(),
    })
    .optional(),
  userAnswers: z.record(z.string()).optional(),
  allPreviousQuestions: z
    .array(
      z.object({
        id: z.string(),
        question: z.string(),
        type: z.enum(['choice', 'text', 'boolean']),
        options: z.array(z.string()).optional(),
        context: z.string().optional(),
      }),
    )
    .optional(),
  allPreviousAnswers: z.record(z.string()).optional(),
});

export const PlanningIterationResultSchema = z.object({
  success: z.boolean(),
  tasks: z.array(
    z.object({
      id: z.string(),
      content: z.string(),
      status: z.enum(['pending', 'in_progress', 'completed', 'blocked']),
      priority: z.enum(['high', 'medium', 'low']),
      dependencies: z.array(z.string()).optional(),
      notes: z.string().optional(),
    }),
  ),
  questions: z.array(
    z.object({
      id: z.string(),
      question: z.string(),
      type: z.enum(['choice', 'text', 'boolean']),
      options: z.array(z.string()).optional(),
      context: z.string().optional(),
    }),
  ),
  reasoning: z.string(),
  planComplete: z.boolean(),
  message: z.string(),
  error: z.string().optional(),
  allPreviousQuestions: z
    .array(
      z.object({
        id: z.string(),
        question: z.string(),
        type: z.enum(['choice', 'text', 'boolean']),
        options: z.array(z.string()).optional(),
        context: z.string().optional(),
      }),
    )
    .optional(),
  allPreviousAnswers: z.record(z.string()).optional(),
});

export const UserClarificationInputSchema = z.object({
  questions: z.array(
    z.object({
      id: z.string(),
      question: z.string(),
      type: z.enum(['choice', 'text', 'boolean']),
      options: z.array(z.string()).optional(),
      context: z.string().optional(),
    }),
  ),
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
  questions: z
    .array(
      z.object({
        id: z.string(),
        question: z.string(),
        type: z.enum(['choice', 'text', 'boolean']),
        options: z.array(z.string()).optional(),
        context: z.string().optional(),
      }),
    )
    .optional(),
  message: z.string(),
  nextSteps: z.array(z.string()).optional(),
  error: z.string().optional(),
});
