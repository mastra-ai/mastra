export type StudioConfig = {
  baseUrl: string;
  headers: Record<string, string>;
  /** API route prefix. Defaults to '/api'. Set this to match your server's prefix configuration. */
  prefix?: string;
};
