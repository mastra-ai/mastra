import { createContext } from 'react';

export interface ChatModelsApi {
  activeModelId: string | undefined;
  isLoading: boolean;
  error: Error | undefined;
  setModel: (modelId: string) => Promise<void>;
}

export const ChatModelsContext = createContext<ChatModelsApi | null>(null);
