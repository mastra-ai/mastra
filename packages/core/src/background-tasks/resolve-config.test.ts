import { describe, expect, it } from 'vitest';
import { resolveBackgroundConfig } from './resolve-config';

/**
 * Regression tests for https://github.com/mastra-ai/mastra/issues/16783.
 *
 * The LLM per-call `_background` override is a *modifier* on tools the
 * developer has already opted in at the tool or agent layer — not a
 * standalone opt-in. A foreground-only tool must stay foreground regardless
 * of what the model emits, so `agent.generate()` keeps returning real data
 * for deterministic tools (calculators, lookups, schema validators).
 */
describe('resolveBackgroundConfig', () => {
  it('ignores `llmOverride.enabled: true` when the tool has not opted in', () => {
    const resolved = resolveBackgroundConfig({
      llmBgOverrides: { enabled: true },
      toolName: 'calculator',
      toolConfig: undefined,
      agentConfig: undefined,
      managerConfig: { enabled: true },
    });

    expect(resolved.runInBackground).toBe(false);
  });

  it('ignores `llmOverride.enabled: true` when the agent opted in OTHER tools but not this one', () => {
    const resolved = resolveBackgroundConfig({
      llmBgOverrides: { enabled: true },
      toolName: 'calculator',
      toolConfig: undefined,
      agentConfig: { tools: { research: true } },
      managerConfig: { enabled: true },
    });

    expect(resolved.runInBackground).toBe(false);
  });

  it('honors LLM override when the tool itself opted in', () => {
    const resolved = resolveBackgroundConfig({
      llmBgOverrides: { enabled: true },
      toolName: 'research',
      toolConfig: { enabled: true },
      agentConfig: undefined,
      managerConfig: { enabled: true },
    });

    expect(resolved.runInBackground).toBe(true);
  });

  it('honors LLM override when the agent opted the tool in', () => {
    const resolved = resolveBackgroundConfig({
      llmBgOverrides: { enabled: true },
      toolName: 'research',
      toolConfig: undefined,
      agentConfig: { tools: { research: true } },
      managerConfig: { enabled: true },
    });

    expect(resolved.runInBackground).toBe(true);
  });

  it('honors LLM override when the agent opted in with `tools: "all"`', () => {
    const resolved = resolveBackgroundConfig({
      llmBgOverrides: { enabled: true },
      toolName: 'anything',
      toolConfig: undefined,
      agentConfig: { tools: 'all' },
      managerConfig: { enabled: true },
    });

    expect(resolved.runInBackground).toBe(true);
  });

  it('lets the LLM flip an opted-in tool back to foreground via `enabled: false`', () => {
    const resolved = resolveBackgroundConfig({
      llmBgOverrides: { enabled: false },
      toolName: 'research',
      toolConfig: { enabled: true },
      agentConfig: undefined,
      managerConfig: { enabled: true },
    });

    expect(resolved).toMatchObject({ runInBackground: false, disposition: 'foreground' });
  });

  it.each(['foreground', 'deferred', 'awaited'] as const)('resolves the %s per-call disposition', disposition => {
    const resolved = resolveBackgroundConfig({
      llmBgOverrides: { disposition },
      toolName: 'research',
      toolConfig: { enabled: true },
      agentConfig: undefined,
      managerConfig: { enabled: true },
    });

    expect(resolved).toMatchObject({
      runInBackground: disposition !== 'foreground',
      disposition,
    });
  });

  it('ignores a disposition override when the tool has not opted in', () => {
    const resolved = resolveBackgroundConfig({
      llmBgOverrides: { disposition: 'awaited' },
      toolName: 'calculator',
      toolConfig: undefined,
      agentConfig: undefined,
      managerConfig: { enabled: true },
    });

    expect(resolved).toMatchObject({ runInBackground: false, disposition: 'foreground' });
  });
});
