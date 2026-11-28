import type { WorkItem } from '@internal/factory-contract';
import { relationshipBoardId } from '@mastra/playground-ui/domains/factory';

import { rememberedBoardPath } from './boardViews';

export function relationshipPath(
  item: Pick<WorkItem, 'source'> & { readonly board?: string | null },
  factoryId: string,
): string {
  return rememberedBoardPath(factoryId, relationshipBoardId(item));
}
