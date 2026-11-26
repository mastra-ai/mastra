import { Button } from '@mastra/playground-ui/components/Button';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconChevronDownMedium } from '@mastra/playground-ui/icons/central/IconChevronDownMedium';
import { IconChevronTopMedium } from '@mastra/playground-ui/icons/central/IconChevronTopMedium';
import { IconCircleDashed } from '@mastra/playground-ui/icons/central/IconCircleDashed';
import { raisedSurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useState } from 'react';
import { useLocation } from 'react-router';

import type { IntakeDecisionInfo } from '../../../../../api/types';
import { useBoardCatalog } from '../../../../../hooks/useBoardCatalog';
import { useNotRoutedQuery, useRouteAgain } from '../../../../../hooks/useIntakeOrder';
import { NOT_ROUTED_ANCHOR } from '../../../boardConfig/boardConfigPaths';
import { NotRoutedItem } from './NotRoutedItem';

/**
 * The end of the intake order: where a new issue or pull request lands when no board's rules take it, with the recent
 * ones listed under it. Route again files one after its rules or labels change.
 */
export function NotRoutedCard({ factoryId, onWhy }: { factoryId: string; onWhy: (decisionId: string) => void }) {
  const query = useNotRoutedQuery(factoryId);
  const routeAgain = useRouteAgain(factoryId);
  const catalog = useBoardCatalog(factoryId);
  const location = useLocation();
  const [open, setOpen] = useState(location.hash === `#${NOT_ROUTED_ANCHOR}`);
  const boardNames = new Map((catalog.data ?? []).map(board => [board.id, board.name]));
  const pages = query.data?.pages ?? [];
  const items = pages.flatMap(page => page.notRouted);
  const canEdit = pages[0]?.canEdit ?? false;
  const listed = items.length > 0 || query.hasNextPage;

  const onRouteAgain = (item: IntakeDecisionInfo) =>
    routeAgain.mutate(item.id, {
      onSuccess: placed =>
        toast.success(`Filing “${item.title}” on ${boardNames.get(placed.boardKey) ?? placed.boardKey}.`),
      onError: error => toast.error(error.message),
    });

  return (
    <section
      id={NOT_ROUTED_ANCHOR}
      aria-label="Not routed"
      className={cn(raisedSurfaceStyle, 'flex scroll-mt-4 flex-col gap-1.75 rounded-2xl px-3.25 pt-2.75 pb-3')}
    >
      <header className="flex min-h-5.5 items-center gap-2">
        <IconCircleDashed className="text-muted-foreground size-icon-sm shrink-0" aria-hidden />
        <Txt as="h2" variant="card-title-strong" tone="ink">
          Not routed
        </Txt>
        <Txt as="span" variant="caption" tone="muted" className="min-w-0 flex-1 truncate">
          {notRoutedSummary(query, items.length)}
        </Txt>
        {listed && (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-expanded={open}
            tooltip={open ? 'Hide items not routed' : 'Show items not routed'}
            onClick={() => setOpen(!open)}
          >
            {open ? <IconChevronTopMedium /> : <IconChevronDownMedium />}
          </Button>
        )}
      </header>
      {!listed && !query.isPending && !query.isError && (
        <Txt as="p" variant="caption" tone="muted">
          A new issue or pull request ends up here when no board’s rules take it.
        </Txt>
      )}
      {open && listed && (
        <ul aria-label="Items not routed" className="flex flex-col">
          {items.map(item => (
            <NotRoutedItem
              key={item.id}
              item={item}
              routing={routeAgain.isPending && routeAgain.variables === item.id}
              onWhy={() => onWhy(item.id)}
              onRouteAgain={canEdit ? () => onRouteAgain(item) : undefined}
            />
          ))}
          {query.hasNextPage && (
            <li className="border-border flex justify-center border-t pt-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void query.fetchNextPage()}
                loading={query.isFetchingNextPage}
              >
                Load more
              </Button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

/** The header's one-line count of what is waiting. */
function notRoutedSummary(
  query: { isPending: boolean; isError: boolean; hasNextPage: boolean },
  count: number,
): string {
  if (query.isPending) return 'Loading…';
  if (query.isError) return 'Items not routed didn’t load.';
  if (query.hasNextPage) return count > 0 ? `${count}+ waiting` : 'More waiting';
  if (count === 0) return 'Every new issue and pull request found a board.';
  return `${count} waiting`;
}
