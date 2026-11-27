import { CardDescription as SharedCardDescription } from '@mastra/playground-ui/domains/factory';

import type { WorkItem } from '../services/workItems';
import { useSourceDescription } from './BoardCardDetails';

export function CardDescription({
  item,
  projectRepositoryId,
  factoryId,
  repositoryFailed,
}: {
  item: WorkItem;
  projectRepositoryId: string | undefined;
  factoryId: string | undefined;
  repositoryFailed: boolean;
}) {
  const query = useSourceDescription(item, projectRepositoryId, factoryId);
  return (
    <SharedCardDescription
      source={query?.data?.description}
      own={item.description}
      loading={query?.isLoading}
      failed={query !== undefined && (query.isError || (repositoryFailed && query.data === undefined))}
    />
  );
}
