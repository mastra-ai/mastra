import { Avatar } from '@mastra/playground-ui/components/Avatar';
import type { BadgeVariant } from '@mastra/playground-ui/components/Badge';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import {
  Bot,
  Check,
  ChevronRight,
  Eye,
  FolderGit2,
  GitCommitHorizontal,
  Hammer,
  Inbox,
  ListFilter,
  MapIcon,
  Play,
  SquarePen,
  User,
  X,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { Link } from 'react-router';

import type { ActivityBlock, ActivityEntry } from '../activity';
import { activityBlocks, clockTime, dayHeading, groupByDay } from '../activity';
import { auditActionLabel, auditCategory } from '../auditPresentation';
import { boardItemPath } from '../overview';
import { PANEL, PANEL_ROW, PANEL_ROW_LINK, TIMESTAMP } from './panel';
import { DayHeading, RailRow, RAIL_LIST, RAIL_MARK_TONE } from './Timeline';
import type { FactoryMentionMember } from '../services/members';
import { stageTone } from '../stages';
import { StageBadge } from './StageBadge';

/** Steps beyond this fold into a count, so a long chain cannot push the title out. */
const CHAIN_SHOWN = 2;

const STAGE_GLYPHS: Record<string, LucideIcon> = {
  intake: Inbox,
  triage: ListFilter,
  planning: MapIcon,
  execute: Hammer,
  review: Eye,
  done: Check,
  canceled: X,
};

/** Only `github:` carries a name; an agent id is a uuid and a WorkOS id off the roster is worse than no name, so both read as a word. */
function actorName(by: string | undefined, roster: Map<string, FactoryMentionMember>): string {
  if (by === undefined) return 'Someone';
  if (by.startsWith('agent:')) return 'Agent';
  if (by.startsWith('github:')) return by.slice('github:'.length) || 'GitHub';
  if (by.startsWith('factory-')) return 'A rule';
  return roster.get(by)?.name ?? 'Someone';
}

const DEED_GLYPHS: Record<string, LucideIcon> = {
  run: Play,
  git: GitCommitHorizontal,
  agent: Bot,
  worktree: FolderGit2,
  intake: Inbox,
  work_item: SquarePen,
};

/** The verb that makes the rail read as prose; anything new falls back to its own label. */
const DEED_PHRASES: Record<string, string> = {
  'run.started': 'started a run on',
  'run.approved': 'approved the run on',
  'run.dismissed': 'dismissed the run on',
  'git.commit': 'committed to',
  'git.push': 'pushed to',
  'git.pr_opened': 'opened a pull request for',
  'agent.commit': 'committed to',
  'agent.push': 'pushed to',
  'agent.pr_opened': 'opened a pull request for',
  'worktree.created': 'set up a worktree for',
  'worktree.deleted': 'cleaned up the worktree of',
  'work_item.comment_created': 'commented:',
  'work_item.comment_edited': 'edited a comment:',
  'work_item.comment_deleted': 'deleted a comment:',
  'work_item.comment_mentioned': 'mentioned someone:',
  'work_item.created': 'created',
  'work_item.updated': 'updated',
  'work_item.deleted': 'deleted',
  'work_item.transition_rejected': 'was blocked moving',
  'intake.config_updated': 'changed intake settings on',
  'intake.binding_updated': 'changed an intake binding on',
};

/** Some events name nothing — an intake setting has no title — so the verb drops its preposition. */
function deedPhrase(action: string, named: boolean): string {
  const [, namespace, leaf] = action.split('.');
  const phrase = DEED_PHRASES[`${namespace}.${leaf}`] ?? auditActionLabel(action).toLowerCase();
  return named ? phrase : phrase.replace(/ (?:on|to|for|of)$/, '');
}

function entryTone(entry: ActivityEntry): BadgeVariant {
  return entry.kind === 'move'
    ? stageTone(entry.stages.at(-1) ?? 'triage')
    : (auditCategory(entry.action)?.tone ?? 'neutral');
}

function entryGlyph(entry: ActivityEntry): LucideIcon {
  return entry.kind === 'move'
    ? (STAGE_GLYPHS[entry.stages.at(-1) ?? ''] ?? ListFilter)
    : (DEED_GLYPHS[entry.action.split('.')[1] ?? ''] ?? SquarePen);
}

function Node({ entry }: { entry: ActivityEntry }) {
  const Glyph = entryGlyph(entry);

  return <Glyph size={14} className={RAIL_MARK_TONE[entryTone(entry)]} aria-hidden />;
}

const ACTOR_GLYPHS: Array<[string, ComponentType<SVGProps<SVGSVGElement>>]> = [
  ['agent:', Bot],
  ['github:', GithubIcon],
  ['factory-', Zap],
];

function Actor({ by, avatarUrl, name }: { by: string | undefined; avatarUrl?: string; name: string }) {
  if (avatarUrl !== undefined) return <Avatar src={avatarUrl} name={name} size="sm" />;

  const Glyph = ACTOR_GLYPHS.find(([prefix]) => by?.startsWith(prefix))?.[1] ?? User;

  return (
    <span className="border-border1 bg-surface3 text-icon3 h-avatar-sm w-avatar-sm grid shrink-0 place-items-center rounded-full border">
      <Glyph className="size-[13px]" aria-hidden />
    </span>
  );
}

function StageChain({ stages }: { stages: string[] }) {
  const folded = stages.length - CHAIN_SHOWN;
  const shown = folded > 0 ? stages.slice(-CHAIN_SHOWN) : stages;

  return (
    <span className="flex shrink-0 items-center gap-1">
      {folded > 0 ? <span className="text-ui-xs text-icon3 tabular-nums">+{folded}</span> : null}
      {shown.map((stage, index) => (
        <span key={`${stage}-${index}`} className="flex items-center gap-1">
          {index > 0 || folded > 0 ? <ChevronRight size={11} className="text-icon2 shrink-0" aria-hidden /> : null}
          <StageBadge stage={stage} />
        </span>
      ))}
    </span>
  );
}

function entryTarget(entry: ActivityEntry): { id: string; board: string } | undefined {
  return entry.kind === 'move' ? { id: entry.id, board: entry.board } : entry.item;
}

/** Only a card the board still holds opens. */
function EntryTitle({ entry, factoryProjectId }: { entry: ActivityEntry; factoryProjectId: string | undefined }) {
  const target = entryTarget(entry);
  const shape = 'text-icon6 min-w-0 truncate font-medium';

  if (target === undefined) return <span className={shape}>{entry.title}</span>;

  return (
    <Link to={boardItemPath(factoryProjectId, target)} className={`${shape} hover:underline`}>
      {entry.title}
    </Link>
  );
}

function Time({ at, className }: { at: number; className?: string }) {
  return (
    <time dateTime={new Date(at).toISOString()} className={`${TIMESTAMP} shrink-0 ${className ?? ''}`}>
      {clockTime(at)}
    </time>
  );
}

function EntryPanel({ entries, factoryProjectId }: { entries: ActivityEntry[]; factoryProjectId: string | undefined }) {
  return (
    <ul className={`${PANEL} m-0 mt-2 list-none p-1`}>
      {entries.map(entry => {
        const target = entryTarget(entry);
        const body = (
          <>
            <Txt as="span" variant="ui-sm" className="text-icon4 min-w-0 flex-1 truncate">
              {entry.title === '' ? <span className="text-icon2">—</span> : entry.title}
            </Txt>
            <Time at={entry.at} />
          </>
        );

        return (
          <li key={`${entry.id}-${entry.at}`}>
            {target === undefined ? (
              <div className={PANEL_ROW}>{body}</div>
            ) : (
              <Link to={boardItemPath(factoryProjectId, target)} className={PANEL_ROW_LINK}>
                {body}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Block({
  block,
  roster,
  factoryProjectId,
  connected,
}: {
  block: ActivityBlock;
  roster: Map<string, FactoryMentionMember>;
  factoryProjectId: string | undefined;
  connected: boolean;
}) {
  const first = block.entries[0]!;
  const name = actorName(first.by, roster);
  const grouped = block.entries.length > 1;

  return (
    <RailRow mark={<Node entry={first} />} connected={connected}>
      <Txt as="div" variant="ui-sm" className="flex min-h-7 min-w-0 items-center gap-x-2 pr-4">
        <Actor by={first.by} avatarUrl={roster.get(first.by ?? '')?.avatarUrl} name={name} />
        <span className="text-icon6 shrink-0 font-medium">{name}</span>
        <span className="text-icon3 shrink-0">
          {first.kind === 'move' ? 'moved' : deedPhrase(first.action, first.title !== '')}
        </span>
        {grouped && first.kind === 'move' ? (
          <span className="text-icon6 shrink-0 font-medium">{block.entries.length} cards</span>
        ) : (
          <>
            {first.title === '' ? null : <EntryTitle entry={first} factoryProjectId={factoryProjectId} />}
            {grouped ? (
              <span className="text-ui-xs text-icon3 shrink-0 tabular-nums">+{block.entries.length - 1}</span>
            ) : null}
          </>
        )}
        {first.kind === 'move' ? (
          <>
            <span className="text-icon3 shrink-0">to</span>
            <StageChain stages={first.stages} />
          </>
        ) : null}
        <Time at={first.at} className="ml-auto pl-2" />
      </Txt>
      {grouped ? <EntryPanel entries={block.entries} factoryProjectId={factoryProjectId} /> : null}
    </RailRow>
  );
}

/**
 * Board traffic as sentences on a rail, cut by day. One stream, two sources that
 * never describe the same fact: the board's stage history, and the audit trail
 * for everything a stage move is not.
 */
export function ActivityRail({
  entries,
  members,
  factoryProjectId,
}: {
  entries: ActivityEntry[];
  members: FactoryMentionMember[];
  factoryProjectId: string | undefined;
}) {
  const roster = new Map(members.map(member => [member.id, member]));
  const nowMs = Date.now();

  return (
    <div className="flex flex-col gap-8">
      {groupByDay(entries).map(day => {
        const blocks = activityBlocks(day.items);

        return (
          <section key={day.dayMs} className="flex flex-col gap-5">
            <DayHeading>{dayHeading(day.dayMs, nowMs)}</DayHeading>
            <ul className={RAIL_LIST}>
              {blocks.map((block, index) => (
                <Block
                  key={`${block.key}-${block.entries[0]?.at}`}
                  block={block}
                  roster={roster}
                  factoryProjectId={factoryProjectId}
                  connected={index < blocks.length - 1}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
