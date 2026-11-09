import { describe, expect, it } from 'vitest';

import { KNOWLEDGE_ROUTES } from './knowledge';
import { getEffectivePermission } from './permissions';
import { ALL_SERVER_ROUTES, OPT_IN_ROUTES, SERVER_ROUTES, getAllServerRoutes, getServerRoutes } from '.';

describe('opt-in routes', () => {
  it('does not mount the Knowledge routes on every server', () => {
    const mountedPaths = new Set(SERVER_ROUTES.map(route => route.path));
    for (const path of [
      '/knowledge',
      '/knowledge/:knowledgeKey/graph',
      '/knowledge/:knowledgeKey/search',
      '/knowledge/:knowledgeKey/tree',
    ]) {
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
    expect(allPaths.has('/knowledge/:knowledgeKey/pages/:pageId')).toBe(true);
  });

  it('hides Computer routes unless the experimental flag is exactly true', () => {
    const previous = process.env.MASTRA_EXPERIMENTAL_COMPUTER;
    try {
      for (const value of [undefined, 'false', '1']) {
        if (value === undefined) delete process.env.MASTRA_EXPERIMENTAL_COMPUTER;
        else process.env.MASTRA_EXPERIMENTAL_COMPUTER = value;

        expect(getServerRoutes().some(route => route.path.startsWith('/computers/'))).toBe(false);
        expect(getAllServerRoutes().some(route => route.path.startsWith('/computers/'))).toBe(false);
      }

      process.env.MASTRA_EXPERIMENTAL_COMPUTER = 'true';
      expect(getServerRoutes().filter(route => route.path.startsWith('/computers/'))).toHaveLength(3);
      expect(getAllServerRoutes().filter(route => route.path.startsWith('/computers/'))).toHaveLength(3);
    } finally {
      if (previous === undefined) delete process.env.MASTRA_EXPERIMENTAL_COMPUTER;
      else process.env.MASTRA_EXPERIMENTAL_COMPUTER = previous;
    }
  });

  it('still derives knowledge:read from the opt-in routes', () => {
    for (const route of KNOWLEDGE_ROUTES) {
      expect(getEffectivePermission(route)).toBe('knowledge:read');
    }
  });
});
