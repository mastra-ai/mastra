import { createContext } from 'react';

export interface ChatThreadMessagesApi {
  threadId?: string;
  isPending: boolean;
  error: unknown;
}

export const ChatThreadMessagesContext = createContext<ChatThreadMessagesApi | null>(null);
