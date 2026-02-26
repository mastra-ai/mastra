import type {
  ClientOptions,
  ListToolProviderToolkitsResponse,
  ListToolProviderToolsParams,
  ListToolProviderToolsResponse,
  GetToolProviderToolSchemaResponse,
} from '../types';

import { BaseResource } from './base';

/**
 * Resource for interacting with a specific tool provider
 */
export class ToolProvider extends BaseResource {
  constructor(
    options: ClientOptions,
    private providerId: string,
  ) {
    super(options);
  }

  /**
   * Lists available toolkits from this provider
   * @returns Promise containing list of toolkits
   */
  listToolkits(): Promise<ListToolProviderToolkitsResponse> {
    return this.request(`/tool-providers/${encodeURIComponent(this.providerId)}/toolkits`);
  }

  /**
   * Lists available tools from this provider, with optional filtering
   * @param params - Optional filtering and pagination parameters
   * @returns Promise containing list of tools
   */
  listTools(params?: ListToolProviderToolsParams): Promise<ListToolProviderToolsResponse> {
    const searchParams = new URLSearchParams();

    if (params?.toolkit) {
      searchParams.set('toolkit', params.toolkit);
    }
    if (params?.search) {
      searchParams.set('search', params.search);
    }
    if (params?.page !== undefined) {
      searchParams.set('page', String(params.page));
    }
    if (params?.perPage !== undefined) {
      searchParams.set('perPage', String(params.perPage));
    }

    const queryString = searchParams.toString();
    return this.request(
      `/tool-providers/${encodeURIComponent(this.providerId)}/tools${queryString ? `?${queryString}` : ''}`,
    );
  }

  /**
   * Gets the input schema for a specific tool
   * @param toolSlug - The slug of the tool
   * @returns Promise containing the tool's JSON schema
   */
  getToolSchema(toolSlug: string): Promise<GetToolProviderToolSchemaResponse> {
    return this.request(
      `/tool-providers/${encodeURIComponent(this.providerId)}/tools/${encodeURIComponent(toolSlug)}/schema`,
    );
  }
}
