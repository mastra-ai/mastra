import type { Mastra } from '@mastra/core';
import type { SavedView, SavedViewsStorage } from '@mastra/core/storage';
import { HTTPException } from '../http-exception';
import {
  createSavedViewBodySchema,
  deleteSavedViewResponseSchema,
  listSavedViewsQuerySchema,
  listSavedViewsResponseSchema,
  MAX_SAVED_VIEWS_PER_PAGE,
  savedViewIdPathParams,
  savedViewResponseSchema,
  updateSavedViewBodySchema,
} from '../schemas/saved-views';
import { createRoute } from '../server-adapter/routes/route-builder';
import { getStoredResourceScope } from '../utils';
import type { StoredResourceScope } from '../utils';
import { getCallerAuthorId } from './authorship';
import { handleError } from './error';

/**
 * Resolve the saved-views storage domain. 501 when storage or the domain is
 * missing (older core, or a store without `savedViews`), so clients can hide
 * the feature instead of showing an error.
 */
async function getSavedViewsStore(mastra: Mastra): Promise<SavedViewsStorage> {
  const store = await mastra.getStorage()?.getStore('savedViews');
  if (!store) {
    throw new HTTPException(501, { message: 'Saved views are not supported by this storage' });
  }
  return store;
}

/** A view in another tenant answers 404, the same as a missing one. */
async function getScopedView(
  store: SavedViewsStorage,
  savedViewId: string,
  scope: StoredResourceScope | undefined,
): Promise<SavedView> {
  const view = await store.get(savedViewId);
  if (!view || (scope && view.resourceId !== scope.value)) {
    throw new HTTPException(404, { message: 'Saved view not found' });
  }
  return view;
}

/** The tenant is server-side bookkeeping, so responses leave it out. */
function toResponse({ resourceId: _resourceId, ...view }: SavedView) {
  return view;
}

export const LIST_SAVED_VIEWS_ROUTE = createRoute({
  method: 'GET',
  path: '/saved-views',
  responseType: 'json' as const,
  queryParamSchema: listSavedViewsQuerySchema,
  responseSchema: listSavedViewsResponseSchema,
  summary: 'List saved views',
  description:
    "Returns saved views, oldest first, optionally limited to one Studio page, up to 100 per page. Use `pageIndex` while `pagination.hasMore` is true. With `storedResources.scope` on, only lists views in the caller's scope.",
  tags: ['Saved Views'],
  requiresAuth: true,
  handler: async ({ mastra, requestContext, page, perPage, pageIndex }) => {
    try {
      const store = await getSavedViewsStore(mastra);
      const scope = await getStoredResourceScope(mastra, requestContext);
      const pagination = { page: pageIndex ?? 0, perPage: perPage ?? MAX_SAVED_VIEWS_PER_PAGE };
      const result = await store.list({ page, resourceId: scope?.value, pagination });
      return {
        views: result.views.map(toResponse),
        // A number, never `false`: the route doesn't list every view at once.
        pagination: { ...result.pagination, perPage: pagination.perPage },
      };
    } catch (error) {
      return handleError(error, 'Error listing saved views');
    }
  },
});

export const GET_SAVED_VIEW_ROUTE = createRoute({
  method: 'GET',
  path: '/saved-views/:savedViewId',
  responseType: 'json' as const,
  pathParamSchema: savedViewIdPathParams,
  responseSchema: savedViewResponseSchema,
  summary: 'Get a saved view by ID',
  description: 'Returns a single saved view. 404 when the view does not exist.',
  tags: ['Saved Views'],
  requiresAuth: true,
  handler: async ({ mastra, requestContext, savedViewId }) => {
    try {
      const store = await getSavedViewsStore(mastra);
      const scope = await getStoredResourceScope(mastra, requestContext);
      return toResponse(await getScopedView(store, savedViewId, scope));
    } catch (error) {
      return handleError(error, 'Error getting saved view');
    }
  },
});

export const CREATE_SAVED_VIEW_ROUTE = createRoute({
  method: 'POST',
  path: '/saved-views',
  responseType: 'json' as const,
  bodySchema: createSavedViewBodySchema,
  responseSchema: savedViewResponseSchema,
  summary: 'Create a saved view',
  description:
    'Saves a named view for a Studio page. The caller is recorded as the author when the server runs with auth.',
  tags: ['Saved Views'],
  requiresAuth: true,
  handler: async ({ mastra, requestContext, page, name, state }) => {
    try {
      const store = await getSavedViewsStore(mastra);
      const scope = await getStoredResourceScope(mastra, requestContext);
      const view = await store.create({
        page,
        name,
        state,
        authorId: getCallerAuthorId(requestContext),
        resourceId: scope?.value ?? null,
      });
      return toResponse(view);
    } catch (error) {
      return handleError(error, 'Error creating saved view');
    }
  },
});

export const UPDATE_SAVED_VIEW_ROUTE = createRoute({
  method: 'PATCH',
  path: '/saved-views/:savedViewId',
  responseType: 'json' as const,
  pathParamSchema: savedViewIdPathParams,
  bodySchema: updateSavedViewBodySchema,
  responseSchema: savedViewResponseSchema,
  summary: 'Update a saved view',
  description:
    'Changes the name or state of a saved view and records the caller as its last editor. Omitted fields keep their value.',
  tags: ['Saved Views'],
  requiresAuth: true,
  handler: async ({ mastra, requestContext, savedViewId, name, state }) => {
    try {
      const store = await getSavedViewsStore(mastra);
      const scope = await getStoredResourceScope(mastra, requestContext);
      await getScopedView(store, savedViewId, scope);
      const view = await store.update(savedViewId, { name, state, updatedById: getCallerAuthorId(requestContext) });
      if (!view) throw new HTTPException(404, { message: 'Saved view not found' });
      return toResponse(view);
    } catch (error) {
      return handleError(error, 'Error updating saved view');
    }
  },
});

export const DELETE_SAVED_VIEW_ROUTE = createRoute({
  method: 'DELETE',
  path: '/saved-views/:savedViewId',
  responseType: 'json' as const,
  pathParamSchema: savedViewIdPathParams,
  responseSchema: deleteSavedViewResponseSchema,
  summary: 'Delete a saved view',
  description: 'Permanently deletes the saved view. 404 when the view does not exist.',
  tags: ['Saved Views'],
  requiresAuth: true,
  handler: async ({ mastra, requestContext, savedViewId }) => {
    try {
      const store = await getSavedViewsStore(mastra);
      const scope = await getStoredResourceScope(mastra, requestContext);
      await getScopedView(store, savedViewId, scope);
      await store.delete(savedViewId);
      return { deleted: true as const };
    } catch (error) {
      return handleError(error, 'Error deleting saved view');
    }
  },
});
