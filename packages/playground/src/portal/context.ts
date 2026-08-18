/**
 * StudioContext — the contract between a Platform host and a Studio portal
 * bundle.
 *
 * Platform passes one of these to `mountStudio({ container, ctx, enabledDomains })`.
 * The portal reads from it to configure its data client, auth, and theming;
 * it never assumes anything about how Platform is built.
 *
 * The seam is intentionally small: Studio's job is to render Mastra server
 * data; Platform's job is to say WHICH server, HOW to talk to it, WHERE in
 * the DOM to render, and WHICH domains it has opted into.
 */
export type StudioContext = {
  /** Base URL of the Mastra server this project runs on. */
  serverUrl: string;

  /** API prefix appended to `serverUrl`. Defaults to '/api'. */
  apiPrefix?: string;

  /**
   * Called before every HTTP request. Return the current auth headers.
   * Platform can rotate tokens transparently — the portal never caches them.
   */
  getAuthHeaders: () => Promise<Record<string, string>>;

  /**
   * Optional synchronous seed for auth headers, used by Studio hooks that
   * bypass MastraReactProvider's customFetch and call raw `fetch()` directly
   * (e.g. auth-capabilities probes on cold start). Should mirror what
   * `getAuthHeaders()` would return for the current session.
   */
  staticAuthHeaders?: Record<string, string>;

  /** Escape hatch. If provided, portal uses this fetch instead of global fetch. */
  fetch?: typeof fetch;

  /** Called when Studio detects an auth failure. */
  onAuthError?: (status: number) => void;

  /** Project the portal is rendering. */
  project: {
    id: string;
    slug: string;
    orgId?: string;
    displayName?: string;
  };

  /** Routing bridge. */
  initialPath?: string;
  onNavigate?: (path: string) => void;
  subscribePath?: (cb: (path: string) => void) => () => void;

  theme?: 'light' | 'dark';
  telemetry?: {
    track: (event: string, props?: Record<string, unknown>) => void;
  };
};

/**
 * Domain descriptors published by the bundle. Platform reads this to know
 * what CAN be enabled for a given mastraVersion. Platform's own allowlist
 * decides what actually IS enabled.
 *
 * When a new domain ships in a Studio version, it appears here; Platform
 * has to explicitly opt in via `enabledDomains[id] = true`. This forces a
 * reviewed code change per new capability rather than silent behavior drift.
 */
export type StudioDomain = {
  id: string;
  label: string;
  stability: 'stable' | 'beta' | 'experimental';
};

export type StudioManifest = {
  mastraVersion: string;
  domains: StudioDomain[];
};

export type MountStudioArgs = {
  /** Single DOM node the portal takes ownership of. Portal owns internal layout. */
  container: HTMLElement;
  ctx: StudioContext;
  /**
   * Platform's opt-in map. Only domains keyed `true` here AND present in
   * `manifest.domains` render. Domains missing from either side stay dark.
   */
  enabledDomains: Record<string, boolean>;
};

export type StudioHandle = {
  navigate: (path: string) => void;
  unmount: () => void;
};
