import type { CreateSavedViewParams } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useMemo } from 'react';
import type { SavedViewsBackend } from '@/ds/components/SavedViews';

type SavedViewState = CreateSavedViewParams['state'];

// The server stores any JSON object with an integer `version`; the page's schema owns the rest.
function isSavedViewState(value: unknown): value is SavedViewState {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'version' in value &&
    Number.isInteger(value.version)
  );
}

function toState(value: unknown): SavedViewState {
  if (!isSavedViewState(value)) throw new Error('This view could not be saved: its data is missing a version.');
  return value;
}

/**
 * Saved views for one Studio page, kept in the Mastra server's storage (`/api/saved-views`) and
 * shared by everyone who can open Studio. The list shares its React Query key with `@mastra/react`'s
 * `useSavedViews`. The server answers 501 when its storage has no saved views and older servers
 * answer 404: check the list error with `isSavedViewsUnavailableError`.
 */
export function useMastraSavedViewsBackend(page: string): SavedViewsBackend {
  const client = useMastraClient();

  // Stable, so a host can pass it through memoized props without re-rendering on every URL change.
  return useMemo<SavedViewsBackend>(
    () => ({
      queryKey: ['saved-views', page],
      list: async () => (await client.listSavedViews({ page })).views,
      create: ({ name, state }) => client.createSavedView({ page, name, state: toState(state) }),
      update: (savedViewId, patch) =>
        client.updateSavedView(savedViewId, {
          ...(patch.name !== undefined && { name: patch.name }),
          ...(patch.state !== undefined && { state: toState(patch.state) }),
        }),
      remove: async savedViewId => {
        await client.deleteSavedView(savedViewId);
      },
    }),
    [client, page],
  );
}
