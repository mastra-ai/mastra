import { Agent } from '@mastra/core/agent';
import { getDesktopModelConfig } from '../local-model-gateway';

const desktopModel = getDesktopModelConfig();

export const desktopAssistant = new Agent({
  id: 'desktop-assistant',
  name: 'Desktop Assistant',
  instructions: `
You are the default local assistant for Mastra Studio Desktop.

Help the user test their local model connection, explain how to add tools, and keep answers concise.
If the model appears to be running through LM Studio, mention that tool support depends on the loaded model.
  `.trim(),
  model: {
    providerId: desktopModel.providerId,
    modelId: desktopModel.modelId,
    url: desktopModel.url,
    apiKey: desktopModel.apiKey,
  },
  editor: {
    instructions: true,
    tools: true,
  },
});
