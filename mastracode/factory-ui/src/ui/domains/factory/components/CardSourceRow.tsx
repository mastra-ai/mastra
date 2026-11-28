import {
  CardSourceRow as SharedCardSourceRow,
  cardLabels,
  sourceMetadata,
  workItemReference,
  sourceState,
  CardMetadataLabels,
} from '@mastra/playground-ui/domains/factory';

import { CARD_SOURCES } from '../cardSources';
import type { WorkItem } from '@internal/factory-contract';

export function CardSourceRow({
  item,
  url,
  repository,
}: {
  item: WorkItem;
  url: string | undefined;
  repository: string | undefined;
}) {
  const metadata = sourceMetadata(item);
  return (
    <SharedCardSourceRow
      reference={workItemReference(item, repository) ?? CARD_SOURCES[item.source].label}
      url={url}
      state={sourceState(item)}
      labels={cardLabels(metadata).length > 0 ? <CardMetadataLabels metadata={metadata} /> : undefined}
    />
  );
}
