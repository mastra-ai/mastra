import { createContext } from 'react';

import type { ChatRuntimeState } from '../services/runtime';

export type ChatRuntimeApi = Omit<ChatRuntimeState, '_sampler'>;

export const ChatRuntimeContext = createContext<ChatRuntimeApi | null>(null);
