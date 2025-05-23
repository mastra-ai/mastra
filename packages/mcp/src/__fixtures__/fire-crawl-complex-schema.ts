#!/usr/bin/env node

import type { ToolsInput } from '@mastra/core/agent';
import FirecrawlApp from '@mendable/firecrawl-js';
import type { ScrapeParams, MapParams, CrawlParams, FirecrawlDocument } from '@mendable/firecrawl-js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { MCPServer } from '../server/server';

// Tool definitions
const SCRAPE_TOOL: Tool = {
  name: 'firecrawl_scrape',
  description:
    'Scrape a single webpage with advanced options for content extraction. ' +
    'Supports various formats including markdown, HTML, and screenshots. ' +
    'Can execute custom actions like clicking or scrolling before scraping.',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to scrape',
      },
      formats: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['markdown', 'html', 'rawHtml', 'screenshot', 'links', 'screenshot@fullPage', 'extract'],
        },
        default: ['markdown'],
        description: "Content formats to extract (default: ['markdown'])",
      },
      onlyMainContent: {
        type: 'boolean',
        description: 'Extract only the main content, filtering out navigation, footers, etc.',
      },
      includeTags: {
        type: 'array',
        items: { type: 'string' },
        description: 'HTML tags to specifically include in extraction',
      },
      excludeTags: {
        type: 'array',
        items: { type: 'string' },
        description: 'HTML tags to exclude from extraction',
      },
      waitFor: {
        type: 'number',
        description: 'Time in milliseconds to wait for dynamic content to load',
      },
      timeout: {
        type: 'number',
        description: 'Maximum time in milliseconds to wait for the page to load',
      },
      actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['wait', 'click', 'screenshot', 'write', 'press', 'scroll', 'scrape', 'executeJavascript'],
              description: 'Type of action to perform',
            },
            selector: {
              type: 'string',
              description: 'CSS selector for the target element',
            },
            milliseconds: {
              type: 'number',
              description: 'Time to wait in milliseconds (for wait action)',
            },
            text: {
              type: 'string',
              description: 'Text to write (for write action)',
            },
            key: {
              type: 'string',
              description: 'Key to press (for press action)',
            },
            direction: {
              type: 'string',
              enum: ['up', 'down'],
              description: 'Scroll direction',
            },
            script: {
              type: 'string',
              description: 'JavaScript code to execute',
            },
            fullPage: {
              type: 'boolean',
              description: 'Take full page screenshot',
            },
          },
          required: ['type'],
        },
        description: 'List of actions to perform before scraping',
      },
      extract: {
        type: 'object',
        properties: {
          schema: {
            type: 'object',
            description: 'Schema for structured data extraction',
          },
          systemPrompt: {
            type: 'string',
            description: 'System prompt for LLM extraction',
          },
          prompt: {
            type: 'string',
            description: 'User prompt for LLM extraction',
          },
        },
        description: 'Configuration for structured data extraction',
      },
      mobile: {
        type: 'boolean',
        description: 'Use mobile viewport',
      },
      skipTlsVerification: {
        type: 'boolean',
        description: 'Skip TLS certificate verification',
      },
      removeBase64Images: {
        type: 'boolean',
        description: 'Remove base64 encoded images from output',
      },
      location: {
        type: 'object',
        properties: {
          country: {
            type: 'string',
            description: 'Country code for geolocation',
          },
          languages: {
            type: 'array',
            items: { type: 'string' },
            description: 'Language codes for content',
          },
        },
        description: 'Location settings for scraping',
      },
    },
    required: ['url'],
  },
};

const MAP_TOOL: Tool = {
  name: 'firecrawl_map',
  description: 'Discover URLs from a starting point. Can use both sitemap.xml and HTML link discovery.',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'Starting URL for URL discovery',
      },
      search: {
        type: 'string',
        description: 'Optional search term to filter URLs',
      },
      ignoreSitemap: {
        type: 'boolean',
        description: 'Skip sitemap.xml discovery and only use HTML links',
      },
      sitemapOnly: {
        type: 'boolean',
        description: 'Only use sitemap.xml for discovery, ignore HTML links',
      },
      includeSubdomains: {
        type: 'boolean',
        description: 'Include URLs from subdomains in results',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of URLs to return',
      },
    },
    required: ['url'],
  },
};

const CRAWL_TOOL: Tool = {
  name: 'firecrawl_crawl',
  description:
    'Start an asynchronous crawl of multiple pages from a starting URL. ' +
    'Supports depth control, path filtering, and webhook notifications.',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'Starting URL for the crawl',
      },
      excludePaths: {
        type: 'array',
        items: { type: 'string' },
        description: 'URL paths to exclude from crawling',
      },
      includePaths: {
        type: 'array',
        items: { type: 'string' },
        description: 'Only crawl these URL paths',
      },
      maxDepth: {
        type: 'number',
        description: 'Maximum link depth to crawl',
      },
      ignoreSitemap: {
        type: 'boolean',
        description: 'Skip sitemap.xml discovery',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of pages to crawl',
      },
      allowBackwardLinks: {
        type: 'boolean',
        description: 'Allow crawling links that point to parent directories',
      },
      allowExternalLinks: {
        type: 'boolean',
        description: 'Allow crawling links to external domains',
      },
      webhook: {
        oneOf: [
          {
            type: 'string',
            description: 'Webhook URL to notify when crawl is complete',
          },
          {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'Webhook URL',
              },
              headers: {
                type: 'object',
                description: 'Custom headers for webhook requests',
              },
            },
            required: ['url'],
          },
        ],
      },
      deduplicateSimilarURLs: {
        type: 'boolean',
        description: 'Remove similar URLs during crawl',
      },
      ignoreQueryParameters: {
        type: 'boolean',
        description: 'Ignore query parameters when comparing URLs',
      },
      scrapeOptions: {
        type: 'object',
        properties: {
          formats: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['markdown', 'html', 'rawHtml', 'screenshot', 'links', 'screenshot@fullPage', 'extract'],
            },
          },
          onlyMainContent: {
            type: 'boolean',
          },
          includeTags: {
            type: 'array',
            items: { type: 'string' },
          },
          excludeTags: {
            type: 'array',
            items: { type: 'string' },
          },
          waitFor: {
            type: 'number',
          },
        },
        description: 'Options for scraping each page',
      },
    },
    required: ['url'],
  },
};

const CHECK_CRAWL_STATUS_TOOL: Tool = {
  name: 'firecrawl_check_crawl_status',
  description: 'Check the status of a crawl job.',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Crawl job ID to check',
      },
    },
    required: ['id'],
  },
};

const SEARCH_TOOL: Tool = {
  name: 'firecrawl_search',
  description:
    'Search and retrieve content from web pages with optional scraping. ' +
    'Returns SERP results by default (url, title, description) or full page content when scrapeOptions are provided.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query string',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 5)',
      },
      lang: {
        type: 'string',
        description: 'Language code for search results (default: en)',
      },
      country: {
        type: 'string',
        description: 'Country code for search results (default: us)',
      },
      tbs: {
        type: 'string',
        description: 'Time-based search filter',
      },
      filter: {
        type: 'string',
        description: 'Search filter',
      },
      location: {
        type: 'object',
        properties: {
          country: {
            type: 'string',
            description: 'Country code for geolocation',
          },
          languages: {
            type: 'array',
            items: { type: 'string' },
            description: 'Language codes for content',
          },
        },
        description: 'Location settings for search',
      },
      scrapeOptions: {
        type: 'object',
        properties: {
          formats: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['markdown', 'html', 'rawHtml'],
            },
            description: 'Content formats to extract from search results',
          },
          onlyMainContent: {
            type: 'boolean',
            description: 'Extract only the main content from results',
          },
          waitFor: {
            type: 'number',
            description: 'Time in milliseconds to wait for dynamic content',
          },
        },
        description: 'Options for scraping search results',
      },
    },
    required: ['query'],
  },
};

const EXTRACT_TOOL: Tool = {
  name: 'firecrawl_extract',
  description:
    'Extract structured information from web pages using LLM. ' +
    'Supports both cloud AI and self-hosted LLM extraction.',
  inputSchema: {
    type: 'object',
    properties: {
      urls: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of URLs to extract information from',
      },
      prompt: {
        type: 'string',
        description: 'Prompt for the LLM extraction',
      },
      systemPrompt: {
        type: 'string',
        description: 'System prompt for LLM extraction',
      },
      schema: {
        type: 'object',
        description: 'JSON schema for structured data extraction',
      },
      allowExternalLinks: {
        type: 'boolean',
        description: 'Allow extraction from external links',
      },
      enableWebSearch: {
        type: 'boolean',
        description: 'Enable web search for additional context',
      },
      includeSubdomains: {
        type: 'boolean',
        description: 'Include subdomains in extraction',
      },
    },
    required: ['urls'],
  },
};

const DEEP_RESEARCH_TOOL: Tool = {
  name: 'firecrawl_deep_research',
  description: 'Conduct deep research on a query using web crawling, search, and AI analysis.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The query to research',
      },
      maxDepth: {
        type: 'number',
        description: 'Maximum depth of research iterations (1-10)',
      },
      timeLimit: {
        type: 'number',
        description: 'Time limit in seconds (30-300)',
      },
      maxUrls: {
        type: 'number',
        description: 'Maximum number of URLs to analyze (1-1000)',
      },
    },
    required: ['query'],
  },
};

const GENERATE_LLMSTXT_TOOL: Tool = {
  name: 'firecrawl_generate_llmstxt',
  description:
    'Generate standardized LLMs.txt file for a given URL, which provides context about how LLMs should interact with the website.',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to generate LLMs.txt from',
      },
      maxUrls: {
        type: 'number',
        description: 'Maximum number of URLs to process (1-100, default: 10)',
      },
      showFullText: {
        type: 'boolean',
        description: 'Whether to show the full LLMs-full.txt in the response',
      },
    },
    required: ['url'],
  },
};

// --- Add back necessary interfaces and type guards ---
interface StatusCheckOptions {
  id: string;
}

interface SearchOptions {
  // Assuming this structure is still needed by isSearchOptions
  query: string;
  // ... other fields if required
}

interface ExtractParams<T = any> {
  // Rename to ExtractParams and add generic T
  urls: string[];
  prompt?: string;
  systemPrompt?: string;
  schema?: T | object; // Use generic T for schema
  allowExternalLinks?: boolean;
  enableWebSearch?: boolean;
  includeSubdomains?: boolean;
  origin?: string;
}

interface ExtractResponse<T = any> {
  success: boolean;
  data: T;
  error?: string;
  warning?: string;
  creditsUsed?: number;
}

interface GenerateLLMsTextParams {
  // Assuming this structure is still needed by isGenerateLLMsTextOptions
  maxUrls?: number;
  showFullText?: boolean;
  __experimental_stream?: boolean;
}

// Type guards
function isScrapeOptions(args: unknown): args is ScrapeParams & { url: string } {
  return (
    typeof args === 'object' && args !== null && 'url' in args && typeof (args as { url: unknown }).url === 'string'
  );
}

function isMapOptions(args: unknown): args is MapParams & { url: string } {
  return (
    typeof args === 'object' && args !== null && 'url' in args && typeof (args as { url: unknown }).url === 'string'
  );
}

function isCrawlOptions(args: unknown): args is CrawlParams & { url: string } {
  return (
    typeof args === 'object' && args !== null && 'url' in args && typeof (args as { url: unknown }).url === 'string'
  );
}

function isStatusCheckOptions(args: unknown): args is StatusCheckOptions {
  return typeof args === 'object' && args !== null && 'id' in args && typeof (args as { id: unknown }).id === 'string';
}

function isSearchOptions(args: unknown): args is SearchOptions {
  return (
    typeof args === 'object' &&
    args !== null &&
    'query' in args &&
    typeof (args as { query: unknown }).query === 'string'
  );
}

function isExtractOptions(args: unknown): args is ExtractParams {
  // Update type guard to use ExtractParams
  if (typeof args !== 'object' || args === null) return false;
  const { urls } = args as { urls?: unknown };
  return Array.isArray(urls) && urls.every((url): url is string => typeof url === 'string');
}

function isGenerateLLMsTextOptions(args: unknown): args is { url: string } & Partial<GenerateLLMsTextParams> {
  return (
    typeof args === 'object' && args !== null && 'url' in args && typeof (args as { url: unknown }).url === 'string'
  );
}
// --- End added back interfaces and type guards ---

// --- Add back necessary helper functions ---
const CONFIG = {
  // Simplified config, adjust if needed
  retry: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
  },
};

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let isStdioTransport = false; // Keep this global flag for safeLog

function safeLog(
  level: 'error' | 'debug' | 'info' | 'notice' | 'warning' | 'critical' | 'alert' | 'emergency',
  data: any,
): void {
  if (isStdioTransport) {
    console.error(`[${level}] ${typeof data === 'object' ? JSON.stringify(data) : data}`);
  } else {
    // Assuming our MCPServer instance has a compatible logging method
    // Or we might need to adapt this if logging isn't directly exposed/compatible
    // For now, just console.error as a fallback if not stdio
    console.error(`[${level}] ${typeof data === 'object' ? JSON.stringify(data) : data}`);
  }
}

async function withRetry<T>(operation: () => Promise<T>, context: string, attempt = 1): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const isRateLimit =
      error instanceof Error && (error.message.includes('rate limit') || error.message.includes('429'));

    if (isRateLimit && attempt < CONFIG.retry.maxAttempts) {
      const delayMs = Math.min(
        CONFIG.retry.initialDelay * Math.pow(CONFIG.retry.backoffFactor, attempt - 1),
        CONFIG.retry.maxDelay,
      );

      safeLog(
        'warning',
        `Rate limit hit for ${context}. Attempt ${attempt}/${CONFIG.retry.maxAttempts}. Retrying in ${delayMs}ms`,
      );

      await delay(delayMs);
      return withRetry(operation, context, attempt + 1);
    }

    throw error;
  }
}
// --- End added back helper functions ---

// Define the tool execution logic creator
const createExecuteFunction = (originalName: string) => async (args: any) => {
  const client = new FirecrawlApp({ apiKey: 'FIXTURE_API_KEY_PLACEHOLDER' });
  const startTime = Date.now();
  try {
    safeLog('info', `[${new Date().toISOString()}] Received request for tool: ${originalName}`);

    if (!args) {
      throw new Error('No arguments provided');
    }

    switch (originalName) {
      case 'firecrawl_scrape': {
        if (!isScrapeOptions(args)) {
          throw new Error('Invalid arguments for firecrawl_scrape');
        }
        const { url, ...options } = args;
        try {
          const scrapeStartTime = Date.now();
          safeLog('info', `Starting scrape for URL: ${url} with options: ${JSON.stringify(options)}`);

          const response = await client.scrapeUrl(url, {
            ...options,
          });

          safeLog('info', `Scrape completed in ${Date.now() - scrapeStartTime}ms`);

          if ('success' in response && !response.success) {
            throw new Error(response.error || 'Scraping failed');
          }

          const contentParts = [];

          if (options.formats?.includes('markdown') && response.markdown) {
            contentParts.push(response.markdown);
          }
          if (options.formats?.includes('html') && response.html) {
            contentParts.push(response.html);
          }
          if (options.formats?.includes('rawHtml') && response.rawHtml) {
            contentParts.push(response.rawHtml);
          }
          if (options.formats?.includes('links') && response.links) {
            contentParts.push(response.links.join('\n'));
          }
          if (options.formats?.includes('screenshot') && response.screenshot) {
            contentParts.push(response.screenshot);
          }
          if (options.formats?.includes('extract') && response.extract) {
            contentParts.push(JSON.stringify(response.extract, null, 2));
          }

          if (!options.formats || options.formats.length === 0) {
            options.formats = ['markdown'];
          }

          if (response.warning) {
            safeLog('warning', response.warning);
          }

          return {
            content: [
              {
                type: 'text',
                text: trimResponseText(contentParts.join('\n\n') || 'No content available'),
              },
            ],
            isError: false,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: 'text', text: trimResponseText(errorMessage) }],
            isError: true,
          };
        }
      }

      case 'firecrawl_map': {
        if (!isMapOptions(args)) {
          throw new Error('Invalid arguments for firecrawl_map');
        }
        const { url, ...options } = args;
        const response = await client.mapUrl(url, {
          ...options,
        });
        if ('error' in response) {
          throw new Error(response.error);
        }
        if (!response.links) {
          throw new Error('No links received from Firecrawl API');
        }
        return {
          content: [{ type: 'text', text: trimResponseText(response.links.join('\n')) }],
          isError: false,
        };
      }

      case 'firecrawl_crawl': {
        if (!isCrawlOptions(args)) {
          throw new Error('Invalid arguments for firecrawl_crawl');
        }
        const { url, ...options } = args;
        const response = await withRetry(async () => client.asyncCrawlUrl(url, { ...options }), 'crawl operation');

        if (!response.success) {
          throw new Error(response.error);
        }

        return {
          content: [
            {
              type: 'text',
              text: trimResponseText(`Started crawl for ${url} with job ID: ${response.id}`),
            },
          ],
          isError: false,
        };
      }

      case 'firecrawl_check_crawl_status': {
        if (!isStatusCheckOptions(args)) {
          throw new Error('Invalid arguments for firecrawl_check_crawl_status');
        }
        const response = await client.checkCrawlStatus(args.id);
        if (!response.success) {
          throw new Error(response.error);
        }
        const status = `Crawl Status:
Status: ${response.status}
Progress: ${response.completed}/${response.total}
Credits Used: ${response.creditsUsed}
Expires At: ${response.expiresAt}
${response.data.length > 0 ? '\nResults:\n' + formatResults(response.data) : ''}`;
        return {
          content: [{ type: 'text', text: trimResponseText(status) }],
          isError: false,
        };
      }

      case 'firecrawl_search': {
        if (!isSearchOptions(args)) {
          throw new Error('Invalid arguments for firecrawl_search');
        }
        try {
          const response = await withRetry(async () => client.search(args.query, { ...args }), 'search operation');

          if (!response.success) {
            throw new Error(`Search failed: ${response.error || 'Unknown error'}`);
          }

          const results = response.data
            .map(
              result =>
                `URL: ${result.url}
Title: ${result.title || 'No title'}
Description: ${result.description || 'No description'}
${result.markdown ? `\nContent:\n${result.markdown}` : ''}`,
            )
            .join('\n\n');

          return {
            content: [{ type: 'text', text: trimResponseText(results) }],
            isError: false,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : `Search failed: ${JSON.stringify(error)}`;
          return {
            content: [{ type: 'text', text: trimResponseText(errorMessage) }],
            isError: true,
          };
        }
      }

      case 'firecrawl_extract': {
        if (!isExtractOptions(args)) {
          throw new Error('Invalid arguments for firecrawl_extract');
        }

        try {
          const extractStartTime = Date.now();

          safeLog('info', `Starting extraction for URLs: ${args.urls.join(', ')}`);

          const extractResponse = await withRetry(
            async () =>
              client.extract(args.urls, {
                prompt: args.prompt,
                systemPrompt: args.systemPrompt,
                schema: args.schema,
                allowExternalLinks: args.allowExternalLinks,
                enableWebSearch: args.enableWebSearch,
                includeSubdomains: args.includeSubdomains,
              } as ExtractParams),
            'extract operation',
          );

          if (!('success' in extractResponse) || !extractResponse.success) {
            throw new Error(extractResponse.error || 'Extraction failed');
          }

          const response = extractResponse as ExtractResponse;

          safeLog('info', `Extraction completed in ${Date.now() - extractStartTime}ms`);

          const result = {
            content: [
              {
                type: 'text',
                text: trimResponseText(JSON.stringify(response.data, null, 2)),
              },
            ],
            isError: false,
          };

          if (response.warning) {
            safeLog('warning', response.warning);
          }

          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          return {
            content: [{ type: 'text', text: trimResponseText(errorMessage) }],
            isError: true,
          };
        }
      }

      case 'firecrawl_deep_research': {
        if (!args || typeof args !== 'object' || !('query' in args)) {
          throw new Error('Invalid arguments for firecrawl_deep_research');
        }

        try {
          const researchStartTime = Date.now();
          safeLog('info', `Starting deep research for query: ${args.query}`);

          const response = await client.deepResearch(
            args.query as string,
            {
              maxDepth: args.maxDepth as number,
              timeLimit: args.timeLimit as number,
              maxUrls: args.maxUrls as number,
            },
            activity => {
              safeLog('info', `Research activity: ${activity.message} (Depth: ${activity.depth})`);
            },
            source => {
              safeLog('info', `Research source found: ${source.url}${source.title ? ` - ${source.title}` : ''}`);
            },
          );

          safeLog('info', `Deep research completed in ${Date.now() - researchStartTime}ms`);

          if (!response.success) {
            throw new Error(response.error || 'Deep research failed');
          }

          const formattedResponse = {
            finalAnalysis: response.data.finalAnalysis,
            activities: response.data.activities,
            sources: response.data.sources,
          };

          return {
            content: [
              {
                type: 'text',
                text: trimResponseText(formattedResponse.finalAnalysis),
              },
            ],
            isError: false,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: 'text', text: trimResponseText(errorMessage) }],
            isError: true,
          };
        }
      }

      case 'firecrawl_generate_llmstxt': {
        if (!isGenerateLLMsTextOptions(args)) {
          throw new Error('Invalid arguments for firecrawl_generate_llmstxt');
        }

        try {
          const { url, ...params } = args;
          const generateStartTime = Date.now();

          safeLog('info', `Starting LLMs.txt generation for URL: ${url}`);

          const response = await withRetry(
            async () => client.generateLLMsText(url, { ...params }),
            'LLMs.txt generation',
          );

          if (!response.success) {
            throw new Error(response.error || 'LLMs.txt generation failed');
          }

          safeLog('info', `LLMs.txt generation completed in ${Date.now() - generateStartTime}ms`);

          let resultText = '';

          if ('data' in response) {
            resultText = `LLMs.txt content:\n\n${response.data.llmstxt}`;

            if (args.showFullText && response.data.llmsfulltxt) {
              resultText += `\n\nLLMs-full.txt content:\n\n${response.data.llmsfulltxt}`;
            }
          }

          return {
            content: [{ type: 'text', text: trimResponseText(resultText) }],
            isError: false,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: 'text', text: trimResponseText(errorMessage) }],
            isError: true,
          };
        }
      }

      default:
        return {
          content: [{ type: 'text', text: trimResponseText(`Unknown tool: ${originalName}`) }],
          isError: true,
        };
    }
  } catch (error) {
    safeLog('error', {
      message: `Request failed: ${error instanceof Error ? error.message : String(error)}`,
      tool: originalName,
      arguments: args,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
    });
    return {
      content: [
        {
          type: 'text',
          text: trimResponseText(`Error: ${error instanceof Error ? error.message : String(error)}`),
        },
      ],
      isError: true,
    };
  } finally {
    safeLog('info', `Request completed in ${Date.now() - startTime}ms`);
  }
};

// Create the tools object with execute functions attached
export const allTools: ToolsInput = {
  firecrawl_scrape: { ...SCRAPE_TOOL, execute: createExecuteFunction('firecrawl_scrape') } as any,
  firecrawl_map: { ...MAP_TOOL, execute: createExecuteFunction('firecrawl_map') } as any,
  firecrawl_crawl: { ...CRAWL_TOOL, execute: createExecuteFunction('firecrawl_crawl') } as any,
  firecrawl_check_crawl_status: {
    ...CHECK_CRAWL_STATUS_TOOL,
    execute: createExecuteFunction('firecrawl_check_crawl_status'),
  } as any,
  firecrawl_search: { ...SEARCH_TOOL, execute: createExecuteFunction('firecrawl_search') } as any,
  firecrawl_extract: { ...EXTRACT_TOOL, execute: createExecuteFunction('firecrawl_extract') } as any,
  firecrawl_deep_research: { ...DEEP_RESEARCH_TOOL, execute: createExecuteFunction('firecrawl_deep_research') } as any,
  firecrawl_generate_llmstxt: {
    ...GENERATE_LLMSTXT_TOOL,
    execute: createExecuteFunction('firecrawl_generate_llmstxt'),
  } as any,
};

export const mcpServerName = 'firecrawl-mcp-fixture';

const server = new MCPServer({
  name: mcpServerName,
  version: '1.7.0',
  tools: allTools, // Pass tools with execute functions already attached
});

function formatResults(data: FirecrawlDocument[]): string {
  return data
    .map(doc => {
      const content = doc.markdown || doc.html || doc.rawHtml || 'No content';
      return `URL: ${doc.url || 'Unknown URL'}
Content: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}
${doc.metadata?.title ? `Title: ${doc.metadata.title}` : ''}`;
    })
    .join('\n\n');
}

function trimResponseText(text: string): string {
  return text.trim();
}

server.startStdio().catch(error => {
  const errorMessage = 'Fatal error running server';
  console.error(errorMessage, error);
  process.exit(1);
});
