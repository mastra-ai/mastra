import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import { createContext } from 'react';

export interface ChatModelsApi {
  activeModelId: string | undefined;
  defaultModelId: string | undefined;
  defaultThinkingLevel: ThinkingLevelSetting | undefined;
  isLoading: boolean;
  error: Error | undefined;
  setModel: (modelId: string) => Promise<void>;
}

export const ChatModelsContext = createContext<ChatModelsApi | null>(null);
