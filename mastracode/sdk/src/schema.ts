import { z } from 'zod';
import { DEFAULT_CONFIG_DIR, DEFAULT_OM_MODEL_ID } from './constants.js';
import { THINKING_LEVEL_VALUES } from './thinking.js';
import type { ThinkingLevelSetting } from './thinking.js';

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
  /** Authoritative organization id seeded by factory at session construction. */
  factoryOrgId?: string;
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
  /**
   * The session's checkout contains third-party content (e.g. a PR branch
   * under review). Project-level instruction files (AGENTS.md, CLAUDE.md)
   * are attacker-writable there and must not be ingested into the system
   * prompt or injected as reminders.
   */
  untrustedCheckout?: boolean;
  /**
   * Trusted git ref (typically the PR's base branch) to serve project
   * instruction files from when the checkout is untrusted. Without it,
   * project-scope instruction files are skipped entirely.
   */
  baseRef?: string;
  /**
   * Skip the home-directory instruction files (~/.claude/AGENTS.md and
   * friends). Hosts running sessions for someone else set this so a run never
   * inherits the machine owner's personal configuration.
   */
  skipGlobalInstructions?: boolean;
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
  /**
   * Session-level reasoning-effort override. When unset, the effective level is
   * resolved at request time from settings (`models.modeThinkingDefaults[mode]`
   * falling back to `preferences.thinkingLevel`).
   */
  thinkingLevel?: ThinkingLevelSetting;
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
    viewport?: { width: number; height: number } | 'window';
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
  projectRepositoryId: z.string().optional(),
  sandboxId: z.string().optional(),
  sandboxWorkdir: z.string().optional(),
  worktreePath: z.string().optional(),
  branch: z.string().optional(),
  // Session operates on an untrusted checkout — suppress AGENTS.md ingestion.
  untrustedCheckout: z.boolean().optional(),
  // Trusted ref to serve instruction files from on untrusted checkouts.
  baseRef: z.string().optional(),
  // Skip the operator machine's home-directory instruction files.
  skipGlobalInstructions: z.boolean().optional(),
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
  // Thinking level for model reasoning effort. Optional: absent means "no
  // session override" — the effective level is resolved from settings
  // (per-mode defaults, then the global preference) at request time.
  thinkingLevel: z.preprocess(value => (value === null ? undefined : value), z.enum(THINKING_LEVEL_VALUES).optional()),
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
        .union([
          z.object({
            width: z.number(),
            height: z.number(),
          }),
          z.literal('window'),
        ])
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
