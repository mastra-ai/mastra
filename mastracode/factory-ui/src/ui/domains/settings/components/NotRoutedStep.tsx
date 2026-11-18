import { Button } from '@mastra/playground-ui/components/Button';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { InfoTooltip } from '@mastra/playground-ui/components/Tooltip';
import { SettingsItem, SettingsItemIcon } from '@mastra/playground-ui/new/settings';
import { CircleDashed } from 'lucide-react';

import type { IntakeDecisionInfo } from '../../../../api/types';
import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useNotRoutedQuery, useRouteAgain } from '../../../../hooks/useIntakeOrder';
import { NOT_ROUTED_ANCHOR } from '../../boardConfig/boardConfigPaths';
import { IntakeTesterDialog } from '../../intake/IntakeTesterDialog';

/**
 * The end of the intake order: where a new issue or pull request lands when no board's rules take it, with the recent
 * ones listed under it. Route again files one after its rules or labels change.
 */
export function NotRoutedStep({ factoryId }: { factoryId: string }) {
  const query = useNotRoutedQuery(factoryId);
  const routeAgain = useRouteAgain(factoryId);
  const boardNames = new Map((useBoardCatalog(factoryId).data ?? []).map(board => [board.id, board.name]));
  const pages = query.data?.pages ?? [];
  const items = pages.flatMap(page => page.notRouted);
  const canEdit = pages[0]?.canEdit ?? false;

  const onRouteAgain = (item: IntakeDecisionInfo) =>
    routeAgain.mutate(item.id, {
      onSuccess: placed =>
        toast.success(`Filing “${item.title}” on ${boardNames.get(placed.boardKey) ?? placed.boardKey}.`),
      onError: error => toast.error(error.message),
    });

  const summary = query.isPending
    ? 'Loading…'
    : query.isError
      ? 'Items not routed didn’t load.'
      : query.hasNextPage
        ? `${items.length > 0 ? `${items.length}+` : 'More'} waiting for a board.`
        : items.length === 0
          ? 'Every new issue and pull request found a board.'
          : `${items.length} waiting for a board.`;

  return (
    <section
      id={NOT_ROUTED_ANCHOR}
      aria-label="Not routed"
      className="flex scroll-mt-4 flex-col gap-3 px-3.5 pt-3 pb-3.5"
    >
      <SettingsItem
        media={
          <SettingsItemIcon>
            <CircleDashed />
          </SettingsItemIcon>
        }
        title={
          <span className="flex items-center gap-1">
            Not routed
            <InfoTooltip aria-label="When an item is not routed">
              A new issue or pull request ends up here when no board’s rules take it. Change a board’s rules, then route
              it again.
            </InfoTooltip>
          </span>
        }
        description={summary}
      />
      {(items.length > 0 || query.hasNextPage) && (
        <ul aria-label="Items not routed" className="ml-11 flex flex-col">
          {items.map(item => (
            <li key={item.id} className="border-border border-t py-3">
              <SettingsItem
                title={
                  item.url ? (
                    <a href={item.url} target="_blank" rel="noreferrer" className="hover:underline">
                      {item.title}
                    </a>
                  ) : (
                    item.title
                  )
                }
                description={
                  <span className="flex flex-wrap gap-x-3 gap-y-1">
                    {item.sourceKey && <span>{item.sourceKey}</span>}
                    <span>{item.reason ?? 'No board’s rules match it.'}</span>
                    <time dateTime={item.decidedAt}>{formatWhen(item.decidedAt)}</time>
                  </span>
                }
              >
                <IntakeTesterDialog factoryProjectId={factoryId} itemId={item.id} label="Why?" />
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onRouteAgain(item)}
                    disabled={routeAgain.isPending && routeAgain.variables === item.id}
                  >
                    Route again
                  </Button>
                )}
              </SettingsItem>
            </li>
          ))}
          {query.hasNextPage && (
            <li className="border-border flex justify-center border-t pt-3">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
              >
                {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
