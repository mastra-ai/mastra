import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Check, ChevronDown } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';

import { useSupervisorHealth } from '../../hooks/useSupervisorHealth';
import { useRunningSessions, useWorkItemsQuery } from '../../hooks/useWorkItems';
import { CommitRail } from '../domains/factory/components/CommitRail';
import { DocumentFactoryPageShell } from '../domains/factory/components/FactoryPageShell';
import { StageFunnel } from '../domains/factory/components/StageFunnel';
import { ActivityFeed, AttentionPreview, RunningList, StalledList } from '../domains/factory/components/OverviewLists';
import { computeFactoryOverview } from '../domains/factory/overview';
import type { LinkedRepositoryPayload } from '../domains/workspaces/services/github';

const DAY_MS = 86_400_000;

const RANGE_PRESETS = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
];

const DEFAULT_RANGE_DAYS = 30;

const BLOCK_TITLE = 'text-ui-sm text-neutral6/40 m-0 font-semibold';

export function OverviewPage() {
  return (
    <DocumentFactoryPageShell>
      {project => <OverviewContent factoryProjectId={project.id} repository={project.repositories[0]} />}
    </DocumentFactoryPageShell>
  );
}

/**
 * Factory › Overview, read top to bottom: how the Factory has been doing, then
 * what needs a person right now, then what it did lately. The pipeline opens the
 * page because it answers the standing question — is work still flowing — before
 * the two lists that age on every poll; the range picker governs it alone.
 */
export function OverviewContent({
  factoryProjectId,
  repository,
}: {
  factoryProjectId: string | undefined;
  repository: LinkedRepositoryPayload | undefined;
}) {
  const [rangeDays, setRangeDays] = useState(DEFAULT_RANGE_DAYS);
  const itemsQuery = useWorkItemsQuery(factoryProjectId);
  const activeSessions = useRunningSessions(factoryProjectId);
  const supervisorHealth = useSupervisorHealth(factoryProjectId);
  const items = itemsQuery.data;

  // The board refetches on a timer; recomputing off its identity re-ages every
  // row on arrival without a second clock of our own.
  const current = useMemo(() => {
    const now = new Date();
    const toMs = now.getTime();
    return computeFactoryOverview(items ?? [], activeSessions, { fromMs: toMs - rangeDays * DAY_MS, toMs }, now);
  }, [items, activeSessions, rangeDays]);

  if (itemsQuery.isError) {
    const message = itemsQuery.error instanceof Error ? itemsQuery.error.message : 'Failed to load the board';
    return <Notice variant="destructive">{message}</Notice>;
  }
  if (!items) return <OverviewLoading />;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-14 pt-4 pb-16">
      <h1 className="sr-only">Overview</h1>

      <Block title="Pipeline" action={<RangePicker rangeDays={rangeDays} onSelect={setRangeDays} />}>
        <StageFunnel funnel={current.funnel} pullRequests={current.pullRequests} merged={current.merged} />
      </Block>

      <section className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <Block
          title="Stalled"
          action={current.waiting.length > 0 ? <Count value={`${current.waiting.length} waiting`} /> : undefined}
        >
          <StalledList waiting={current.waiting} factoryProjectId={factoryProjectId} />
        </Block>

        <Block
          title="Running now"
          action={
            <Count
              value={`${new Set(current.running.map(item => item.id)).size} running · ${current.inFlight} in the pipeline`}
            />
          }
        >
          <RunningList running={current.running} factoryProjectId={factoryProjectId} />
        </Block>
      </section>

      <Block title="Latest commits" action={repository ? <ViewOnGithub slug={repository.slug} /> : undefined}>
        <CommitRail projectRepositoryId={repository?.projectRepositoryId} />
      </Block>

      <Block title="Activity" action={<ViewAll to={`/factories/${factoryProjectId ?? ''}/activity`} />}>
        <ActivityFeed moved={current.moved} factoryProjectId={factoryProjectId} />
      </Block>

      <Block
        title="Needs you"
        action={
          <div className="flex items-center gap-3">
            {supervisorHealth.data?.findings.length ? (
              <Link
                className="text-accent1 hover:text-accent2 text-ui-xs"
                to={`/factories/${factoryProjectId ?? ''}/supervisor`}
              >
                {supervisorHealth.data.findings.length} supervisor{' '}
                {supervisorHealth.data.findings.length === 1 ? 'finding' : 'findings'}
              </Link>
            ) : null}
            <ViewAll to={`/factories/${factoryProjectId ?? ''}/attention`} />
          </div>
        }
      >
        <AttentionPreview factoryProjectId={factoryProjectId} />
      </Block>
    </div>
  );
}

function ViewAll({ to }: { to: string }) {
  return (
    <Link to={to} className="text-icon3 hover:text-icon5 text-ui-xs">
      View all
    </Link>
  );
}

function ViewOnGithub({ slug }: { slug: string }) {
  return (
    <a
      href={`https://github.com/${slug}/commits`}
      target="_blank"
      rel="noreferrer"
      className="text-icon3 hover:text-icon5 text-ui-xs"
    >
      {slug}
    </a>
  );
}

function Count({ value }: { value: string }) {
  return (
    <Txt as="span" variant="ui-xs" className="text-icon3">
      {value}
    </Txt>
  );
}

function Block({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <h3 className={BLOCK_TITLE}>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function RangePicker({ rangeDays, onSelect }: { rangeDays: number; onSelect: (days: number) => void }) {
  const current = RANGE_PRESETS.find(preset => preset.days === rangeDays) ?? RANGE_PRESETS[1]!;
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <Button type="button" variant="ghost" size="sm" aria-label={`Date range: ${current.label}`}>
          {current.label}
          <ChevronDown size={14} aria-hidden />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" className="min-w-44">
        {RANGE_PRESETS.map(preset => (
          <DropdownMenu.Item key={preset.days} onSelect={() => onSelect(preset.days)}>
            <span className="flex-1">{preset.label}</span>
            {preset.days === current.days && <Check aria-label="Selected" />}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

function OverviewLoading() {
  return (
    <div role="status" aria-label="Loading factory overview" className="mx-auto flex w-full max-w-6xl flex-col gap-10">
      <Skeleton className="h-52 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}
