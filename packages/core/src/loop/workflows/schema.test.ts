import { describe, expect, it } from 'vitest';
import { toolCallOutputSchema } from './schema';

// Guards the `aborted` field on toolCallOutputSchema (#17995). The evented engine validates
// step outputs against this schema, and Zod strips undeclared keys — so without the field,
// `{ aborted: true }` would be dropped before llm-mapping-step sees it, defeating the fix.
// Pins that it survives both the single-object and array boundaries the engine uses.
describe('toolCallOutputSchema aborted field survival', () => {
  const aborted = {
    toolCallId: 'srv-1',
    toolName: 'slowServerTool',
    args: { q: 'important' },
    aborted: true,
  };

  it('preserves `aborted` through a single-object parse', () => {
    const parsed = toolCallOutputSchema.parse(aborted);
    expect(parsed.aborted).toBe(true);
  });

  it('preserves `aborted` through an array parse (the evented-engine step-output boundary)', () => {
    const parsed = toolCallOutputSchema.array().parse([aborted]);
    expect(parsed[0]?.aborted).toBe(true);
  });

  it('still allows the normal result/error shapes without an `aborted` flag', () => {
    const withResult = toolCallOutputSchema.parse({
      toolCallId: 'ok-1',
      toolName: 't',
      args: {},
      result: { ok: true },
    });
    expect(withResult.aborted).toBeUndefined();
    expect(withResult.result).toEqual({ ok: true });
  });
});
