import { describe, expect, it } from 'vitest';
import { isModelBackgroundOverrideAllowed, isToolBackgroundEligible, resolveBackgroundConfig } from './resolve-config';
import type { AgentBackgroundConfig } from './types';

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

  it.each([
    ['ignores `llmOverride.enabled: true` when the agent opted in OTHER tools but not this one', 'calculator', false],
    ['honors LLM override when the agent opted the tool in', 'research', true],
  ] as const)('%s', (_title, toolName, expected) => {
    const resolved = resolveBackgroundConfig({
      llmBgOverrides: { enabled: true },
      toolName,
      toolConfig: undefined,
      agentConfig: { tools: { research: true } },
      managerConfig: { enabled: true },
    });

    expect(resolved.runInBackground).toBe(expected);
  });

  it('defers an eligible tool by default when the call has no override', () => {
    const resolved = resolveBackgroundConfig({
      llmBgOverrides: {},
      toolName: 'research',
      toolConfig: { enabled: true },
      agentConfig: undefined,
      managerConfig: { enabled: true },
    });

    expect(resolved).toMatchObject({ runInBackground: true, disposition: 'deferred' });
  });

  it('defers an agent-eligible tool by default when the call has no override', () => {
    const resolved = resolveBackgroundConfig({
      llmBgOverrides: {},
      toolName: 'research',
      toolConfig: undefined,
      agentConfig: { tools: { research: true } },
      managerConfig: { enabled: true },
    });

    expect(resolved).toMatchObject({ runInBackground: true, disposition: 'deferred' });
  });

  it('keeps an eligible tool foreground by default when `defaultDisposition: "foreground"` is configured', () => {
    const resolved = resolveBackgroundConfig({
      llmBgOverrides: {},
      toolName: 'research',
      toolConfig: { enabled: true, defaultDisposition: 'foreground' },
      agentConfig: undefined,
      managerConfig: { enabled: true },
    });

    expect(resolved).toMatchObject({ runInBackground: false, disposition: 'foreground' });
  });

  it('keeps an agent-eligible tool foreground by default when the agent config sets `defaultDisposition: "foreground"`', () => {
    const resolved = resolveBackgroundConfig({
      llmBgOverrides: {},
      toolName: 'research',
      toolConfig: undefined,
      agentConfig: { tools: { research: { enabled: true, defaultDisposition: 'foreground' } } },
      managerConfig: { enabled: true },
    });

    expect(resolved).toMatchObject({ runInBackground: false, disposition: 'foreground' });
  });

  it('lets a per-call disposition opt an eligible foreground-default tool into background', () => {
    const resolved = resolveBackgroundConfig({
      llmBgOverrides: { disposition: 'deferred' },
      toolName: 'research',
      toolConfig: { enabled: true, defaultDisposition: 'foreground' },
      agentConfig: undefined,
      managerConfig: { enabled: true },
    });

    expect(resolved).toMatchObject({ runInBackground: true, disposition: 'deferred' });
  });

  it('lets the agent-level defaultDisposition override the tool-level one', () => {
    const resolved = resolveBackgroundConfig({
      llmBgOverrides: {},
      toolName: 'research',
      toolConfig: { enabled: true, defaultDisposition: 'foreground' },
      agentConfig: { tools: { research: { enabled: true, defaultDisposition: 'deferred' } } },
      managerConfig: { enabled: true },
    });

    expect(resolved).toMatchObject({ runInBackground: true, disposition: 'deferred' });
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

/**
 * Regression tests for https://github.com/mastra-ai/mastra/issues/28638.
 *
 * `modelOverrides: false` keeps a tool background-eligible while removing the
 * model's per-call `_background` override, so dispatch must ignore one the
 * model sends anyway.
 */
describe('resolveBackgroundConfig with modelOverrides: false', () => {
  it('ignores the model override and keeps the configured settings', () => {
    const resolved = resolveBackgroundConfig({
      llmBgOverrides: { disposition: 'foreground', timeoutMs: 1, maxRetries: 9 },
      toolName: 'research',
      toolConfig: { enabled: true, modelOverrides: false, timeoutMs: 5000, maxRetries: 2 },
      managerConfig: { enabled: true },
    });

    expect(resolved).toEqual({ runInBackground: true, disposition: 'deferred', timeoutMs: 5000, maxRetries: 2 });
  });

  it('keeps a foreground-default tool in the foreground even when the model asks for background', () => {
    const resolved = resolveBackgroundConfig({
      llmBgOverrides: { disposition: 'deferred' },
      toolName: 'research',
      toolConfig: { enabled: true, defaultDisposition: 'foreground', modelOverrides: false },
      managerConfig: { enabled: true },
    });

    expect(resolved.runInBackground).toBe(false);
    expect(resolved.disposition).toBe('foreground');
  });

  it('honors an agent per-tool modelOverrides: false over the tool config', () => {
    const resolved = resolveBackgroundConfig({
      llmBgOverrides: { enabled: false },
      toolName: 'research',
      toolConfig: { enabled: true, modelOverrides: true },
      agentConfig: { tools: { research: { enabled: true, modelOverrides: false } } },
      managerConfig: { enabled: true },
    });

    expect(resolved.disposition).toBe('deferred');
  });

  it('still applies the model override when modelOverrides is unset', () => {
    const resolved = resolveBackgroundConfig({
      llmBgOverrides: { disposition: 'foreground' },
      toolName: 'research',
      toolConfig: { enabled: true },
      managerConfig: { enabled: true },
    });

    expect(resolved.disposition).toBe('foreground');
  });
});

describe('isModelBackgroundOverrideAllowed', () => {
  it('defaults to true', () => {
    expect(isModelBackgroundOverrideAllowed({ toolName: 'research', toolConfig: { enabled: true } })).toBe(true);
  });

  it('reads the tool config', () => {
    expect(
      isModelBackgroundOverrideAllowed({ toolName: 'research', toolConfig: { enabled: true, modelOverrides: false } }),
    ).toBe(false);
  });

  it('lets the agent per-tool entry win in either direction', () => {
    expect(
      isModelBackgroundOverrideAllowed({
        toolName: 'research',
        toolConfig: { enabled: true, modelOverrides: false },
        agentConfig: { tools: { research: { enabled: true, modelOverrides: true } } },
      }),
    ).toBe(true);
    expect(
      isModelBackgroundOverrideAllowed({
        toolName: 'research',
        toolConfig: { enabled: true },
        agentConfig: { tools: { research: { enabled: true, modelOverrides: false } } },
      }),
    ).toBe(false);
  });

  it('falls back to the tool config for boolean entries and tools: "all"', () => {
    const toolConfig = { enabled: true, modelOverrides: false };
    expect(
      isModelBackgroundOverrideAllowed({
        toolName: 'research',
        toolConfig,
        agentConfig: { tools: { research: true } },
      }),
    ).toBe(false);
    expect(isModelBackgroundOverrideAllowed({ toolName: 'research', toolConfig, agentConfig: { tools: 'all' } })).toBe(
      false,
    );
  });

  it('strips agent- and workflow- prefixes', () => {
    const agentConfig = { tools: { biExecutor: { enabled: true, modelOverrides: false } } };
    expect(isModelBackgroundOverrideAllowed({ toolName: 'agent-biExecutor', agentConfig })).toBe(false);
    expect(isModelBackgroundOverrideAllowed({ toolName: 'workflow-biExecutor', agentConfig })).toBe(false);
  });
});

/**
 * Regression tests for https://github.com/mastra-ai/mastra/issues/31614 and
 * https://github.com/mastra-ai/mastra/issues/31612.
 *
 * `AgentBackgroundConfig` gains agent-wide `defaultDisposition` and
 * `modelOverrides`. They apply to `tools: 'all'` and act as defaults for named
 * per-tool entries; a named entry keeps the last word. Agent-wide fields never
 * change eligibility, so they cannot newly enable background execution.
 */
describe('agent-wide defaultDisposition and modelOverrides (#31614, #31612)', () => {
  describe('defaultDisposition', () => {
    it('keeps every tool foreground by default with tools: "all"', () => {
      const resolved = resolveBackgroundConfig({
        llmBgOverrides: {},
        toolName: 'anything',
        agentConfig: { tools: 'all', defaultDisposition: 'foreground' },
        managerConfig: { enabled: true },
      });

      expect(resolved).toMatchObject({ runInBackground: false, disposition: 'foreground' });
    });

    it.each(['deferred', 'awaited'] as const)('still lets a call opt into %s', disposition => {
      const resolved = resolveBackgroundConfig({
        llmBgOverrides: { disposition },
        toolName: 'anything',
        agentConfig: { tools: 'all', defaultDisposition: 'foreground' },
        managerConfig: { enabled: true },
      });

      expect(resolved).toMatchObject({ runInBackground: true, disposition });
    });

    it('applies the agent-wide default to a named boolean entry, over the tool default', () => {
      const resolved = resolveBackgroundConfig({
        llmBgOverrides: {},
        toolName: 'research',
        toolConfig: { enabled: true, defaultDisposition: 'deferred' },
        agentConfig: { tools: { research: true }, defaultDisposition: 'foreground' },
        managerConfig: { enabled: true },
      });

      expect(resolved).toMatchObject({ runInBackground: false, disposition: 'foreground' });
    });

    it('applies the agent-wide default to a named object entry that omits defaultDisposition', () => {
      const resolved = resolveBackgroundConfig({
        llmBgOverrides: {},
        toolName: 'research',
        toolConfig: { enabled: true, defaultDisposition: 'deferred' },
        agentConfig: { tools: { research: { enabled: true } }, defaultDisposition: 'foreground' },
        managerConfig: { enabled: true },
      });

      expect(resolved).toMatchObject({ runInBackground: false, disposition: 'foreground' });
    });

    it('lets a named entry override the agent-wide default', () => {
      const resolved = resolveBackgroundConfig({
        llmBgOverrides: {},
        toolName: 'research',
        toolConfig: { enabled: true },
        agentConfig: {
          tools: { research: { enabled: true, defaultDisposition: 'deferred' } },
          defaultDisposition: 'foreground',
        },
        managerConfig: { enabled: true },
      });

      expect(resolved).toMatchObject({ runInBackground: true, disposition: 'deferred' });
    });

    it('falls back to the tool default when neither agent rung is set', () => {
      const resolved = resolveBackgroundConfig({
        llmBgOverrides: {},
        toolName: 'research',
        toolConfig: { enabled: true, defaultDisposition: 'foreground' },
        agentConfig: { tools: { research: true } },
        managerConfig: { enabled: true },
      });

      expect(resolved).toMatchObject({ runInBackground: false, disposition: 'foreground' });
    });

    it('falls back to deferred when no rung is set', () => {
      const resolved = resolveBackgroundConfig({
        llmBgOverrides: {},
        toolName: 'research',
        toolConfig: { enabled: true },
        agentConfig: { tools: { research: true } },
        managerConfig: { enabled: true },
      });

      expect(resolved).toMatchObject({ runInBackground: true, disposition: 'deferred' });
    });
  });

  describe('modelOverrides', () => {
    it('lets the agent-wide false override a tool that allows overrides', () => {
      expect(
        isModelBackgroundOverrideAllowed({
          toolName: 'research',
          toolConfig: { enabled: true, modelOverrides: true },
          agentConfig: { tools: { research: true }, modelOverrides: false },
        }),
      ).toBe(false);
    });

    it('applies the agent-wide false to tools: "all"', () => {
      expect(
        isModelBackgroundOverrideAllowed({
          toolName: 'anything',
          toolConfig: { enabled: true, modelOverrides: true },
          agentConfig: { tools: 'all', modelOverrides: false },
        }),
      ).toBe(false);
    });

    it('lets a named entry re-enable overrides over the agent-wide false', () => {
      expect(
        isModelBackgroundOverrideAllowed({
          toolName: 'research',
          toolConfig: { enabled: true, modelOverrides: false },
          agentConfig: {
            tools: { research: { enabled: true, modelOverrides: true } },
            modelOverrides: false,
          },
        }),
      ).toBe(true);
    });

    it('lets a named entry disable overrides over an agent-wide true', () => {
      expect(
        isModelBackgroundOverrideAllowed({
          toolName: 'research',
          toolConfig: { enabled: true },
          agentConfig: {
            tools: { research: { enabled: true, modelOverrides: false } },
            modelOverrides: true,
          },
        }),
      ).toBe(false);
    });

    it('preserves true when nothing is configured', () => {
      expect(
        isModelBackgroundOverrideAllowed({
          toolName: 'research',
          toolConfig: { enabled: true },
          agentConfig: { tools: { research: true } },
        }),
      ).toBe(true);
    });
  });

  describe('does not newly enable background execution', () => {
    it('ignores agent-wide fields when there is no tools config', () => {
      const agentConfig: AgentBackgroundConfig = { defaultDisposition: 'foreground', modelOverrides: false };
      expect(isToolBackgroundEligible({ toolName: 'research', agentConfig })).toBe(false);

      const resolved = resolveBackgroundConfig({
        llmBgOverrides: { enabled: true },
        toolName: 'research',
        agentConfig,
        managerConfig: { enabled: true },
      });
      expect(resolved).toMatchObject({ runInBackground: false, disposition: 'foreground' });
    });

    it('ignores agent-wide fields for a tool unlisted in a named record', () => {
      const agentConfig: AgentBackgroundConfig = { tools: { other: true }, defaultDisposition: 'foreground' };
      expect(isToolBackgroundEligible({ toolName: 'research', agentConfig })).toBe(false);

      const resolved = resolveBackgroundConfig({
        llmBgOverrides: { enabled: true },
        toolName: 'research',
        agentConfig,
        managerConfig: { enabled: true },
      });
      expect(resolved).toMatchObject({ runInBackground: false, disposition: 'foreground' });
    });

    it('keeps a named `false` entry ineligible even with agent-wide defaults', () => {
      const agentConfig: AgentBackgroundConfig = { tools: { research: false }, modelOverrides: false };
      expect(isToolBackgroundEligible({ toolName: 'research', toolConfig: { enabled: true }, agentConfig })).toBe(
        false,
      );

      const resolved = resolveBackgroundConfig({
        llmBgOverrides: { disposition: 'deferred' },
        toolName: 'research',
        toolConfig: { enabled: true },
        agentConfig,
        managerConfig: { enabled: true },
      });
      expect(resolved).toMatchObject({ runInBackground: false, disposition: 'foreground' });
    });
  });
});
