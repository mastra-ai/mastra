import type { ReactNode } from 'react';

import { sessionBeltLabel } from './session-belt-label';
import { SidebarEmptyNote, SidebarLoadError, SidebarNavigationSkeleton } from './sidebar-list-states';
import { ActivityBelt } from '@/ds/components/Activity';
import type { ActivityStatus } from '@/ds/components/Activity';
import { Sidebar, useMaybeSidebarState } from '@/ds/components/Sidebar';
import { IconChatBubble7 } from '@/ds/icons/central/IconChatBubble7';
import type { LinkComponent } from '@/ds/types/link-component';

export type FactorySessionsNavSession = {
  id: string;
  name: string;
  href: string;
  /** Second line, e.g. the phase and when it last changed. */
  description?: ReactNode;
  /** Shown as an activity belt; omitted when the session is idle. */
  status?: ActivityStatus;
};

export type FactorySessionsNavProps = {
  /** Undefined while loading. */
  sessions: FactorySessionsNavSession[] | undefined;
  error?: boolean;
  onRetry?: () => void;
  retrying?: boolean;
  isActive?: (href: string) => boolean;
  /** Beside the Sessions header. */
  headerAction?: ReactNode;
  /** Called when a session link is followed, e.g. to close a mobile sidebar. */
  onNavigate?: () => void;
  /** Router link; defaults to the Sidebar's. */
  LinkComponent?: LinkComponent;
};

/**
 * The Sessions section of a Factory sidebar: the sessions the project shares, newest first.
 * Hosts map their own session rows into it and keep their own router.
 */
export function FactorySessionsNav({
  sessions,
  error,
  onRetry,
  retrying,
  isActive,
  headerAction,
  onNavigate,
  LinkComponent,
}: FactorySessionsNavProps) {
  const sidebarLink = useMaybeSidebarState()?.LinkComponent;
  const Link: LinkComponent = LinkComponent ?? sidebarLink ?? 'a';
  return (
    <section className="flex flex-col gap-1" aria-label="Sessions">
      <Sidebar.NavHeader className="mt-0" action={headerAction}>
        Sessions
      </Sidebar.NavHeader>
      <Sidebar.NavList>
        {error ? (
          <li>
            <SidebarLoadError onRetry={onRetry} retrying={retrying}>
              Couldn’t load sessions
            </SidebarLoadError>
          </li>
        ) : !sessions ? (
          <li>
            <SidebarNavigationSkeleton label="Loading sessions" description />
          </li>
        ) : sessions.length === 0 ? (
          <li>
            <SidebarEmptyNote>No sessions yet</SidebarEmptyNote>
          </li>
        ) : (
          sessions.map(session => (
            <Sidebar.NavLink
              key={session.id}
              link={{ name: session.name, url: session.href }}
              isActive={isActive?.(session.href)}
              render={
                <Link href={session.href} onClick={onNavigate}>
                  <IconChatBubble7 />
                  <Sidebar.NavLabel description={session.description}>{session.name}</Sidebar.NavLabel>
                </Link>
              }
              action={
                session.status ? (
                  <ActivityBelt status={session.status} label={sessionBeltLabel(session.status, session.name)} />
                ) : undefined
              }
            />
          ))
        )}
      </Sidebar.NavList>
    </section>
  );
}
