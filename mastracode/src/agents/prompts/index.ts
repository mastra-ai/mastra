/**
 * Prompt system — exports the prompt builder and mode-specific prompts.
 */

export { buildModePrompt, buildModePromptFn } from './build.js';
export { planModePrompt } from './plan.js';
export { fastModePrompt } from './fast.js';

import { buildBasePrompt } from '@mastra/core/coding-agent';
import type { PromptContext as BasePromptContext } from '@mastra/core/coding-agent';
import { hasTavilyKey } from '../../tools/index.js';
import { loadAgentInstructions, formatAgentInstructions } from './agent-instructions.js';
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
  const toolGuidance = buildToolGuidance(ctx.modeId, { hasWebSearch, deniedTools });

  // Map new context to base context
  const baseCtx: BasePromptContext = {
    projectPath: ctx.workingDir,
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

  // Load and inject agent instructions from AGENTS.md/CLAUDE.md files
  const configDir = ctx.state?.configDir as string | undefined;
  const instructionSources = loadAgentInstructions(ctx.workingDir, configDir);
  const instructionsSection = formatAgentInstructions(instructionSources);

  const sections = [base, instructionsSection.trim(), modelSpecific.trim(), modeSpecific.trim()].filter(Boolean);

  return sections.join('\n\n');
}
