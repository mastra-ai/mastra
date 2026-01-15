/**
 * Knowledge server handlers - stub implementation.
 *
 * Knowledge and Skills are now accessed through the Workspace system.
 * These handlers need to be updated to use workspace.fs and workspace.search().
 *
 * TODO: Update these handlers to use the new Workspace API.
 */

import { createRoute } from '../server-adapter/routes/route-builder';

// Stub routes that return empty/not configured responses
export const LIST_KNOWLEDGE_NAMESPACES_ROUTE = createRoute({
  method: 'GET',
  path: '/api/knowledge/namespaces',
  responseType: 'json',
  summary: 'List knowledge namespaces',
  description: 'Returns a list of all knowledge namespaces',
  tags: ['Knowledge'],
  handler: async () => {
    return { namespaces: [], isKnowledgeConfigured: false };
  },
});

export const CREATE_KNOWLEDGE_NAMESPACE_ROUTE = createRoute({
  method: 'POST',
  path: '/api/knowledge/namespaces',
  responseType: 'json',
  summary: 'Create knowledge namespace',
  description: 'Creates a new knowledge namespace',
  tags: ['Knowledge'],
  handler: async () => {
    return { error: 'Knowledge handlers need migration to Workspace API' };
  },
});

export const DELETE_KNOWLEDGE_NAMESPACE_ROUTE = createRoute({
  method: 'DELETE',
  path: '/api/knowledge/namespaces/:namespace',
  responseType: 'json',
  summary: 'Delete knowledge namespace',
  description: 'Deletes a knowledge namespace',
  tags: ['Knowledge'],
  handler: async () => {
    return { error: 'Knowledge handlers need migration to Workspace API' };
  },
});

export const LIST_KNOWLEDGE_ARTIFACTS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/knowledge/namespaces/:namespace/artifacts',
  responseType: 'json',
  summary: 'List artifacts in namespace',
  description: 'Returns a list of all artifacts in a namespace',
  tags: ['Knowledge'],
  handler: async () => {
    return { artifacts: [], namespace: '' };
  },
});

export const GET_KNOWLEDGE_ARTIFACT_ROUTE = createRoute({
  method: 'GET',
  path: '/api/knowledge/namespaces/:namespace/artifacts/:artifactKey',
  responseType: 'json',
  summary: 'Get artifact content',
  description: 'Returns the content of a specific artifact',
  tags: ['Knowledge'],
  handler: async () => {
    return { error: 'Knowledge handlers need migration to Workspace API' };
  },
});

export const ADD_KNOWLEDGE_ARTIFACT_ROUTE = createRoute({
  method: 'POST',
  path: '/api/knowledge/namespaces/:namespace/artifacts',
  responseType: 'json',
  summary: 'Add text artifact',
  description: 'Adds a new text artifact',
  tags: ['Knowledge'],
  handler: async () => {
    return { error: 'Knowledge handlers need migration to Workspace API' };
  },
});

export const ADD_KNOWLEDGE_FILE_ARTIFACT_ROUTE = createRoute({
  method: 'POST',
  path: '/api/knowledge/namespaces/:namespace/artifacts/file',
  responseType: 'json',
  summary: 'Add file artifact',
  description: 'Adds a new file artifact',
  tags: ['Knowledge'],
  handler: async () => {
    return { error: 'Knowledge handlers need migration to Workspace API' };
  },
});

export const DELETE_KNOWLEDGE_ARTIFACT_ROUTE = createRoute({
  method: 'DELETE',
  path: '/api/knowledge/namespaces/:namespace/artifacts/:artifactKey',
  responseType: 'json',
  summary: 'Delete artifact',
  description: 'Deletes an artifact',
  tags: ['Knowledge'],
  handler: async () => {
    return { error: 'Knowledge handlers need migration to Workspace API' };
  },
});

export const SEARCH_KNOWLEDGE_ROUTE = createRoute({
  method: 'GET',
  path: '/api/knowledge/search',
  responseType: 'json',
  summary: 'Search knowledge',
  description: 'Searches across all knowledge content',
  tags: ['Knowledge'],
  handler: async () => {
    return { results: [], query: '', mode: 'bm25', namespace: '' };
  },
});
