import { estimateTokenCount } from 'tokenx';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_MCP_RESULT_MAX_TOKENS, truncateSandwich, withMcpResultTruncation } from './truncate.js';

/** ~N tokens of distinct text (tokenx estimates ~1 token per short word). */
function bigText(tokens: number): string {
  return Array.from({ length: tokens }, (_, i) => `word${i}`).join(' ');
}

function callToolResult(text: string) {
  return { content: [{ type: 'text', text }] };
}

describe('withMcpResultTruncation', () => {
  it('leaves small results untouched (toModelOutput returns undefined)', () => {
    const wrapped = withMcpResultTruncation({ id: 'tool', execute: vi.fn() } as any);
    expect(wrapped.toModelOutput!(callToolResult('small result'))).toBeUndefined();
  });

  it('preserves the rest of the tool config', () => {
    const execute = vi.fn();
    const wrapped = withMcpResultTruncation({ id: 'tool', description: 'desc', execute } as any);
    expect(wrapped.id).toBe('tool');
    expect(wrapped.description).toBe('desc');
    expect(wrapped.execute).toBe(execute);
  });

  it('truncates an oversized text-only CallToolResult for the model', () => {
    const wrapped = withMcpResultTruncation({ id: 'tool' } as any);
    const text = bigText(DEFAULT_MCP_RESULT_MAX_TOKENS * 3);

    const modelOutput = wrapped.toModelOutput!(callToolResult(text)) as { type: string; value: string };

    expect(modelOutput.type).toBe('text');
    expect(modelOutput.value).toContain('truncated for the model');
    // Bounded near the cap (notice adds a little).
    expect(estimateTokenCount(modelOutput.value)).toBeLessThan(DEFAULT_MCP_RESULT_MAX_TOKENS * 1.1);
    // Keeps both ends.
    expect(modelOutput.value).toContain('word0 ');
    expect(modelOutput.value.trimEnd().endsWith(`word${DEFAULT_MCP_RESULT_MAX_TOKENS * 3 - 1}`)).toBe(true);
  });

  it('truncates oversized string results', () => {
    const wrapped = withMcpResultTruncation({ id: 'tool' } as any);
    const modelOutput = wrapped.toModelOutput!(bigText(DEFAULT_MCP_RESULT_MAX_TOKENS * 2)) as {
      type: string;
      value: string;
    };
    expect(modelOutput.type).toBe('text');
    expect(estimateTokenCount(modelOutput.value)).toBeLessThan(DEFAULT_MCP_RESULT_MAX_TOKENS * 1.1);
  });

  it('truncates oversized structured results via the base toModelOutput', () => {
    const text = bigText(DEFAULT_MCP_RESULT_MAX_TOKENS * 2);
    const base = vi.fn(() => ({ type: 'text', value: text }));
    const wrapped = withMcpResultTruncation({ id: 'tool', toModelOutput: base } as any);

    const modelOutput = wrapped.toModelOutput!({ structured: true }) as { type: string; value: string };

    expect(base).toHaveBeenCalled();
    expect(modelOutput.value).toContain('truncated for the model');
    expect(estimateTokenCount(modelOutput.value)).toBeLessThan(DEFAULT_MCP_RESULT_MAX_TOKENS * 1.1);
  });

  it('returns the base output unchanged when it is under the cap', () => {
    const base = { type: 'json', value: { ok: true } };
    const wrapped = withMcpResultTruncation({ id: 'tool', toModelOutput: () => base } as any);
    expect(wrapped.toModelOutput!({ structured: true })).toBe(base);
  });

  it('never truncates results containing non-text content parts', () => {
    const wrapped = withMcpResultTruncation({ id: 'tool' } as any);
    const result = {
      content: [
        { type: 'text', text: bigText(DEFAULT_MCP_RESULT_MAX_TOKENS * 2) },
        { type: 'image', data: 'base64...', mimeType: 'image/png' },
      ],
    };
    // Media would be dropped by a text-only truncation — leave untouched.
    expect(wrapped.toModelOutput!(result)).toBeUndefined();
  });

  it('respects a custom token cap', () => {
    const wrapped = withMcpResultTruncation({ id: 'tool' } as any, 100);
    const modelOutput = wrapped.toModelOutput!(callToolResult(bigText(1000))) as { type: string; value: string };
    expect(estimateTokenCount(modelOutput.value)).toBeLessThan(200);
  });
});

describe('truncateSandwich', () => {
  it('returns short text unchanged', () => {
    expect(truncateSandwich('short', 100)).toBe('short');
  });

  it('keeps head and tail with a notice between', () => {
    const text = bigText(1000);
    const out = truncateSandwich(text, 100);
    expect(out).toContain('word0 ');
    expect(out.trimEnd().endsWith('word999')).toBe(true);
    expect(out).toContain('truncated for the model');
    expect(estimateTokenCount(out)).toBeLessThan(200);
  });
});
