import { createContext } from 'react';

export interface ChatModelsApi {
  activeModelId: string | undefined;
  setModel: (modelId: string) => Promise<void>;
}

export const ChatModelsContext = createContext<ChatModelsApi | null>(null);
