import type { GatewayLanguageModel } from '@mastra/core/llm';
import { generateText, type LanguageModel } from 'ai';
import type { ThinkingLevel } from '../providers/openai-codex.js';
import { getAnthropicApiKey, getOpenAIApiKey, reloadAuthStorage } from './mastracode-gateway.js';
import { resolveModel } from './model.js';

/**
 * Gateways resolve models across AI SDK generations (v5/v6/v7); this module
 * drives them through ai v6's `generateText`, which speaks the v2/v3 specs.
 */
function supportsGenerateText(model: GatewayLanguageModel): model is GatewayLanguageModel & LanguageModel {
  return model.specificationVersion === 'v2' || model.specificationVersion === 'v3';
}

/** A model (and optional thinking level) a thread title can be generated with. */
export interface ThreadTitleModelChoice {
  modelId: string;
  thinkingLevel?: ThinkingLevel;
}

/**
 * Provider-ordered thread-title defaults. The first provider with resolvable
 * credentials wins: Anthropic → Haiku, OpenAI → GPT-5.6-Luna at low thinking.
 */
const THREAD_TITLE_DEFAULTS: Array<ThreadTitleModelChoice & { hasCredentials: () => boolean }> = [
  { modelId: 'anthropic/claude-haiku-4-5', hasCredentials: () => Boolean(getAnthropicApiKey()) },
  { modelId: 'openai/gpt-5.6-luna', thinkingLevel: 'low', hasCredentials: () => Boolean(getOpenAIApiKey()) },
];

/**
 * The thread-title default for the first provider this process can authenticate,
 * or `undefined` when none is reachable. Callers with an explicit model never
 * need this — it only backs the "no configuration, sensible behavior" path.
 */
export function resolveDefaultThreadTitleModel(): ThreadTitleModelChoice | undefined {
  reloadAuthStorage();
  const found = THREAD_TITLE_DEFAULTS.find(choice => choice.hasCredentials());
  if (!found) return undefined;
  return { modelId: found.modelId, ...(found.thinkingLevel ? { thinkingLevel: found.thinkingLevel } : {}) };
}

export interface ThreadTitleOptions {
  /** The user prompt to derive the title from. */
  prompt: string;
  /** Explicit model id (`provider/model`). Omitted → the provider-aware default applies. */
  model?: string;
  thinkingLevel?: ThinkingLevel;
  /** Maximum prompt characters sent to the model. Default: 2000. */
  maxPromptChars?: number;
  abortSignal?: AbortSignal;
}

const TITLE_SYSTEM_PROMPT = `Write a short noun-phrase title for this conversation (2-5 words). Examples:
- "Auth bug fix" — not "Fixing the auth bug"
- "Dark mode toggle" — not "User wants dark mode toggle added"
Reply with the title only: no quotes, no trailing period, no explanation.`;

const MAX_TITLE_CHARS = 80;

function sanitizeTitle(output: string): string | undefined {
  const firstLine = output.split('\n').find(line => line.trim()) ?? '';
  const cleaned = firstLine
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/^title:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return undefined;
  if (cleaned.length <= MAX_TITLE_CHARS) return cleaned;
  const truncated = cleaned.slice(0, MAX_TITLE_CHARS);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > MAX_TITLE_CHARS / 2 ? truncated.slice(0, lastSpace) : truncated).trim();
}

/**
 * Generate a short thread title from a user prompt with a cheap side model.
 *
 * Resolves `model` through mastracode's gateway (stored OAuth/API keys and env
 * fallbacks), so the call uses the same credential paths as every other model
 * call. Without an explicit `model`, the default for the first provider with
 * credentials applies (`resolveDefaultThreadTitleModel`). Returns `undefined`
 * when there is nothing to title from or the model output is unusable; provider
 * failures throw — this runs beside a live answer, so callers decide how loud
 * to be about it.
 */
export async function generateThreadTitle({
  prompt,
  model,
  thinkingLevel,
  maxPromptChars = 2000,
  abortSignal,
}: ThreadTitleOptions): Promise<string | undefined> {
  const trimmed = prompt.trim().slice(0, maxPromptChars);
  if (!trimmed) return undefined;

  const choice = model
    ? { modelId: model, ...(thinkingLevel ? { thinkingLevel } : {}) }
    : resolveDefaultThreadTitleModel();
  if (!choice) return undefined;

  const resolved = resolveModel(choice.modelId, {
    ...(choice.thinkingLevel ? { thinkingLevel: choice.thinkingLevel } : {}),
  });
  if (!supportsGenerateText(resolved)) {
    throw new Error(
      `Model '${choice.modelId}' does not expose an AI SDK v2/v3 interface and cannot generate thread titles.`,
    );
  }

  const { text } = await generateText({
    model: resolved,
    system: TITLE_SYSTEM_PROMPT,
    prompt: trimmed,
    maxOutputTokens: 1024,
    ...(abortSignal ? { abortSignal } : {}),
  });
  return sanitizeTitle(text ?? '');
}
