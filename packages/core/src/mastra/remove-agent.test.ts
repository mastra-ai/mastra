import { describe, expect, it } from 'vitest';
import { Agent } from '../agent';
import { Mastra } from './index';

describe('Mastra.removeAgent', () => {
  it('should remove an agent by key', () => {
    const testAgent = new Agent({
      id: 'test-id',
      name: 'Test Agent',
      instructions: 'You are a test agent',
      model: 'openai/gpt-4o',
    });

    const mastra = new Mastra({
      agents: {
        testAgent,
      },
    });

    // Verify agent exists
    expect(mastra.getAgent('testAgent')).toBeDefined();

    // Remove by key
    const removed = mastra.removeAgent('testAgent');
    expect(removed).toBe(true);

    // Verify agent is removed
    expect(() => mastra.getAgent('testAgent')).toThrow();
  });

  it('should remove an agent by ID', () => {
    const testAgent = new Agent({
      id: 'unique-agent-id',
      name: 'Test Agent',
      instructions: 'You are a test agent',
      model: 'openai/gpt-4o',
    });

    const mastra = new Mastra({
      agents: {
        myAgent: testAgent,
      },
    });

    // Verify agent exists
    expect(mastra.getAgentById('unique-agent-id')).toBeDefined();

    // Remove by ID (not key)
    const removed = mastra.removeAgent('unique-agent-id');
    expect(removed).toBe(true);

    // Verify agent is removed
    expect(() => mastra.getAgentById('unique-agent-id')).toThrow();
    expect(() => mastra.getAgent('myAgent')).toThrow();
  });

  it('should return false when agent does not exist', () => {
    const mastra = new Mastra({});

    const removed = mastra.removeAgent('non-existent-agent');
    expect(removed).toBe(false);
  });

  it('should prefer key over ID when both match', () => {
    // Create an agent where key and another agent's ID are different
    const agent1 = new Agent({
      id: 'agent-1-id',
      name: 'Agent 1',
      instructions: 'Test',
      model: 'openai/gpt-4o',
    });

    const agent2 = new Agent({
      id: 'agent-2-id',
      name: 'Agent 2',
      instructions: 'Test',
      model: 'openai/gpt-4o',
    });

    const mastra = new Mastra({
      agents: {
        agent1,
        agent2,
      },
    });

    // Remove by key
    const removed = mastra.removeAgent('agent1');
    expect(removed).toBe(true);

    // agent1 should be removed, agent2 should remain
    expect(() => mastra.getAgent('agent1')).toThrow();
    expect(mastra.getAgent('agent2')).toBeDefined();
  });

  it('should allow re-adding an agent after removal', () => {
    const originalAgent = new Agent({
      id: 'reusable-id',
      name: 'Original Agent',
      instructions: 'Original instructions',
      model: 'openai/gpt-4o',
    });

    const mastra = new Mastra({
      agents: {
        myAgent: originalAgent,
      },
    });

    // Remove the agent
    mastra.removeAgent('myAgent');

    // Create a new agent with the same key
    const newAgent = new Agent({
      id: 'reusable-id',
      name: 'New Agent',
      instructions: 'New instructions',
      model: 'openai/gpt-4o',
    });

    // Should be able to add it back
    mastra.addAgent(newAgent, 'myAgent');

    const retrieved = mastra.getAgent('myAgent');
    expect(retrieved.name).toBe('New Agent');
  });

  it('should clear storedAgentsCache when removing an agent by key', () => {
    const testAgent = new Agent({
      id: 'cached-agent-id',
      name: 'Test Agent',
      instructions: 'You are a test agent',
      model: 'openai/gpt-4o',
    });

    const mastra = new Mastra({
      agents: {
        testAgent,
      },
    });

    // Simulate a cached agent by adding to the cache
    const cache = mastra.getStoredAgentCache();
    cache.set('cached-agent-id', testAgent);
    expect(cache.has('cached-agent-id')).toBe(true);

    // Remove the agent by key
    const removed = mastra.removeAgent('testAgent');
    expect(removed).toBe(true);

    // Verify cache entry is also cleared
    expect(cache.has('cached-agent-id')).toBe(false);
  });

  it('should clear storedAgentsCache when removing an agent by ID', () => {
    const testAgent = new Agent({
      id: 'cached-agent-id-2',
      name: 'Test Agent',
      instructions: 'You are a test agent',
      model: 'openai/gpt-4o',
    });

    const mastra = new Mastra({
      agents: {
        myAgent: testAgent,
      },
    });

    // Simulate a cached agent by adding to the cache
    const cache = mastra.getStoredAgentCache();
    cache.set('cached-agent-id-2', testAgent);
    expect(cache.has('cached-agent-id-2')).toBe(true);

    // Remove the agent by ID (not key)
    const removed = mastra.removeAgent('cached-agent-id-2');
    expect(removed).toBe(true);

    // Verify cache entry is also cleared
    expect(cache.has('cached-agent-id-2')).toBe(false);
  });
});
