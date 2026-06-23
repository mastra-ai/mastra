import { describe, expect, it } from 'vitest';
import { Agent } from '@mastra/core/agent';
import { createEditorScenarioMastra } from './editor-scenario-utils';

describe('Editor E2E scenario: stored agent creation reaches runtime', () => {
  it('creates a stored agent, registers it with Mastra, and uses stored instructions during generation', async () => {
    // USER STORY: A Studio user creates an agent in the editor and can immediately run it.
    // ARRANGE: Start a real Mastra + Editor + storage stack with a deterministic model gateway.
    const { editor, mastra } = createEditorScenarioMastra();

    // ACT: Persist the agent through the Editor namespace, then run the hydrated runtime agent.
    const created = await editor.agent.create({
      id: 'support-agent',
      name: 'Support Agent',
      instructions: 'Answer as the persisted support specialist.',
      model: { provider: 'mock', name: 'editor-scenario' },
    });
    const runtimeAgent = mastra.getAgentById('support-agent');
    const result = await runtimeAgent.generate('Who are you?');

    // ASSERT: The same runtime agent is registered and its model request contains the stored prompt.
    expect(created).toBeInstanceOf(Agent);
    expect(runtimeAgent).toBe(created);
    expect(result.text).toContain('Answer as the persisted support specialist.');
  });
});
