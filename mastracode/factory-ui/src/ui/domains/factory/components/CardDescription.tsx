import { CardDescription as SharedCardDescription } from '@mastra/playground-ui/domains/factory';

import type { WorkItem } from '@internal/factory-contract';
import { useCardPanelHost } from '../cardPanelHost';
import type { CardPanelRepository } from '../cardPanelHost';

export function CardDescription({
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
