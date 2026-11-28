import type { ModelPack, ModelSelectionRequest } from '@internal/factory-contract';
import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import { createContext } from 'react';

export interface ChatModelsApi {
  activeModelId: string | undefined;
  modelPacks: readonly ModelPack[];
  defaultModelPack: ModelPack | undefined;
  selectedPack: ModelPack | undefined;
  selection: ModelSelectionRequest;
  selectedThinkingLevel: ThinkingLevelSetting | undefined;
  switching: boolean;
  isLoading: boolean;
  error: Error | undefined;
  select: (selection: ModelSelectionRequest) => Promise<void>;
}

export const ChatModelsContext = createContext<ChatModelsApi | null>(null);
