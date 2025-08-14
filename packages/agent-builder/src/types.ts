import type { MastraLanguageModel, ToolsInput } from '@mastra/core/agent';
import { z } from 'zod';

/**
 * Configuration options for the AgentBuilder
 */
export interface AgentBuilderConfig {
  /** The language model to use for agent generation */
  model: MastraLanguageModel;
  /** Storage provider for memory (required) */
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

// Types for the merge template workflow
export interface TemplateUnit {
  kind: 'agent' | 'workflow' | 'tool' | 'mcp-server' | 'network';
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
  kind: z.enum(['agent', 'workflow', 'tool', 'mcp-server', 'network']),
  id: z.string(),
  file: z.string(),
});

export const TemplateManifestSchema = z.object({
  slug: z.string(),
  ref: z.string().optional(),
  description: z.string().optional(),
  units: z.array(TemplateUnitSchema),
});

export const MergeInputSchema = z.object({
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

export const ApplyResultSchema = z.object({
  success: z.boolean(),
  applied: z.boolean(),
  branchName: z.string().optional(),
  error: z.string().optional(),
});
