import type { ComponentProps, KeyboardEvent, ReactNode } from 'react';
import { BoardStageIcon, phaseIconKind } from './board-icons';
import type { BoardPhaseKind } from './board-icons';
import { Sidebar } from '@/ds/components/Sidebar';
import { IconBook } from '@/ds/icons/central/IconBook';
import { IconBranch } from '@/ds/icons/central/IconBranch';
import { IconInboxEmpty } from '@/ds/icons/central/IconInboxEmpty';
import { IconSettingsSliderHor } from '@/ds/icons/central/IconSettingsSliderHor';
import type { LinkComponent } from '@/ds/types/link-component';

export type BoardConfigPage = 'overview' | 'rules' | 'skills' | 'routing' | { phase: string };

/** Where each page lives. A host that hasn't a page leaves its href out, and the row doesn't show. */
export interface BoardConfigHrefs {
  skills?: string;
  routing?: string;
  overview: string;
  rules?: string;
}

/** One row of the board configuration sidebar. */
export function BoardConfigNavLink({
  href,
  isActive,
  icon,
  label,
  className,
  description,
  onKeyDown,
  onNavigate,
  LinkComponent: Link = 'a',
  ...row
}: Pick<ComponentProps<'li'>, 'style' | 'onPointerDown'> & {
  'data-drop'?: 'before' | 'after';
  href: string;
  isActive: boolean;
  icon: ReactNode;
  label: string;
  className?: string;
  description?: string;
  onKeyDown?: (event: KeyboardEvent) => void;
  onNavigate?: () => void;
  LinkComponent?: LinkComponent;
}) {
  return (
    <Sidebar.NavLink
      {...row}
      link={{ name: label, url: href }}
      isActive={isActive}
      className={className}
      render={
        <Link
          href={href}
          // Rows move by a grip, where the host has one; the link's own drag would carry a URL instead.
          draggable={false}
          onClick={onNavigate}
          onKeyDown={onKeyDown}
          aria-description={description}
        >
          {icon}
          <Sidebar.NavLabel>{label}</Sidebar.NavLabel>
        </Link>
      }
    />
  );
}

/** A board's phases as plain links, in board order. */
export function BoardConfigPhaseLinks({
  boardId,
  phases,
  page,
  phaseHref,
  onNavigate,
  LinkComponent,
}: {
  boardId: string;
  phases: readonly { key: string; name: string; kind: BoardPhaseKind }[];
  page: BoardConfigPage;
  phaseHref: (phaseKey: string) => string;
  onNavigate?: () => void;
  LinkComponent?: LinkComponent;
}) {
  return (
    <Sidebar.NavList>
      {phases.map(phase => (
        <BoardConfigNavLink
          key={phase.key}
          href={phaseHref(phase.key)}
          isActive={typeof page === 'object' && page.phase === phase.key}
          icon={<BoardStageIcon stage={phase.key} kind={phaseIconKind(boardId, phase.kind)} decorative />}
          label={phase.name}
          onNavigate={onNavigate}
          LinkComponent={LinkComponent}
        />
      ))}
    </Sidebar.NavList>
  );
}

/**
 * Two scopes. All boards: the skills no phase runs, and how new issues and pull requests are routed between boards.
 * This board: the switcher naming it, its Overview and Rules pages, then one page per phase, in board order.
 */
export function BoardConfigNav({
  page,
  hrefs,
  switcher,
  phases,
  onNavigate,
  LinkComponent,
}: {
  page: BoardConfigPage;
  hrefs: BoardConfigHrefs;
  /** Names the board being configured, and opens another board's configuration. */
  switcher: ReactNode;
  /** The Phases section's body: the phase links, and whatever adds or loads them. */
  phases: ReactNode;
  onNavigate?: () => void;
  LinkComponent?: LinkComponent;
}) {
  const link = { onNavigate, LinkComponent };
  return (
    <nav className="flex flex-col gap-6" aria-label="Board configuration">
      {(hrefs.skills || hrefs.routing) && (
        <section className="flex flex-col gap-1" aria-label="All boards">
          <Sidebar.NavHeader>All boards</Sidebar.NavHeader>
          <Sidebar.NavList>
            {hrefs.skills && (
              <BoardConfigNavLink
                {...link}
                href={hrefs.skills}
                isActive={page === 'skills'}
                icon={<IconBook />}
                label="Skills"
              />
            )}
            {hrefs.routing && (
              <BoardConfigNavLink
                {...link}
                href={hrefs.routing}
                isActive={page === 'routing'}
                icon={<IconInboxEmpty />}
                label="Routing"
              />
            )}
          </Sidebar.NavList>
        </section>
      )}
      <section className="flex flex-col gap-2" aria-label="This board">
        <Sidebar.NavHeader>This board</Sidebar.NavHeader>
        {switcher}
        <Sidebar.NavList>
          <BoardConfigNavLink
            {...link}
            href={hrefs.overview}
            isActive={page === 'overview'}
            icon={<IconSettingsSliderHor />}
            label="Overview"
          />
          {hrefs.rules && (
            <BoardConfigNavLink
              {...link}
              href={hrefs.rules}
              isActive={page === 'rules'}
              icon={<IconBranch />}
              label="Rules"
            />
          )}
        </Sidebar.NavList>
        <section className="flex flex-col gap-1 pt-2" aria-label="Phases">
          <Sidebar.NavHeader>Phases</Sidebar.NavHeader>
          {phases}
        </section>
      </section>
    </nav>
  );
}
