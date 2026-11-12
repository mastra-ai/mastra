import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { Txt } from '@mastra/playground-ui/components/Txt';
import {
  ArrowRightLeft,
  BookOpen,
  Check,
  ChevronDown,
  GripVertical,
  Plus,
  SlidersHorizontal,
  SquareKanban,
} from 'lucide-react';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useState } from 'react';
import type { ComponentProps, KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { Link, NavLink } from 'react-router';

import type { StoredBoardResponse } from '../../../../api/types';
import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useBoardQuery } from '../../../../hooks/useBoardEditor';
import { useOverlays } from '../../../lib/overlays';
import { SidebarLoadError } from '../../../ui/LoadErrorState';
import { SidebarNavigationSkeleton } from '../../../ui/SidebarNavigationSkeleton';
import { orderedBoards } from '../../factory/boardCatalog';
import { BoardStageIcon, phaseIconKind } from '../../factory/components/BoardIcons';
import { useBoardDraft, useShownDraft } from '../BoardDraftProvider';
import { boardCardMovesPath, boardConfigPath, boardSkillsPath, newBoardPath } from '../boardConfigPaths';
import type { BoardConfigLocation } from '../boardConfigPaths';
import { movePhase } from '../boardDraft';
import { AddPhaseButton } from './AddPhaseButton';

/**
 * The factory's skills no phase runs, then the board switcher and the open board's pages: General, Card moves,
 * then one page per phase, in board order. Skills sit above the switcher because they belong to no board.
 */
export function BoardConfigNavigation({ factoryId, boardId, phaseKey, skills, moves }: BoardConfigLocation) {
  const query = useBoardQuery(factoryId, boardId);

  return (
    <nav className="flex flex-col gap-2" aria-label="Board configuration">
      <Sidebar.NavList>
        <ConfigLink
          to={boardSkillsPath(factoryId, boardId)}
          isActive={skills === true}
          icon={<BookOpen />}
          label="Skills"
        />
      </Sidebar.NavList>
      <BoardSwitcher factoryId={factoryId} boardId={boardId} />
      <Sidebar.NavList>
        <ConfigLink
          to={boardConfigPath(factoryId, boardId)}
          isActive={!phaseKey && !skills && !moves}
          icon={<SlidersHorizontal />}
          label="General"
        />
        <ConfigLink
          to={boardCardMovesPath(factoryId, boardId)}
          isActive={moves === true}
          icon={<ArrowRightLeft />}
          label="Card moves"
        />
      </Sidebar.NavList>
      <section className="flex flex-col gap-1" aria-label="Phases">
        <Sidebar.NavHeader>Phases</Sidebar.NavHeader>
        {query.isPending ? (
          <SidebarNavigationSkeleton label="Loading phases" rows={4} />
        ) : query.isError ? (
          <SidebarLoadError onRetry={() => void query.refetch()} retrying={query.isFetching}>
            Couldn’t load phases
          </SidebarLoadError>
        ) : (
          <PhaseList
            factoryId={factoryId}
            boardId={boardId}
            phaseKey={phaseKey}
            skills={skills}
            moves={moves}
            response={query.data}
          />
        )}
      </section>
    </nav>
  );
}

/** Names the board being configured, and opens another board's configuration in its place. */
function BoardSwitcher({ factoryId, boardId }: { factoryId: string; boardId: string }) {
  const catalog = useBoardCatalog(factoryId);
  const response = useBoardQuery(factoryId, boardId).data;
  const board = response?.board;
  const name = useShownDraft(factoryId, boardId, board)?.name;
  const boards = catalog.data ? orderedBoards(catalog.data) : [];
  const title = name || boards.find(other => other.id === boardId)?.title || 'Board';
  const overlays = useOverlays();

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        type="button"
        aria-label={`Board: ${title}`}
        variant="ghost"
        size="sm"
        className="w-full min-w-0 justify-start gap-2"
      >
        <SquareKanban aria-hidden />
        <Txt tone="ink" as="span" variant="body" className="min-w-0 flex-1 truncate text-left">
          {title}
        </Txt>
        <ChevronDown aria-hidden size={14} className="text-muted-foreground shrink-0" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" className="w-64">
        {boards.map(other => (
          <DropdownMenu.Item
            key={other.id}
            render={<Link to={boardConfigPath(factoryId, other.id)} onClick={() => overlays.close('sidebar')} />}
          >
            <SquareKanban />
            <span className="min-w-0 flex-1 truncate">{other.id === boardId ? title : other.title}</span>
            {other.id === boardId && <Check aria-label="Open board" />}
          </DropdownMenu.Item>
        ))}
        {response?.canEdit && (
          <>
            <DropdownMenu.Separator />
            <DropdownMenu.Item render={<Link to={newBoardPath(factoryId)} onClick={() => overlays.close('sidebar')} />}>
              <Plus />
              New board
            </DropdownMenu.Item>
          </>
        )}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

/**
 * The phases as the draft has them, so renames and moves show before saving. On a board the user can change, every
 * phase but the first can be dragged by its grip, or moved with Alt+Up and Alt+Down; the first is where new cards land.
 * A dragged row only travels up and down the list, and a line marks where it will land.
 */
function PhaseList({
  factoryId,
  boardId,
  phaseKey,
  skills,
  moves,
  response,
}: BoardConfigLocation & {
  response: StoredBoardResponse;
}) {
  const { board, canEdit } = response;
  const { draft, locked, setDraft } = useBoardDraft(factoryId, boardId, board);
  const editable = canEdit === true && board.editable === true;
  // The skills and card moves pages have no save bar to keep a reorder made there.
  const sortable = editable && !skills && !moves && !locked && draft.phases.length > 2;
  const [drag, setDrag] = useState<Drag>();
  const [announcement, setAnnouncement] = useState('');

  const commit = (from: number, to: number) => {
    const next = movePhase(draft.phases, from, to);
    if (next === draft.phases) return;
    const key = draft.phases[from]?.key;
    setDraft(current => ({ ...current, phases: next }));
    const index = next.findIndex(phase => phase.key === key);
    setAnnouncement(`${next[index]?.name} moved to position ${index + 1} of ${next.length}.`);
  };

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    event.preventDefault();
    commit(index, index + (event.key === 'ArrowUp' ? -1 : 1));
  };

  const onPointerDown = (event: PointerEvent<HTMLLIElement>, from: number) => {
    if (event.button !== 0 || !(event.target instanceof Element) || !event.target.closest('[data-grip]')) return;
    const list = event.currentTarget.parentElement;
    if (!list) return;
    event.preventDefault();
    const rows = Array.from(list.children, row => row.getBoundingClientRect());
    const startY = event.clientY;
    let current: Drag | undefined;

    const onMove = (move: globalThis.PointerEvent) => {
      const raw = move.clientY - startY;
      if (!current && Math.abs(raw) < 4) return;
      const self = rows[from];
      const first = rows[1];
      const last = rows[rows.length - 1];
      if (!self || !first || !last) return;
      // Locked to the list: the row can't rise above the first phase's slot or sink below the last row.
      const offset = Math.min(Math.max(raw, first.top - self.top), last.bottom - self.bottom);
      const center = self.top + self.height / 2 + offset;
      let to = from;
      rows.forEach((row, index) => {
        const middle = row.top + row.height / 2;
        // Inclusive, since the clamp stops the row's center right on the end rows' middles.
        if (index > from && center >= middle) to = index;
        if (index > 0 && index < from && center <= middle) to = Math.min(to, index);
      });
      current = { from, to, offset };
      setDrag(current);
    };
    const stop = (drop: boolean) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onEscape);
      if (current) {
        // The release would otherwise click the link under the pointer.
        window.addEventListener('click', swallow, { capture: true, once: true });
        setTimeout(() => window.removeEventListener('click', swallow, { capture: true }));
        if (drop) commit(current.from, current.to);
      }
      setDrag(undefined);
    };
    const onUp = () => stop(true);
    const onCancel = () => stop(false);
    const onEscape = (key: globalThis.KeyboardEvent) => {
      if (key.key === 'Escape') {
        key.preventDefault();
        stop(false);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onEscape);
  };

  return (
    <>
      <Sidebar.NavList className={cn(drag && 'cursor-grabbing select-none')}>
        {draft.phases.map((phase, index) => {
          const movable = sortable && index > 0;
          const dragged = drag?.from === index;
          const lands =
            drag && drag.to !== drag.from && drag.to === index ? (drag.to < drag.from ? 'before' : 'after') : undefined;
          return (
            <ConfigLink
              key={phase.key}
              to={boardConfigPath(factoryId, boardId, phase.key)}
              isActive={phase.key === phaseKey}
              icon={
                <PhaseIcon movable={movable}>
                  <BoardStageIcon stage={phase.key} kind={phaseIconKind(boardId, phase.kind)} decorative />
                </PhaseIcon>
              }
              label={phase.name}
              data-drop={lands}
              style={dragged ? { transform: `translateY(${drag.offset}px)` } : undefined}
              className={cn(
                movable && 'group/phase',
                dragged && 'bg-card/90 shadow-overlay z-10 rounded-lg',
                DROP_LINE,
              )}
              onKeyDown={movable ? event => onKeyDown(event, index) : undefined}
              onPointerDown={movable ? event => onPointerDown(event, index) : undefined}
              description={movable ? 'Alt+Up or Alt+Down moves this phase.' : undefined}
            />
          );
        })}
      </Sidebar.NavList>
      {editable && <AddPhaseButton factoryId={factoryId} boardId={boardId} board={board} disabled={locked} />}
      <span role="status" className="sr-only">
        {announcement}
      </span>
    </>
  );
}

type Drag = { from: number; to: number; offset: number };

// Where a dragged phase will land: a line across the top or bottom edge of the row it'll take the place of.
const DROP_LINE = cn(
  'before:bg-border-focus before:pointer-events-none before:z-20 before:absolute before:inset-x-1 before:hidden before:h-0.5 before:rounded-full',
  'data-[drop=before]:before:-top-px data-[drop=before]:before:block data-[drop=after]:before:-bottom-px data-[drop=after]:before:block',
);

function swallow(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
}

/**
 * A movable phase's icon gives way to a grip while the row is hovered or focused, so the row reads as draggable. On
 * touch screens there's no hover, so the grip shows all the time. Only the grip starts a drag.
 */
function PhaseIcon({ movable, children }: { movable: boolean; children: ReactNode }) {
  if (!movable) return children;
  return (
    <span
      data-grip
      className="grid cursor-grab touch-none place-items-center *:col-start-1 *:row-start-1 active:cursor-grabbing"
    >
      <span className="grid place-items-center group-focus-within/phase:invisible group-hover/phase:invisible pointer-coarse:invisible">
        {children}
      </span>
      <GripVertical
        aria-hidden
        className="text-muted-foreground invisible size-4 group-focus-within/phase:visible group-hover/phase:visible pointer-coarse:visible"
      />
    </span>
  );
}

function ConfigLink({
  to,
  isActive,
  icon,
  label,
  className,
  description,
  onKeyDown,
  ...row
}: Pick<ComponentProps<'li'>, 'style' | 'onPointerDown'> & {
  'data-drop'?: 'before' | 'after';
  to: string;
  isActive: boolean;
  icon: ReactNode;
  label: string;
  className?: string;
  description?: string;
  onKeyDown?: (event: KeyboardEvent) => void;
}) {
  const overlays = useOverlays();

  return (
    <Sidebar.NavLink
      {...row}
      link={{ name: label, url: to }}
      isActive={isActive}
      className={className}
      render={
        <NavLink
          to={to}
          // Rows move by the grip; the link's own drag would carry a URL instead.
          draggable={false}
          onClick={() => overlays.close('sidebar')}
          onKeyDown={onKeyDown}
          aria-description={description}
        >
          {icon}
          <Sidebar.NavLabel>{label}</Sidebar.NavLabel>
        </NavLink>
      }
    />
  );
}
