import { createContext } from 'react';

export interface ChatSessionContextApi {
  resourceId: string;
  sessionEnabled: boolean;
  projectPath?: string;
  projectState?: Record<string, unknown>;
  baseUrl: string;
}

export const ChatSessionContext = createContext<ChatSessionContextApi | null>(null);
