export type StudioConfig = {
  baseUrl: string;
  headers: Record<string, string>;
  /** API route prefix. Defaults to '/api'. Set this to match your server's apiPrefix configuration. */
  apiPrefix?: string;
  /** Optional base URL for observability requests. When set, telemetry reads go to this URL instead of the main baseUrl. */
  telemetryBaseUrl?: string;
};
