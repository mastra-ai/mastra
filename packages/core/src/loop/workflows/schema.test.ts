import { describe, expect, it } from 'vitest';
import { toolCallOutputSchema } from './schema';

// Guards the `aborted` field on toolCallOutputSchema (#17995). Note: no engine actually
// validates step outputs against this schema today — the workflows engine has no
// output-side validation, and input validation is disabled (`validateInputs: false`) in
// both loop builders — so the schema exists for type/schema honesty. Zod strips
// undeclared keys on parse, so if validation is ever (re-)enabled, an undeclared field
// would silently drop `{ aborted: true }` before llm-mapping-step sees it, defeating the
// fix. Pins that the declared field survives both the single-object and array shapes.
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
