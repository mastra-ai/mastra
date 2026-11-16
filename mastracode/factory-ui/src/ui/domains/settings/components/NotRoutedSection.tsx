import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { toast } from '@mastra/playground-ui/components/Toaster';
import {
  SettingsContainer,
  SettingsEmptyRow,
  SettingsItem,
  SettingsSkeleton,
} from '@mastra/playground-ui/new/settings';

import type { IntakeDecisionInfo } from '../../../../api/types';
import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useNotRoutedQuery, useRouteAgain } from '../../../../hooks/useIntakeOrder';
import { IntakeTesterDialog } from '../../intake/IntakeTesterDialog';
import { NOT_ROUTED_ANCHOR } from '../settingsSections';
import { SettingsSubsection } from './SettingsSubsection';

/** Recent issues and pull requests no board's rules took. Route again files one after its rules or labels change. */
export function NotRoutedSection({ factoryId }: { factoryId: string }) {
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

  return (
    <SettingsSubsection
      id={NOT_ROUTED_ANCHOR}
      title="Not routed"
      description="New issues and pull requests no board's rules took. Change a board's rules, then route the item again."
    >
      {query.isPending ? (
        <SettingsContainer>
          <SettingsSkeleton label="Loading items not routed" variant="item" rows={2} />
        </SettingsContainer>
      ) : query.isError ? (
        <Notice variant="destructive">Items not routed didn’t load.</Notice>
      ) : (
        <div className="flex flex-col gap-2">
          {items.length === 0 ? (
            <SettingsContainer>
              <SettingsEmptyRow>Every new item found a board.</SettingsEmptyRow>
            </SettingsContainer>
          ) : (
            <SettingsContainer role="list" aria-label="Not routed">
              {items.map(item => (
                <SettingsItem
                  key={item.id}
                  role="listitem"
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
              ))}
            </SettingsContainer>
          )}
          {query.hasNextPage && (
            <div className="flex justify-center">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
              >
                {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
        </div>
      )}
    </SettingsSubsection>
  );
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
