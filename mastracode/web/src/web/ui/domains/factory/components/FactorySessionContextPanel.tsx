import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { ChevronRight, ExternalLink, RefreshCw } from 'lucide-react';

import type { FactoryThreadTaskContext } from '../../../../../shared/api/types';
import { useFactoryThreadTaskContextQuery } from '../../../../../shared/hooks/useFactoryData';
import { Markdown, SkeletonRows } from '../../../ui';
import { renderedPaths, WorkspaceViewerPanel } from '../../workspace-viewer';

export type FactorySessionContextTab = 'task' | 'files';

interface FactorySessionContextPanelProps {
  factoryProjectId: string;
  threadId: string;
  resourceId: string;
  workspacePath: string;
  activeTab: FactorySessionContextTab;
  onTabChange: (tab: FactorySessionContextTab) => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onCollapse: () => void;
}

const SOURCE_LABELS: Record<FactoryThreadTaskContext['task']['source'], string> = {
  'github-issue': 'GitHub issue',
  'github-pr': 'GitHub pull request',
  'linear-issue': 'Linear issue',
  manual: 'Manual task',
};

const STORED_REASON_MESSAGES: Record<NonNullable<FactoryThreadTaskContext['resolution']['reason']>, string> = {
  manual: 'This task was created manually, so no provider details are available.',
  'not-found': 'The linked item could not be found. Showing the stored Factory task instead.',
  'not-connected': 'Linear is not connected. Showing the stored Factory task instead.',
  'reauth-required': 'The provider connection needs authorization. Showing the stored Factory task instead.',
  'provider-unavailable': 'The provider could not be reached. Showing the stored Factory task instead.',
  'invalid-source': 'The stored provider identity is invalid. Showing the stored Factory task instead.',
};

function safeHttpUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function FactorySessionContextPanel({
  factoryProjectId,
  threadId,
  resourceId,
  workspacePath,
  activeTab,
  onTabChange,
  expanded,
  onExpandedChange,
  onCollapse,
}: FactorySessionContextPanelProps) {
  return (
    <div
      className="h-full min-w-0 overflow-hidden bg-surface1"
      data-expanded={expanded ? 'true' : 'false'}
      aria-label="Session task and workspace context"
    >
      <Tabs<FactorySessionContextTab>
        defaultTab="task"
        value={activeTab}
        onValueChange={onTabChange}
        className="flex h-full min-h-0 flex-col overflow-hidden"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border1 px-3 py-2">
          <TabList variant="pill">
            <Tab value="task">Task</Tab>
            <Tab value="files">Files</Tab>
          </TabList>
          {activeTab === 'task' ? (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={onCollapse}
              aria-label="Close task and workspace context"
            >
              <ChevronRight />
            </Button>
          ) : null}
        </div>

        {activeTab === 'task' ? (
          <TabContent value="task" className="min-h-0 flex-1 px-3 pb-4">
            <FactoryTaskContext
              factoryProjectId={factoryProjectId}
              threadId={threadId}
              resourceId={resourceId}
              projectPath={workspacePath}
            />
          </TabContent>
        ) : null}
        {activeTab === 'files' ? (
          <TabContent value="files" className="min-h-0 flex-1 overflow-hidden p-0">
            <WorkspaceViewerPanel
              workspacePath={workspacePath}
              renderedPaths={renderedPaths}
              title="Workspace files"
              onExpandedChange={onExpandedChange}
              onCollapse={onCollapse}
            />
          </TabContent>
        ) : null}
      </Tabs>
    </div>
  );
}

function FactoryTaskContext({
  factoryProjectId,
  threadId,
  resourceId,
  projectPath,
}: {
  factoryProjectId: string;
  threadId: string;
  resourceId: string;
  projectPath: string;
}) {
  const query = useFactoryThreadTaskContextQuery(factoryProjectId, threadId, resourceId, projectPath, true);

  if (query.isPending) {
    return <SkeletonRows label="Loading task context" rows={5} />;
  }

  if (query.isError) {
    return (
      <Notice
        variant="destructive"
        title="Task context unavailable"
        action={
          <Button type="button" size="sm" variant="outline" onClick={() => query.refetch()}>
            Try again
          </Button>
        }
      >
        {query.error instanceof Error ? query.error.message : 'The task context request failed.'}
      </Notice>
    );
  }

  if (!query.data) {
    return <Notice variant="note">No Factory task is linked to this session.</Notice>;
  }

  return <FactoryTaskDetails context={query.data} refreshing={query.isFetching} onRefresh={() => query.refetch()} />;
}

function FactoryTaskDetails({
  context,
  refreshing,
  onRefresh,
}: {
  context: FactoryThreadTaskContext;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { task, resolution } = context;
  const url = safeHttpUrl(task.url);

  return (
    <article className="flex min-w-0 flex-col gap-4" aria-label="Factory task context">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge size="sm" variant="info">
              {SOURCE_LABELS[task.source]}
            </Badge>
            {task.identifier ? <Badge size="sm">{task.identifier}</Badge> : null}
            {task.state ? <Badge size="sm">{task.state}</Badge> : null}
          </div>
          <h2 className="break-words text-lg font-semibold text-neutral5">{task.title}</h2>
        </div>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          onClick={onRefresh}
          disabled={refreshing}
          tooltip="Refresh task"
        >
          <RefreshCw className={refreshing ? 'motion-safe:animate-spin' : undefined} />
        </Button>
      </div>

      {resolution.mode === 'stored' ? (
        <Notice variant="warning">{STORED_REASON_MESSAGES[resolution.reason ?? 'provider-unavailable']}</Notice>
      ) : null}

      {task.description ? (
        <section aria-label="Task description">
          <Markdown>{task.description}</Markdown>
        </section>
      ) : null}

      {task.labels.length > 0 ? <TaskBadgeGroup label="Labels" values={task.labels} /> : null}
      {task.assignees.length > 0 ? <TaskBadgeGroup label="Assignees" values={task.assignees} /> : null}

      {url ? (
        <div>
          <Button as="a" href={url} target="_blank" rel="noopener noreferrer" size="sm" variant="outline">
            <ExternalLink />
            Open source
          </Button>
        </div>
      ) : null}
    </article>
  );
}

function TaskBadgeGroup({ label, values }: { label: string; values: string[] }) {
  return (
    <section className="flex flex-col gap-2" aria-label={label}>
      <h3 className="text-sm font-medium text-neutral4">{label}</h3>
      <div className="flex flex-wrap gap-1.5">
        {values.map(value => (
          <Badge key={value} size="sm">
            {value}
          </Badge>
        ))}
      </div>
    </section>
  );
}
