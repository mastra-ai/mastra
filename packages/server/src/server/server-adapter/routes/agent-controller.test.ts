import { describe, expect, it } from 'vitest';

import { AGENT_CONTROLLER_ROUTES } from './agent-controller';
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

  it('does not register any legacy /harness routes', () => {
    const paths = new Set(SERVER_ROUTES.map(r => r.path));
    expect(paths.has('/agent-controller')).toBe(true);
    for (const path of paths) {
      expect(path.startsWith('/harness')).toBe(false);
    }
  });
});
