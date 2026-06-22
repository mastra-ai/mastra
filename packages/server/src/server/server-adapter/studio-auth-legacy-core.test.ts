/**
 * @license Mastra Enterprise License - see ee/LICENSE
 */
import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { describe, it, expect, vi } from 'vitest';
import { MASTRA_AUTH_MODE_KEY, MASTRA_CLIENT_TYPE_HEADER, MASTRA_STUDIO_CLIENT_TYPE } from '../constants';
import { MastraServer } from './index';

/**
 * Regression guard for the deployed-Studio 500 caused by a version skew between
 * a bundled `@mastra/server` and an older `@mastra/core`.
 *
 * `mastra build` can resolve a newer `@mastra/server` than the project's pinned
 * `@mastra/core`. The `Mastra` class only gained `getStudio()` in 1.42, so a
 * legacy core (e.g. 1.37.1) has no such method. At request-auth time the server
 * resolves the studio auth/RBAC/FGA config off `mastra.getStudio()`. If those
 * call sites are not optional (`getStudio?.()`), `getStudio` is `undefined` on
 * the legacy core and the call itself throws
 * `TypeError: this.mastra.getStudio is not a function` — note the trailing
 * `?.auth`/`?.rbac` does NOT help, because it guards the *result*, not the
 * *call*. Every request then returns 500.
 *
 * These tests pin the optional-call contract: with a legacy core that predates
 * `getStudio()`, studio-routed auth resolution must degrade to the server
 * fallback instead of throwing.
 */

// Exposes the protected auth-resolution methods that read `mastra.getStudio()`.
class TestMastraServer extends MastraServer<any, any, any> {
  stream = vi.fn();
  getParams = vi.fn();
  sendResponse = vi.fn();
  registerRoute = vi.fn();
  registerContextMiddleware = vi.fn();
  registerAuthMiddleware = vi.fn();
  registerHttpLoggingMiddleware = vi.fn();

  effectiveAuthConfig(getHeader: (name: string) => string | undefined) {
    return this.getEffectiveAuthConfig(getHeader);
  }

  effectiveRBACProvider(requestContext: RequestContext) {
    return this.getEffectiveRBACProvider(requestContext);
  }

  effectiveFGAProvider(requestContext: RequestContext) {
    return this.getEffectiveFGAProvider(requestContext);
  }
}

// A `Mastra` stand-in matching `@mastra/core` <= 1.41: deliberately NO `getStudio`.
function createLegacyCoreMastra(server?: { auth?: unknown; rbac?: unknown; fga?: unknown }) {
  return {
    getServer: () => server,
    setMastraServer: vi.fn(),
  } as unknown as Mastra;
}

function studioRequestContext() {
  const requestContext = new RequestContext();
  requestContext.set(MASTRA_AUTH_MODE_KEY, 'studio');
  return requestContext;
}

// A `getHeader` that routes the request as a Studio request.
const studioHeader = (name: string) => (name === MASTRA_CLIENT_TYPE_HEADER ? MASTRA_STUDIO_CLIENT_TYPE : undefined);

describe('Studio auth resolution against a legacy @mastra/core (no getStudio)', () => {
  it('legacy core stand-in really lacks getStudio (matches the broken combo)', () => {
    const legacy = createLegacyCoreMastra() as unknown as { getStudio?: unknown };
    expect(legacy.getStudio).toBeUndefined();
  });

  it('getEffectiveAuthConfig does not throw and returns null when no auth is configured', () => {
    const adapter = new TestMastraServer({ app: {}, mastra: createLegacyCoreMastra() });

    let result: ReturnType<TestMastraServer['effectiveAuthConfig']>;
    expect(() => {
      result = adapter.effectiveAuthConfig(studioHeader);
    }).not.toThrow();
    expect(result!).toBeNull();
  });

  it('getEffectiveAuthConfig falls back to server auth for a Studio request', () => {
    const serverAuth = { kind: 'server-auth' };
    const adapter = new TestMastraServer({ app: {}, mastra: createLegacyCoreMastra({ auth: serverAuth }) });

    const result = adapter.effectiveAuthConfig(studioHeader);

    expect(result).toEqual({ authConfig: serverAuth, authMode: 'server' });
  });

  it('getEffectiveRBACProvider does not throw and falls back to the server RBAC provider', () => {
    const serverRbac = { kind: 'server-rbac' };
    const adapter = new TestMastraServer({ app: {}, mastra: createLegacyCoreMastra({ rbac: serverRbac }) });

    let result: unknown;
    expect(() => {
      result = adapter.effectiveRBACProvider(studioRequestContext());
    }).not.toThrow();
    expect(result).toBe(serverRbac);
  });

  it('getEffectiveFGAProvider does not throw and falls back to the server FGA provider', () => {
    const serverFga = { kind: 'server-fga' };
    const adapter = new TestMastraServer({ app: {}, mastra: createLegacyCoreMastra({ fga: serverFga }) });

    let result: unknown;
    expect(() => {
      result = adapter.effectiveFGAProvider(studioRequestContext());
    }).not.toThrow();
    expect(result).toBe(serverFga);
  });
});
