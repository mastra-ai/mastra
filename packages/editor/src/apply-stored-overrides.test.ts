import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent, DurableAgent } from '@mastra/core/agent/durable';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import type { ResolveToolsOpts, ToolProvider } from '@mastra/core/tool-provider';
import type { ToolAction } from '@mastra/core/tools';
import { MastraEditor } from './index';

describe('applyStoredOverrides', () => {
  async function setup(storedAgentData?: Record<string, unknown>) {
    const storage = new InMemoryStore();
    const editor = new MastraEditor();
    const codeAgent = new Agent({
      id: 'my-agent',
      name: 'Code Agent',
      instructions: 'You are a code-defined agent.',
      model: 'openai/gpt-4o',
    });
    const mastra = new Mastra({
      storage,
      editor,
      agents: { 'my-agent': codeAgent },
    });

    if (storedAgentData) {
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.create({ agent: { id: 'my-agent', ...storedAgentData } });
    }

    return { storage, editor, mastra, codeAgent };
  }

  it('returns the agent unchanged when no stored config exists', async () => {
    const { editor, codeAgent } = await setup();

    const result = await editor.agent.applyStoredOverrides(codeAgent);

    expect(result).toBe(codeAgent);
    const instructions = await result.getInstructions();
    expect(instructions).toBe('You are a code-defined agent.');
  });

  it('overrides instructions from stored config', async () => {
    const { editor, codeAgent } = await setup({
      name: 'Stored Agent Name',
      instructions: 'You are a stored-config agent with updated instructions.',
      model: { provider: 'openai', name: 'gpt-4o' },
    });

    const result = await editor.agent.applyStoredOverrides(codeAgent);

    const instructions = await result.getInstructions();
    expect(instructions).toBe('You are a stored-config agent with updated instructions.');
  });

  it('does not override anything when code agent disables editor overrides', async () => {
    const storage = new InMemoryStore();
    const editor = new MastraEditor();
    const codeTool = createTool({
      id: 'code-tool',
      description: 'Code description',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async () => ({ ok: true }),
    });
    const storedTool = createTool({
      id: 'stored-tool',
      description: 'Stored description',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async () => ({ ok: true }),
    });
    const codeAgent = new Agent({
      id: 'my-agent',
      name: 'Code Agent',
      instructions: 'Code instructions',
      model: 'openai/gpt-4o',
      tools: { 'code-tool': codeTool },
      editor: false,
    });
    new Mastra({
      storage,
      editor,
      agents: { 'my-agent': codeAgent },
      tools: { 'stored-tool': storedTool },
    });

    const agentsStore = await storage.getStore('agents');
    await agentsStore?.create({
      agent: {
        id: 'my-agent',
        name: 'Stored Agent',
        instructions: 'Stored instructions',
        model: { provider: 'openai', name: 'gpt-4o' },
        tools: { 'stored-tool': {} },
      },
    });

    const result = await editor.agent.applyStoredOverrides(codeAgent);

    expect(await result.getInstructions()).toBe('Code instructions');
    const tools = await result.listTools();
    expect(tools['code-tool']).toBeDefined();
    expect(tools['stored-tool']).toBeUndefined();
  });

  it('only applies stored tool description overrides when code owns tool implementations', async () => {
    const storage = new InMemoryStore();
    const editor = new MastraEditor();
    const codeTool = createTool({
      id: 'code-tool',
      description: 'Code description',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async () => ({ ok: true }),
    });
    const storedTool = createTool({
      id: 'stored-tool',
      description: 'Stored description',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async () => ({ ok: true }),
    });
    const codeAgent = new Agent({
      id: 'my-agent',
      name: 'Code Agent',
      instructions: 'Code instructions',
      model: 'openai/gpt-4o',
      tools: { 'code-tool': codeTool },
      editor: { tools: { description: true } },
    });
    new Mastra({
      storage,
      editor,
      agents: { 'my-agent': codeAgent },
      tools: { 'stored-tool': storedTool },
    });

    const agentsStore = await storage.getStore('agents');
    await agentsStore?.create({
      agent: {
        id: 'my-agent',
        name: 'Stored Agent',
        instructions: 'Stored instructions',
        model: { provider: 'openai', name: 'gpt-4o' },
        tools: { 'code-tool': { description: 'Stored code-tool description' }, 'stored-tool': {} },
      },
    });

    const result = await editor.agent.applyStoredOverrides(codeAgent);

    expect(await result.getInstructions()).toBe('Code instructions');
    const tools = await result.listTools();
    expect(tools['code-tool']?.description).toBe('Stored code-tool description');
    expect(tools['stored-tool']).toBeUndefined();
  });

  it('preserves a createDurableAgent wrapper and its code-owned tools when applying an instructions-only override', async () => {
    const storage = new InMemoryStore();
    const editor = new MastraEditor();
    const ping = createTool({
      id: 'ping',
      description: 'Ping',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async () => ({ ok: true }),
    });
    const codeAgent = new Agent({
      id: 'my-agent',
      name: 'Code Agent',
      instructions: 'Code instructions',
      model: 'openai/gpt-4o',
      tools: { ping },
      editor: { instructions: true, tools: false },
    });
    const durableAgent = createDurableAgent({ agent: codeAgent });
    new Mastra({
      storage,
      editor,
      agents: { 'my-agent': durableAgent },
    });

    // Publish an override that touches only instructions/model — it carries no tools.
    const agentsStore = await storage.getStore('agents');
    await agentsStore?.create({
      agent: {
        id: 'my-agent',
        name: 'Stored Agent',
        instructions: 'Overridden instructions',
        model: { provider: 'openai', name: 'gpt-4o' },
      },
    });

    const result = await editor.agent.applyStoredOverrides(durableAgent);

    // The served agent must stay a DurableAgent (its delegating behavior intact)…
    expect(result).toBeInstanceOf(DurableAgent);
    // …keep its code-owned tool (editor: { tools: false })…
    const tools = await result.listTools();
    expect(Object.keys(tools)).toContain('ping');
    // …and reflect the instructions override.
    expect(await result.getInstructions()).toBe('Overridden instructions');
    // The original singleton must not be mutated by the fork.
    expect(await durableAgent.getInstructions()).toBe('Code instructions');
  });

  it('does not override model from stored config (model is code-only)', async () => {
    const { editor, codeAgent } = await setup({
      name: 'Stored Agent',
      instructions: 'Test',
      model: { provider: 'anthropic', name: 'claude-sonnet-4-20250514' },
    });

    const result = await editor.agent.applyStoredOverrides(codeAgent);

    // Model should remain unchanged — stored model is ignored
    const modelValue = (result as any).model;
    expect(modelValue).toBe('openai/gpt-4o');
  });

  it('does not override instructions when stored config has no instructions', async () => {
    const { editor, codeAgent } = await setup({
      name: 'Stored Agent',
      model: { provider: 'openai', name: 'gpt-4o' },
    });

    // The stored config doesn't have `instructions` set, so the code agent's
    // instructions should be preserved.
    const result = await editor.agent.applyStoredOverrides(codeAgent);

    const instructions = await result.getInstructions();
    expect(instructions).toBe('You are a code-defined agent.');
  });

  it('returns agent unchanged when editor is not registered', async () => {
    const editor = new MastraEditor();
    const agent = new Agent({
      id: 'standalone-agent',
      name: 'Standalone',
      instructions: 'Original',
      model: 'openai/gpt-4o',
    });

    // applyStoredOverrides should not throw — it returns the agent unchanged
    const result = await editor.agent.applyStoredOverrides(agent);
    expect(result).toBe(agent);
  });

  it('returns a forked agent instance (does not mutate the original)', async () => {
    const { editor, codeAgent } = await setup({
      name: 'Stored Agent',
      instructions: 'Updated instructions.',
      model: { provider: 'openai', name: 'gpt-4o' },
    });

    const result = await editor.agent.applyStoredOverrides(codeAgent);

    // Should be a different object reference — the original is not mutated
    expect(result).not.toBe(codeAgent);
    expect(result.id).toBe(codeAgent.id);

    // Original agent should retain its code-defined instructions
    const originalInstructions = await codeAgent.getInstructions();
    expect(originalInstructions).toBe('You are a code-defined agent.');

    // Forked agent should have the overridden instructions
    const forkedInstructions = await result.getInstructions();
    expect(forkedInstructions).toBe('Updated instructions.');
  });

  it('merges conditional stored tools with code tools without recursively calling the fork', async () => {
    const storage = new InMemoryStore();
    const editor = new MastraEditor();
    const codeTool = createTool({
      id: 'code-tool',
      description: 'Code tool',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async () => ({ ok: true }),
    });
    const storedTool = createTool({
      id: 'stored-tool',
      description: 'Stored tool',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async () => ({ ok: true }),
    });
    const codeAgent = new Agent({
      id: 'my-agent',
      name: 'Code Agent',
      instructions: 'You are a code-defined agent.',
      model: 'openai/gpt-4o',
      tools: { 'code-tool': codeTool },
    });
    new Mastra({
      storage,
      editor,
      agents: { 'my-agent': codeAgent },
      tools: { 'stored-tool': storedTool },
    });

    const agentsStore = await storage.getStore('agents');
    await agentsStore?.create({
      agent: {
        id: 'my-agent',
        name: 'Stored Agent',
        instructions: 'You are a stored-config agent.',
        model: { provider: 'openai', name: 'gpt-4o' },
        tools: [
          {
            value: { 'stored-tool': {} },
            rules: {
              operator: 'AND',
              conditions: [{ field: 'tier', operator: 'equals', value: 'premium' }],
            },
          },
        ],
      },
    });

    const result = await editor.agent.applyStoredOverrides(codeAgent);

    const premiumTools = await result.listTools({ requestContext: new RequestContext([['tier', 'premium']]) });
    expect(premiumTools['code-tool']).toBeDefined();
    expect(premiumTools['stored-tool']).toBeDefined();

    const defaultTools = await result.listTools({ requestContext: new RequestContext() });
    expect(defaultTools['code-tool']).toBeDefined();
    expect(defaultTools['stored-tool']).toBeUndefined();
  });

  it('resolves with the published (active) version when status is "published"', async () => {
    const { storage, editor, codeAgent } = await setup({
      name: 'Draft v1',
      instructions: 'Version 1 instructions.',
      model: { provider: 'openai', name: 'gpt-4o' },
    });

    // Create a second version and activate it as the published version
    const agentsStore = await storage.getStore('agents');
    const publishedVersionId = 'published-version-id';
    await agentsStore?.createVersion({
      id: publishedVersionId,
      agentId: 'my-agent',
      versionNumber: 2,
      name: 'Published v2',
      instructions: 'Published version instructions.',
      model: { provider: 'openai', name: 'gpt-4o' },
      changedFields: ['instructions'],
      changeMessage: 'Published version',
    });
    await agentsStore?.update({ id: 'my-agent', activeVersionId: publishedVersionId });

    // Create a third version (latest draft) that's newer but not published
    await agentsStore?.createVersion({
      id: 'draft-version-id',
      agentId: 'my-agent',
      versionNumber: 3,
      name: 'Draft v3',
      instructions: 'Latest draft instructions.',
      model: { provider: 'openai', name: 'gpt-4o' },
      changedFields: ['instructions'],
      changeMessage: 'Draft version',
    });

    const result = await editor.agent.applyStoredOverrides(codeAgent, { status: 'published' });
    const instructions = await result.getInstructions();
    expect(instructions).toBe('Published version instructions.');
  });

  it('resolves with the latest draft version by default', async () => {
    const { storage, editor, codeAgent } = await setup({
      name: 'Draft v1',
      instructions: 'Version 1 instructions.',
      model: { provider: 'openai', name: 'gpt-4o' },
    });

    // Create a second version and activate it
    const agentsStore = await storage.getStore('agents');
    await agentsStore?.createVersion({
      id: 'published-version-id',
      agentId: 'my-agent',
      versionNumber: 2,
      name: 'Published v2',
      instructions: 'Published version instructions.',
      model: { provider: 'openai', name: 'gpt-4o' },
      changedFields: ['instructions'],
      changeMessage: 'Published version',
    });
    await agentsStore?.update({ id: 'my-agent', activeVersionId: 'published-version-id' });

    // Create a third version (latest draft)
    await agentsStore?.createVersion({
      id: 'draft-version-id',
      agentId: 'my-agent',
      versionNumber: 3,
      name: 'Draft v3',
      instructions: 'Latest draft instructions.',
      model: { provider: 'openai', name: 'gpt-4o' },
      changedFields: ['instructions'],
      changeMessage: 'Draft version',
    });

    // Default (no options) should resolve with the latest draft
    const result = await editor.agent.applyStoredOverrides(codeAgent);
    const instructions = await result.getInstructions();
    expect(instructions).toBe('Latest draft instructions.');
  });

  it('resolves with a specific version when versionId is provided', async () => {
    const { storage, editor, codeAgent } = await setup({
      name: 'Draft v1',
      instructions: 'Version 1 instructions.',
      model: { provider: 'openai', name: 'gpt-4o' },
    });

    // Create additional versions
    const agentsStore = await storage.getStore('agents');
    const specificVersionId = 'specific-version-id';
    await agentsStore?.createVersion({
      id: specificVersionId,
      agentId: 'my-agent',
      versionNumber: 2,
      name: 'Specific v2',
      instructions: 'Specific version instructions.',
      model: { provider: 'openai', name: 'gpt-4o' },
      changedFields: ['instructions'],
      changeMessage: 'Specific version',
    });

    // Create a third version (latest)
    await agentsStore?.createVersion({
      id: 'latest-version-id',
      agentId: 'my-agent',
      versionNumber: 3,
      name: 'Latest v3',
      instructions: 'Latest version instructions.',
      model: { provider: 'openai', name: 'gpt-4o' },
      changedFields: ['instructions'],
      changeMessage: 'Latest version',
    });

    const result = await editor.agent.applyStoredOverrides(codeAgent, { versionId: specificVersionId });
    const instructions = await result.getInstructions();
    expect(instructions).toBe('Specific version instructions.');
  });

  it('preserves code defaults when status is "published" but no version has been published', async () => {
    // Setup creates a stored agent but does NOT set activeVersionId
    const { editor, codeAgent } = await setup({
      name: 'Stored Draft',
      instructions: 'Stored draft instructions.',
      model: { provider: 'openai', name: 'gpt-4o' },
    });

    // Request published status — but no activeVersionId exists, so code defaults should be used
    const result = await editor.agent.applyStoredOverrides(codeAgent, { status: 'published' });
    expect(result).toBe(codeAgent);
    const instructions = await result.getInstructions();
    expect(instructions).toBe('You are a code-defined agent.');
  });

  it('merges v1 toolProviders into the code agent tool list', async () => {
    const storage = new InMemoryStore();
    const codeTool = createTool({
      id: 'code-tool',
      description: 'Code tool',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async () => ({ ok: true }),
    });
    const codeAgent = new Agent({
      id: 'my-agent',
      name: 'Code Agent',
      instructions: 'You are a code-defined agent.',
      model: 'openai/gpt-4o',
      tools: { 'code-tool': codeTool },
    });

    const stubProvider: ToolProvider = {
      info: { id: 'composio', name: 'Composio', description: 'stub' },
      listToolkits: vi.fn(async () => ({ data: [] })),
      listTools: vi.fn(async () => ({ data: [] })),
      getToolSchema: vi.fn(async () => ({ type: 'object', properties: {} })),
      resolveTools: vi.fn(async () => ({})),
      resolveToolsVNext: vi.fn(async (opts: ResolveToolsOpts): Promise<Record<string, ToolAction<any, any, any>>> => {
        const result: Record<string, ToolAction<any, any, any>> = {};
        for (const slug of opts.toolSlugs) {
          result[slug] = {
            id: slug,
            description: opts.toolMeta?.[slug]?.description ?? 'provider tool',
            execute: vi.fn(async () => ({ ok: true, connectionId: opts.connectionId })),
          } as any;
        }
        return result;
      }),
    };

    const editor = new MastraEditor({ toolProviders: { composio: stubProvider } });
    new Mastra({ storage, editor, agents: { 'my-agent': codeAgent } });

    const agentsStore = await storage.getStore('agents');
    await agentsStore?.create({
      agent: {
        id: 'my-agent',
        name: 'Stored Override',
        authorId: 'author-1',
        model: { provider: 'openai', name: 'gpt-4o' },
        toolProviders: {
          composio: {
            tools: {
              GITHUB_LIST_REPOSITORY_ISSUES: {
                toolkit: 'github',
                description: 'Lists issues (override)',
              },
            },
            connections: {
              github: [
                {
                  kind: 'author',
                  toolkit: 'github',
                  connectionId: 'stub-connection-id',
                  scope: 'per-author',
                },
              ],
            },
          },
        },
      },
    });

    const result = await editor.agent.applyStoredOverrides(codeAgent);
    const tools = await result.listTools({ requestContext: new RequestContext() });

    expect(tools['code-tool']).toBeDefined();
    expect(tools['GITHUB_LIST_REPOSITORY_ISSUES']).toBeDefined();
    expect(tools['GITHUB_LIST_REPOSITORY_ISSUES'].description).toBe('Lists issues (override)');

    expect(stubProvider.resolveToolsVNext).toHaveBeenCalledWith(
      expect.objectContaining({
        toolSlugs: ['GITHUB_LIST_REPOSITORY_ISSUES'],
        connectionId: 'stub-connection-id',
        authorId: 'author-1',
      }),
    );
  });
});
