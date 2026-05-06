import { APICallError } from '@internal/ai-sdk-v5';

import type { MastraDBMessage, MastraMessagePart, MastraToolInvocationPart } from '../agent/message-list';
import type { JSONValue } from '../stream';
import type { Processor, ProcessAPIErrorArgs, ProcessAPIErrorResult } from './index';

// ---------------------------------------------------------------------------
// Compat-rule infrastructure
// ---------------------------------------------------------------------------

/**
 * A single compatibility rule that maps an error pattern to a history fix.
 *
 * `errorPatterns` – regexes tested against the error message *and* the
 *   `responseBody` (when present).  Any match triggers the rule.
 *
 * `fix` – mutates the message list to resolve the incompatibility.
 *   Returns `true` if any changes were made (meaning a retry is worthwhile).
 */
export interface CompatRule {
  /** Human-readable identifier for logging/debugging. */
  name: string;
  /** Optional provider prefixes this rule applies to, e.g. `openai` or `anthropic`. */
  providers?: string[];
  /** Regexes matched against the error message and response body. */
  errorPatterns: RegExp[];
  /** Mutate messages to resolve the incompatibility. Return `true` if changes were made. */
  fix: (messages: MastraDBMessage[]) => boolean;
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
  const matches = (text: string) => rule.errorPatterns.some(p => p.test(text));

  if (APICallError.isInstance(error)) {
    return getErrorCandidates(error).some(matches);
  }

  if (error instanceof Error) {
    return getErrorCandidates(error).some(matches);
  }

  return false;
}

function matchesProvider(provider: string | undefined, rule: CompatRule): boolean {
  if (!rule.providers?.length) return true;
  if (!provider) return false;

  return rule.providers.some(ruleProvider => provider === ruleProvider || provider.startsWith(`${ruleProvider}.`));
}

type CompatToolResultOutput =
  | { type: 'text'; value: string }
  | { type: 'json'; value: JSONValue }
  | { type: 'error-text'; value: string }
  | { type: 'error-json'; value: JSONValue }
  | { type: 'content'; value: JSONValue[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringifyOutput(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isValidToolResultOutput(value: unknown): value is CompatToolResultOutput {
  if (!isRecord(value) || typeof value.type !== 'string' || !('value' in value)) return false;

  switch (value.type) {
    case 'text':
    case 'error-text':
      return typeof value.value === 'string';
    case 'json':
    case 'error-json':
      return value.value !== undefined;
    case 'content':
      return Array.isArray(value.value);
    default:
      return false;
  }
}

function toJSONValue(value: unknown): JSONValue {
  if (value === undefined) return null;

  try {
    return JSON.parse(JSON.stringify(value)) as JSONValue;
  } catch {
    return stringifyOutput(value);
  }
}

function normalizeToolResultOutput(modelOutput: unknown, result: unknown): CompatToolResultOutput {
  if (isValidToolResultOutput(modelOutput)) return modelOutput;

  if (isRecord(modelOutput) && typeof modelOutput.type === 'string') {
    switch (modelOutput.type) {
      case 'text':
      case 'error-text':
        return { type: modelOutput.type, value: stringifyOutput(result) };
      case 'json':
      case 'error-json':
        return { type: modelOutput.type, value: toJSONValue(result) };
      case 'content':
        return { type: 'json', value: toJSONValue(result) };
    }
  }

  return typeof result === 'string' ? { type: 'text', value: result } : { type: 'json', value: toJSONValue(result) };
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
  providers: ['anthropic'],
  errorPatterns: [/tool_use\.id:.*should match pattern/i, /tool_call_id.*invalid/i],
  fix(messages) {
    const idMap = buildToolIdMap(messages);
    if (idMap.size === 0) return false;
    rewriteToolIds(messages, idMap);
    return true;
  },
};

export const openaiMissingToolResultOutput: CompatRule = {
  name: 'openai-missing-tool-result-output',
  providers: ['openai'],
  errorPatterns: [/Missing required parameter:\s*['"]?input\[\d+\]\.output['"]?/i],
  fix(messages) {
    let changed = false;

    for (const msg of messages) {
      if (!msg.content?.parts) continue;

      for (const part of msg.content.parts) {
        if (part.type !== 'tool-invocation' || part.toolInvocation?.state !== 'result') continue;

        const mastraMetadata = part.providerMetadata?.mastra;
        const metadataRecord = isRecord(mastraMetadata) ? mastraMetadata : {};
        const modelOutput = metadataRecord.modelOutput;
        const normalizedOutput = normalizeToolResultOutput(modelOutput, part.toolInvocation.result);

        if (modelOutput === normalizedOutput) continue;

        part.providerMetadata = {
          ...part.providerMetadata,
          mastra: {
            ...metadataRecord,
            modelOutput: normalizedOutput,
          },
        };
        changed = true;
      }
    }

    return changed;
  },
};

// ---------------------------------------------------------------------------
// Default rule set
// ---------------------------------------------------------------------------

/**
 * All built-in compat rules. Extend by passing additional rules to the
 * `ProviderHistoryCompat` constructor.
 */
export const DEFAULT_COMPAT_RULES: CompatRule[] = [anthropicToolIdFormat, openaiMissingToolResultOutput];

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

/**
 * Handles provider-specific history incompatibilities by matching API errors
 * against a registry of known patterns and applying targeted fixes.
 *
 * Each {@link CompatRule} pairs an error pattern with a message-rewriting
 * function. When the API returns an error that matches a rule, the processor
 * applies the fix and retries the request.
 *
 * Built-in rules:
 * - **anthropic-tool-id-format** – rewrites tool-call IDs that contain
 *   characters outside `[a-zA-Z0-9_-]` (e.g. `.` or `:` from other providers).
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

  async processAPIError({
    error,
    messageList,
    provider,
    retryCount,
  }: ProcessAPIErrorArgs): Promise<ProcessAPIErrorResult | void> {
    if (retryCount > 0) return;

    const messages = messageList.get.all.db();

    for (const rule of this.rules) {
      if (!matchesProvider(provider, rule)) continue;

      if (matchesRule(error, rule)) {
        const changed = rule.fix(messages);
        if (changed) {
          return { retry: true };
        }
      }
    }
  }
}
