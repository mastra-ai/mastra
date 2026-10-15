import { isAuditAction, parseAuditAction } from '@mastra/factory/storage/domains/audit/actions';
import type { AuditAction, AuditNamespace } from '@mastra/factory/storage/domains/audit/actions';
import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { DisclosureChevron } from '@mastra/playground-ui/components/DisclosureChevron';
import type { BadgeVariant } from '@mastra/playground-ui/components/Badge';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import {
  Bot,
  Check,
  ChevronRight,
  Eye,
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
import type { ComponentType, ReactNode, SVGProps } from 'react';
import { Link } from 'react-router';

import type { ActivityEntry } from '../../activity';
import { boardItemPath, clockTime } from '../../activity';
import { auditActionLabel, auditCategory } from '../../auditPresentation';
import type { FactoryMentionMember } from '../../services/members';
import { stageTone } from '../../stages';
import { StageBadge } from '../StageBadge';
import { RAIL_MARK_TONE } from '../Timeline';

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

const DEED_GLYPHS: Record<AuditNamespace, LucideIcon> = {
  run: Play,
  git: GitCommitHorizontal,
  agent: Bot,
  intake: Inbox,
  work_item: SquarePen,
};

/** The verb that makes the rail read as prose; a row off the registry falls back to its own label. */
const DEED_PHRASES: Record<AuditAction, string> = {
  'factory.run.started': 'started a run on',
  'factory.run.ended': 'ended a run on',
  'factory.run.queued': 'queued a run on',
  'factory.run.rejected': 'rejected the run on',
  'factory.run.approved': 'approved the run on',
  'factory.run.dismissed': 'dismissed the run on',
  'factory.run.retry': 'retried the run on',
  'factory.git.commit': 'committed to',
  'factory.git.push': 'pushed to',
  'factory.git.pr_opened': 'opened a pull request for',
  'factory.agent.commit': 'committed to',
  'factory.agent.push': 'pushed to',
  'factory.agent.pr_opened': 'opened a pull request for',
  'factory.agent.signaled': 'signaled',
  'factory.work_item.created': 'created',
  'factory.work_item.updated': 'updated',
  'factory.work_item.deleted': 'deleted',
  'factory.work_item.stage_moved': 'moved',
  'factory.work_item.transition_rejected': 'was blocked moving',
  'factory.work_item.comment_created': 'commented:',
  'factory.work_item.comment_edited': 'edited a comment:',
  'factory.work_item.comment_deleted': 'deleted a comment:',
  'factory.work_item.comment_mentioned': 'mentioned someone:',
  'factory.work_item.labels_reconciled': 'reconciled the labels on',
  'factory.intake.config_updated': 'changed intake settings on',
  'factory.intake.binding_updated': 'changed an intake binding on',
  'factory.intake.label_route_updated': 'changed an intake label route on',
};

/** What a sentence's verb points at: one card's title, a count of cards, or nothing at all (an intake setting has no title). */
type DeedObject = 'title' | 'group' | 'none';

function subjectCount(entries: ActivityEntry[]): number {
  return new Set(entries.map(entry => entryTarget(entry)?.id ?? entry.title)).size;
}

function deedObject(entries: ActivityEntry[]): DeedObject {
  if (entries.every(entry => entry.title === '')) return 'none';
  return subjectCount(entries) > 1 ? 'group' : 'title';
}

export function namesSeveralCards(entries: ActivityEntry[]): boolean {
  return deedObject(entries) === 'group';
}

/** A comment's colon introduces its card; before a count it reads "commented on 3 cards". */
function deedPhrase(action: string, object: DeedObject): string {
  const phrase = isAuditAction(action) ? DEED_PHRASES[action] : auditActionLabel(action).toLowerCase();
  if (object === 'none') return phrase.replace(/ (?:on|to|for|of)$/, '');
  if (object === 'group') return phrase.replace(/:$/, ' on');
  return phrase;
}

function entryTone(entry: ActivityEntry): BadgeVariant {
  return entry.kind === 'move'
    ? stageTone(entry.stages.at(-1) ?? 'triage')
    : (auditCategory(entry.action)?.tone ?? 'neutral');
}

function entryGlyph(entry: ActivityEntry): LucideIcon {
  if (entry.kind === 'move') return STAGE_GLYPHS[entry.stages.at(-1) ?? ''] ?? ListFilter;
  const namespace = parseAuditAction(entry.action)?.namespace;
  return namespace ? DEED_GLYPHS[namespace] : SquarePen;
}

export function Node({ entry }: { entry: ActivityEntry }) {
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
    <span className="border-border bg-card text-muted-foreground h-avatar-sm w-avatar-sm grid shrink-0 place-items-center rounded-full border">
      <Glyph className="size-[13px]" aria-hidden />
    </span>
  );
}

function StageChain({ stages }: { stages: string[] }) {
  const folded = stages.length - CHAIN_SHOWN;
  const shown = folded > 0 ? stages.slice(-CHAIN_SHOWN) : stages;

  return (
    <span className="flex shrink-0 items-center gap-1">
      {folded > 0 ? (
        <Txt as="span" variant="meta" tone="muted" className="tabular-nums">
          +{folded}
        </Txt>
      ) : null}
      {shown.map((stage, index) => (
        <span key={`${stage}-${index}`} className="flex items-center gap-1">
          {index > 0 || folded > 0 ? (
            <ChevronRight size={11} className="text-placeholder shrink-0" aria-hidden />
          ) : null}
          <StageBadge stage={stage} />
        </span>
      ))}
    </span>
  );
}

export function entryTarget(entry: ActivityEntry): { id: string; board: string } | undefined {
  return entry.kind === 'move' ? { id: entry.id, board: entry.board } : entry.item;
}

export function EntryTitle({
  entry,
  factoryProjectId,
  flagged,
  variant,
}: {
  entry: ActivityEntry;
  factoryProjectId: string | undefined;
  flagged: ReadonlySet<ActivityEntry>;
  variant: 'column' | 'caption';
}) {
  const target = entryTarget(entry);
  const tone = variant === 'column' ? 'ink' : 'muted';

  return (
    <span className="flex min-w-0 items-center gap-2">
      {target === undefined ? (
        <Txt as="span" variant={variant} tone={tone} className="min-w-0 truncate">
          {entry.title}
        </Txt>
      ) : (
        <Link to={boardItemPath(factoryProjectId, target)} className="min-w-0 truncate hover:underline">
          <Txt as="span" variant={variant} tone={tone} className="truncate">
            {entry.title}
          </Txt>
        </Link>
      )}
      {flagged.has(entry) ? (
        <Badge variant="orange" size="xs" className="shrink-0">
          Needs you
        </Badge>
      ) : null}
    </span>
  );
}

export function Time({ at, className }: { at: number; className?: string }) {
  return (
    <Txt
      as="time"
      variant="meta"
      tone="muted"
      font="mono"
      dateTime={new Date(at).toISOString()}
      className={`shrink-0 ${className ?? ''}`}
    >
      {clockTime(at)}
    </Txt>
  );
}

/** Who did what to which card, on one line; detail slots in before the time, controls after it. */
export function EntrySentence({
  entries,
  roster,
  factoryProjectId,
  flagged,
  compact,
  groupToggle,
  children,
  trailing,
}: {
  entries: [ActivityEntry, ...ActivityEntry[]];
  roster: Map<string, FactoryMentionMember>;
  factoryProjectId: string | undefined;
  flagged: ReadonlySet<ActivityEntry>;
  compact: boolean;
  groupToggle?: { expanded: boolean; onToggle: () => void };
  children?: ReactNode;
  trailing?: ReactNode;
}) {
  const [first] = entries;
  const name = actorName(first.by, roster);
  const object = deedObject(entries);
  const groupNoun = entries.every(entry => entryTarget(entry) !== undefined) ? 'cards' : 'items';

  return (
    <div className={`flex min-w-0 items-center gap-x-2 pr-4 ${compact ? 'min-h-6' : 'min-h-7'}`}>
      {compact ? null : <Actor by={first.by} avatarUrl={roster.get(first.by ?? '')?.avatarUrl} name={name} />}
      <Txt as="span" variant="column" tone="ink" className="shrink-0">
        {name}
      </Txt>
      <Txt as="span" variant="caption" tone="muted" className="shrink-0">
        {first.kind === 'move' ? 'moved' : deedPhrase(first.action, object)}
      </Txt>
      {object === 'group' && groupToggle ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={groupToggle.expanded}
          onClick={groupToggle.onToggle}
          className="text-foreground -mx-1.5 h-6 shrink-0 px-1.5 tabular-nums"
        >
          {subjectCount(entries)} {groupNoun}
          <DisclosureChevron direction={groupToggle.expanded ? 'down' : 'right'} />
        </Button>
      ) : null}
      {object === 'group' && !groupToggle ? (
        <Txt as="span" variant="column" tone="ink" className="shrink-0 tabular-nums">
          {subjectCount(entries)} {groupNoun}
        </Txt>
      ) : null}
      {object === 'none' && entries.length > 1 ? (
        <Txt as="span" variant="caption" tone="muted" className="shrink-0 tabular-nums">
          {entries.length} times
        </Txt>
      ) : null}
      {object === 'title' ? (
        <EntryTitle entry={first} factoryProjectId={factoryProjectId} flagged={flagged} variant="column" />
      ) : null}
      {object === 'title' && entries.length > 1 ? (
        <Txt as="span" variant="caption" tone="muted" className="shrink-0 tabular-nums">
          {entries.length} times
        </Txt>
      ) : null}
      {first.kind === 'move' ? (
        <>
          <Txt as="span" variant="caption" tone="muted" className="shrink-0">
            to
          </Txt>
          <StageChain stages={first.stages} />
        </>
      ) : null}
      {children}
      <Time at={first.at} className="ml-auto pl-2" />
      {trailing}
    </div>
  );
}
