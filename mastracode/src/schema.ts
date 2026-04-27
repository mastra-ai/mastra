import { z } from 'zod';
import { DEFAULT_OM_MODEL_ID } from './constants';

export const stateSchema = z.object({
  projectPath: z.string().optional(),
  projectName: z.string().optional(),
  gitBranch: z.string().optional(),
  lastCommand: z.string().optional(),
  currentModelId: z.string().default(''),
  // Subagent model settings (per-thread/per-mode)
  subagentModelId: z.string().optional(), // Thread-level default for subagents
  // Observational Memory model settings
  observerModelId: z.string().default(DEFAULT_OM_MODEL_ID),
  reflectorModelId: z.string().default(DEFAULT_OM_MODEL_ID),
  // Observational Memory threshold settings
  observationThreshold: z.number().default(30_000),
  reflectionThreshold: z.number().default(40_000),
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
        content: z.string(),
        status: z.enum(['pending', 'in_progress', 'completed']),
        activeForm: z.string(),
      }),
    )
    .default([]),
  // Sandbox allowed paths (per-thread, absolute paths allowed in addition to project root)
  sandboxAllowedPaths: z.array(z.string()).default([]),
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
