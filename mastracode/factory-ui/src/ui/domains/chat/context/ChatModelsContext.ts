import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import { createContext } from 'react';

import type { EffectiveThinkingLevel } from '../services/thinkingLevels';

export interface ChatModelsApi {
  activeModelId: string | undefined;
  defaultModelId: string | undefined;
  effectiveThinkingLevel: EffectiveThinkingLevel | undefined;
  thinkingLevelOverride: ThinkingLevelSetting | undefined;
  thinkingLevelError: Error | undefined;
  isLoading: boolean;
  error: Error | undefined;
  setModel: (modelId: string) => Promise<void>;
  setThinkingLevel: (level: ThinkingLevelSetting) => Promise<void>;
  resetThinkingLevel: () => Promise<void>;
}

export const ChatModelsContext = createContext<ChatModelsApi | null>(null);
