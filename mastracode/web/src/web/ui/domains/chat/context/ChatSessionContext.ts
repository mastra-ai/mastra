import { createContext } from 'react';

export interface ChatSessionContextApi {
  resourceId: string;
  sessionEnabled: boolean;
  projectPath?: string;
  baseUrl: string;
}

export const ChatSessionContext = createContext<ChatSessionContextApi | null>(null);
