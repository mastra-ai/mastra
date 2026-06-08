const REQUEST_ENDPOINT = 'https://api.brightdata.com/request';
const DEFAULT_SERP_ZONE = 'sdk_serp';
const DEFAULT_WEB_UNLOCKER_ZONE = 'sdk_unlocker';
const DEFAULT_TIMEOUT = 120_000;

type RequestFormat = 'raw' | 'json';
type DataFormat = 'html' | 'markdown' | 'screenshot';

export interface BrightDataClientOptions {
  [key: string]: unknown;
  apiKey?: string;
  timeout?: number;
  webUnlockerZone?: string;
  serpZone?: string;
}

interface RequestOptions {
  country?: string;
  dataFormat?: DataFormat;
  format?: RequestFormat;
  method?: string;
  timeout?: number;
  zone?: string;
}

interface SearchOptions extends RequestOptions {
  language?: string;
  start?: number;
}

interface BrightDataRequestBody {
  country?: string;
  data_format?: Exclude<DataFormat, 'html'>;
  format: RequestFormat;
  method: string;
  url: string;
  zone: string;
}

export interface BrightDataClient {
  search: {
    google: (query: string, options?: SearchOptions) => Promise<unknown>;
  };
  scrapeUrl: (url: string, options?: RequestOptions) => Promise<string>;
  close: () => Promise<void>;
}

async function requestBrightData(
  apiKey: string,
  body: BrightDataRequestBody,
  timeout = DEFAULT_TIMEOUT,
): Promise<unknown> {
  const effectiveTimeout = Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);

  try {
    const response = await fetch(REQUEST_ENDPOINT, {
      body: JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
      signal: controller.signal,
    });

    const responseText = await response.text();

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('invalid API key or insufficient permissions');
      }

      if (response.status === 400) {
        throw new Error(`bad request: ${responseText}`);
      }

      throw new Error(`request failed with status ${response.status}: ${responseText}`);
    }

    if (body.format === 'json') {
      return responseText ? JSON.parse(responseText) : {};
    }

    return responseText;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${effectiveTimeout}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildGoogleSearchUrl(query: string, options: SearchOptions = {}) {
  const url = new URL('https://www.google.com/search');
  url.searchParams.set('q', query.trim());
  if ((options.format ?? 'json') === 'json') {
    url.searchParams.set('brd_json', '1');
  }
  url.searchParams.set('hl', options.language ?? 'en');

  if (options.country) {
    url.searchParams.set('gl', options.country);
  }

  if (options.start !== undefined) {
    url.searchParams.set('start', String(options.start));
  }

  return url.toString();
}

function toRequestBody(url: string, zone: string, options: RequestOptions = {}): BrightDataRequestBody {
  const body: BrightDataRequestBody = {
    format: options.format ?? 'raw',
    method: options.method ?? 'GET',
    url,
    zone,
  };

  if (options.country) {
    body.country = options.country;
  }

  if (options.dataFormat && options.dataFormat !== 'html') {
    body.data_format = options.dataFormat;
  }

  return body;
}

export function getBrightDataClient(config?: BrightDataClientOptions): BrightDataClient {
  const apiKey = config?.apiKey ?? process.env.BRIGHTDATA_API_TOKEN;
  if (!apiKey) {
    throw new Error(
      'Bright Data API token is required. Pass { apiKey } or set BRIGHTDATA_API_TOKEN env var.',
    );
  }

  const timeout = config?.timeout;
  const serpZone = config?.serpZone ?? process.env.BRIGHTDATA_SERP_ZONE ?? DEFAULT_SERP_ZONE;
  const webUnlockerZone =
    config?.webUnlockerZone ?? process.env.BRIGHTDATA_WEB_UNLOCKER_ZONE ?? DEFAULT_WEB_UNLOCKER_ZONE;

  return {
    search: {
      google: async (query: string, options: SearchOptions = {}) => {
        if (options.language && !/^[a-z]{2}$/i.test(options.language)) {
          throw new Error('language must be a two-letter code (e.g. "en", "es")');
        }

        const normalizedOptions = options.language
          ? { ...options, language: options.language.toLowerCase() }
          : options;

        const url = buildGoogleSearchUrl(query, normalizedOptions);
        return requestBrightData(
          apiKey,
          toRequestBody(url, normalizedOptions.zone ?? serpZone, {
            ...normalizedOptions,
            format: normalizedOptions.format ?? 'json',
            method: 'GET',
          }),
          normalizedOptions.timeout ?? timeout,
        );
      },
    },
    scrapeUrl: async (url: string, options: RequestOptions = {}) => {
      const response = await requestBrightData(
        apiKey,
        toRequestBody(url, options.zone ?? webUnlockerZone, options),
        options.timeout ?? timeout,
      );

      return typeof response === 'string' ? response : JSON.stringify(response);
    },
    close: async () => {},
  };
}

export async function closeClient(client: BrightDataClient): Promise<void> {
  const close = client.close;
  try {
    await close.call(client);
  } catch {
    // best-effort cleanup; never mask the primary tool error from the finally block
  }
}
