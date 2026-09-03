import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { Bot, Brain, CircleAlert, MessageSquare, User, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';

import { useFactoryAttention } from '../../../../hooks/useFactoryAttention';
import { formatDuration } from '../../../../lib/date';
import { relativeTime } from '../../../../lib/date/relativeTime';
import { boardItemPath } from '../overview';
import type { MovedItem, StageItem } from '../overview';
import { attentionAuthorName, factoryAttentionTargetPath } from '../services/attention';
import type { FactoryAttentionItem } from '../services/attention';
import { PANEL, PANEL_ROW_LINK, TIMESTAMP } from './panel';
import { StageBadge } from './StageBadge';

/** Rows before the fold, and the ceiling once it is opened. */
const PREVIEW_ROWS = 5;
const EXPANDED_ROWS = 25;

/** Who moved a card, as a mark rather than a word. */
function ActorIcon({ by }: { by: string | undefined }) {
  const [Glyph, label] =
    by === undefined
      ? [User, 'unknown']
      : by.startsWith('agent:')
        ? [Bot, 'an agent']
        : by.startsWith('github:')
          ? [GithubIcon, 'GitHub']
          : by.startsWith('factory-')
            ? [Zap, 'a rule']
            : [User, 'a person'];
  return <Glyph className="text-icon3 size-[13px] shrink-0" aria-label={`Moved by ${label}`} />;
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className={`${PANEL} px-3 py-6`}>
      <Txt as="p" variant="ui-sm" className="text-icon3 m-0 text-center">
        {children}
      </Txt>
    </div>
  );
}

function ItemRow({
  to,
  href,
  title,
  badge,
  subtitle,
  time,
  leading,
  unread,
}: {
  to?: string;
  href?: string;
  title: string;
  badge?: ReactNode;
  subtitle?: string;
  time: string;
  leading?: ReactNode;
  unread?: boolean;
}) {
  const body = (
    <>
      {leading}
      <span className="flex min-w-0 flex-1 flex-col">
        <Txt as="span" variant="ui-sm" className="text-icon6 truncate font-medium">
          {title}
        </Txt>
        {subtitle ? (
          <Txt as="span" variant="ui-xs" className="text-icon3 truncate">
            {subtitle}
          </Txt>
        ) : null}
      </span>
      {badge}
      <span className={`${TIMESTAMP} relative shrink-0 text-right`}>
        {unread ? (
          <span
            className="bg-warning1 absolute top-1/2 -left-3 size-1.5 -translate-y-1/2 rounded-full"
            aria-label="Unread"
          />
        ) : null}
        {time}
      </span>
    </>
  );

  return (
    <li>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className={PANEL_ROW_LINK}>
          {body}
        </a>
      ) : (
        <Link to={to ?? ''} className={PANEL_ROW_LINK}>
          {body}
        </Link>
      )}
    </li>
  );
}

/** Five rows, then as many as a glance can still take — the rest live on the board. */
function Rows<T>({ items, row }: { items: T[]; row: (item: T) => ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items.slice(0, EXPANDED_ROWS) : items.slice(0, PREVIEW_ROWS);

  return (
    <ul className={`${PANEL} m-0 flex list-none flex-col p-1`}>
      {shown.map(row)}
      <ShowMore total={items.length} expanded={expanded} onToggle={() => setExpanded(!expanded)} />
    </ul>
  );
}

/** The fold, as the list's own last row rather than a control floating under it. */
function ShowMore({ total, expanded, onToggle }: { total: number; expanded: boolean; onToggle: () => void }) {
  if (total <= PREVIEW_ROWS) return null;

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className={`${PANEL_ROW_LINK} text-ui-xs text-icon3 hover:text-icon5 w-full cursor-pointer`}
      >
        <span className="flex-1 text-left">
          {expanded ? 'Show less' : `Show ${Math.min(total, EXPANDED_ROWS) - PREVIEW_ROWS} more`}
        </span>
        {expanded && total > EXPANDED_ROWS ? (
          <span className={TIMESTAMP}>
            {EXPANDED_ROWS} of {total}
          </span>
        ) : null}
      </button>
    </li>
  );
}

/** What a run is working on, longest first — a run that outlives its stage is the hung one. */
export function RunningList({
  running,
  factoryProjectId,
}: {
  running: StageItem[];
  factoryProjectId: string | undefined;
}) {
  if (running.length === 0) return <Empty>Nothing running</Empty>;

  return (
    <Rows
      items={running}
      row={item => (
        <ItemRow
          key={`${item.id}-${item.stage}`}
          to={boardItemPath(factoryProjectId, item)}
          title={item.title}
          badge={<StageBadge stage={item.stage} live />}
          time={formatDuration(item.ageMs)}
        />
      )}
    />
  );
}

/** Pipeline items with nothing running on them, oldest first — the silent failure. */
export function StalledList({
  waiting,
  factoryProjectId,
}: {
  waiting: StageItem[];
  factoryProjectId: string | undefined;
}) {
  if (waiting.length === 0) return <Empty>Nothing stalled</Empty>;

  return (
    <Rows
      items={waiting}
      row={item => (
        <ItemRow
          key={`${item.id}-${item.stage}`}
          to={boardItemPath(factoryProjectId, item)}
          title={item.title}
          badge={<StageBadge stage={item.stage} />}
          time={formatDuration(item.ageMs)}
        />
      )}
    />
  );
}

/** The newest moves; the day headings and the whole history live on the Activity page. */
export function ActivityFeed({
  moved,
  factoryProjectId,
}: {
  moved: MovedItem[];
  factoryProjectId: string | undefined;
}) {
  if (moved.length === 0) return <Empty>Nothing moved</Empty>;

  return (
    <Rows
      items={moved}
      row={item => (
        <ItemRow
          key={`${item.id}-${item.stage}-${item.at}`}
          to={boardItemPath(factoryProjectId, item)}
          title={item.title}
          leading={<ActorIcon by={item.by} />}
          badge={<StageBadge stage={item.stage} />}
          time={relativeTime(new Date(item.at).toISOString())}
        />
      )}
    />
  );
}

const ATTENTION_GLYPHS: Record<FactoryAttentionItem['kind'], { Glyph: LucideIcon; tone: string; label: string }> = {
  mention: { Glyph: MessageSquare, tone: 'text-badge-blue-fg', label: 'Mention' },
  'automation-failed': { Glyph: CircleAlert, tone: 'text-badge-red-fg', label: 'Failed run' },
  'supervisor-finding': { Glyph: Brain, tone: 'text-accent1', label: 'Supervisor finding' },
  activity: { Glyph: MessageSquare, tone: 'text-icon3', label: 'Comment' },
};

/** What landed. Unread lives at the row's edge instead, so the titles stay aligned. */
function AttentionMark({ item }: { item: FactoryAttentionItem }) {
  const { Glyph, tone, label } = ATTENTION_GLYPHS[item.kind];

  return <Glyph size={15} className={`${tone} shrink-0`} aria-label={label} />;
}

/** Where the message landed — the card, and who wrote it when we know. */
function attentionWhere(item: FactoryAttentionItem): string {
  const author = attentionAuthorName(item);
  return author ? `${item.title} · ${author}` : item.title;
}

/** Read and archive stay on the attention page — a preview that acts is a second inbox. */
export function AttentionPreview({ factoryProjectId }: { factoryProjectId: string | undefined }) {
  const attention = useFactoryAttention(factoryProjectId, 'open', EXPANDED_ROWS, 'badge');
  const items = attention.data?.items ?? [];

  if (attention.isPending) return <Skeleton className="h-24 w-full rounded-xl" />;
  if (attention.isError) return <Empty>Could not read what needs you.</Empty>;
  if (items.length === 0) return <Empty>All clear</Empty>;

  return (
    <Rows
      items={items}
      row={item => (
        <ItemRow
          key={item.key}
          to={factoryAttentionTargetPath(factoryProjectId ?? '', item.target)}
          title={item.detail}
          subtitle={attentionWhere(item)}
          leading={<AttentionMark item={item} />}
          unread={!item.read}
          time={relativeTime(item.occurredAt)}
        />
      )}
    />
  );
}
