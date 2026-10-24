import { describe, expect, it } from 'vitest';

import { KNOWLEDGE_ROUTES } from './knowledge';
import { getEffectivePermission } from './permissions';
import { ALL_SERVER_ROUTES, OPT_IN_ROUTES, SERVER_ROUTES } from '.';

describe('opt-in routes', () => {
  it('does not mount the Knowledge routes on every server', () => {
    const mountedPaths = new Set(SERVER_ROUTES.map(route => route.path));
    for (const path of ['/knowledge', '/knowledge/:knowledgeKey/graph', '/knowledge/:knowledgeKey/search']) {
      expect(mountedPaths.has(path)).toBe(false);
    }
    expect(OPT_IN_ROUTES).toContain(KNOWLEDGE_ROUTES[0]);
  });

  it('keeps the opt-in routes in the set generators derive from', () => {
    // Types, permissions and CLI metadata come from ALL_SERVER_ROUTES so an app that
    // registers an opt-in route still gets its permission and contract types.
    expect(ALL_SERVER_ROUTES.length).toBe(SERVER_ROUTES.length + OPT_IN_ROUTES.length);
    const allPaths = new Set(ALL_SERVER_ROUTES.map(route => route.path));
    expect(allPaths.has('/knowledge')).toBe(true);
    expect(allPaths.has('/knowledge/:knowledgeKey/nodes/:nodeId')).toBe(true);
  });

  it('still derives knowledge:read from the opt-in routes', () => {
    for (const route of KNOWLEDGE_ROUTES) {
      expect(getEffectivePermission(route)).toBe('knowledge:read');
    }
  });
});
