/**
 * Model-facing truncation for MCP tool results.
 *
 * Unlike mastracode's workspace tools (which cap their own results at ~2k
 * tokens), MCP servers return whatever they like — a chrome-devtools
 * accessibility snapshot or a web page extraction can easily be 30-100k
 * tokens. Untruncated, a single such result dominates the agent's context
 * window and observational memory's pending-token accounting.
 *
 * The wrap composes a `toModelOutput` that only takes effect when the
 * model-facing payload exceeds the cap: under the cap it defers entirely to
 * the tool's own `toModelOutput` (or returns `undefined`, which leaves the
 * raw result untouched). The full result is always preserved for
 * display/storage — only what the model reads is bounded.
 */

import { estimateTokenCount, sliceByTokens } from 'tokenx';

/**
 * Cap for model-facing MCP tool result content. Generous compared to the 2k
 * workspace-tool cap because MCP results (a11y snapshots, page extractions)
 * are often consumed structurally by the model, but far below the pathological
 * sizes observed in practice.
 */
export const DEFAULT_MCP_RESULT_MAX_TOKENS = 10_000;

/** MCP CallToolResult-style content part. */
interface ContentPart {
  type?: unknown;
  text?: unknown;
}

/**
 * Join the text of an MCP `content` array. Returns undefined when the array
 * contains any non-text part (images, resources) — truncating those results
 * to a text-only payload would drop the media the model may need.
 */
function joinTextOnlyContent(content: unknown): string | undefined {
  if (!Array.isArray(content)) return undefined;
  const texts: string[] = [];
  for (const part of content as ContentPart[]) {
    if (!part || typeof part !== 'object' || part.type !== 'text' || typeof part.text !== 'string') {
      return undefined;
    }
    texts.push(part.text);
  }
  return texts.join('\n');
}

function safeStringify(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return undefined;
  }
}

/**
 * Head+tail truncation with a notice in the middle. Keeps both ends because
 * structured results (snapshots, listings) carry useful anchors at the start
 * and recency at the end.
 */
export function truncateSandwich(text: string, limit: number): string {
  const totalTokens = estimateTokenCount(text);
  if (totalTokens <= limit) return text;
  const headBudget = Math.floor(limit / 2);
  const tailBudget = limit - headBudget;
  const head = sliceByTokens(text, 0, headBudget);
  const tail = sliceByTokens(text, -tailBudget);
  const notice = `\n[...MCP tool result truncated for the model — showing first ~${headBudget} + last ~${tailBudget} of ~${totalTokens} tokens. The full result was too large to include...]\n`;
  return `${head}${notice}${tail}`;
}

/**
 * Derive the model-facing text of a tool result when the tool has no
 * `toModelOutput` of its own. Plain MCP tools return the raw CallToolResult
 * (`{ content: [...] }`); structured tools return `structuredContent`.
 * Returns undefined when the payload is not safely representable as text
 * (e.g. contains media parts).
 */
function deriveModelText(output: unknown): string | undefined {
  if (typeof output === 'string') return output;
  if (output && typeof output === 'object' && 'content' in (output as Record<string, unknown>)) {
    return joinTextOnlyContent((output as Record<string, unknown>).content);
  }
  return safeStringify(output);
}

type ToModelOutput = (output: unknown) => unknown;

/**
 * Wrap an MCP tool config so oversized results are truncated for the model.
 * Under the cap the tool behaves exactly as before; over it, the model sees a
 * head+tail slice with a truncation notice while the raw result stays intact.
 */
export function withMcpResultTruncation<T extends { toModelOutput?: ToModelOutput }>(
  toolConfig: T,
  maxTokens: number = DEFAULT_MCP_RESULT_MAX_TOKENS,
): T {
  const baseToModelOutput = toolConfig.toModelOutput;

  const toModelOutput: ToModelOutput = (output: unknown) => {
    const base = baseToModelOutput ? baseToModelOutput(output) : undefined;

    if (base && typeof base === 'object') {
      // Structured tools produce { type: 'text' | 'json', value }.
      const { type, value } = base as { type?: unknown; value?: unknown };
      const text = type === 'text' && typeof value === 'string' ? value : safeStringify(value);
      if (text !== undefined && estimateTokenCount(text) > maxTokens) {
        return { type: 'text', value: truncateSandwich(text, maxTokens) };
      }
      return base;
    }

    const text = deriveModelText(output);
    if (text !== undefined && estimateTokenCount(text) > maxTokens) {
      return { type: 'text', value: truncateSandwich(text, maxTokens) };
    }
    // Under the cap (or not safely truncatable): leave the result untouched.
    return base;
  };

  return { ...toolConfig, toModelOutput };
}
