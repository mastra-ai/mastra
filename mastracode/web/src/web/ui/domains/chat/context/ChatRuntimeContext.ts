import { createContext } from 'react';

import type { ChatRuntimeState } from '../services/runtime';

export type ChatRuntimeApi = Omit<ChatRuntimeState, '_decodeStartedAt'>;

export const ChatRuntimeContext = createContext<ChatRuntimeApi | null>(null);
