import { Agent } from '@mastra/core/agent';

const localModelApiKeyPlaceholder = 'not-needed';

function getDesktopModelApiKey() {
  const configuredApiKey = process.env.MASTRA_DESKTOP_MODEL_API_KEY?.trim();
  return configuredApiKey && configuredApiKey.length > 0 ? configuredApiKey : localModelApiKeyPlaceholder;
}

export const desktopAssistant = new Agent({
  id: 'desktop-assistant',
  name: 'Desktop Assistant',
  instructions: `
You are the default local assistant for Mastra Studio Desktop.

Help the user test their local model connection, explain how to add tools, and keep answers concise.
If the model appears to be running through LM Studio, mention that tool support depends on the loaded model.
  `.trim(),
  model: {
    providerId: 'lmstudio',
    modelId: process.env.MASTRA_DESKTOP_MODEL_ID || 'lmstudio/openai/gpt-oss-20b',
    url: process.env.MASTRA_DESKTOP_MODEL_URL || 'http://localhost:1234/v1',
    apiKey: getDesktopModelApiKey(),
  },
  editor: {
    instructions: true,
    tools: true,
  },
});
