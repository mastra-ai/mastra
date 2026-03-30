import Firecrawl, {
  type CrawlJob,
  type CrawlOptions,
  type CrawlResponse,
  type FirecrawlClientOptions,
  type PaginationConfig,
} from '@mendable/firecrawl-js';
import { Integration } from '@mastra/core/integration';
import type { ToolAction } from '@mastra/core/tools';

export interface FirecrawlIntegrationConfig {
  API_KEY?: string;
  API_URL?: string;
  timeoutMs?: number;
  maxRetries?: number;
  backoffFactor?: number;
}

export interface FirecrawlIntegrationOptions {
  config?: FirecrawlIntegrationConfig;
}

export type FirecrawlCrawlUrlsBody = CrawlOptions & { url: string };

export interface FirecrawlCrawlUrlsRequest {
  body: FirecrawlCrawlUrlsBody;
}

export interface FirecrawlGetCrawlStatusRequest {
  path: { id: string };
  query?: PaginationConfig;
}

export interface FirecrawlApiError {
  error: string;
  status?: number;
  details?: unknown;
}

export interface FirecrawlCrawlUrlsResponse {
  data?: CrawlResponse;
  error?: FirecrawlApiError;
}

export interface FirecrawlGetCrawlStatusResponse {
  data?: CrawlJob;
  error?: FirecrawlApiError;
}

export type FirecrawlApiClient = Firecrawl & {
  crawlUrls: (request: FirecrawlCrawlUrlsRequest) => Promise<FirecrawlCrawlUrlsResponse>;
  getCrawlStatus: (request: FirecrawlGetCrawlStatusRequest) => Promise<FirecrawlGetCrawlStatusResponse>;
};

const DEFAULT_INTEGRATION_TAG = 'mastra';

const normalizeError = (error: unknown): FirecrawlApiError => {
  if (error instanceof Error) {
    const details = (error as { details?: unknown }).details;
    const status = (error as { status?: number }).status;
    return {
      error: error.message,
      status,
      details,
    };
  }

  return { error: 'Unknown error' };
};

export class FirecrawlIntegration extends Integration<void, FirecrawlApiClient> {
  name = 'FirecrawlIntegration';
  private readonly config: FirecrawlIntegrationConfig;
  private client?: Firecrawl;
  private apiClient?: FirecrawlApiClient;

  constructor(options: FirecrawlIntegrationOptions = {}) {
    super();
    this.config = options.config ?? {};
  }

  listStaticTools(): Record<string, ToolAction<any, any, any>> {
    return {};
  }

  async listTools(): Promise<Record<string, ToolAction<any, any, any>>> {
    return {};
  }

  private buildClientOptions(): FirecrawlClientOptions {
    return {
      apiKey: this.config.API_KEY ?? process.env.FIRECRAWL_API_KEY ?? null,
      apiUrl: this.config.API_URL ?? process.env.FIRECRAWL_API_URL ?? null,
      timeoutMs: this.config.timeoutMs,
      maxRetries: this.config.maxRetries,
      backoffFactor: this.config.backoffFactor,
    };
  }

  public getClient(): Firecrawl {
    if (!this.client) {
      this.client = new Firecrawl(this.buildClientOptions());
    }

    return this.client;
  }

  async getApiClient(): Promise<FirecrawlApiClient> {
    if (this.apiClient) return this.apiClient;

    const sdk = this.getClient();

    const apiClient = Object.assign(sdk, {
      crawlUrls: async ({ body }: FirecrawlCrawlUrlsRequest): Promise<FirecrawlCrawlUrlsResponse> => {
        try {
          const { url, ...options } = body;
          const data = await sdk.startCrawl(url, {
            ...options,
            integration: options.integration ?? DEFAULT_INTEGRATION_TAG,
          });
          return { data };
        } catch (error) {
          return { error: normalizeError(error) };
        }
      },
      getCrawlStatus: async ({
        path,
        query,
      }: FirecrawlGetCrawlStatusRequest): Promise<FirecrawlGetCrawlStatusResponse> => {
        try {
          const data = await sdk.getCrawlStatus(path.id, query);
          return { data };
        } catch (error) {
          return { error: normalizeError(error) };
        }
      },
    });

    this.apiClient = apiClient;
    return apiClient;
  }
}
