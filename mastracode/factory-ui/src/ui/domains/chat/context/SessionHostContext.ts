import { createContext, useContext } from 'react';
import type { AnchorHTMLAttributes, ComponentType } from 'react';

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
}

export const SessionHostContext = createContext<SessionHost | null>(null);

export function useSessionHost(): SessionHost {
  const host = useContext(SessionHostContext);
  if (!host) throw new Error('useSessionHost must be used within a SessionHostContext provider');
  return host;
}
