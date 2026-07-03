import { Agent } from '@mastra/core/agent';
import { getDesktopAgentModelConfig } from '../local-model-gateway';

export const desktopAssistant = new Agent({
  id: 'desktop-assistant',
  name: 'Desktop Assistant',
  instructions: `
You are the default local assistant for Mastra Studio Desktop.

Help the user test their local model connection, explain how to add tools, and keep answers concise.
If the model appears to be running through LM Studio, mention that tool support depends on the loaded model.
  `.trim(),
  model: getDesktopAgentModelConfig(),
  editor: {
    instructions: true,
    tools: true,
  },
});
