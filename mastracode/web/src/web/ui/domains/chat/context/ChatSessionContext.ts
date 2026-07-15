import { createContext } from 'react';

export interface ChatSessionGithubState {
  githubProjectId?: string;
  sandboxId?: string;
  sandboxWorkdir?: string;
  repoFullName?: string;
  defaultBranch?: string;
  installationId?: number;
}

export interface ChatSessionContextApi {
  resourceId: string;
  sessionEnabled: boolean;
  projectPath?: string;
  github?: ChatSessionGithubState;
  baseUrl: string;
}

export const ChatSessionContext = createContext<ChatSessionContextApi | null>(null);
