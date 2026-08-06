import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { createTool } from '@mastra/core/tools';
import { LocalFilesystem, Workspace } from '@mastra/core/workspace';
import { z } from 'zod';

const throwingTool = createTool({
  id: 'throwing-tool',
  description: 'Always throws an intentional error.',
  inputSchema: z.object({ reason: z.string() }),
  execute: async () => {
    throw new Error('intentional example-agent tool failure');
  },
});

export const failedToolLoopAgent = new Agent({
  id: 'failed-tool-loop-repro',
  name: 'Failed Tool Loop Reproduction',
  description: 'Reproduces an agent loop after a tool throws an error.',
  model: 'openai/gpt-5.4-mini',
  instructions:
    'Call throwingTool exactly once. After it fails, do not retry it. Briefly explain that the tool failed and finish.',
  tools: { throwingTool },
  defaultOptions: {
    maxSteps: 4,
    prepareStep: ({ stepNumber }) => ({
      toolChoice: stepNumber === 0 ? { type: 'tool', toolName: 'throwingTool' } : 'none',
    }),
  },
});

export const failedToolLoopController = new AgentController({
  id: 'failed-tool-loop-controller',
  workspace: new Workspace({
    name: 'Failed tool loop reproduction',
    filesystem: new LocalFilesystem({ basePath: './workspace' }),
  }),
  modes: [
    {
      id: 'default',
      name: 'Default',
      default: true,
      agent: failedToolLoopAgent,
    },
  ],
  initialState: { yolo: true },
});
