import { createContext } from 'react';

/**
 * Sandbox identity for a GitHub-backed project. Persisted onto controller
 * state at session init so the server builds a sandbox-backed workspace
 * instead of treating `projectPath` as a host-local directory.
 */
export interface ChatSessionGithubState {
  githubProjectId: string;
  sandboxId: string;
  sandboxWorkdir: string;
  worktreePath?: string;
}

export interface ChatSessionContextApi {
  resourceId: string;
  sessionEnabled: boolean;
  projectPath?: string;
  github?: ChatSessionGithubState;
  baseUrl: string;
}

export const ChatSessionContext = createContext<ChatSessionContextApi | null>(null);
