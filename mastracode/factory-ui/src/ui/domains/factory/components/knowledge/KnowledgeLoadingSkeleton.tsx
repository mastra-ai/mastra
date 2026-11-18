import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { buttonVariants } from '@mastra/playground-ui/components/Button';
import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { KNOWLEDGE_EXPLORER_VIEWS } from '@mastra/playground-ui/domains/knowledge/lib/explorerViews';
import type { KnowledgeExplorerView } from '@mastra/playground-ui/domains/knowledge/components/KnowledgePageExplorer';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { cn } from '@mastra/playground-ui/utils/cn';

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

export function KnowledgeLoadingSkeleton({ label, view }: { label: string; view: KnowledgeExplorerView }) {
  return (
    <div role="status" aria-label={label} className="flex min-h-0 flex-1 flex-col gap-2">
      <ActionRow aria-hidden>
        <ActionRow.Start>
          <div className="flex w-fit items-center gap-0.5 rounded-full">
            {KNOWLEDGE_EXPLORER_VIEWS.map(({ value, label, icon, narrowOnly }) => (
              <span
                key={value}
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'sm' }),
                  'text-muted-foreground',
                  narrowOnly && 'lg:hidden',
                )}
              >
                <Icon size="xs">{icon}</Icon>
                <Txt variant="caption" className="text-inherit">
                  {label}
                </Txt>
              </span>
            ))}
          </div>
          <Skeleton className="h-control-sm w-64 min-w-0 rounded-full motion-reduce:before:animate-none" />
        </ActionRow.Start>
      </ActionRow>
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
        <div className={cn(CARD_CLASS, 'gap-3 p-4 lg:hidden', view === 'page' ? 'flex' : 'hidden')}>
          <SkeletonText line="text-caption" className="w-28 motion-reduce:before:animate-none" />
          <SkeletonText className="w-72 max-w-full motion-reduce:before:animate-none" />
          <SkeletonText className="w-5/6 motion-reduce:before:animate-none" />
          <SkeletonText className="w-2/3 motion-reduce:before:animate-none" />
        </div>
        <div
          className={cn(
            'relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl border border-border bg-sidebar lg:block lg:h-full',
            view === 'graph' ? 'block' : 'hidden',
          )}
        >
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
        </div>
      </div>
    </div>
  );
}
