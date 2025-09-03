import type { MastraLanguageModel, ToolsInput } from '@mastra/core/agent';
import type { MastraStorage } from '@mastra/core/storage';
import type { MastraVector } from '@mastra/core/vector';
import { z } from 'zod';

/**
 * Configuration options for the AgentBuilder
 */
export interface AgentBuilderConfig {
  /** The language model to use for agent generation */
  model: MastraLanguageModel;
  /** Storage provider for memory (optional) */
  storage?: MastraStorage;
  /** Vector provider for memory (optional) */
  vectorProvider?: MastraVector;
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
    kind: z.enum(UNIT_KINDS),
    id: z.string(),
  }),
});

export const ConflictSchema = z.object({
  unit: z.object({
    kind: z.enum(UNIT_KINDS),
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
    kind: z.enum(UNIT_KINDS),
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
