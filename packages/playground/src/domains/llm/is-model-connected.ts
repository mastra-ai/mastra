import type { Provider } from '@mastra/client-js';

export function isModelConnected(provider: Provider, modelId: string): boolean {
  return provider.connectedModels?.includes(modelId) ?? provider.connected;
}
