import { Agent } from '@mastra/core/agent';
import { getDesktopAgentModelConfig } from '../local-model-gateway';
import { createDesktopAgentMemory } from './desktop-memory';

export const desktopAssistant = new Agent({
  id: 'desktop-assistant',
  name: 'Desktop Assistant',
  description: 'A local-first assistant for testing the bundled Mastra Studio Desktop runtime.',
  instructions: `
You are the default local assistant for Mastra Studio Desktop.

Help the user test their local model connection, explore the bundled Studio features, and keep answers concise.
If the model appears to be running through LM Studio, mention that tool support depends on the loaded model.
  `.trim(),
  model: getDesktopAgentModelConfig(),
  memory: createDesktopAgentMemory('desktop-assistant'),
  editor: {
    instructions: true,
    tools: true,
  },
});
