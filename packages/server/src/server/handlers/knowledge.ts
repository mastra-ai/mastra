import type { MastraKnowledge, KnowledgeSearchMode } from '@mastra/core/knowledge';
import { HTTPException } from '../http-exception';
import {
  namespacePathParams,
  artifactKeyPathParams,
  listArtifactsQuerySchema,
  searchKnowledgeQuerySchema,
  createNamespaceBodySchema,
  addTextArtifactBodySchema,
  addFileArtifactBodySchema,
  listNamespacesResponseSchema,
  listArtifactsResponseSchema,
  getArtifactResponseSchema,
  addArtifactResponseSchema,
  deleteArtifactResponseSchema,
  searchKnowledgeResponseSchema,
  createNamespaceResponseSchema,
  deleteNamespaceResponseSchema,
} from '../schemas/knowledge';
import { createRoute } from '../server-adapter/routes/route-builder';
import { handleError } from './error';

/**
 * Get the knowledge instance from Mastra.
 * Returns null if no knowledge instance is registered.
 */

function getKnowledge(mastra: any): MastraKnowledge | null {
  return mastra.getKnowledge?.() ?? null;
}

// ============================================================================
// Route Definitions
// ============================================================================

export const LIST_KNOWLEDGE_NAMESPACES_ROUTE = createRoute({
  method: 'GET',
  path: '/api/knowledge/namespaces',
  responseType: 'json',
  responseSchema: listNamespacesResponseSchema,
  summary: 'List knowledge namespaces',
  description: 'Returns a list of all knowledge namespaces',
  tags: ['Knowledge'],
  handler: async ({ mastra }) => {
    try {
      const knowledge = getKnowledge(mastra);
      if (!knowledge) {
        return { namespaces: [], isKnowledgeConfigured: false };
      }

      const namespaces = await knowledge.listNamespaces();

      return {
        namespaces: namespaces.map(ns => ({
          namespace: ns.namespace,
          description: ns.description,
          artifactCount: ns.artifactCount,
          createdAt: ns.createdAt,
          updatedAt: ns.updatedAt,
          hasBM25: ns.hasBM25,
          hasVector: ns.hasVector,
        })),
        isKnowledgeConfigured: true,
      };
    } catch (error) {
      return handleError(error, 'Error listing knowledge namespaces');
    }
  },
});

export const CREATE_KNOWLEDGE_NAMESPACE_ROUTE = createRoute({
  method: 'POST',
  path: '/api/knowledge/namespaces',
  responseType: 'json',
  bodySchema: createNamespaceBodySchema,
  responseSchema: createNamespaceResponseSchema,
  summary: 'Create knowledge namespace',
  description: 'Creates a new knowledge namespace for organizing artifacts',
  tags: ['Knowledge'],
  handler: async ({ mastra, namespace, description, enableBM25, vectorConfig }) => {
    try {
      if (!namespace) {
        throw new HTTPException(400, { message: 'Namespace is required' });
      }

      const knowledge = getKnowledge(mastra);
      if (!knowledge) {
        throw new HTTPException(404, { message: 'No Knowledge instance registered with Mastra' });
      }

      // Check if namespace already exists
      const exists = await knowledge.hasNamespace(namespace);
      if (exists) {
        throw new HTTPException(409, { message: `Namespace "${namespace}" already exists` });
      }

      const result = await knowledge.createNamespace({
        namespace,
        description,
        enableBM25,
        vectorConfig,
      });

      return {
        namespace: result.namespace,
        description: result.description,
        artifactCount: result.artifactCount,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        hasBM25: result.hasBM25,
        hasVector: result.hasVector,
      };
    } catch (error) {
      return handleError(error, 'Error creating knowledge namespace');
    }
  },
});

export const DELETE_KNOWLEDGE_NAMESPACE_ROUTE = createRoute({
  method: 'DELETE',
  path: '/api/knowledge/namespaces/:namespace',
  responseType: 'json',
  pathParamSchema: namespacePathParams,
  responseSchema: deleteNamespaceResponseSchema,
  summary: 'Delete knowledge namespace',
  description: 'Deletes a knowledge namespace and all its artifacts',
  tags: ['Knowledge'],
  handler: async ({ mastra, namespace }) => {
    try {
      if (!namespace) {
        throw new HTTPException(400, { message: 'Namespace is required' });
      }

      const knowledge = getKnowledge(mastra);
      if (!knowledge) {
        throw new HTTPException(404, { message: 'No Knowledge instance registered with Mastra' });
      }

      // Check if namespace exists
      const exists = await knowledge.hasNamespace(namespace);
      if (!exists) {
        throw new HTTPException(404, { message: `Namespace "${namespace}" not found` });
      }

      await knowledge.deleteNamespace(namespace);

      return { success: true, namespace };
    } catch (error) {
      return handleError(error, 'Error deleting knowledge namespace');
    }
  },
});

export const LIST_KNOWLEDGE_ARTIFACTS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/knowledge/namespaces/:namespace/artifacts',
  responseType: 'json',
  pathParamSchema: namespacePathParams,
  queryParamSchema: listArtifactsQuerySchema,
  responseSchema: listArtifactsResponseSchema,
  summary: 'List artifacts in namespace',
  description: 'Returns a list of all artifacts in a knowledge namespace',
  tags: ['Knowledge'],
  handler: async ({ mastra, namespace, prefix }) => {
    try {
      if (!namespace) {
        throw new HTTPException(400, { message: 'Namespace is required' });
      }

      const knowledge = getKnowledge(mastra);
      if (!knowledge) {
        return { namespace, artifacts: [] };
      }

      // Check if namespace exists
      const exists = await knowledge.hasNamespace(namespace);
      if (!exists) {
        return { namespace, artifacts: [] };
      }

      const keys = await knowledge.list(namespace, prefix);

      // For each key, we need to get the content to compute size
      // This is a simplification - in a real implementation, we'd want metadata storage
      const artifacts = await Promise.all(
        keys.map(async key => {
          try {
            const content = await knowledge.get(namespace, key);
            return {
              key,
              type: 'text' as const,
              size: new TextEncoder().encode(content).length,
              createdAt: new Date().toISOString(), // Not tracked yet
            };
          } catch {
            return {
              key,
              type: 'text' as const,
              size: 0,
              createdAt: new Date().toISOString(),
            };
          }
        }),
      );

      return {
        namespace,
        artifacts,
      };
    } catch (error) {
      return handleError(error, 'Error listing knowledge artifacts');
    }
  },
});

export const GET_KNOWLEDGE_ARTIFACT_ROUTE = createRoute({
  method: 'GET',
  path: '/api/knowledge/namespaces/:namespace/artifacts/:artifactKey',
  responseType: 'json',
  pathParamSchema: artifactKeyPathParams,
  responseSchema: getArtifactResponseSchema,
  summary: 'Get artifact content',
  description: 'Returns the content of a specific artifact',
  tags: ['Knowledge'],
  handler: async ({ mastra, namespace, artifactKey }) => {
    try {
      if (!namespace || !artifactKey) {
        throw new HTTPException(400, { message: 'Namespace and artifact key are required' });
      }

      const knowledge = getKnowledge(mastra);
      if (!knowledge) {
        throw new HTTPException(404, { message: 'No Knowledge instance registered with Mastra' });
      }

      // Decode the artifact key (it may be URL encoded)
      const decodedKey = decodeURIComponent(artifactKey);

      try {
        const content = await knowledge.get(namespace, decodedKey);
        return {
          key: decodedKey,
          content,
          type: 'text' as const,
        };
      } catch {
        throw new HTTPException(404, { message: `Artifact "${decodedKey}" not found` });
      }
    } catch (error) {
      return handleError(error, 'Error getting knowledge artifact');
    }
  },
});

/** Default prefix for static knowledge artifacts - must match @mastra/skills */
const STATIC_PREFIX = 'static';

export const ADD_KNOWLEDGE_ARTIFACT_ROUTE = createRoute({
  method: 'POST',
  path: '/api/knowledge/namespaces/:namespace/artifacts',
  responseType: 'json',
  pathParamSchema: namespacePathParams,
  bodySchema: addTextArtifactBodySchema,
  responseSchema: addArtifactResponseSchema,
  summary: 'Add text artifact',
  description: 'Adds a new text artifact to the knowledge namespace',
  tags: ['Knowledge'],
  handler: async ({ mastra, namespace, key, content, metadata, skipIndex }) => {
    try {
      if (!namespace) {
        throw new HTTPException(400, { message: 'Namespace is required' });
      }

      if (!key || !content) {
        throw new HTTPException(400, { message: 'Key and content are required' });
      }

      const knowledge = getKnowledge(mastra);
      if (!knowledge) {
        throw new HTTPException(404, { message: 'No Knowledge instance registered with Mastra' });
      }

      // If skipIndex is true, this is a "static" artifact - prefix the key with static/
      // so it can be retrieved via getStatic()
      const artifactKey = skipIndex && !key.startsWith(`${STATIC_PREFIX}/`) ? `${STATIC_PREFIX}/${key}` : key;

      // Add the artifact (namespace will be auto-created if it doesn't exist)
      await knowledge.add(
        namespace,
        { type: 'text', key: artifactKey, content },
        { metadata, skipIndex: skipIndex ?? false },
      );

      return { success: true, key: artifactKey };
    } catch (error) {
      return handleError(error, 'Error adding knowledge artifact');
    }
  },
});

export const ADD_KNOWLEDGE_FILE_ARTIFACT_ROUTE = createRoute({
  method: 'POST',
  path: '/api/knowledge/namespaces/:namespace/artifacts/file',
  responseType: 'json',
  pathParamSchema: namespacePathParams,
  bodySchema: addFileArtifactBodySchema,
  responseSchema: addArtifactResponseSchema,
  summary: 'Add file artifact',
  description: 'Adds a new file artifact to the knowledge namespace',
  tags: ['Knowledge'],
  handler: async ({ mastra, namespace, key, filename, mimeType, content, metadata, skipIndex }) => {
    try {
      if (!namespace) {
        throw new HTTPException(400, { message: 'Namespace is required' });
      }

      if (!key || !content) {
        throw new HTTPException(400, { message: 'Key and content are required' });
      }

      const knowledge = getKnowledge(mastra);
      if (!knowledge) {
        throw new HTTPException(404, { message: 'No Knowledge instance registered with Mastra' });
      }

      // If skipIndex is true, this is a "static" artifact - prefix the key with static/
      // so it can be retrieved via getStatic()
      const artifactKey = skipIndex && !key.startsWith(`${STATIC_PREFIX}/`) ? `${STATIC_PREFIX}/${key}` : key;

      // Decode base64 content to buffer
      const buffer = Buffer.from(content, 'base64');

      // Determine artifact type based on mimeType
      const isImage = mimeType.startsWith('image/');
      const artifact = isImage
        ? { type: 'image' as const, key: artifactKey, content: buffer, mimeType }
        : { type: 'file' as const, key: artifactKey, content: buffer };

      // Add file metadata
      const fileMetadata = {
        ...metadata,
        filename,
        mimeType,
        size: buffer.length,
      };

      await knowledge.add(namespace, artifact, { metadata: fileMetadata, skipIndex: skipIndex ?? false });

      return { success: true, key: artifactKey };
    } catch (error) {
      return handleError(error, 'Error adding file artifact');
    }
  },
});

export const DELETE_KNOWLEDGE_ARTIFACT_ROUTE = createRoute({
  method: 'DELETE',
  path: '/api/knowledge/namespaces/:namespace/artifacts/:artifactKey',
  responseType: 'json',
  pathParamSchema: artifactKeyPathParams,
  responseSchema: deleteArtifactResponseSchema,
  summary: 'Delete artifact',
  description: 'Deletes an artifact from the knowledge namespace',
  tags: ['Knowledge'],
  handler: async ({ mastra, namespace, artifactKey }) => {
    try {
      if (!namespace || !artifactKey) {
        throw new HTTPException(400, { message: 'Namespace and artifact key are required' });
      }

      const knowledge = getKnowledge(mastra);
      if (!knowledge) {
        throw new HTTPException(404, { message: 'No Knowledge instance registered with Mastra' });
      }

      // Decode the artifact key
      const decodedKey = decodeURIComponent(artifactKey);

      await knowledge.delete(namespace, decodedKey);

      return { success: true, key: decodedKey };
    } catch (error) {
      return handleError(error, 'Error deleting knowledge artifact');
    }
  },
});

export const SEARCH_KNOWLEDGE_ROUTE = createRoute({
  method: 'GET',
  path: '/api/knowledge/namespaces/:namespace/search',
  responseType: 'json',
  pathParamSchema: namespacePathParams,
  queryParamSchema: searchKnowledgeQuerySchema,
  responseSchema: searchKnowledgeResponseSchema,
  summary: 'Search knowledge',
  description: 'Searches artifacts in the knowledge namespace using BM25 or vector search',
  tags: ['Knowledge'],
  handler: async ({ mastra, namespace, query, topK, minScore, mode }) => {
    try {
      if (!namespace) {
        throw new HTTPException(400, { message: 'Namespace is required' });
      }

      if (!query) {
        throw new HTTPException(400, { message: 'Search query is required' });
      }

      const knowledge = getKnowledge(mastra);
      if (!knowledge) {
        return {
          results: [],
          query,
          mode: 'bm25' as const,
          namespace,
        };
      }

      // Check if namespace exists
      const exists = await knowledge.hasNamespace(namespace);
      if (!exists) {
        return {
          results: [],
          query,
          mode: 'bm25' as const,
          namespace,
        };
      }

      // Get capabilities to determine the effective mode
      const capabilities = await knowledge.getNamespaceCapabilities(namespace);

      // Validate the requested mode
      if (mode === 'vector' && !capabilities.canVectorSearch) {
        throw new HTTPException(400, { message: 'Vector search is not enabled for this namespace' });
      }
      if (mode === 'bm25' && !capabilities.canBM25Search) {
        throw new HTTPException(400, { message: 'BM25 search is not enabled for this namespace' });
      }
      if (mode === 'hybrid' && !capabilities.canHybridSearch) {
        throw new HTTPException(400, { message: 'Hybrid search requires both BM25 and vector to be enabled' });
      }

      const results = await knowledge.search(namespace, query, {
        topK: topK || 5,
        minScore,
        mode: mode as KnowledgeSearchMode | undefined,
      });

      // Determine the effective mode used
      let effectiveMode: 'vector' | 'bm25' | 'hybrid';
      if (mode) {
        effectiveMode = mode;
      } else if (capabilities.canHybridSearch) {
        effectiveMode = 'hybrid';
      } else if (capabilities.canVectorSearch) {
        effectiveMode = 'vector';
      } else {
        effectiveMode = 'bm25';
      }

      return {
        results: results.map(r => ({
          key: r.key,
          content: r.content,
          score: r.score,
          metadata: r.metadata,
          scoreDetails: r.scoreDetails,
        })),
        query,
        mode: effectiveMode,
        namespace,
      };
    } catch (error) {
      return handleError(error, 'Error searching knowledge');
    }
  },
});
