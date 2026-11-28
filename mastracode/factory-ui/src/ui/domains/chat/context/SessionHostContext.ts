import { createContext, useContext } from 'react';
import type { AnchorHTMLAttributes, ComponentType } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { FactoryProject, FactoryUserSession, LinkedRepositoryPayload, WorkItem } from '@internal/factory-contract';
import type { ChangeRequestProvider, PullRequestSubscription } from '@mastra/playground-ui/domains/factory';

import type { FactoryAuthState } from '../../auth/services/auth';

import type { ModelDefaultsAnchor, SettingsSection, VOICE_INPUT_ANCHOR } from '../services/sessionSettings';

export { VOICE_INPUT_ANCHOR } from '../services/sessionSettings';

/** The settings pages a session links to. */
export type SessionSettingsSection = SettingsSection;

/** Places on the settings pages a session links to. */
export type SessionSettingsAnchor = ModelDefaultsAnchor | typeof VOICE_INPUT_ANCHOR;

export interface SessionLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  /** Lets the destination return to the current page. */
  returnHere?: boolean;
}

export interface SessionNavigateOptions {
  replace?: boolean;
  state?: unknown;
  returnHere?: boolean;
}

/** Which kind of page the session is shown on. */
export type SessionRouteKind = 'thread' | 'user-thread' | 'draft' | 'user-draft' | 'card-draft' | 'none';

/**
 * What a session view needs from the app that hosts it: where it is, how to
 * link and navigate, and where the pages it links to live.
 */
export interface SessionHost {
  factoryProjectId: string | undefined;
  sessionId: string | undefined;
  threadId: string | undefined;
  draftSessionId: string | undefined;
  routeKind: SessionRouteKind;
  location: { pathname: string; search: string; state: unknown };
  LinkComponent: ComponentType<SessionLinkProps>;
  navigate(href: string | { pathname: string; search?: string }, options?: SessionNavigateOptions): void;
  links: {
    settings(section: SessionSettingsSection, anchor?: SessionSettingsAnchor): string;
    thread(thread: { sessionId: string; threadId: string }): string;
    userThread(threadId: string): string;
    newUserSession(): string;
    /** A thread opened from a channel; Factory resolves its session. */
    channelThread(threadId: string): string;
  };
  data: SessionHostData;
}

/** A project's sessions, split into shared workspaces and the viewer's own sessions. */
export interface SessionList {
  workspaces: FactoryUserSession[];
  userSessions: FactoryUserSession[];
}

export interface CreateUserSessionInput {
  projectId: string;
  projectRepositoryId: string;
  sessionId: string;
  title: string;
  visibility: 'private' | 'org';
}

/**
 * The project, viewer and session records a session view reads, and the writes
 * it makes to them. Hooks keep the host's cache, so loading and error states
 * are the host's own.
 */
export interface SessionHostData {
  useProject(projectId: string | undefined): UseQueryResult<FactoryProject | undefined>;
  useProjects(): UseQueryResult<FactoryProject[]>;
  useViewer(options?: { monitorSession?: boolean }): UseQueryResult<FactoryAuthState>;
  useUserSession(sessionId: string | undefined): UseQueryResult<FactoryUserSession>;
  useSessionList(projectId: string | undefined): UseQueryResult<SessionList>;
  /**
   * Creates the session under its own record's cache entry, so a page reading
   * that record waits on the create. `toError` shapes a failed create.
   */
  createUserSession(input: CreateUserSessionInput, toError: (cause: unknown) => Error): Promise<FactoryUserSession>;
  answerParkedApproval(sessionId: string, decision: 'approve' | 'decline', toolCallId?: string): Promise<void>;
  onSessionTitleChanged(projectId: string | undefined, sessionId: string, title: string): Promise<void>;
  /** Refreshes the project's session lists and activity, and its cards. */
  invalidateSessions(projectId: string | undefined): Promise<void>;
  /** The card the open thread works on. Absent where sessions have no cards. */
  useSessionCard?(): { item: WorkItem | undefined };
  /** The repository the open session works in. */
  useSessionRepository?(): { repository: LinkedRepositoryPayload | undefined };
  /** Pull requests a thread follows. Absent where threads can't follow pull requests. */
  pullRequestSubscriptions?: {
    use(
      sessionId: string,
      threadId: string | undefined,
      provider: ChangeRequestProvider,
      enabled: boolean,
    ): UseQueryResult<PullRequestSubscription[]>;
    invalidate(sessionId: string, threadId: string | undefined, provider: ChangeRequestProvider): void;
  };
}

export const SessionHostContext = createContext<SessionHost | null>(null);

export function useSessionHost(): SessionHost {
  const host = useContext(SessionHostContext);
  if (!host) throw new Error('useSessionHost must be used within a SessionHostContext provider');
  return host;
}
