import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';

import { calculatorTool, stringTool, approvalTool } from '../tools/index.js';
import { sequentialSteps } from '../workflows/basic.js';

export const memory = new Memory({
  options: {
    lastMessages: 20,
    workingMemory: {
      enabled: true,
    },
  },
});

export const observationalMemory = new Memory({
  options: {
    lastMessages: 20,
    workingMemory: {
      enabled: true,
    },
    observationalMemory: {
      enabled: true,
      observation: {
        model: 'openai/gpt-4o-mini',
        messageTokens: 20,
        bufferTokens: false,
      },
      reflection: {
        model: 'openai/gpt-4o-mini',
        observationTokens: 50000,
      },
    },
  },
});

export const testAgent = new Agent({
  id: 'test-agent',
  name: 'Test Agent',
  instructions: 'You are a helpful test agent.',
  model: 'openai/gpt-4o-mini',
  tools: { calculator: calculatorTool, 'string-transform': stringTool },
  memory,
});

export const helperAgent = new Agent({
  id: 'helper-agent',
  name: 'Helper Agent',
  instructions: 'You are a helper sub-agent. Answer concisely.',
  model: 'openai/gpt-4o-mini',
  tools: { 'string-transform': stringTool },
});

export const networkAgent = new Agent({
  id: 'network-agent',
  name: 'Network Agent',
  instructions:
    'You are an orchestrator agent. When the user asks you to delegate or ask your helper, you MUST call the helper-agent sub-agent tool. Never answer directly when delegation is requested.',
  model: 'openai/gpt-4o-mini',
  agents: { 'helper-agent': helperAgent },
  memory,
});

export const workflowAgent = new Agent({
  id: 'workflow-agent',
  name: 'Workflow Agent',
  instructions:
    'You are an agent with a workflow. When the user asks you to greet someone, you MUST call the sequential-steps workflow with their name. Never answer directly — always use the workflow.',
  model: 'openai/gpt-4o-mini',
  workflows: { 'sequential-steps': sequentialSteps },
});

export const approvalAgent = new Agent({
  id: 'approval-agent',
  name: 'Approval Agent',
  instructions: 'You are a helpful agent. When asked to greet someone, always use the needs-approval tool.',
  model: 'openai/gpt-4o-mini',
  tools: { 'needs-approval': approvalTool },
});

export const observationalAgent = new Agent({
  id: 'observational-agent',
  name: 'Observational Agent',
  instructions: 'You are a helpful test agent with observational memory enabled.',
  model: 'openai/gpt-4o-mini',
  memory: observationalMemory,
});
