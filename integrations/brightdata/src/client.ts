import { bdclient } from '@brightdata/sdk';

export type BrightDataClientOptions = ConstructorParameters<typeof bdclient>[0];
export type BrightDataClient = bdclient;

export function getBrightDataClient(config?: BrightDataClientOptions): BrightDataClient {
  const apiKey = config?.apiKey ?? process.env.BRIGHTDATA_API_TOKEN;
  if (!apiKey) {
    throw new Error(
      'Bright Data API token is required. Pass { apiKey } or set BRIGHTDATA_API_TOKEN env var.',
    );
  }
  return new bdclient({ ...config, apiKey });
}

export async function closeClient(client: BrightDataClient): Promise<void> {
  const close = (client as { close?: () => Promise<void> | void }).close;
  if (typeof close === 'function') {
    try {
      await close.call(client);
    } catch {
      // best-effort cleanup; never mask the primary tool error from the finally block
    }
  }
}
