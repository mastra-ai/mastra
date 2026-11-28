import type { ThinkingLevelSetting } from '@mastra/core/llm/reasoning';
import { createContext } from 'react';

import type { EffectiveThinkingLevel, ThinkingDefault } from '../services/thinkingLevels';

export interface ChatThinkingApi {
  level: EffectiveThinkingLevel | undefined;
  thinkingDefault: ThinkingDefault | undefined;
  loadError: Error | undefined;
  override: ThinkingLevelSetting | undefined;
  setLevel: (level: ThinkingLevelSetting) => Promise<void>;
  resetLevel: () => Promise<void>;
  /** The session's own thinking override as the runtime stores it, apart from any picked pack. */
  sessionLevel: ChatSessionThinkingLevel;
}

export interface ChatSessionThinkingLevel {
  loaded: boolean;
  level: ThinkingLevelSetting | undefined;
  /** Resolves once the session's settings are loaded; rejects when they can't be. */
  load: () => Promise<ThinkingLevelSetting | undefined>;
}

export const ChatThinkingContext = createContext<ChatThinkingApi | null>(null);
