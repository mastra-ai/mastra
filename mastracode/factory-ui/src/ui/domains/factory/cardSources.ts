import { CARD_SOURCES as SHARED_CARD_SOURCES } from '@mastra/playground-ui/domains/factory';
import type { CardSourcePresentation } from '@mastra/playground-ui/domains/factory';

import type { WorkItemBoardSource as WorkItemSource } from '@internal/factory-contract';

export type { CardSourcePresentation } from '@mastra/playground-ui/domains/factory';

/** A mark that takes SVG props, so it can be sized and stamped with data and aria attributes. */
export type SourceGlyph = CardSourcePresentation['Icon'];

/**
 * Every place a card can come from, keyed by the server's own source vocabulary. A source the
 * server adds fails the typecheck here until the shared table has a label, a link label and a mark.
 */
export const CARD_SOURCES: Record<WorkItemSource, CardSourcePresentation> = SHARED_CARD_SOURCES;
