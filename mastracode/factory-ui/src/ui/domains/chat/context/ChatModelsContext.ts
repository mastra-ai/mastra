import { createContext } from 'react';

import type { ModelPackInfo } from '../../../../api/types';

export interface ChatModelsApi {
  activeModelId: string | undefined;
  activeModelPackId: string | undefined;
  /** The user's personal default pack — lets the picker mark it and offer "reset to default". */
  defaultModelPackId: string | undefined;
  draftModelPackId: string | undefined;
  modelPacks: ModelPackInfo[];
  isLoading: boolean;
  error: Error | undefined;
  setModel: (modelId: string) => Promise<void>;
  setModelPack: (modelPackId: string) => Promise<void>;
}

export const ChatModelsContext = createContext<ChatModelsApi | null>(null);
