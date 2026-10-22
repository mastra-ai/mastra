import type { SavedViewsController } from '@mastra/playground-ui/components/SavedViews';
import type { TraceViewSettings } from '@mastra/playground-ui/domains/traces/trace-saved-views';
import { createContext } from 'react';

/**
 * The page's saved views, for the toolbar inside the memoized page content: a prop would re-render
 * all of it. `null` on scoped pages, which have no views.
 */
export const TracesSavedViewsContext = createContext<{
  views: SavedViewsController<TraceViewSettings>;
  /** What "New view" starts from: the time range, sort and columns shown, without filters. */
  newViewSettings: TraceViewSettings;
} | null>(null);
