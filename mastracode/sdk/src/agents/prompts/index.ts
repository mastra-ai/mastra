/**
 * Prompt system — exports the prompt builder and mode-specific prompts.
 */

export { buildModePrompt, buildModePromptFn } from './build.js';
export { planModePrompt } from './plan.js';
export { fastModePrompt } from './fast.js';

import { buildBasePrompt } from '@mastra/core/coding-agent';
import type { PromptContext as BasePromptContext } from '@mastra/core/coding-agent';
import { hasTavilyKey } from '../../tools/index.js';
import { getLocalPlansRelativeDir } from '../../utils/plans.js';
import { loadAgentInstructions, formatAgentInstructions, createGitRefInstructionReader } from './agent-instructions.js';
import { buildModePromptFn } from './build.js';
import { fastModePrompt } from './fast.js';
import { modelSpecificPrompts } from './model.js';
import { planModePrompt } from './plan.js';
import { buildToolGuidance } from './tool-guidance.js';

// Extended prompt context that includes runtime information
export interface PromptContext extends Omit<BasePromptContext, 'toolGuidance'> {
  modeId: string;
  state?: any;
  currentDate: string;
  workingDir: string;
}

const modePrompts: Record<string, string | ((ctx: PromptContext) => string)> = {
  build: buildModePromptFn,
  plan: planModePrompt,
  fast: fastModePrompt,
};

/**
 * Build the full system prompt for a given mode and context.
 * Combines the base prompt with mode-specific instructions.
 */
export function buildFullPrompt(ctx: PromptContext): string {
  // Determine whether web search tools are available
  const modelId = ctx.modelId;
  const hasWebSearch = hasTavilyKey() || (!!modelId && modelId.startsWith('anthropic/'));

  // Collect per-tool deny rules so guidance omits denied tools
  const deniedTools = new Set<string>();
  const permRules = ctx.state?.permissionRules as { tools?: Record<string, string> } | undefined;
  if (permRules?.tools) {
    for (const [name, policy] of Object.entries(permRules.tools)) {
      if (policy === 'deny') deniedTools.add(name);
    }
  }

  // Build mode-aware tool guidance
  const factoryProjectId = typeof ctx.state?.factoryProjectId === 'string' ? ctx.state.factoryProjectId : undefined;
  const toolGuidance = buildToolGuidance(ctx.modeId, {
    hasWebSearch,
    deniedTools,
    plansDir: getLocalPlansRelativeDir({ factoryProjectId }),
  });

  // Map new context to base context
  const baseCtx: BasePromptContext = {
    projectPath: ctx.workingDir || '(no workspace attached)',
    projectName: ctx.projectName || 'unknown',
    gitBranch: ctx.gitBranch,
    platform: process.platform,
    commonBinaries: ctx.commonBinaries,
    date: ctx.currentDate,
    mode: ctx.modeId,
    modelId: ctx.modelId,
    activePlan: ctx.state?.activePlan,
    toolGuidance,
  };

  const base = buildBasePrompt(baseCtx);
  const entry = modePrompts[ctx.modeId] || modePrompts.build;
  const modeSpecific = (typeof entry === 'function' ? entry(ctx) : entry) ?? '';
  const modelSpecific = ctx.modelId
    ? (modelSpecificPrompts[ctx.modelId as keyof typeof modelSpecificPrompts] ?? '')
    : '';

  // The current task list is carried on the agent state-signal lane (see
  // TaskStateProcessor) rather than injected into the cached system prompt. This
  // keeps the prompt prefix stable across task updates (preserving prompt cache)
  // while still surviving observational-memory truncation.

  // Load and inject agent instructions from AGENTS.md/CLAUDE.md files.
  // Untrusted checkouts (e.g. a PR branch under review) never read
  // project-scope files off the working tree: their AGENTS.md is
  // attacker-writable and would otherwise land in the system prompt as
  // trusted configuration. When the session carries a trusted base ref, the
  // project instructions are served from that ref instead (`git show`);
  // without one, project-scope files are skipped entirely. Home-directory
  // (global) instructions belong to whoever owns the machine, so hosts that
  // run sessions for someone else opt out of them entirely.
  const configDir = ctx.state?.configDir as string | undefined;
  const untrustedCheckout = ctx.state?.untrustedCheckout === true;
  const skipGlobalInstructions = ctx.state?.skipGlobalInstructions === true;
  const baseRef = typeof ctx.state?.baseRef === 'string' ? ctx.state.baseRef : undefined;
  const projectReader = untrustedCheckout
    ? baseRef
      ? createGitRefInstructionReader(ctx.workingDir, baseRef)
      : { exists: () => false, read: () => '' }
    : undefined;
  // No working directory means a hosted session with no project attached:
  // load NO instruction files at all — project locations would resolve
  // against the server's own cwd, and global locations against the server's
  // homedir. Neither belongs in a hosted session's prompt.
  const instructionSources = ctx.workingDir
    ? loadAgentInstructions(ctx.workingDir, configDir, projectReader, {
        skipGlobal: skipGlobalInstructions,
      })
    : [];
  const instructionsSection = formatAgentInstructions(instructionSources);

  const sections = [base, instructionsSection.trim(), modelSpecific.trim(), modeSpecific.trim()].filter(Boolean);

  return sections.join('\n\n');
}
