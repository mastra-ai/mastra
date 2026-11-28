import type { WorkItem } from '@internal/factory-contract';

import { CardDescription as SharedCardDescription } from '../session';
import { useCardPanelHost } from './card-panel-host';
import type { CardPanelRepository } from './card-panel-host';

export function CardPanelDescription({
  item,
  repository,
  repositoryFailed,
}: {
  item: WorkItem;
  repository: CardPanelRepository | undefined;
  repositoryFailed: boolean;
}) {
  const query = useCardPanelHost().useSourceDescription(item, repository);
  return (
    <SharedCardDescription
      source={query?.data?.description ?? undefined}
      own={item.description}
      loading={query?.isLoading}
      failed={query !== undefined && (query.isError || (repositoryFailed && query.data === undefined))}
    />
  );
}
