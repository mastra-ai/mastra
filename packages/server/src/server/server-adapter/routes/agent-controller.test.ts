import { describe, expect, it } from 'vitest';

import { AGENT_CONTROLLER_ROUTES } from './agent-controller';
import { HARNESS_ROUTES } from './harness';
import { SERVER_ROUTES } from '.';

describe('agent-controller routes', () => {
  it('serves every route under /agent-controller with AgentController tags and agent-controller permissions', () => {
    expect(AGENT_CONTROLLER_ROUTES.length).toBeGreaterThan(0);
    for (const route of AGENT_CONTROLLER_ROUTES) {
      expect(route.path.startsWith('/agent-controller')).toBe(true);
      expect(route.openapi?.tags ?? []).not.toContain('Harness');
      const perms = Array.isArray(route.requiresPermission)
        ? route.requiresPermission
        : route.requiresPermission
          ? [route.requiresPermission]
          : [];
      for (const perm of perms) {
        if (typeof perm === 'string') {
          expect(perm.startsWith('harness:')).toBe(false);
        }
      }
    }
  });

  it('mirrors the canonical surface 1:1 onto the legacy /harness paths', () => {
    expect(HARNESS_ROUTES.length).toBe(AGENT_CONTROLLER_ROUTES.length);

    for (let i = 0; i < AGENT_CONTROLLER_ROUTES.length; i++) {
      const canonical = AGENT_CONTROLLER_ROUTES[i]!;
      const legacy = HARNESS_ROUTES[i]!;

      expect(legacy.method).toBe(canonical.method);
      expect(legacy.path).toBe(canonical.path.replace(/^\/agent-controller/, '/harness'));
      // Handler is shared verbatim, so both surfaces resolve through the same accessor.
      expect(legacy.handler).toBe(canonical.handler);
      expect(legacy.openapi?.tags ?? []).not.toContain('AgentController');
    }
  });

  it('legacy harness routes keep harness-flavored permissions', () => {
    for (const route of HARNESS_ROUTES) {
      const perms = Array.isArray(route.requiresPermission)
        ? route.requiresPermission
        : route.requiresPermission
          ? [route.requiresPermission]
          : [];
      for (const perm of perms) {
        if (typeof perm === 'string') {
          expect(perm.startsWith('agent-controller:')).toBe(false);
        }
      }
    }
  });

  it('registers both surfaces in SERVER_ROUTES', () => {
    const paths = new Set(SERVER_ROUTES.map(r => r.path));
    expect(paths.has('/agent-controller')).toBe(true);
    expect(paths.has('/harness')).toBe(true);
  });
});
