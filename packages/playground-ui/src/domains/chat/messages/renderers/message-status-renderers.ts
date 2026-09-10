import type { MessageStatusRenderers } from '@mastra/react';
import { ErrorStatusRenderer, WarningStatusRenderer, TripwireStatusRenderer } from './status-renderers';

export const messageStatusRenderers: MessageStatusRenderers = {
  Error: ErrorStatusRenderer,
  Warning: WarningStatusRenderer,
  Tripwire: TripwireStatusRenderer,
};
