import { matchRoutes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { routes } from './App';

describe('agent editor routes', () => {
  describe('when opening a legacy CMS editor URL', () => {
    it.each([
      '/cms/agents/create',
      '/cms/agents/create/memory',
      '/cms/agents/agent-1/edit',
      '/cms/agents/agent-1/edit/tools',
    ])('does not resolve %s', path => {
      expect(matchRoutes(routes, path)).toBeNull();
    });
  });

  describe('when opening Agent Builder', () => {
    it.each(['/agent-builder/agents/create', '/agent-builder/agents/agent-1/edit'])('resolves %s', path => {
      expect(matchRoutes(routes, path)).not.toBeNull();
    });
  });
});
