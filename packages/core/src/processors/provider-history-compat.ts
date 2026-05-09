import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { APICallError } from '@internal/ai-sdk-v5';

import type { MastraDBMessage, MastraMessagePart, MastraToolInvocationPart } from '../agent/message-list';
import type {
  Processor,
  ProcessAPIErrorArgs,
  ProcessAPIErrorResult,
  ProcessLLMRequestArgs,
  ProcessLLMRequestResult,
} from './index';

// ---------------------------------------------------------------------------
// Compat-rule infrastructure
// ---------------------------------------------------------------------------

/**
 * A single compatibility rule that resolves a known provider history
 * incompatibility. Rules can resolve issues either:
 *
 * - **Reactively** via {@link CompatRule.fix}: when an API call fails with an
 *   error matching one of {@link CompatRule.errorPatterns}, the fix mutates
 *   the persisted message list and the request is retried. Suitable for
 *   incompatibilities that, once fixed, stay fixed across future turns
 *   (e.g. tool-call ID format).
 *
 * - **Preemptively** via {@link CompatRule.applyToPrompt}: runs in
 *   `processLLMRequest` after `MessageList → LanguageModelV2Prompt` conversion
 *   and before the prompt is sent to the provider. Mutations affect only the
 *   outbound prompt; nothing is persisted to the message list. Suitable for
 *   incompatibilities that would otherwise re-trigger on every turn (e.g.
 *   fields the model adds to its own response that the same provider rejects
 *   on subsequent input).
 *
 * A rule may implement either hook, both, or — rarely — neither (e.g. a
 * placeholder for future error-pattern matching).
 */
export interface CompatRule {
  /** Human-readable identifier for logging/debugging. */
  name: string;
  /** Regexes matched against the error message and response body. */
  errorPatterns?: RegExp[];
  /** Mutate persisted messages to resolve the incompatibility. Return `true` if changes were made. */
  fix?: (messages: MastraDBMessage[]) => boolean;
  /**
   * Rewrite the outbound LLM request preemptively. Receives the resolved model
   * so rules can scope themselves to specific providers. Return a new prompt
   * to forward, or `undefined` to leave the prompt unchanged.
   */
  applyToPrompt?: (args: { prompt: LanguageModelV2Prompt; model: unknown }) => LanguageModelV2Prompt | undefined;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getErrorCandidates(error: APICallError | Error): string[] {
  const candidates = [error.message];

  if (APICallError.isInstance(error) && typeof error.responseBody === 'string') {
    candidates.push(error.responseBody);
  }

  return candidates.filter(Boolean);
}

function matchesRule(error: unknown, rule: CompatRule): boolean {
  if (!rule.errorPatterns?.length) return false;
  const matches = (text: string) => rule.errorPatterns!.some(p => p.test(text));

  if (APICallError.isInstance(error)) {
    return getErrorCandidates(error).some(matches);
  }

  if (error instanceof Error) {
    return getErrorCandidates(error).some(matches);
  }

  return false;
}

// ---------------------------------------------------------------------------
// Built-in rule: Anthropic tool-call ID format
// ---------------------------------------------------------------------------

const VALID_TOOL_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function sanitizeToolId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function buildToolIdMap(messages: MastraDBMessage[]): Map<string, string> {
  const idMap = new Map<string, string>();

  for (const msg of messages) {
    if (!msg.content?.parts) continue;
    for (const part of msg.content.parts) {
      if (part.type === 'tool-invocation') {
        const id = part.toolInvocation.toolCallId;
        if (id && !VALID_TOOL_ID_PATTERN.test(id) && !idMap.has(id)) {
          idMap.set(id, sanitizeToolId(id));
        }
      }
    }

    if (msg.content.toolInvocations) {
      for (const inv of msg.content.toolInvocations) {
        const id = inv.toolCallId;
        if (id && !VALID_TOOL_ID_PATTERN.test(id) && !idMap.has(id)) {
          idMap.set(id, sanitizeToolId(id));
        }
      }
    }
  }

  return idMap;
}

function rewriteToolIds(messages: MastraDBMessage[], idMap: Map<string, string>): void {
  for (const msg of messages) {
    if (msg.content?.parts) {
      for (let i = 0; i < msg.content.parts.length; i++) {
        const part = msg.content.parts[i] as MastraMessagePart;
        if (part.type === 'tool-invocation') {
          const oldId = part.toolInvocation.toolCallId;
          const newId = idMap.get(oldId);
          if (newId) {
            (part as MastraToolInvocationPart).toolInvocation = {
              ...part.toolInvocation,
              toolCallId: newId,
            };
          }
        }
      }
    }

    if (msg.content?.toolInvocations) {
      for (const inv of msg.content.toolInvocations) {
        const newId = idMap.get(inv.toolCallId);
        if (newId) {
          inv.toolCallId = newId;
        }
      }
    }
  }
}

/**
 * Anthropic enforces `^[a-zA-Z0-9_-]+$` on tool_use.id values.
 * Tool-call IDs from other providers (e.g. containing `.`, `:`) will be
 * rejected. This rule rewrites offending characters to `_`.
 */
export const anthropicToolIdFormat: CompatRule = {
  name: 'anthropic-tool-id-format',
  errorPatterns: [/tool_use\.id:.*should match pattern/i, /tool_call_id.*invalid/i],
  fix(messages) {
    const idMap = buildToolIdMap(messages);
    if (idMap.size === 0) return false;
    rewriteToolIds(messages, idMap);
    return true;
  },
};

// ---------------------------------------------------------------------------
// Built-in rule: Cerebras `reasoning_content` strip
// ---------------------------------------------------------------------------

/**
 * Detects whether a model is (or might be) routed through Cerebras.
 *
 * Cerebras's API rejects assistant messages carrying `reasoning_content`
 * (the field `@ai-sdk/openai-compatible@>=1.0.32` adds when serializing
 * reasoning parts). A flexible matcher is used here because the model arg
 * passed to processors may be a resolved language model, an unresolved
 * model id string, a dynamic function, or a fallback array.
 */
function matchesProviderPrefix(model: unknown, providerPrefix: string): boolean {
  if (model == null) return false;
  if (typeof model === 'function') return false;

  if (Array.isArray(model)) {
    return model.some(m => matchesProviderPrefix((m as { model?: unknown }).model ?? m, providerPrefix));
  }

  const gatewayPattern = new RegExp(`^${providerPrefix}[/:]`, 'i');
  const providerPattern = new RegExp(`^${providerPrefix}($|[.\\-])`, 'i');

  if (typeof model === 'string') {
    // Common forms: 'provider/...' (mastra gateway prefix), 'provider:...' (some routers)
    return gatewayPattern.test(model);
  }

  if (typeof model === 'object') {
    const { provider, modelId } = model as { provider?: unknown; modelId?: unknown };
    if (typeof provider === 'string' && providerPattern.test(provider)) return true;
    if (typeof modelId === 'string') return gatewayPattern.test(modelId);
  }

  return false;
}

export function isMaybeCerebras(
  model:
    | string
    | { provider?: string; modelId?: string }
    | ((...args: any[]) => any)
    | { model: any; enabled?: boolean }[]
    | unknown,
): boolean {
  return matchesProviderPrefix(model, 'cerebras');
}

export function isMaybeAnthropic(
  model:
    | string
    | { provider?: string; modelId?: string }
    | ((...args: any[]) => any)
    | { model: any; enabled?: boolean }[]
    | unknown,
): boolean {
  return matchesProviderPrefix(model, 'anthropic');
}

/**
 * Returns a copy of the prompt with selected `reasoning` parts stripped from
 * assistant messages. Returns `undefined` if no changes were necessary.
 */
function stripReasoningFromPrompt(
  prompt: LanguageModelV2Prompt,
  shouldStrip: (
    part: Extract<
      Extract<LanguageModelV2Prompt[number], { role: 'assistant' }>['content'][number],
      { type: 'reasoning' }
    >,
  ) => boolean = () => true,
): LanguageModelV2Prompt | undefined {
  let mutated = false;
  const next: LanguageModelV2Prompt = prompt.map(message => {
    if (message.role !== 'assistant') return message;
    if (typeof message.content === 'string') return message;
    if (!Array.isArray(message.content)) return message;
    const filtered = message.content.filter(part => part.type !== 'reasoning' || !shouldStrip(part as any));
    if (filtered.length === message.content.length) return message;
    mutated = true;
    return { ...message, content: filtered };
  });
  return mutated ? next : undefined;
}

function isAnthropicReasoningPart(part: { providerOptions?: unknown; providerMetadata?: unknown }): boolean {
  const providerOptions = part.providerOptions;
  if (providerOptions && typeof providerOptions === 'object' && 'anthropic' in providerOptions) return true;

  const providerMetadata = part.providerMetadata;
  if (providerMetadata && typeof providerMetadata === 'object' && 'anthropic' in providerMetadata) return true;

  return false;
}

/**
 * Cerebras's API rejects assistant messages carrying a `reasoning_content`
 * field with HTTP 400 (`property '...reasoning_content' is unsupported`).
 *
 * Starting in `@ai-sdk/openai-compatible@1.0.32` (https://github.com/vercel/ai/pull/12049),
 * which `@ai-sdk/cerebras` depends on, reasoning parts on assistant messages
 * are unconditionally serialized as `reasoning_content` on outbound requests.
 * That breaks multi-turn tool calls with reasoning enabled (e.g.
 * `cerebras/zai-glm-4.7`) on the second-or-later assistant turn.
 *
 * This rule preemptively strips `reasoning` parts from assistant messages
 * in the outbound prompt when the resolved model is Cerebras. The strip
 * runs in `processLLMRequest` so it affects only what is sent to Cerebras —
 * the persisted message list (memory, UI, observability) keeps the full
 * reasoning trace, and other providers (e.g. Z.ai's coding-plan endpoint,
 * which *requires* `reasoning_content` echoed back for its preserved-thinking
 * feature) are unaffected because the rule is provider-scoped.
 *
 * It can't be reactive (`processAPIError`) because the model emits a fresh
 * reasoning part on every turn — a reactive rule would cause one
 * failed-and-retried request per turn.
 *
 * Once https://github.com/vercel/ai/pull/11278 lands a per-provider
 * `sendReasoning` opt-out, this rule can be replaced with `sendReasoning: false`
 * on the cerebras provider config.
 */
export const cerebrasStripReasoningContent: CompatRule = {
  name: 'cerebras-strip-reasoning-content',
  applyToPrompt({ prompt, model }) {
    if (!isMaybeCerebras(model)) return undefined;
    return stripReasoningFromPrompt(prompt);
  },
};

/**
 * Anthropic accepts its own thinking/reasoning history, but rejects reasoning
 * parts emitted by other providers. Strip only foreign reasoning parts at the
 * Anthropic provider boundary so persisted history remains intact and native
 * Anthropic thinking can still round-trip.
 */
export const anthropicStripForeignReasoningContent: CompatRule = {
  name: 'anthropic-strip-foreign-reasoning-content',
  applyToPrompt({ prompt, model }) {
    if (!isMaybeAnthropic(model)) return undefined;
    return stripReasoningFromPrompt(prompt, part => !isAnthropicReasoningPart(part));
  },
};

// ---------------------------------------------------------------------------
// Default rule set
// ---------------------------------------------------------------------------

/**
 * All built-in compat rules. Extend by passing additional rules to the
 * `ProviderHistoryCompat` constructor.
 */
export const DEFAULT_COMPAT_RULES: CompatRule[] = [
  anthropicToolIdFormat,
  cerebrasStripReasoningContent,
  anthropicStripForeignReasoningContent,
];

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

/**
 * Handles provider-specific history incompatibilities by applying a registry
 * of {@link CompatRule}s. Rules can rewrite the outbound prompt preemptively
 * via `processLLMRequest`, or react to non-retryable API rejections via
 * `processAPIError`.
 *
 * Built-in rules:
 * - **anthropic-tool-id-format** — rewrites tool-call IDs that contain
 *   characters outside `[a-zA-Z0-9_-]` (e.g. `.` or `:` from other
 *   providers). Reactive (matches a 400 response body, retries with
 *   sanitized IDs).
 * - **cerebras-strip-reasoning-content** — strips `reasoning` parts from
 *   assistant messages in the outbound prompt when the resolved model is
 *   Cerebras, to avoid the `@ai-sdk/openai-compatible@>=1.0.32` regression
 *   that serializes them as `reasoning_content` (a field Cerebras's API
 *   rejects). Preemptive; runs in `processLLMRequest` so the persisted
 *   message list keeps the reasoning trace.
 * - **anthropic-strip-foreign-reasoning-content** — strips non-Anthropic
 *   `reasoning` parts from assistant messages in the outbound prompt when the
 *   resolved model is Anthropic. Anthropic-native reasoning parts are kept.
 *
 * To add custom rules, pass them to the constructor:
 * ```ts
 * new ProviderHistoryCompat({
 *   additionalRules: [myCustomRule],
 * })
 * ```
 */
export class ProviderHistoryCompat implements Processor<'provider-history-compat'> {
  readonly id = 'provider-history-compat' as const;
  readonly name = 'Provider History Compat';

  private rules: CompatRule[];

  constructor(opts?: { additionalRules?: CompatRule[] }) {
    this.rules = [...DEFAULT_COMPAT_RULES, ...(opts?.additionalRules ?? [])];
  }

  processLLMRequest({ prompt, model }: ProcessLLMRequestArgs): ProcessLLMRequestResult {
    let current = prompt;
    let mutated = false;
    for (const rule of this.rules) {
      if (!rule.applyToPrompt) continue;
      const next = rule.applyToPrompt({ prompt: current, model });
      if (next) {
        current = next;
        mutated = true;
      }
    }
    return mutated ? { prompt: current } : undefined;
  }

  async processAPIError({
    error,
    messageList,
    retryCount,
  }: ProcessAPIErrorArgs): Promise<ProcessAPIErrorResult | void> {
    if (retryCount > 0) return;

    const messages = messageList.get.all.db();

    for (const rule of this.rules) {
      if (!rule.fix) continue;
      if (matchesRule(error, rule)) {
        const changed = rule.fix(messages);
        if (changed) {
          return { retry: true };
        }
      }
    }
  }
}
