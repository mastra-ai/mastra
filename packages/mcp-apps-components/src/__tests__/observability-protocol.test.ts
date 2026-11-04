// The built package, as consumers install it.
import { OBSERVABILITY_APP_TOOLS } from '@mastra/mcp-apps-components/observability-protocol';
import { SERVER_ROUTES } from '@mastra/server/server-adapter';
import { describe, expect, it } from 'vitest';

describe('OBSERVABILITY_APP_TOOLS', () => {
  describe('when a server defines a tool for each entry', () => {
    it('finds a Mastra JSON route for every method and path, so the contract cannot drift from the server', () => {
      const routes = Object.values(OBSERVABILITY_APP_TOOLS).map(({ method, path }) => {
        const route = SERVER_ROUTES.find(candidate => candidate.method === method && candidate.path === path);
        return { method, path, responseType: route?.responseType };
      });

      expect(routes).toEqual(
        Object.values(OBSERVABILITY_APP_TOOLS).map(({ method, path }) => ({ method, path, responseType: 'json' })),
      );
    });
  });
});
