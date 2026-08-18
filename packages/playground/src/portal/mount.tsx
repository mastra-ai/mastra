import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StudioPortalShell } from './StudioPortalShell';
import { bundleDomains } from './routes';
import type {
  MountStudioArgs,
  StudioContext,
  StudioHandle,
  StudioManifest,
} from './context';
import './portal.css';

// Injected at build time via Vite `define`. Falls back to a dev sentinel so
// local builds don't crash if the define isn't set.
declare const __PORTAL_MASTRA_VERSION__: string;
const MASTRA_VERSION: string =
  typeof __PORTAL_MASTRA_VERSION__ !== 'undefined' ? __PORTAL_MASTRA_VERSION__ : '0.0.0-dev';

/**
 * Manifest of what this bundle can render. Platform reads this after loading
 * the bundle, intersects with its own allowlist, and passes the intersection
 * as `enabledDomains` to `mountStudio`. Domains missing from either side
 * stay dark.
 */
export const manifest: StudioManifest = {
  mastraVersion: MASTRA_VERSION,
  domains: bundleDomains,
};

/**
 * Portal entry point. Platform calls this once per (project, mastraVersion,
 * container) combination it wants to mount.
 *
 * Contract:
 *  - Platform owns the container element and its outer layout/sizing.
 *  - Portal owns everything inside it (its own sidebar, routing, layout).
 *  - `enabledDomains` gates which nav items and routes render. Only domains
 *    Platform has explicitly opted into (in code) light up.
 */
export function mountStudio({ container, ctx, enabledDomains }: MountStudioArgs): StudioHandle {
  if (!container) {
    throw new Error('mountStudio: missing container element');
  }

  const root: Root = createRoot(container);

  let apiRef: { navigate: (path: string) => void } | null = null;
  const onReady = (api: { navigate: (path: string) => void }) => {
    apiRef = api;
  };

  root.render(
    <StrictMode>
      <StudioPortalShell ctx={ctx} enabledDomains={enabledDomains} onReady={onReady} />
    </StrictMode>,
  );

  return {
    navigate(path: string) {
      apiRef?.navigate(path);
    },
    unmount() {
      root.unmount();
      container.replaceChildren();
    },
  };
}

/** Re-export types for host consumers. */
export type { StudioContext, StudioHandle, StudioManifest, MountStudioArgs };
