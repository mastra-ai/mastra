import { CardSourceRow as SharedCardSourceRow } from '@mastra/playground-ui/domains/factory';

import { cardLabels, sourceMetadata } from '../boardItems';
import { CARD_SOURCES } from '../cardSources';
import { workItemReference } from '../services/relationships';
import { sourceState } from '../services/workItemPresentation';
import type { WorkItem } from '../services/workItems';
import { MetadataLabels } from './BoardCardParts';

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
      labels={cardLabels(metadata).length > 0 ? <MetadataLabels metadata={metadata} /> : undefined}
    />
  );
}
