import type { ModelPack } from '@mastra/factory/model-packs';
import { createContext } from 'react';

export interface ChatModelsApi {
  activeModelId: string | undefined;
  defaultModelId: string | undefined;
  modelPacks: readonly ModelPack[];
  defaultModelPackId: string | null;
  activeModelPack: ModelPack | undefined;
  pendingModelId: string | undefined;
  pendingModelPackId: string | undefined;
  isLoading: boolean;
  error: Error | undefined;
  setModel: (modelId: string) => Promise<void>;
  setModelPack: (pack: ModelPack) => Promise<void>;
}

export const ChatModelsContext = createContext<ChatModelsApi | null>(null);
