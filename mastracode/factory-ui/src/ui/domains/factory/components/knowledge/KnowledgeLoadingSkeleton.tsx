import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import type { KnowledgeExplorerView } from '@mastra/playground-ui/domains/knowledge/components/KnowledgePageExplorer';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

const TREE_ROWS = [
  { indent: 'pl-1', width: 'w-32' },
  { indent: 'pl-4', width: 'w-24' },
  { indent: 'pl-7', width: 'w-40' },
  { indent: 'pl-1', width: 'w-28' },
  { indent: 'pl-4', width: 'w-36' },
  { indent: 'pl-7', width: 'w-20' },
];
const CARD_CLASS = 'min-h-0 w-full flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card';

function TreeRows() {
  return (
    <div className="min-h-0 flex-1 overflow-hidden">
      <div className="flex flex-col py-1">
        {TREE_ROWS.map(({ indent, width }) => (
          <div key={width} className={cn('flex h-8 items-center gap-2 pr-2', indent)}>
            <Skeleton className="size-3.5 shrink-0 motion-reduce:before:animate-none" />
            <SkeletonText className={cn(width, 'motion-reduce:before:animate-none')} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PageRows() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-border bg-fill-subtle flex flex-col gap-2 border-b px-6 pt-5 pb-4">
        <SkeletonText line="text-caption" className="w-28 motion-reduce:before:animate-none" />
        <SkeletonText line="text-title" className="h-5 w-56 motion-reduce:before:animate-none" />
        <SkeletonText className="w-72 max-w-full motion-reduce:before:animate-none" />
        <SkeletonText line="text-caption" className="w-40 motion-reduce:before:animate-none" />
      </div>
      <div className="flex flex-col gap-3 p-6">
        <SkeletonText className="w-full max-w-3xl motion-reduce:before:animate-none" />
        <SkeletonText className="w-5/6 max-w-2xl motion-reduce:before:animate-none" />
        <SkeletonText className="w-2/3 max-w-xl motion-reduce:before:animate-none" />
      </div>
    </div>
  );
}

export function KnowledgeLoadingSkeleton({
  label,
  view,
  pageOpen,
  toolbar,
}: {
  label: string;
  view: KnowledgeExplorerView;
  pageOpen: boolean;
  toolbar: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {toolbar}
      <div role="status" aria-label={label} className="flex min-h-0 flex-1 flex-col">
        <div aria-hidden className="relative flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
          <div className="absolute inset-y-2 left-2 z-10 flex w-72 max-lg:hidden">
            <DataPanel variant="inline" title="Pages" className="shadow-overlay">
              <DataPanel.Header>
                <DataPanel.Heading>Pages</DataPanel.Heading>
              </DataPanel.Header>
              <TreeRows />
            </DataPanel>
          </div>
          <div className={cn(CARD_CLASS, 'lg:hidden', view === 'tree' ? 'flex' : 'hidden')}>
            <TreeRows />
          </div>
          <div className={cn(CARD_CLASS, 'lg:hidden', pageOpen ? 'flex' : 'hidden')}>
            <PageRows />
          </div>
          <div
            className={cn(
              'relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl border border-border bg-sidebar lg:block lg:h-full',
              view === 'graph' ? 'block' : 'hidden',
            )}
          >
            {pageOpen ? (
              <div className="absolute inset-y-2 right-2 left-76 z-20 flex">
                <DataPanel variant="inline" title="Page" className="shadow-overlay">
                  <DataPanel.Header>
                    <DataPanel.Heading>Page</DataPanel.Heading>
                  </DataPanel.Header>
                  <PageRows />
                </DataPanel>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center gap-8 lg:pl-72">
                <div className="flex flex-col items-center gap-16">
                  <Skeleton className="size-5 rounded-full motion-reduce:before:animate-none" />
                  <Skeleton className="size-8 rounded-full motion-reduce:before:animate-none" />
                </div>
                <div className="flex items-center gap-4">
                  <Skeleton className="h-px w-8 motion-reduce:before:animate-none" />
                  <Skeleton className="size-12 rounded-full motion-reduce:before:animate-none" />
                  <Skeleton className="h-px w-8 motion-reduce:before:animate-none" />
                </div>
                <div className="flex flex-col items-center gap-16">
                  <Skeleton className="size-8 rounded-full motion-reduce:before:animate-none" />
                  <Skeleton className="size-5 rounded-full motion-reduce:before:animate-none" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
