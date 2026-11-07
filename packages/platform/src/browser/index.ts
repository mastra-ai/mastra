import { StagehandBrowser } from '@mastra/stagehand';
import type { StagehandBrowserConfig } from '@mastra/stagehand';

export interface PlatformBrowserOptions extends Omit<
  StagehandBrowserConfig,
  'cdpUrl' | 'scope' | 'env' | 'apiKey' | 'projectId'
> {
  /** Existing Platform-provisioned CDP URL. When supplied, no API request or access token is needed. */
  cdpUrl?: string;
  /** Platform access token. Falls back to `MASTRA_PLATFORM_ACCESS_TOKEN`, then `MASTRA_PLATFORM_SECRET_KEY`. */
  accessToken?: string;
  /** Mastra Platform project ID. Falls back to `MASTRA_PROJECT_ID`. */
  projectId?: string;
  /** Browser provisioning API URL. Falls back to `MASTRA_BROWSER_API_URL`. */
  apiUrl?: string;
  fetch?: typeof fetch;
}

const DEFAULT_API_URL = 'https://platform.mastra.ai';

/** A Stagehand browser connected to a Platform-provisioned Browserbase session. */
export class PlatformBrowser extends StagehandBrowser {
  constructor(options: PlatformBrowserOptions = {}) {
    const {
      cdpUrl,
      accessToken = process.env.MASTRA_PLATFORM_ACCESS_TOKEN ?? process.env.MASTRA_PLATFORM_SECRET_KEY,
      projectId = process.env.MASTRA_PROJECT_ID,
      apiUrl = process.env.MASTRA_BROWSER_API_URL ?? DEFAULT_API_URL,
      fetch: fetchImpl = fetch,
      ...stagehandOptions
    } = options;
    if (!cdpUrl && !accessToken) throw new Error('PlatformBrowser: accessToken is required');
    if (!cdpUrl && !projectId) throw new Error('PlatformBrowser: projectId is required');

    super({
      ...stagehandOptions,
      scope: 'shared',
      cdpUrl:
        cdpUrl ||
        (async () => {
          const response = await fetchImpl(`${apiUrl.replace(/\/+$/, '')}/v1/browsers/sessions`, {
            method: 'POST',
            headers: {
              authorization: `Bearer ${accessToken}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({ projectId }),
            signal: AbortSignal.timeout(30_000),
          });
          if (!response.ok) throw new Error(`PlatformBrowser: browser provisioning failed (${response.status})`);
          const result: unknown = await response.json();
          if (
            !result ||
            typeof result !== 'object' ||
            !('connectUrl' in result) ||
            typeof result.connectUrl !== 'string'
          ) {
            throw new Error('PlatformBrowser: browser provisioning returned no connectUrl');
          }
          return result.connectUrl;
        }),
    });
  }
}
