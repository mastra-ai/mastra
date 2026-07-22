import { z } from 'zod';
import { DEFAULT_CONFIG_DIR, DEFAULT_OM_MODEL_ID } from './constants.js';

export type PermissionPolicy = 'allow' | 'ask' | 'deny';

export type MastraCodeSessionState = {
  currentModelId: string;
  modeId: string;
};

export type MastraCodeComposedState = MastraCodeState & MastraCodeSessionState;

export interface MastraCodeState {
  [key: string]: unknown;
  [key: `subagentModelId_${string}`]: string | undefined;
  subagentModelId?: string;
  projectPath?: string;
  projectName?: string;
  /** Factory project that owns this session. */
  factoryProjectId?: string;
  /** Factory tenant that owns a server-managed global session. */
  factoryOrgId?: string;
  /** Marks the canonical Factory supervisor session (`'true'` is the persisted thread tag form). */
  factorySupervisor?: boolean | 'true';
  /** Linked repository used by this session when source-control execution is required. */
  projectRepositoryId?: string;
  /** Persisted sandbox id for reattaching the project's cloud workspace. */
  sandboxId?: string;
  /** Path inside the sandbox the repo is cloned into. */
  sandboxWorkdir?: string;
  /** Active git worktree path inside the sandbox for the current unit of work. */
  worktreePath?: string;
  /** Active feature branch checked out in the worktree. */
  branch?: string;
  configDir: string;
  homeDir?: string;
  gitBranch?: string;
  lastCommand?: string;
  observerModelId: string;
  reflectorModelId: string;
  observationThreshold: number;
  reflectionThreshold: number;
  cavemanObservations: boolean;
  observeAttachments: 'auto' | boolean;
  omScope?: 'thread' | 'resource';
  thinkingLevel: 'off' | 'low' | 'medium' | 'high' | 'xhigh';
  yolo: boolean;
  permissionRules: {
    categories: Record<string, PermissionPolicy>;
    tools: Record<string, PermissionPolicy>;
  };
  smartEditing: boolean;
  notifications: 'bell' | 'system' | 'both' | 'off';
  tasks: Array<{
    id?: string;
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
    activeForm: string;
  }>;
  sandboxAllowedPaths: string[];
  pluginSkillPaths: string[];
  pluginCommandPaths: string[];
  pluginInstructions: string[];
  activePlan: {
    title: string;
    plan: string;
    approvedAt: string;
  } | null;
  activeBrowserSettings?: {
    enabled: boolean;
    provider: 'stagehand' | 'agent-browser';
    headless?: boolean;
    viewport?: {
      width: number;
      height: number;
    };
    cdpUrl?: string;
    stagehand?: {
      env: 'LOCAL' | 'BROWSERBASE';
      apiKey?: string;
      projectId?: string;
    };
  };
}

export const stateSchema = z.object({
  // Session-scoped selection.
  // validates state against this schema, so they MUST be declared here — Zod
  // strips unknown keys on parse, which would otherwise silently discard the
  // seeded model and leave the controller with no model selected.
  currentModelId: z.string().optional(),
  modeId: z.string().optional(),
  subagentModelId: z.string().optional(),
  projectPath: z.string().optional(),
  projectName: z.string().optional(),
  factoryProjectId: z.string().optional(),
  factoryOrgId: z.string().optional(),
  factorySupervisor: z.union([z.boolean(), z.literal('true')]).optional(),
  projectRepositoryId: z.string().optional(),
  sandboxId: z.string().optional(),
  sandboxWorkdir: z.string().optional(),
  worktreePath: z.string().optional(),
  branch: z.string().optional(),
  configDir: z.string().default(DEFAULT_CONFIG_DIR),
  homeDir: z.string().optional(),
  gitBranch: z.string().optional(),
  lastCommand: z.string().optional(),
  // Observational Memory model settings
  observerModelId: z.string().default(DEFAULT_OM_MODEL_ID),
  reflectorModelId: z.string().default(DEFAULT_OM_MODEL_ID),
  // Observational Memory threshold settings
  observationThreshold: z.number().default(30_000),
  reflectionThreshold: z.number().default(40_000),
  // Whether observations and reflections use the terse caveman-style instruction.
  // Off by default — caveman style is opt-in via `/om` settings; observers and
  // reflectors fall back to their built-in (prose) behavior unless enabled.
  cavemanObservations: z.boolean().default(false),
  // Whether OM forwards image/file attachment parts to the Observer LLM.
  // 'auto' (default) checks the provider capabilities registry to decide.
  // true/false forces the setting regardless of model capabilities.
  observeAttachments: z.union([z.literal('auto'), z.boolean()]).default('auto'),
  // Observational Memory scope — 'thread' (per-conversation) or 'resource' (shared across threads)
  omScope: z.enum(['thread', 'resource']).optional(),
  // Thinking level for model reasoning effort
  thinkingLevel: z.enum(['off', 'low', 'medium', 'high', 'xhigh']).default('off'),
  // YOLO mode — auto-approve all tool calls
  yolo: z.boolean().default(false),
  // Permission rules — per-category and per-tool approval policies
  permissionRules: z
    .object({
      categories: z.record(z.string(), z.enum(['allow', 'ask', 'deny'])).default({}),
      tools: z.record(z.string(), z.enum(['allow', 'ask', 'deny'])).default({}),
    })
    .default({ categories: {}, tools: {} }),
  // Smart editing mode — use AST-based analysis for code edits
  smartEditing: z.boolean().default(true),
  // Notification mode — alert when TUI needs user attention
  notifications: z.enum(['bell', 'system', 'both', 'off']).default('off'),
  // Task list (ephemeral per-thread, cleared on thread switch/creation)
  tasks: z
    .array(
      z.object({
        id: z.string().optional(),
        content: z.string(),
        status: z.enum(['pending', 'in_progress', 'completed']),
        activeForm: z.string(),
      }),
    )
    .default([]),
  // Sandbox allowed paths (per-thread, absolute paths allowed in addition to project root)
  sandboxAllowedPaths: z.array(z.string()).default([]),
  // Asset directories contributed by active plugins.
  pluginSkillPaths: z.array(z.string()).default([]),
  pluginCommandPaths: z.array(z.string()).default([]),
  pluginInstructions: z.array(z.string()).default([]),
  // Active plan (set when a plan is approved in Plan mode)
  activePlan: z
    .object({
      title: z.string(),
      plan: z.string(),
      approvedAt: z.string(),
    })
    .nullable()
    .default(null),
  // Active browser settings (tracks what's actually running vs. what's in the settings file)
  activeBrowserSettings: z
    .object({
      enabled: z.boolean(),
      provider: z.enum(['stagehand', 'agent-browser']),
      headless: z.boolean().optional(),
      viewport: z
        .object({
          width: z.number(),
          height: z.number(),
        })
        .optional(),
      cdpUrl: z.string().optional(),
      stagehand: z
        .object({
          env: z.enum(['LOCAL', 'BROWSERBASE']),
          apiKey: z.string().optional(),
          projectId: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});
