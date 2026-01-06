import type { StorageCreateAgentInput } from '@mastra/core/storage';
import { randomUUID } from 'node:crypto';

/**
 * Creates a sample agent input for testing storage operations.
 * @param overrides - Optional fields to override the default values
 */
export const createSampleAgent = ({
  id = `agent-${randomUUID()}`,
  name = 'Test Agent',
  description,
  instructions = 'You are a helpful assistant',
  model = { provider: 'openai', name: 'gpt-4' },
  tools,
  defaultOptions,
  workflows,
  agents,
  inputProcessors,
  outputProcessors,
  memory,
  scorers,
  metadata,
}: Partial<StorageCreateAgentInput> = {}): StorageCreateAgentInput => ({
  id,
  name,
  ...(description && { description }),
  instructions,
  model,
  ...(tools && { tools }),
  ...(defaultOptions && { defaultOptions }),
  ...(workflows && { workflows }),
  ...(agents && { agents }),
  ...(inputProcessors && { inputProcessors }),
  ...(outputProcessors && { outputProcessors }),
  ...(memory && { memory }),
  ...(scorers && { scorers }),
  ...(metadata && { metadata }),
});

/**
 * Creates a sample agent with all fields populated for comprehensive testing.
 */
export const createFullSampleAgent = ({
  id = `agent-${randomUUID()}`,
}: {
  id?: string;
} = {}): StorageCreateAgentInput => ({
  id,
  name: 'Full Test Agent',
  description: 'A fully configured test agent with all fields',
  instructions: 'You are a comprehensive test assistant with multiple capabilities',
  model: {
    provider: 'openai',
    name: 'gpt-4',
    temperature: 0.7,
    maxTokens: 2000,
  },
  tools: ['calculator', 'webSearch'],
  defaultOptions: {
    maxSteps: 5,
    temperature: 0.5,
  },
  workflows: ['order-workflow', 'support-workflow'],
  agents: ['helper-agent'],
  inputProcessors: [{ type: 'sanitize', config: { stripHtml: true } }],
  outputProcessors: [{ type: 'format', config: { style: 'markdown' } }],
  memory: 'thread-memory',
  scorers: {
    relevance: { sampling: { type: 'ratio', rate: 0.8 } },
  },
  metadata: {
    category: 'test',
    version: '1.0.0',
    tags: ['testing', 'sample'],
    createdBy: 'test-suite',
  },
});

/**
 * Creates multiple sample agents for pagination and list testing.
 * @param count - Number of agents to create
 */
export const createSampleAgents = (count: number): StorageCreateAgentInput[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `agent-${randomUUID()}`,
    name: `Test Agent ${i + 1}`,
    description: `Description for agent ${i + 1}`,
    instructions: `Instructions for agent ${i + 1}`,
    model: {
      provider: i % 2 === 0 ? 'openai' : 'anthropic',
      name: i % 2 === 0 ? 'gpt-4' : 'claude-3',
    },
    metadata: {
      index: i + 1,
      createdOrder: i,
    },
  }));
};
