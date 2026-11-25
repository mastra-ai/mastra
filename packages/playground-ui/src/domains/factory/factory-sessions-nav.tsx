import type { ReactNode } from 'react';

import { ActivityBelt } from '@/ds/components/Activity';
import type { ActivityStatus } from '@/ds/components/Activity';
import { Sidebar, useMaybeSidebarState } from '@/ds/components/Sidebar';
import { Skeleton } from '@/ds/components/Skeleton';
import { Txt } from '@/ds/components/Txt';
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
  isActive?: (href: string) => boolean;
  /** Beside the Sessions header. */
  headerAction?: ReactNode;
  /** Called after any link is followed, e.g. to close a mobile sidebar. */
  onNavigate?: () => void;
  /** Router link; defaults to the Sidebar's. */
  LinkComponent?: LinkComponent;
};

const BELT_LABEL: Record<ActivityStatus, string> = {
  initializing: 'Initializing',
  working: 'Agent working in',
  ready: 'Waiting on you in',
};

/**
 * The Sessions section of a Factory sidebar: the sessions the project shares, newest first.
 * Hosts map their own session rows into it and keep their own router.
 */
export function FactorySessionsNav({
  sessions,
  error,
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
          <li role="alert" className="py-0.5 pl-3">
            <Txt as="p" variant="label" className="m-0 truncate text-destructive-foreground">
              Couldn’t load sessions
            </Txt>
          </li>
        ) : !sessions ? (
          <li aria-label="Loading sessions" aria-busy className="flex flex-col gap-1 px-3 py-1">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </li>
        ) : sessions.length === 0 ? (
          <li className="py-0.5 pl-3">
            <Txt as="p" variant="label" tone="muted" className="m-0">
              No sessions yet
            </Txt>
          </li>
        ) : (
          sessions.map(session => (
            <Sidebar.NavLink
              key={session.id}
              isActive={isActive?.(session.href)}
              render={
                <Link href={session.href} onClick={onNavigate}>
                  <Sidebar.NavLabel description={session.description}>{session.name}</Sidebar.NavLabel>
                </Link>
              }
              action={
                session.status ? (
                  <ActivityBelt status={session.status} label={`${BELT_LABEL[session.status]} ${session.name}`} />
                ) : undefined
              }
            />
          ))
        )}
      </Sidebar.NavList>
    </section>
  );
}
