import { describe, expect, it, vi } from 'vitest';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
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
});
