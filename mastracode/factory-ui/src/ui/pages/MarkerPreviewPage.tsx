/**
 * TEMPORARY — a bench for the session activity markers at `/markers`, so every
 * state can be looked at side by side without arranging real sessions to be in
 * it. Delete once the markers are settled.
 */
import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { MainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { MessageSquare } from 'lucide-react';
import type { ReactNode } from 'react';

import { CardLabels } from '../domains/factory/components/BoardCardParts';
import { SourceIcon } from '../domains/factory/components/BoardIcons';
import { SessionActivityPentad } from '../domains/workspaces/components/SessionActivity';
import type { SessionCardStatus, SessionRowStatus } from '../domains/workspaces/components/SessionActivity';
import { SessionNavRow } from '../domains/workspaces/components/SessionNavRow';
import type { SessionPreviewDetails } from '../domains/workspaces/components/SessionPreviewCard';

interface MockItem {
  status?: SessionCardStatus;
  meta: string;
  title: string;
  labels: string[];
  comments: number;
  owner: string;
}

const CARDS: MockItem[] = [
  {
    status: 'working',
    meta: '#22532 · daneatmastra · 3d',
    title: 'cannot abort suspend run',
    labels: ['bug', 'Workflows', 'trio-tnt', 'storage', 'cli', 'memory', 'triage'],
    comments: 3,
    owner: 'Schneider Damien',
  },
  {
    status: 'initializing',
    meta: '#22509 · daneatmastra · 4d',
    title: 'Ingest durable agents tweaks',
    labels: ['Workflows', 'trio-tnt', 'trio-tb', 'cli', 'memory', 'storage', 'triage'],
    comments: 0,
    owner: 'daneatmastra',
  },
  {
    status: 'ready',
    meta: 'COR-1188 · daneatmastra · 1h',
    title: 'Review the memory page draft',
    labels: ['linear', 'docs'],
    comments: 1,
    owner: 'Schneider Damien',
  },
  {
    status: 'idle',
    meta: '#22501 · daneatmastra · 5d',
    title: 'Session bound, agent resting',
    labels: ['factory'],
    comments: 0,
    owner: 'daneatmastra',
  },
  {
    meta: '#22488 · daneatmastra · 6d',
    title: 'Bump the pubsub retry ceiling',
    labels: ['Workflows'],
    comments: 0,
    owner: 'daneatmastra',
  },
];

const ROWS: { status: SessionRowStatus; label: string }[] = [
  { status: 'working', label: 'fix: transcript duplicates' },
  { status: 'initializing', label: 'feat: attention inbox' },
  { status: 'ready', label: 'docs: memory page' },
];

function previewDetails(branch: string): SessionPreviewDetails {
  return {
    kind: 'Work session',
    owner: { name: 'Damien Schneider' },
    itemLabel: 'Work item: Issue #42',
    itemTitle: 'Authentication fails after token refresh',
    branch,
    baseBranch: 'main',
    updatedAt: new Date(Date.now() - 14 * 60_000).toISOString(),
  };
}

function noop() {}

/** The board card's own markup, so the marker is judged at the width and density it ships at. */
function MockCard({ item }: { item: MockItem }) {
  return (
    <article className="border-border1/50 bg-neutral6/5 relative flex flex-col gap-3 rounded-xl border p-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex min-w-0 items-center gap-1.5 pr-8">
          <span className="text-ui-xs text-icon2 min-w-0 truncate">{item.meta}</span>
          {item.status && <SessionActivityPentad status={item.status} className="shrink-0" />}
          {item.comments > 0 && (
            <span className="text-ui-xs text-icon2 flex shrink-0 items-center gap-1">
              <MessageSquare size={11} aria-hidden />
              {item.comments}
            </span>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-1.5 tracking-tight">
          <SourceIcon source="github-issue" />
          <span className="text-ui-smd text-icon6 min-w-0 flex-1 truncate font-[550]">{item.title}</span>
        </div>
      </div>
      <CardLabels labels={item.labels} />
      <div className="text-ui-xs text-icon4 flex items-center gap-1.5">
        <Avatar name={item.owner} size="sm" />
        {item.owner}
      </div>
    </article>
  );
}

function Column({ title }: { title: string }) {
  return (
    <div className="flex w-80 shrink-0 flex-col gap-2">
      <Txt as="h2" variant="ui-sm" className="text-icon3 m-0 font-medium">
        {title}
      </Txt>
      {CARDS.map(item => (
        <MockCard key={item.title} item={item} />
      ))}
    </div>
  );
}

export function MarkerPreviewPage() {
  return (
    <div className="bg-surface1 min-h-dvh p-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <div className="flex flex-col gap-1">
          <Txt as="h1" variant="header-md" className="text-icon6 m-0">
            Session activity markers
          </Txt>
          <Txt as="p" variant="ui-sm" className="text-icon3 m-0">
            Green marches, amber holds and lurches against its stop, blue stops travelling and breathes. Hover a sidebar
            row for its preview card.
          </Txt>
        </div>

        <div className="flex flex-wrap items-start gap-10">
          <div className="flex flex-col gap-2">
            <Txt as="h2" variant="ui-sm" className="text-icon3 m-0 font-medium">
              Sidebar rows
            </Txt>
            <div className="bg-surface2 border-border1 w-72 rounded-lg border p-2">
              <MainSidebar.NavList>
                {ROWS.map(row => (
                  <SessionNavRow
                    key={row.label}
                    name={row.label}
                    url="#"
                    active={false}
                    disabled={false}
                    status={row.status}
                    preview={previewDetails(row.label.replace(/^\w+: /, '').replace(/ /g, '-'))}
                    onSelect={noop}
                    onPinChange={noop}
                  />
                ))}
                <SessionNavRow
                  name="opening a session…"
                  url="#"
                  active={false}
                  disabled={false}
                  loading
                  onSelect={noop}
                  onPinChange={noop}
                />
                <SessionNavRow
                  name="chore: bump deps"
                  url="#"
                  active={false}
                  disabled={false}
                  onSelect={noop}
                  onPinChange={noop}
                />
                <SessionNavRow
                  name="feat: merged already"
                  url="#"
                  active={false}
                  disabled={false}
                  merged
                  onSelect={noop}
                  onPinChange={noop}
                />
              </MainSidebar.NavList>
            </div>
          </div>

          <Column title="Board cards" />
        </div>
      </div>
    </div>
  );
}
