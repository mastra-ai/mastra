/**
 * Prompt system — exports the prompt builder and mode-specific prompts.
 */

export { buildModePrompt, buildModePromptFn } from './build.js';
export { planModePrompt } from './plan.js';
export { fastModePrompt } from './fast.js';

import { buildBasePrompt } from '@mastra/core/coding-agent';
import type { PromptContext as BasePromptContext } from '@mastra/core/coding-agent';
import { loadSettings, resolveLspSetting } from '../../onboarding/settings.js';
import { MC_TOOLS } from '../../tool-names.js';
import { hasParallelKey, hasTavilyKey } from '../../tools/index.js';
import { getLocalPlansRelativeDir } from '../../utils/plans.js';
import {
  loadAgentInstructions,
  formatInstructionSource,
  createGitRefInstructionReader,
  AGENT_INSTRUCTIONS_HEADING,
} from './agent-instructions.js';
import { buildModePromptFn } from './build.js';
import { fastModePrompt } from './fast.js';
import { modelSpecificPrompts } from './model.js';
import { planModePrompt } from './plan.js';
import { buildToolGuidance } from './tool-guidance.js';

// Extended prompt context that includes runtime information
export interface PromptContext extends Omit<BasePromptContext, 'toolGuidance'> {
  modeId: string;
  state?: any;
  hostInstructions?: string;
  currentDate: string;
  workingDir: string;
}

const modePrompts: Record<string, string | ((ctx: PromptContext) => string)> = {
  build: buildModePromptFn,
  plan: planModePrompt,
  fast: fastModePrompt,
};

/**
 * One labeled piece of the assembled system prompt.
 *
 * The system prompt is a single string by the time it reaches the model, which
 * makes it impossible to say which configuration source is responsible for
 * which share of the context window. Building it as labeled sections and
 * joining them at the end keeps that attribution available to the `/context`
 * audit while guaranteeing the audit measures the exact text that is sent —
 * a parallel "describe the prompt" path would drift and report numbers for a
 * prompt that is no longer assembled this way.
 */
export interface PromptSection {
  /** Stable identifier, unique within a single build. */
  id: string;
  /** Human-readable label for display. */
  label: string;
  /** Optional provenance (e.g. the instruction file path). */
  detail?: string;
  /** The exact text contributed to the prompt. */
  content: string;
}

/** Join prompt sections into the final system prompt string. */
export function joinPromptSections(sections: PromptSection[]): string {
  return sections
    .map(section => section.content)
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Build the full system prompt for a given mode and context.
 * Combines the base prompt with mode-specific instructions.
 */
export function buildFullPrompt(ctx: PromptContext): string {
  return joinPromptSections(buildFullPromptSections(ctx));
}

/**
 * Build the system prompt as labeled sections. `buildFullPrompt` is the join of
 * these, so the two can never disagree about what the model receives.
 */
export function buildFullPromptSections(ctx: PromptContext): PromptSection[] {
  // Determine whether web search tools are available
  const modelId = ctx.modelId;
  const hasWebSearch =
    hasParallelKey() ||
    hasTavilyKey() ||
    (!!modelId && (modelId.startsWith('anthropic/') || modelId.startsWith('openai/')));

  // Collect per-tool deny rules so guidance omits denied tools
  const deniedTools = new Set<string>();
  const permRules = ctx.state?.permissionRules as { tools?: Record<string, string> } | undefined;
  if (permRules?.tools) {
    for (const [name, policy] of Object.entries(permRules.tools)) {
      if (policy === 'deny') deniedTools.add(name);
    }
  }

  // LSP is opt-in — when it is off the tool is never registered, so its
  // guidance must not be advertised either.
  if (resolveLspSetting(loadSettings().lsp) === false) deniedTools.add(MC_TOOLS.LSP_INSPECT);

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
  // Emitted per source so each AGENTS.md/CLAUDE.md can be costed individually.
  // The heading rides on the first source's section, which is exactly how
  // `formatAgentInstructions` lays the block out, so joining the sections
  // reproduces its output byte for byte.
  const instructionSections: PromptSection[] = instructionSources.map((source, index) => {
    const isFirst = index === 0;
    const isLast = index === instructionSources.length - 1;
    let content = formatInstructionSource(source);
    if (isFirst) content = `${AGENT_INSTRUCTIONS_HEADING}\n\n${content}`;
    // The block as a whole used to be trimmed, which only ever affected the
    // trailing whitespace of the final source's content.
    if (isLast) content = content.trimEnd();
    return {
      id: `agent-instructions:${source.path}:${index}`,
      label: `${source.scope === 'global' ? 'Global' : 'Project'} instructions`,
      detail: source.ref ? `${source.path} (at ref ${source.ref})` : source.path,
      content,
    };
  });

  const hostInstructions = ctx.hostInstructions?.trim() ?? '';

  return [
    { id: 'base-prompt', label: 'Base system prompt', content: base },
    { id: 'host-instructions', label: 'Host instructions', content: hostInstructions },
    ...instructionSections,
    { id: 'model-prompt', label: 'Model-specific prompt', detail: ctx.modelId, content: modelSpecific.trim() },
    { id: 'mode-prompt', label: 'Mode prompt', detail: ctx.modeId, content: modeSpecific.trim() },
  ].filter(section => Boolean(section.content));
}
