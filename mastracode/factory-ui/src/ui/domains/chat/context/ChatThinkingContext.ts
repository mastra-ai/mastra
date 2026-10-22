import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import { createContext } from 'react';

import type { EffectiveThinkingLevel } from '../services/thinkingLevels';

export interface ChatThinkingApi {
  level: EffectiveThinkingLevel | undefined;
  loadError: Error | undefined;
  override: ThinkingLevelSetting | undefined;
  setLevel: (level: ThinkingLevelSetting) => Promise<void>;
  resetLevel: () => Promise<void>;
}

export const ChatThinkingContext = createContext<ChatThinkingApi | null>(null);
