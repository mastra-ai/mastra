import { createContext } from 'react';

import type { ChatRuntimeState } from '../services/runtime';

export type ChatRuntimeApi = Omit<
  ChatRuntimeState,
  '_decodeStartedAt' | '_decodeLastDeltaAt' | '_decodeHasReasoning' | '_streamingAssistantId'
>;

export const ChatRuntimeContext = createContext<ChatRuntimeApi | null>(null);
