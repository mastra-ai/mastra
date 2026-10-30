import { createContext } from 'react';

export interface ChatModelsApi {
  activeModelId: string | undefined;
  defaultModelId: string | undefined;
  pendingModelId: string | undefined;
  isLoading: boolean;
  error: Error | undefined;
  setModel: (modelId: string) => Promise<void>;
  /**
   * Drafts only: settles once the draft's model is known, loading whatever the
   * picker is still waiting on. Rejects when that load fails.
   */
  resolveDraftModels?: () => Promise<Pick<ChatModelsApi, 'activeModelId' | 'defaultModelId'>>;
}

export const ChatModelsContext = createContext<ChatModelsApi | null>(null);
