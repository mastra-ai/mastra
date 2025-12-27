import type {
  ClientOptions,
  ListKnowledgeArtifactsParams,
  ListKnowledgeArtifactsResponse,
  GetKnowledgeArtifactResponse,
  AddKnowledgeArtifactParams,
  AddKnowledgeArtifactResponse,
  DeleteKnowledgeArtifactResponse,
  SearchKnowledgeParams,
  SearchKnowledgeResponse,
  DeleteKnowledgeNamespaceResponse,
  KnowledgeNamespace,
} from '../types';

import { BaseResource } from './base';

/**
 * Resource for interacting with a specific knowledge namespace
 */
export class Knowledge extends BaseResource {
  constructor(
    options: ClientOptions,
    private namespace: string,
  ) {
    super(options);
  }

  /**
   * Retrieves details about the namespace
   * @returns Promise containing namespace details
   */
  async details(): Promise<KnowledgeNamespace> {
    // Get from list and filter
    const res = (await this.request(`/api/knowledge/namespaces`)) as { namespaces: KnowledgeNamespace[] };
    const namespace = res.namespaces.find(n => n.namespace === this.namespace);
    if (!namespace) {
      throw new Error('Namespace not found');
    }
    return namespace;
  }

  /**
   * Lists all artifacts in the namespace
   * @param params - Optional filter parameters
   * @returns Promise containing list of artifacts
   */
  listArtifacts(params?: ListKnowledgeArtifactsParams): Promise<ListKnowledgeArtifactsResponse> {
    const searchParams = new URLSearchParams();

    if (params?.prefix) {
      searchParams.set('prefix', params.prefix);
    }

    const queryString = searchParams.toString();
    return this.request(
      `/api/knowledge/namespaces/${encodeURIComponent(this.namespace)}/artifacts${queryString ? `?${queryString}` : ''}`,
    );
  }

  /**
   * Gets the content of a specific artifact
   * @param key - Artifact key
   * @returns Promise containing artifact content
   */
  getArtifact(key: string): Promise<GetKnowledgeArtifactResponse> {
    return this.request(
      `/api/knowledge/namespaces/${encodeURIComponent(this.namespace)}/artifacts/${encodeURIComponent(key)}`,
    );
  }

  /**
   * Adds a text artifact to the namespace
   * @param params - Artifact data including key and content
   * @returns Promise containing success status
   */
  addArtifact(params: AddKnowledgeArtifactParams): Promise<AddKnowledgeArtifactResponse> {
    return this.request(`/api/knowledge/namespaces/${encodeURIComponent(this.namespace)}/artifacts`, {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Deletes an artifact from the namespace
   * @param key - Artifact key to delete
   * @returns Promise containing deletion confirmation
   */
  deleteArtifact(key: string): Promise<DeleteKnowledgeArtifactResponse> {
    return this.request(
      `/api/knowledge/namespaces/${encodeURIComponent(this.namespace)}/artifacts/${encodeURIComponent(key)}`,
      {
        method: 'DELETE',
      },
    );
  }

  /**
   * Searches artifacts in the namespace
   * @param params - Search parameters
   * @returns Promise containing search results
   */
  search(params: SearchKnowledgeParams): Promise<SearchKnowledgeResponse> {
    const searchParams = new URLSearchParams();

    searchParams.set('query', params.query);

    if (params.topK !== undefined) {
      searchParams.set('topK', String(params.topK));
    }
    if (params.minScore !== undefined) {
      searchParams.set('minScore', String(params.minScore));
    }
    if (params.mode) {
      searchParams.set('mode', params.mode);
    }
    if (params.vectorWeight !== undefined) {
      searchParams.set('vectorWeight', String(params.vectorWeight));
    }

    return this.request(
      `/api/knowledge/namespaces/${encodeURIComponent(this.namespace)}/search?${searchParams.toString()}`,
    );
  }

  /**
   * Deletes the entire namespace and all its artifacts
   * @returns Promise containing deletion confirmation
   */
  delete(): Promise<DeleteKnowledgeNamespaceResponse> {
    return this.request(`/api/knowledge/namespaces/${encodeURIComponent(this.namespace)}`, {
      method: 'DELETE',
    });
  }
}
