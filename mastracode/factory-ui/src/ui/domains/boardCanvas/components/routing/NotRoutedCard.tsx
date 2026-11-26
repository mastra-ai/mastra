import { toast } from '@mastra/playground-ui/components/Toaster';
import { NotRoutedItem, NotRoutedCard as SharedNotRoutedCard } from '@mastra/playground-ui/domains/factory';
import { useLocation } from 'react-router';

import type { IntakeDecisionInfo } from '../../../../../api/types';
import { useBoardCatalog } from '../../../../../hooks/useBoardCatalog';
import { useNotRoutedQuery, useRouteAgain } from '../../../../../hooks/useIntakeOrder';
import { NOT_ROUTED_ANCHOR } from '../../../boardConfig/boardConfigPaths';
import { isIntakeProvider } from '../../../factory/boardSourceFilters';
import type { IntakeProvider } from '../../../factory/boardSourceFilters';
import { SettingsIntegrationIcon } from '../../../settings/components/brand-icons/SettingsIntegrationIcon';

/**
 * The end of the intake order: where a new issue or pull request lands when no board's rules take it, with the recent
 * ones listed under it. Route again files one after its rules or labels change.
 */
export function NotRoutedCard({ factoryId, onWhy }: { factoryId: string; onWhy: (decisionId: string) => void }) {
  const query = useNotRoutedQuery(factoryId);
  const routeAgain = useRouteAgain(factoryId);
  const catalog = useBoardCatalog(factoryId);
  const location = useLocation();
  const boardNames = new Map((catalog.data ?? []).map(board => [board.id, board.name]));
  const pages = query.data?.pages ?? [];
  const items = pages.flatMap(page => page.notRouted);
  const canEdit = pages[0]?.canEdit ?? false;

  const onRouteAgain = (item: IntakeDecisionInfo) =>
    routeAgain.mutate(item.id, {
      onSuccess: placed =>
        toast.success(`Filing “${item.title}” on ${boardNames.get(placed.boardKey) ?? placed.boardKey}.`),
      onError: error => toast.error(error.message),
    });

  return (
    <SharedNotRoutedCard
      id={NOT_ROUTED_ANCHOR}
      defaultOpen={location.hash === `#${NOT_ROUTED_ANCHOR}`}
      count={items.length}
      pending={query.isPending}
      error={query.isError}
      hasMore={query.hasNextPage}
      loadingMore={query.isFetchingNextPage}
      onLoadMore={() => void query.fetchNextPage()}
    >
      {items.map(item => {
        const { provider, source } = sourceParts(item.sourceKey);
        return (
          <NotRoutedItem
            key={item.id}
            item={item}
            icon={provider && <SettingsIntegrationIcon provider={provider} className="size-icon-xs" />}
            source={source}
            routing={routeAgain.isPending && routeAgain.variables === item.id}
            onWhy={() => onWhy(item.id)}
            onRouteAgain={canEdit ? () => onRouteAgain(item) : undefined}
          />
        );
      })}
    </SharedNotRoutedCard>
  );
}

/** Splits `github:acme/app#1` into the provider, for its mark, and the rest, to show. */
function sourceParts(sourceKey: string | null | undefined): { provider?: IntakeProvider; source?: string } {
  if (!sourceKey) return {};
  const colon = sourceKey.indexOf(':');
  const prefix = sourceKey.slice(0, colon);
  if (colon < 0 || !isIntakeProvider(prefix)) return { source: sourceKey };
  return { provider: prefix, source: sourceKey.slice(colon + 1) };
}
