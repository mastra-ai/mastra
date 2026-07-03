import type { GetWorkflowResponse } from '@mastra/client-js';
import {
  DataList as EntityList,
  DataListSkeleton as EntityListSkeleton,
} from '@mastra/playground-ui/components/DataList';
import { cn } from '@mastra/playground-ui/utils/cn';
import { truncateString } from '@mastra/playground-ui/utils/truncate-string';
import { ChevronRightIcon, PauseIcon, WorkflowIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useWorkflowsRunCounts } from '@/domains/workflows/hooks/use-workflows-run-counts';
import { flattenWorkflowTree } from '@/domains/workflows/utils/nested-workflows';
import { useLinkComponent } from '@/lib/framework';

export interface WorkflowsListProps {
  workflows: Record<string, GetWorkflowResponse>;
  isLoading: boolean;
  search?: string;
}

const GRID_COLUMNS = 'auto minmax(0, 1fr) auto auto auto';

/**
 * Tree connector for nested rows: one vertical guide per ancestor level that
 * has more siblings below, then a ├ stub (└ for the last child) linking the
 * row to its parent. Overshooting vertical margins let the lines span the
 * full row height; the cell's overflow clipping trims the excess.
 */
function TreeConnector({ guides, isLastChild }: { guides: boolean[]; isLastChild: boolean }) {
  return (
    <span aria-hidden className="-my-6 flex shrink-0 self-stretch">
      {guides.map((show, index) => (
        <span key={index} className={cn('w-6', show && 'border-l border-border1')} />
      ))}
      <span className="relative w-6">
        <span className={cn('absolute left-0 top-0 border-l border-border1', isLastChild ? 'h-1/2' : 'h-full')} />
        <span className="absolute left-0 top-1/2 w-3.5 border-b border-border1" />
      </span>
    </span>
  );
}

export function WorkflowsList({ workflows, isLoading, search = '' }: WorkflowsListProps) {
  const { paths, Link } = useLinkComponent();
  const [expandedPaths, setExpandedPaths] = useState<ReadonlySet<string>>(new Set());

  const workflowData = useMemo(
    () =>
      Object.keys(workflows).map(key => ({
        ...workflows[key],
        id: key,
      })),
    [workflows],
  );

  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    return workflowData.filter(
      wf => wf.name?.toLowerCase().includes(term) || wf.description?.toLowerCase().includes(term),
    );
  }, [workflowData, search]);

  const rows = useMemo(
    () => flattenWorkflowTree(filteredData, workflows, expandedPaths),
    [filteredData, workflows, expandedPaths],
  );

  const workflowIds = useMemo(() => workflowData.map(wf => wf.id), [workflowData]);
  const runCounts = useWorkflowsRunCounts(workflowIds);

  const toggleExpanded = (pathKey: string) => {
    setExpandedPaths(previous => {
      const next = new Set(previous);
      if (next.has(pathKey)) {
        next.delete(pathKey);
      } else {
        next.add(pathKey);
      }
      return next;
    });
  };

  if (isLoading) {
    return <EntityListSkeleton columns={GRID_COLUMNS} fit="container" />;
  }

  return (
    <EntityList columns={GRID_COLUMNS} fit="container">
      <EntityList.Top>
        <EntityList.TopCell>Name</EntityList.TopCell>
        <EntityList.TopCell>Description</EntityList.TopCell>
        <EntityList.TopCell>Running</EntityList.TopCell>
        <EntityList.TopCell>Pending input</EntityList.TopCell>
        <EntityList.TopCell>Number of steps</EntityList.TopCell>
      </EntityList.Top>

      {rows.length === 0 && search ? <EntityList.NoMatch message="No Workflows match your search" /> : null}

      {rows.map(row => {
        if (row.kind === 'inline') {
          return (
            <EntityList.RowStatic key={`workflow-${row.pathKey}`}>
              <EntityList.NameCell>
                <span className="flex items-center gap-1.5">
                  <TreeConnector guides={row.guides} isLastChild={row.isLastChild} />
                  <span className="size-5 shrink-0" aria-hidden />
                  <span className="truncate">{truncateString(row.stepId, 50)}</span>
                  <span
                    title="Nested workflow not registered standalone"
                    className="shrink-0 text-ui-smd text-neutral4"
                  >
                    inline
                  </span>
                </span>
              </EntityList.NameCell>
              <EntityList.DescriptionCell>{truncateString(row.description ?? '', 200)}</EntityList.DescriptionCell>
              <EntityList.TextCell className="text-center">{''}</EntityList.TextCell>
              <EntityList.TextCell className="text-center">{''}</EntityList.TextCell>
              <EntityList.TextCell className="text-center">{''}</EntityList.TextCell>
            </EntityList.RowStatic>
          );
        }

        const { workflow: wf, pathKey, depth, nestedIds, guides, isLastChild } = row;
        const name = truncateString(wf.name, 50);
        const description = truncateString(wf.description ?? '', 200);
        const stepsCount = Object.keys(wf.steps ?? {}).length;
        const runningCount = runCounts[wf.id]?.running ?? 0;
        const suspendedCount = runCounts[wf.id]?.suspended ?? 0;
        const isExpanded = expandedPaths.has(pathKey);
        const hasNested = nestedIds.length > 0;

        return (
          <EntityList.RowLink key={`workflow-${pathKey}`} to={paths.workflowLink(wf.id)} LinkComponent={Link}>
            <EntityList.NameCell>
              <span className="flex items-center gap-1.5">
                {depth > 0 ? (
                  <span
                    data-testid={`tree-gutter-${pathKey}`}
                    className={cn('flex shrink-0 self-stretch', hasNested && 'cursor-pointer')}
                    onClick={event => {
                      // Redundant pointer target for the chevron button; also a
                      // dead zone so near-misses on the tree lines never navigate.
                      event.preventDefault();
                      event.stopPropagation();
                      if (hasNested) toggleExpanded(pathKey);
                    }}
                  >
                    <TreeConnector guides={guides} isLastChild={isLastChild} />
                  </span>
                ) : null}
                {!hasNested && depth > 0 ? <span className="size-5 shrink-0" aria-hidden /> : null}
                {hasNested ? (
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} nested workflows of ${wf.name}`}
                    className="relative grid size-5 shrink-0 place-items-center text-neutral4 hover:text-neutral2 before:absolute before:-inset-1.5 before:content-['']"
                    onClick={event => {
                      // The row is a link; keep the toggle from navigating.
                      event.preventDefault();
                      event.stopPropagation();
                      toggleExpanded(pathKey);
                    }}
                  >
                    <ChevronRightIcon className={cn('size-4 transition-transform', isExpanded && 'rotate-90')} />
                  </button>
                ) : null}
                <span className="truncate">{name}</span>
                {hasNested ? (
                  <span
                    title={`Nested workflows: ${nestedIds.join(', ')}`}
                    className="inline-flex shrink-0 items-center gap-1 text-ui-smd text-neutral4"
                  >
                    <WorkflowIcon aria-hidden className="size-3.5" />
                    {nestedIds.length}
                  </span>
                ) : null}
              </span>
            </EntityList.NameCell>
            <EntityList.DescriptionCell>{description}</EntityList.DescriptionCell>
            <EntityList.TextCell className="text-center">
              {runningCount > 0 ? (
                <span
                  className="inline-flex items-center gap-1.5 text-positive1"
                  aria-label={`${runningCount} run${runningCount === 1 ? '' : 's'} in progress`}
                >
                  <span aria-hidden className="size-2 rounded-full bg-positive1 motion-safe:animate-pulse" />
                  {runningCount}
                </span>
              ) : (
                ''
              )}
            </EntityList.TextCell>
            <EntityList.TextCell className="text-center">
              {suspendedCount > 0 ? (
                <span
                  className="inline-flex items-center gap-1.5 text-warning1"
                  aria-label={`${suspendedCount} run${suspendedCount === 1 ? '' : 's'} awaiting input`}
                >
                  <PauseIcon aria-hidden className="size-3.5" />
                  {suspendedCount}
                </span>
              ) : (
                ''
              )}
            </EntityList.TextCell>
            <EntityList.TextCell className="text-center">{stepsCount || ''}</EntityList.TextCell>
          </EntityList.RowLink>
        );
      })}
    </EntityList>
  );
}
