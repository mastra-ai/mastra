import type { Mastra } from '@mastra/core';
import type { SavedViewsStorage } from '@mastra/core/storage';
import { HTTPException } from '../http-exception';
import { messageResponseSchema } from '../schemas/common';
import {
  createSavedViewBodySchema,
  listSavedViewsQuerySchema,
  listSavedViewsResponseSchema,
  savedViewIdPathParams,
  savedViewResponseSchema,
  updateSavedViewBodySchema,
} from '../schemas/saved-views';
import { createRoute } from '../server-adapter/routes/route-builder';
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

export const LIST_SAVED_VIEWS_ROUTE = createRoute({
  method: 'GET',
  path: '/saved-views',
  responseType: 'json' as const,
  queryParamSchema: listSavedViewsQuerySchema,
  responseSchema: listSavedViewsResponseSchema,
  summary: 'List saved views',
  description:
    'Returns every saved view, oldest first, optionally limited to one Studio page. Everyone who can open Studio sees every view.',
  tags: ['Saved Views'],
  requiresAuth: true,
  handler: async ({ mastra, page }) => {
    try {
      const store = await getSavedViewsStore(mastra);
      return await store.list({ page, pagination: { page: 0, perPage: false } });
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
  handler: async ({ mastra, savedViewId }) => {
    try {
      const store = await getSavedViewsStore(mastra);
      const view = await store.get(savedViewId);
      if (!view) throw new HTTPException(404, { message: 'Saved view not found' });
      return view;
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
      return await store.create({ page, name, state, authorId: getCallerAuthorId(requestContext) });
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
  description: 'Changes the name or state of a saved view. Omitted fields keep their value.',
  tags: ['Saved Views'],
  requiresAuth: true,
  handler: async ({ mastra, savedViewId, name, state }) => {
    try {
      const store = await getSavedViewsStore(mastra);
      const view = await store.update(savedViewId, { name, state });
      if (!view) throw new HTTPException(404, { message: 'Saved view not found' });
      return view;
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
  responseSchema: messageResponseSchema,
  summary: 'Delete a saved view',
  description: 'Permanently deletes the saved view. 404 when the view does not exist.',
  tags: ['Saved Views'],
  requiresAuth: true,
  handler: async ({ mastra, savedViewId }) => {
    try {
      const store = await getSavedViewsStore(mastra);
      if (!(await store.get(savedViewId))) throw new HTTPException(404, { message: 'Saved view not found' });
      await store.delete(savedViewId);
      return { message: 'Saved view deleted' };
    } catch (error) {
      return handleError(error, 'Error deleting saved view');
    }
  },
});
