import { describe, it, expect } from 'vitest';
import { Agent } from '../agent';
import type { ToolsInput, ToolsetsInput } from '../agent/types';
import { RequestContext } from '../request-context';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';

function createAgent() {
  return new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });
}

function createRequestContext() {
  return new RequestContext() as RequestContext;
}

/** Dummy tool that satisfies ToolsInput shape */
const dummyTool = {
  type: 'function' as const,
  function: { name: 'dummy', parameters: {}, description: 'dummy' },
};

// ===========================================================================
// Static toolsets
// ===========================================================================

describe('Harness toolsets config — static', () => {
  it('spreads static toolsets into buildToolsets result', async () => {
    const customToolsets: ToolsetsInput = {
      anthropic: { web_search: dummyTool } as unknown as ToolsInput,
    };

    const harness = new Harness({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      toolsets: customToolsets,
    });

    const rc = createRequestContext();
    const result: ToolsetsInput = await (harness as any).buildToolsets(rc);

    // Should have the built-in toolset
    expect(result.harnessBuiltIn).toBeDefined();
    // Should have the user-provided toolset spread in
    expect(result.anthropic).toBe(customToolsets.anthropic);
  });

  it('does not include extra keys when toolsets is undefined', async () => {
    const harness = new Harness({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
    });

    const rc = createRequestContext();
    const result: ToolsetsInput = await (harness as any).buildToolsets(rc);

    expect(result.harnessBuiltIn).toBeDefined();
    expect(Object.keys(result)).toEqual(['harnessBuiltIn']);
  });
});

// ===========================================================================
// Dynamic toolsets (function receives modelId)
// ===========================================================================

describe('Harness toolsets config — dynamic', () => {
  it('passes current modelId to the toolsets function', async () => {
    const anthropicToolset = { web_search: dummyTool } as unknown as ToolsInput;
    const openaiToolset = { web_search: dummyTool } as unknown as ToolsInput;

    const toolsetsFn = (modelId: string) => {
      if (modelId.startsWith('anthropic/')) return { anthropic: anthropicToolset };
      if (modelId.startsWith('openai/')) return { openai: openaiToolset };
      return undefined;
    };

    // Harness with an Anthropic default model
    const harness = new Harness({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [
        {
          id: 'default',
          name: 'Default',
          default: true,
          defaultModelId: 'anthropic/claude-sonnet-4-20250514',
          agent: createAgent(),
        },
      ],
      toolsets: toolsetsFn,
    });

    const rc = createRequestContext();
    const result: ToolsetsInput = await (harness as any).buildToolsets(rc);

    expect(result.harnessBuiltIn).toBeDefined();
    expect(result.anthropic).toBe(anthropicToolset);
    expect(result.openai).toBeUndefined();
  });

  it('returns openai toolset when model is openai', async () => {
    const openaiToolset = { web_search: dummyTool } as unknown as ToolsInput;

    const toolsetsFn = (modelId: string) => {
      if (modelId.startsWith('openai/')) return { openai: openaiToolset };
      return undefined;
    };

    const harness = new Harness({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [
        {
          id: 'default',
          name: 'Default',
          default: true,
          defaultModelId: 'openai/gpt-4o',
          agent: createAgent(),
        },
      ],
      toolsets: toolsetsFn,
    });

    const rc = createRequestContext();
    const result: ToolsetsInput = await (harness as any).buildToolsets(rc);

    expect(result.harnessBuiltIn).toBeDefined();
    expect(result.openai).toBe(openaiToolset);
  });

  it('resolves async dynamic toolsets function', async () => {
    const customToolsets: ToolsetsInput = {
      anthropic: { web_search: dummyTool } as unknown as ToolsInput,
    };

    const harness = new Harness({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [
        {
          id: 'default',
          name: 'Default',
          default: true,
          defaultModelId: 'anthropic/claude-sonnet-4-20250514',
          agent: createAgent(),
        },
      ],
      toolsets: async () => customToolsets,
    });

    const rc = createRequestContext();
    const result: ToolsetsInput = await (harness as any).buildToolsets(rc);

    expect(result.harnessBuiltIn).toBeDefined();
    expect(result.anthropic).toBe(customToolsets.anthropic);
  });

  it('handles dynamic toolsets returning undefined', async () => {
    const harness = new Harness({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      toolsets: () => undefined,
    });

    const rc = createRequestContext();
    const result: ToolsetsInput = await (harness as any).buildToolsets(rc);

    expect(result.harnessBuiltIn).toBeDefined();
    // No extra keys beyond built-in
    expect(Object.keys(result)).toEqual(['harnessBuiltIn']);
  });

  it('returns no extra toolsets when modelId is empty and function returns undefined', async () => {
    const harness = new Harness({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      toolsets: (modelId: string) => {
        if (!modelId) return undefined;
        return { some: { tool: dummyTool } as unknown as ToolsInput };
      },
    });

    const rc = createRequestContext();
    const result: ToolsetsInput = await (harness as any).buildToolsets(rc);

    expect(Object.keys(result)).toEqual(['harnessBuiltIn']);
  });
});

// ===========================================================================
// Toolsets + tools combined
// ===========================================================================

describe('Harness toolsets config — combined with tools', () => {
  it('includes both harness tools and custom toolsets', async () => {
    const harnessTools: ToolsInput = {
      my_tool: dummyTool as unknown as ToolsInput[string],
    };
    const customToolsets: ToolsetsInput = {
      anthropic: { web_search: dummyTool } as unknown as ToolsInput,
    };

    const harness = new Harness({
      id: 'test',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
      tools: harnessTools,
      toolsets: customToolsets,
    });

    const rc = createRequestContext();
    const result: ToolsetsInput = await (harness as any).buildToolsets(rc);

    // Built-in tools
    expect(result.harnessBuiltIn).toBeDefined();
    // User-configured harness tools
    expect(result.harness).toBe(harnessTools);
    // Provider-scoped toolsets
    expect(result.anthropic).toBe(customToolsets.anthropic);
  });
});
