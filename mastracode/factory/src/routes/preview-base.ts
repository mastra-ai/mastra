/**
 * `GET /web/workspace/preview-base` — surface the pieces the SPA needs to
 * build sandbox-preview URLs. The parser + hostname math lives in
 * `preview.ts`; this route just hands the client the session-scoped slug
 * and whether preview subdomain routing is actually enabled on this deploy.
 *
 * The client can reconstruct the origin itself (`window.location.origin`),
 * so we don't repeat it here; we only tell it *what deploy it's on* enough
 * to know whether preview subdomains will resolve at all.
 */

import { registerApiRoute } from '@mastra/core/server';
import type { ApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import { resolveAuthorizedSession } from './editor.js';
import type { EditorSessionDeps } from './editor.js';
import { parentHostFromPublicUrl, sessionSlug } from './preview.js';

export interface PreviewBase {
  /** Preview subdomain routing is available on this deploy. */
  available: boolean;
  /** Deterministic session identifier embedded in preview hostnames. */
  slug: string;
  /**
   * The parent hostname preview URLs are minted under. When `available` is
   * false the client still gets the slug so it can render a
   * "preview unavailable" affordance without a second request round-trip.
   */
  parentHost?: string;
}

export interface PreviewBaseDeps extends EditorSessionDeps {
  /** Whether the Factory booted with `preview.enabled: true`. */
  previewEnabled: boolean;
  /** The Factory's publicUrl — used to derive the parent host clients build against. */
  publicUrl: string;
}

function errorStatus(message: string): 400 | 403 | 404 | 500 {
  if (message.includes('not available') || message.includes('current user')) return 403;
  if (message.includes('not found')) return 404;
  if (message.includes('required')) return 400;
  return 500;
}

export function resolvePreviewBase(session: SourceControlSession, deps: PreviewBaseDeps): PreviewBase {
  const slug = sessionSlug(session.sessionId);
  if (!deps.previewEnabled) return { available: false, slug };
  const parentHost = parentHostFromPublicUrl(deps.publicUrl);
  if (!parentHost) return { available: false, slug };
  return { available: true, slug, parentHost };
}

/** Register the `/web/workspace/preview-base` route. */
export function buildPreviewBaseRoutes(deps: PreviewBaseDeps): ApiRoute[] {
  const respond = async (c: Context, run: (session: SourceControlSession) => Promise<unknown>) => {
    const workspacePath = c.req.query('workspacePath');
    if (!workspacePath) return c.json({ error: 'Missing required query param: workspacePath' }, 400);
    try {
      const session = await resolveAuthorizedSession(c, deps, workspacePath);
      return c.json(await run(session));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: message }, errorStatus(message));
    }
  };

  return [
    registerApiRoute('/web/workspace/preview-base', {
      method: 'GET',
      requiresAuth: false,
      handler: c => respond(c, session => Promise.resolve(resolvePreviewBase(session, deps))),
    }),
  ];
}
