import type { GatewayLanguageModel } from '@mastra/core/llm';
import type { RequestContext } from '@mastra/core/request-context';
import { streamText, type LanguageModel } from 'ai';
import { selectPreferredOMPack } from '../onboarding/packs.js';
import { computeProviderAccess } from '../onboarding/provider-access.js';
import type { ThinkingLevel } from '../providers/openai-codex.js';
import { getAuthStorage, MastraCodeGateway, reloadAuthStorage } from './mastracode-gateway.js';
import { resolveModel } from './model.js';

// Gateway models span AI SDK v5–v7; ai v6's generateText speaks v2/v3 only.
function supportsGenerateText(model: GatewayLanguageModel): model is GatewayLanguageModel & LanguageModel {
  return model.specificationVersion === 'v2' || model.specificationVersion === 'v3';
}

export interface ThreadTitleOptions {
  prompt: string;
  /** Explicit model id (`provider/model`). Omitted → the provider-aware default applies. */
  model?: string;
  thinkingLevel?: ThinkingLevel;
  /**
   * Request context the generation rides on. In deployed (multi-tenant) web,
   * model credentials resolve per calling tenant through it; omitting it falls
   * back to the process-global AuthStorage/env.
   */
  requestContext?: RequestContext;
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
 * The cheap-model default for background text work — the same provider pack
 * selection OM uses — or `undefined` when no provider is reachable.
 */
export function resolveDefaultThreadTitleModel(): string | undefined {
  reloadAuthStorage();
  const access = computeProviderAccess(getAuthStorage(), MastraCodeGateway.getMastraGatewayApiKey());
  return selectPreferredOMPack(access)?.modelId;
}

/**
 * Generate a short thread title from a user prompt with a cheap side model.
 *
 * Resolves `model` through mastracode's gateway (stored OAuth/API keys and env
 * fallbacks); pass `requestContext` in deployed web so credentials resolve per
 * calling tenant. Returns `undefined` when there is nothing to title from or
 * the model output is unusable; provider failures throw — this runs beside a
 * live answer, so callers decide how loud to be about it.
 */
export async function generateThreadTitle({
  prompt: rawPrompt,
  model,
  thinkingLevel,
  requestContext,
  maxPromptChars = 2000,
  abortSignal,
}: ThreadTitleOptions): Promise<string | undefined> {
  const prompt = rawPrompt.trim().slice(0, maxPromptChars);
  if (!prompt) return undefined;

  const modelId = model ?? resolveDefaultThreadTitleModel();
  if (!modelId) return undefined;

  const resolved = resolveModel(modelId, {
    ...(thinkingLevel ? { thinkingLevel } : {}),
    ...(requestContext ? { requestContext } : {}),
  });
  if (!supportsGenerateText(resolved)) {
    throw new Error(`Model '${modelId}' does not expose an AI SDK v2/v3 interface and cannot generate thread titles.`);
  }

  // Some provider endpoints (Codex OAuth) reject non-streaming requests and
  // unsupported sampling params, so generation streams with no token cap —
  // the prompt constrains the title to a short noun phrase.
  const { text } = streamText({
    model: resolved,
    system: TITLE_SYSTEM_PROMPT,
    prompt,
    ...(abortSignal ? { abortSignal } : {}),
  });
  return sanitizeTitle((await text) ?? '');
}
