import { Scavio } from 'scavio';

export interface ScavioClientOptions {
  /** Scavio API key. Falls back to the `SCAVIO_API_KEY` environment variable. */
  apiKey?: string;
}

export type ScavioClient = Scavio;

export function getScavioClient(config?: ScavioClientOptions): ScavioClient {
  const apiKey = config?.apiKey ?? process.env.SCAVIO_API_KEY;
  if (!apiKey) {
    throw new Error('Scavio API key is required. Pass { apiKey } or set SCAVIO_API_KEY env var.');
  }
  return new Scavio({ apiKey });
}
