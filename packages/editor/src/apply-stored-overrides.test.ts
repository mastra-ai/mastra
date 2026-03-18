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

  it('mutates the same agent instance (does not create a new one)', async () => {
    const { editor, codeAgent } = await setup({
      name: 'Stored Agent',
      instructions: 'Updated instructions.',
      model: { provider: 'openai', name: 'gpt-4o' },
    });

    const result = await editor.agent.applyStoredOverrides(codeAgent);

    // Should be the same object reference
    expect(result).toBe(codeAgent);
  });
});
