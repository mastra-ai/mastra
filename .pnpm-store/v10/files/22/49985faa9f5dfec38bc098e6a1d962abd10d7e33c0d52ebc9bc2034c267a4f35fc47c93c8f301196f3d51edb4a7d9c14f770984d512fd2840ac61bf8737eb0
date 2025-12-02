import { AxiosRequestHeaders, AxiosResponse } from 'axios';
import * as zt from 'zod';
import { TypedEventTarget } from 'typescript-event-target';

/**
 * Configuration interface for FirecrawlApp.
 * @param apiKey - Optional API key for authentication.
 * @param apiUrl - Optional base URL of the API; defaults to 'https://api.firecrawl.dev'.
 */
interface FirecrawlAppConfig {
    apiKey?: string | null;
    apiUrl?: string | null;
}
/**
 * Metadata for a Firecrawl document.
 * Includes various optional properties for document metadata.
 */
interface FirecrawlDocumentMetadata {
    title?: string;
    description?: string;
    language?: string;
    keywords?: string;
    robots?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogUrl?: string;
    ogImage?: string;
    ogAudio?: string;
    ogDeterminer?: string;
    ogLocale?: string;
    ogLocaleAlternate?: string[];
    ogSiteName?: string;
    ogVideo?: string;
    dctermsCreated?: string;
    dcDateCreated?: string;
    dcDate?: string;
    dctermsType?: string;
    dcType?: string;
    dctermsAudience?: string;
    dctermsSubject?: string;
    dcSubject?: string;
    dcDescription?: string;
    dctermsKeywords?: string;
    modifiedTime?: string;
    publishedTime?: string;
    articleTag?: string;
    articleSection?: string;
    sourceURL?: string;
    statusCode?: number;
    error?: string;
    proxyUsed?: "basic" | "stealth";
    cacheState?: "miss" | "hit";
    cachedAt?: string;
    [key: string]: any;
}
/**
 * Document interface for Firecrawl.
 * Represents a document retrieved or processed by Firecrawl.
 */
interface FirecrawlDocument<T = any, ActionsSchema extends (ActionsResult | never) = never> {
    url?: string;
    markdown?: string;
    html?: string;
    rawHtml?: string;
    links?: string[];
    extract?: T;
    json?: T;
    screenshot?: string;
    metadata?: FirecrawlDocumentMetadata;
    actions: ActionsSchema;
    changeTracking?: {
        previousScrapeAt: string | null;
        changeStatus: "new" | "same" | "changed" | "removed";
        visibility: "visible" | "hidden";
        diff?: {
            text: string;
            json: {
                files: Array<{
                    from: string | null;
                    to: string | null;
                    chunks: Array<{
                        content: string;
                        changes: Array<{
                            type: string;
                            normal?: boolean;
                            ln?: number;
                            ln1?: number;
                            ln2?: number;
                            content: string;
                        }>;
                    }>;
                }>;
            };
        };
        json?: any;
    };
    title?: string;
    description?: string;
}
/**
 * Parameters for scraping operations.
 * Defines the options and configurations available for scraping web content.
 */
interface CrawlScrapeOptions {
    formats?: ("markdown" | "html" | "rawHtml" | "content" | "links" | "screenshot" | "screenshot@fullPage" | "extract" | "json" | "changeTracking")[];
    headers?: Record<string, string>;
    includeTags?: string[];
    excludeTags?: string[];
    onlyMainContent?: boolean;
    waitFor?: number;
    timeout?: number;
    location?: {
        country?: string;
        languages?: string[];
    };
    mobile?: boolean;
    skipTlsVerification?: boolean;
    removeBase64Images?: boolean;
    blockAds?: boolean;
    proxy?: "basic" | "stealth" | "auto";
    storeInCache?: boolean;
    maxAge?: number;
    parsePDF?: boolean;
}
type Action = {
    type: "wait";
    milliseconds?: number;
    selector?: string;
} | {
    type: "click";
    selector: string;
    all?: boolean;
} | {
    type: "screenshot";
    fullPage?: boolean;
    quality?: number;
} | {
    type: "write";
    text: string;
} | {
    type: "press";
    key: string;
} | {
    type: "scroll";
    direction?: "up" | "down";
    selector?: string;
} | {
    type: "scrape";
} | {
    type: "executeJavascript";
    script: string;
};
interface ScrapeParams<LLMSchema extends zt.ZodSchema = any, ActionsSchema extends (Action[] | undefined) = undefined> extends CrawlScrapeOptions {
    extract?: {
        prompt?: string;
        schema?: LLMSchema;
        systemPrompt?: string;
    };
    jsonOptions?: {
        prompt?: string;
        schema?: LLMSchema;
        systemPrompt?: string;
    };
    changeTrackingOptions?: {
        prompt?: string;
        schema?: any;
        modes?: ("json" | "git-diff")[];
        tag?: string | null;
    };
    actions?: ActionsSchema;
    agent?: AgentOptions;
    zeroDataRetention?: boolean;
}
interface ActionsResult {
    screenshots: string[];
    scrapes: ({
        url: string;
        html: string;
    })[];
    javascriptReturns: {
        type: string;
        value: unknown;
    }[];
}
/**
 * Response interface for scraping operations.
 * Defines the structure of the response received after a scraping operation.
 */
interface ScrapeResponse<LLMResult = any, ActionsSchema extends (ActionsResult | never) = never> extends FirecrawlDocument<LLMResult, ActionsSchema> {
    success: true;
    warning?: string;
    error?: string;
}
/**
 * Parameters for crawling operations.
 * Includes options for both scraping and mapping during a crawl.
 */
interface CrawlParams {
    includePaths?: string[];
    excludePaths?: string[];
    maxDepth?: number;
    maxDiscoveryDepth?: number;
    limit?: number;
    allowBackwardLinks?: boolean;
    crawlEntireDomain?: boolean;
    allowExternalLinks?: boolean;
    ignoreSitemap?: boolean;
    scrapeOptions?: CrawlScrapeOptions;
    webhook?: string | {
        url: string;
        headers?: Record<string, string>;
        metadata?: Record<string, string>;
        events?: ["completed", "failed", "page", "started"][number][];
    };
    deduplicateSimilarURLs?: boolean;
    ignoreQueryParameters?: boolean;
    regexOnFullURL?: boolean;
    /**
     * Delay in seconds between scrapes. This helps respect website rate limits.
     * If not provided, the crawler may use the robots.txt crawl delay if available.
     */
    delay?: number;
    allowSubdomains?: boolean;
    maxConcurrency?: number;
    zeroDataRetention?: boolean;
}
/**
 * Response interface for crawling operations.
 * Defines the structure of the response received after initiating a crawl.
 */
interface CrawlResponse {
    id?: string;
    url?: string;
    success: true;
    error?: string;
}
/**
 * Response interface for batch scrape operations.
 * Defines the structure of the response received after initiating a crawl.
 */
interface BatchScrapeResponse {
    id?: string;
    url?: string;
    success: true;
    error?: string;
    invalidURLs?: string[];
}
/**
 * Response interface for job status checks.
 * Provides detailed status of a crawl job including progress and results.
 */
interface CrawlStatusResponse {
    success: true;
    status: "scraping" | "completed" | "failed" | "cancelled";
    completed: number;
    total: number;
    creditsUsed: number;
    expiresAt: Date;
    next?: string;
    data: FirecrawlDocument<undefined>[];
}
/**
 * Response interface for batch scrape job status checks.
 * Provides detailed status of a batch scrape job including progress and results.
 */
interface BatchScrapeStatusResponse {
    success: true;
    status: "scraping" | "completed" | "failed" | "cancelled";
    completed: number;
    total: number;
    creditsUsed: number;
    expiresAt: Date;
    next?: string;
    data: FirecrawlDocument<undefined>[];
}
/**
 * Parameters for mapping operations.
 * Defines options for mapping URLs during a crawl.
 */
interface MapParams {
    search?: string;
    ignoreSitemap?: boolean;
    includeSubdomains?: boolean;
    sitemapOnly?: boolean;
    limit?: number;
    timeout?: number;
    useIndex?: boolean;
}
/**
 * Response interface for mapping operations.
 * Defines the structure of the response received after a mapping operation.
 */
interface MapResponse {
    success: true;
    links?: string[];
    error?: string;
}
/**
 * Parameters for extracting information from URLs.
 * Defines options for extracting information from URLs.
 */
interface AgentOptions {
    model?: string;
    prompt?: string;
    sessionId?: string;
}
/**
 * Parameters for extracting information from URLs.
 * Defines options for extracting information from URLs.
 */
interface AgentOptionsExtract {
    model?: string;
    sessionId?: string;
}
interface ExtractParams<LLMSchema extends zt.ZodSchema = any> {
    prompt?: string;
    schema?: LLMSchema | object;
    systemPrompt?: string;
    allowExternalLinks?: boolean;
    enableWebSearch?: boolean;
    includeSubdomains?: boolean;
    origin?: string;
    showSources?: boolean;
    scrapeOptions?: CrawlScrapeOptions;
    agent?: AgentOptionsExtract;
}
/**
 * Response interface for extracting information from URLs.
 * Defines the structure of the response received after extracting information from URLs.
 */
interface ExtractResponse<LLMSchema extends zt.ZodSchema = any> {
    success: boolean;
    data: LLMSchema;
    error?: string;
    warning?: string;
    sources?: string[];
}
/**
 * Error response interface.
 * Defines the structure of the response received when an error occurs.
 */
interface ErrorResponse {
    success: false;
    error: string;
}
/**
 * Custom error class for Firecrawl.
 * Extends the built-in Error class to include a status code.
 */
declare class FirecrawlError extends Error {
    statusCode: number;
    details?: any;
    constructor(message: string, statusCode: number, details?: any);
}
/**
 * Parameters for search operations.
 * Defines options for searching and scraping search results.
 */
interface SearchParams {
    limit?: number;
    tbs?: string;
    filter?: string;
    lang?: string;
    country?: string;
    location?: string;
    origin?: string;
    timeout?: number;
    scrapeOptions?: ScrapeParams;
}
/**
 * Response interface for search operations.
 * Defines the structure of the response received after a search operation.
 */
interface SearchResponse {
    success: boolean;
    data: FirecrawlDocument<undefined>[];
    warning?: string;
    error?: string;
}
/**
 * Response interface for crawl/batch scrape error monitoring.
 */
interface CrawlErrorsResponse {
    /**
     * Scrapes that errored out + error details
     */
    errors: {
        id: string;
        timestamp?: string;
        url: string;
        error: string;
    }[];
    /**
     * URLs blocked by robots.txt
     */
    robotsBlocked: string[];
}
/**
 * Parameters for deep research operations.
 * Defines options for conducting deep research on a query.
 */
interface DeepResearchParams<LLMSchema extends zt.ZodSchema = any> {
    /**
     * Maximum depth of research iterations (1-10)
     * @default 7
     */
    maxDepth?: number;
    /**
     * Time limit in seconds (30-300)
     * @default 270
     */
    timeLimit?: number;
    /**
     * Maximum number of URLs to analyze (1-1000)
     * @default 20
     */
    maxUrls?: number;
    /**
     * The prompt to use for the final analysis
     */
    analysisPrompt?: string;
    /**
     * The system prompt to use for the research agent
     */
    systemPrompt?: string;
    /**
     * The formats to use for the final analysis
     */
    formats?: ("markdown" | "json")[];
    /**
     * The JSON options to use for the final analysis
     */
    jsonOptions?: {
        prompt?: string;
        schema?: LLMSchema;
        systemPrompt?: string;
    };
}
/**
 * Response interface for deep research operations.
 */
interface DeepResearchResponse {
    success: boolean;
    id: string;
}
/**
 * Status response interface for deep research operations.
 */
interface DeepResearchStatusResponse {
    success: boolean;
    data: {
        finalAnalysis: string;
        activities: Array<{
            type: string;
            status: string;
            message: string;
            timestamp: string;
            depth: number;
        }>;
        sources: Array<{
            url: string;
            title: string;
            description: string;
        }>;
    };
    status: "processing" | "completed" | "failed";
    error?: string;
    expiresAt: string;
    currentDepth: number;
    maxDepth: number;
    activities: Array<{
        type: string;
        status: string;
        message: string;
        timestamp: string;
        depth: number;
    }>;
    sources: Array<{
        url: string;
        title: string;
        description: string;
    }>;
    summaries: string[];
}
/**
 * Parameters for LLMs.txt generation operations.
 */
interface GenerateLLMsTextParams {
    /**
     * Maximum number of URLs to process (1-100)
     * @default 10
     */
    maxUrls?: number;
    /**
     * Whether to show the full LLMs-full.txt in the response
     * @default false
     */
    showFullText?: boolean;
    /**
     * Whether to use cached content if available
     * @default true
     */
    cache?: boolean;
    /**
     * Experimental flag for streaming
     */
    __experimental_stream?: boolean;
}
/**
 * Response interface for LLMs.txt generation operations.
 */
interface GenerateLLMsTextResponse {
    success: boolean;
    id: string;
}
/**
 * Status response interface for LLMs.txt generation operations.
 */
interface GenerateLLMsTextStatusResponse {
    success: boolean;
    data: {
        llmstxt: string;
        llmsfulltxt?: string;
    };
    status: "processing" | "completed" | "failed";
    error?: string;
    expiresAt: string;
}
/**
 * Main class for interacting with the Firecrawl API.
 * Provides methods for scraping, searching, crawling, and mapping web content.
 */
declare class FirecrawlApp {
    apiKey: string;
    apiUrl: string;
    version: string;
    private isCloudService;
    private getVersion;
    private init;
    /**
     * Initializes a new instance of the FirecrawlApp class.
     * @param config - Configuration options for the FirecrawlApp instance.
     */
    constructor({ apiKey, apiUrl }: FirecrawlAppConfig);
    /**
     * Scrapes a URL using the Firecrawl API.
     * @param url - The URL to scrape.
     * @param params - Additional parameters for the scrape request.
     * @returns The response from the scrape operation.
     */
    scrapeUrl<T extends zt.ZodSchema, ActionsSchema extends (Action[] | undefined) = undefined>(url: string, params?: ScrapeParams<T, ActionsSchema>): Promise<ScrapeResponse<zt.infer<T>, ActionsSchema extends Action[] ? ActionsResult : never> | ErrorResponse>;
    /**
     * Searches using the Firecrawl API and optionally scrapes the results.
     * @param query - The search query string.
     * @param params - Optional parameters for the search request.
     * @returns The response from the search operation.
     */
    search(query: string, params?: SearchParams | Record<string, any>): Promise<SearchResponse>;
    /**
     * Initiates a crawl job for a URL using the Firecrawl API.
     * @param url - The URL to crawl.
     * @param params - Additional parameters for the crawl request.
     * @param pollInterval - Time in seconds for job status checks.
     * @param idempotencyKey - Optional idempotency key for the request.
     * @returns The response from the crawl operation.
     */
    crawlUrl(url: string, params?: CrawlParams, pollInterval?: number, idempotencyKey?: string): Promise<CrawlStatusResponse | ErrorResponse>;
    asyncCrawlUrl(url: string, params?: CrawlParams, idempotencyKey?: string): Promise<CrawlResponse | ErrorResponse>;
    /**
     * Checks the status of a crawl job using the Firecrawl API.
     * @param id - The ID of the crawl operation.
     * @param getAllData - Paginate through all the pages of documents, returning the full list of all documents. (default: `false`)
     * @param nextURL - The `next` URL from the previous crawl status. Only required if you're not manually increasing `skip`. Only used when `getAllData = false`.
     * @param skip - How many entries to skip to paginate. Only required if you're not providing `nextURL`. Only used when `getAllData = false`.
     * @param limit - How many entries to return. Only used when `getAllData = false`.
     * @returns The response containing the job status.
     */
    checkCrawlStatus(id?: string, getAllData?: boolean, nextURL?: string, skip?: number, limit?: number): Promise<CrawlStatusResponse | ErrorResponse>;
    /**
     * Returns information about crawl errors.
     * @param id - The ID of the crawl operation.
     * @returns Information about crawl errors.
     */
    checkCrawlErrors(id: string): Promise<CrawlErrorsResponse | ErrorResponse>;
    /**
     * Cancels a crawl job using the Firecrawl API.
     * @param id - The ID of the crawl operation.
     * @returns The response from the cancel crawl operation.
     */
    cancelCrawl(id: string): Promise<ErrorResponse>;
    /**
     * Initiates a crawl job and returns a CrawlWatcher to monitor the job via WebSocket.
     * @param url - The URL to crawl.
     * @param params - Additional parameters for the crawl request.
     * @param idempotencyKey - Optional idempotency key for the request.
     * @returns A CrawlWatcher instance to monitor the crawl job.
     */
    crawlUrlAndWatch(url: string, params?: CrawlParams, idempotencyKey?: string): Promise<CrawlWatcher>;
    /**
     * Maps a URL using the Firecrawl API.
     * @param url - The URL to map.
     * @param params - Additional parameters for the map request.
     * @returns The response from the map operation.
     */
    mapUrl(url: string, params?: MapParams): Promise<MapResponse | ErrorResponse>;
    /**
     * Initiates a batch scrape job for multiple URLs using the Firecrawl API.
     * @param url - The URLs to scrape.
     * @param params - Additional parameters for the scrape request.
     * @param pollInterval - Time in seconds for job status checks.
     * @param idempotencyKey - Optional idempotency key for the request.
     * @param webhook - Optional webhook for the batch scrape.
     * @param ignoreInvalidURLs - Optional flag to ignore invalid URLs.
     * @returns The response from the crawl operation.
     */
    batchScrapeUrls(urls: string[], params?: ScrapeParams, pollInterval?: number, idempotencyKey?: string, webhook?: CrawlParams["webhook"], ignoreInvalidURLs?: boolean, maxConcurrency?: number): Promise<BatchScrapeStatusResponse | ErrorResponse>;
    asyncBatchScrapeUrls(urls: string[], params?: ScrapeParams, idempotencyKey?: string, webhook?: CrawlParams["webhook"], ignoreInvalidURLs?: boolean): Promise<BatchScrapeResponse | ErrorResponse>;
    /**
     * Initiates a batch scrape job and returns a CrawlWatcher to monitor the job via WebSocket.
     * @param urls - The URL to scrape.
     * @param params - Additional parameters for the scrape request.
     * @param idempotencyKey - Optional idempotency key for the request.
     * @returns A CrawlWatcher instance to monitor the crawl job.
     */
    batchScrapeUrlsAndWatch(urls: string[], params?: ScrapeParams, idempotencyKey?: string, webhook?: CrawlParams["webhook"], ignoreInvalidURLs?: boolean): Promise<CrawlWatcher>;
    /**
     * Checks the status of a batch scrape job using the Firecrawl API.
     * @param id - The ID of the batch scrape operation.
     * @param getAllData - Paginate through all the pages of documents, returning the full list of all documents. (default: `false`)
     * @param nextURL - The `next` URL from the previous batch scrape status. Only required if you're not manually increasing `skip`. Only used when `getAllData = false`.
     * @param skip - How many entries to skip to paginate. Only used when `getAllData = false`.
     * @param limit - How many entries to return. Only used when `getAllData = false`.
     * @returns The response containing the job status.
     */
    checkBatchScrapeStatus(id?: string, getAllData?: boolean, nextURL?: string, skip?: number, limit?: number): Promise<BatchScrapeStatusResponse | ErrorResponse>;
    /**
     * Returns information about batch scrape errors.
     * @param id - The ID of the batch scrape operation.
     * @returns Information about batch scrape errors.
     */
    checkBatchScrapeErrors(id: string): Promise<CrawlErrorsResponse | ErrorResponse>;
    /**
     * Extracts information from URLs using the Firecrawl API.
     * Currently in Beta. Expect breaking changes on future minor versions.
     * @param urls - The URLs to extract information from. Optional if using other methods for data extraction.
     * @param params - Additional parameters for the extract request.
     * @returns The response from the extract operation.
     */
    extract<T extends zt.ZodSchema = any>(urls?: string[], params?: ExtractParams<T>): Promise<ExtractResponse<zt.infer<T>> | ErrorResponse>;
    /**
     * Initiates an asynchronous extract job for a URL using the Firecrawl API.
     * @param url - The URL to extract data from.
     * @param params - Additional parameters for the extract request.
     * @param idempotencyKey - Optional idempotency key for the request.
     * @returns The response from the extract operation.
     */
    asyncExtract(urls: string[], params?: ExtractParams, idempotencyKey?: string): Promise<ExtractResponse | ErrorResponse>;
    /**
     * Retrieves the status of an extract job.
     * @param jobId - The ID of the extract job.
     * @returns The status of the extract job.
     */
    getExtractStatus(jobId: string): Promise<any>;
    /**
     * Prepares the headers for an API request.
     * @param idempotencyKey - Optional key to ensure idempotency.
     * @returns The prepared headers.
     */
    prepareHeaders(idempotencyKey?: string): AxiosRequestHeaders;
    /**
     * Sends a POST request to the specified URL.
     * @param url - The URL to send the request to.
     * @param data - The data to send in the request.
     * @param headers - The headers for the request.
     * @returns The response from the POST request.
     */
    postRequest(url: string, data: any, headers: AxiosRequestHeaders): Promise<AxiosResponse>;
    /**
     * Sends a GET request to the specified URL.
     * @param url - The URL to send the request to.
     * @param headers - The headers for the request.
     * @returns The response from the GET request.
     */
    getRequest(url: string, headers: AxiosRequestHeaders): Promise<AxiosResponse>;
    /**
     * Sends a DELETE request to the specified URL.
     * @param url - The URL to send the request to.
     * @param headers - The headers for the request.
     * @returns The response from the DELETE request.
     */
    deleteRequest(url: string, headers: AxiosRequestHeaders): Promise<AxiosResponse>;
    /**
     * Monitors the status of a crawl job until completion or failure.
     * @param id - The ID of the crawl operation.
     * @param headers - The headers for the request.
     * @param checkInterval - Interval in seconds for job status checks.
     * @param checkUrl - Optional URL to check the status (used for v1 API)
     * @returns The final job status or data.
     */
    monitorJobStatus(id: string, headers: AxiosRequestHeaders, checkInterval: number): Promise<CrawlStatusResponse | ErrorResponse>;
    /**
     * Determines if an error is retryable (transient network error)
     * @param error - The error to check
     * @returns True if the error should be retried
     */
    private isRetryableError;
    /**
     * Handles errors from API responses.
     * @param {AxiosResponse} response - The response from the API.
     * @param {string} action - The action being performed when the error occurred.
     */
    handleError(response: AxiosResponse, action: string): void;
    /**
     * Initiates a deep research operation on a given query and polls until completion.
     * @param query - The query to research.
     * @param params - Parameters for the deep research operation.
     * @param onActivity - Optional callback to receive activity updates in real-time.
     * @param onSource - Optional callback to receive source updates in real-time.
     * @returns The final research results.
     */
    deepResearch(query: string, params: DeepResearchParams<zt.ZodSchema>, onActivity?: (activity: {
        type: string;
        status: string;
        message: string;
        timestamp: string;
        depth: number;
    }) => void, onSource?: (source: {
        url: string;
        title?: string;
        description?: string;
        icon?: string;
    }) => void): Promise<DeepResearchStatusResponse | ErrorResponse>;
    /**
     * Initiates a deep research operation on a given query without polling.
     * @param params - Parameters for the deep research operation.
     * @returns The response containing the research job ID.
     */
    asyncDeepResearch(query: string, params: DeepResearchParams<zt.ZodSchema>): Promise<DeepResearchResponse | ErrorResponse>;
    /**
     * Checks the status of a deep research operation.
     * @param id - The ID of the deep research operation.
     * @returns The current status and results of the research operation.
     */
    checkDeepResearchStatus(id: string): Promise<DeepResearchStatusResponse | ErrorResponse>;
    /**
     * @deprecated Use deepResearch() instead
     * Initiates a deep research operation on a given topic and polls until completion.
     * @param topic - The topic to research.
     * @param params - Parameters for the deep research operation.
     * @param onActivity - Optional callback to receive activity updates in real-time.
     * @returns The final research results.
     */
    __deepResearch(topic: string, params: DeepResearchParams, onActivity?: (activity: {
        type: string;
        status: string;
        message: string;
        timestamp: string;
        depth: number;
    }) => void): Promise<DeepResearchStatusResponse | ErrorResponse>;
    /**
     * @deprecated Use asyncDeepResearch() instead
     * Initiates a deep research operation on a given topic without polling.
     * @param params - Parameters for the deep research operation.
     * @returns The response containing the research job ID.
     */
    __asyncDeepResearch(topic: string, params: DeepResearchParams): Promise<DeepResearchResponse | ErrorResponse>;
    /**
     * @deprecated Use checkDeepResearchStatus() instead
     * Checks the status of a deep research operation.
     * @param id - The ID of the deep research operation.
     * @returns The current status and results of the research operation.
     */
    __checkDeepResearchStatus(id: string): Promise<DeepResearchStatusResponse | ErrorResponse>;
    /**
     * Generates LLMs.txt for a given URL and polls until completion.
     * @param url - The URL to generate LLMs.txt from.
     * @param params - Parameters for the LLMs.txt generation operation.
     * @returns The final generation results.
     */
    generateLLMsText(url: string, params?: GenerateLLMsTextParams): Promise<GenerateLLMsTextStatusResponse | ErrorResponse>;
    /**
     * Initiates a LLMs.txt generation operation without polling.
     * @param url - The URL to generate LLMs.txt from.
     * @param params - Parameters for the LLMs.txt generation operation.
     * @returns The response containing the generation job ID.
     */
    asyncGenerateLLMsText(url: string, params?: GenerateLLMsTextParams): Promise<GenerateLLMsTextResponse | ErrorResponse>;
    /**
     * Checks the status of a LLMs.txt generation operation.
     * @param id - The ID of the LLMs.txt generation operation.
     * @returns The current status and results of the generation operation.
     */
    checkGenerateLLMsTextStatus(id: string): Promise<GenerateLLMsTextStatusResponse | ErrorResponse>;
}
interface CrawlWatcherEvents {
    document: CustomEvent<FirecrawlDocument<undefined>>;
    done: CustomEvent<{
        status: CrawlStatusResponse["status"];
        data: FirecrawlDocument<undefined>[];
    }>;
    error: CustomEvent<{
        status: CrawlStatusResponse["status"];
        data: FirecrawlDocument<undefined>[];
        error: string;
    }>;
}
declare class CrawlWatcher extends TypedEventTarget<CrawlWatcherEvents> {
    private ws;
    data: FirecrawlDocument<undefined>[];
    status: CrawlStatusResponse["status"];
    id: string;
    constructor(id: string, app: FirecrawlApp);
    close(): void;
}

export { type Action, type ActionsResult, type AgentOptions, type AgentOptionsExtract, type BatchScrapeResponse, type BatchScrapeStatusResponse, type CrawlErrorsResponse, type CrawlParams, type CrawlResponse, type CrawlScrapeOptions, type CrawlStatusResponse, CrawlWatcher, type DeepResearchParams, type DeepResearchResponse, type DeepResearchStatusResponse, type ErrorResponse, type ExtractParams, type ExtractResponse, type FirecrawlAppConfig, type FirecrawlDocument, type FirecrawlDocumentMetadata, FirecrawlError, type GenerateLLMsTextParams, type GenerateLLMsTextResponse, type GenerateLLMsTextStatusResponse, type MapParams, type MapResponse, type ScrapeParams, type ScrapeResponse, type SearchParams, type SearchResponse, FirecrawlApp as default };
