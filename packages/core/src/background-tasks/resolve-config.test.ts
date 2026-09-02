import { describe, expect, it } from 'vitest';
import { isToolBackgroundEligible, resolveBackgroundConfig } from './resolve-config';

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

    expect(resolved.runInBackground).toBe(false);
  });
});

/**
 * Regression tests for https://github.com/mastra-ai/mastra/issues/22724.
 *
 * `isToolBackgroundEligible` is the single source of truth for whether a tool
 * may be *advertised* as background-capable (schema `_background` injection and
 * the background system prompt). It must match `resolveBackgroundConfig`'s
 * base-enabled expression exactly.
 */
describe('isToolBackgroundEligible', () => {
  it('returns false when nothing is configured', () => {
    expect(isToolBackgroundEligible({ toolName: 'calculator' })).toBe(false);
  });

  it('returns true when the agent opts the tool in', () => {
    expect(isToolBackgroundEligible({ toolName: 'research', agentConfig: { tools: { research: true } } })).toBe(true);
  });

  it('returns false when the agent opted in OTHER tools but not this one', () => {
    expect(isToolBackgroundEligible({ toolName: 'readFile', agentConfig: { tools: { research: true } } })).toBe(false);
  });

  it('falls back to tool-level config when the agent config is silent for this tool', () => {
    expect(
      isToolBackgroundEligible({
        toolName: 'research',
        toolConfig: { enabled: true },
        agentConfig: { tools: { other: true } },
      }),
    ).toBe(true);
  });

  it('falls back to tool-level config when there is no agent config at all', () => {
    expect(isToolBackgroundEligible({ toolName: 'research', toolConfig: { enabled: true } })).toBe(true);
  });

  it('lets an explicit agent-level `enabled: false` override tool-level opt-in', () => {
    expect(
      isToolBackgroundEligible({
        toolName: 'research',
        toolConfig: { enabled: true },
        agentConfig: { tools: { research: false } },
      }),
    ).toBe(false);
  });

  it('returns true for every tool when the agent uses `tools: "all"`', () => {
    expect(isToolBackgroundEligible({ toolName: 'anything', agentConfig: { tools: 'all' } })).toBe(true);
  });

  it('strips the `agent-` prefix for sub-agent tools', () => {
    expect(
      isToolBackgroundEligible({ toolName: 'agent-biExecutor', agentConfig: { tools: { biExecutor: true } } }),
    ).toBe(true);
  });

  it('strips the `workflow-` prefix for workflow tools', () => {
    expect(isToolBackgroundEligible({ toolName: 'workflow-etl', agentConfig: { tools: { etl: true } } })).toBe(true);
  });

  it('returns false when the agent disabled background tasks entirely', () => {
    expect(
      isToolBackgroundEligible({
        toolName: 'research',
        toolConfig: { enabled: true },
        agentConfig: { disabled: true, tools: 'all' },
      }),
    ).toBe(false);
  });
});
