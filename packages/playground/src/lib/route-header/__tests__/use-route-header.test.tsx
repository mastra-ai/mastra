import { render as renderComponent } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, Outlet } from 'react-router';
import type { RouteObject } from 'react-router';
import { describe, expect, it } from 'vitest';

import type { CrumbCtx, CrumbDef, DocsLink } from '../types';
import { useRouteHeader } from '../use-route-header';

/**
 * Renders the hook at the leaf of a two-level route tree so the walk over
 * parent and child handles is exercised the way the layout uses it.
 */
const render = (parentHandle: unknown, childHandle: unknown, path = '/agents/weather') => {
  let captured: ReturnType<typeof useRouteHeader> | undefined;

  const Leaf = () => {
    captured = useRouteHeader();
    return null;
  };

  const routes: RouteObject[] = [
    {
      path: '/agents',
      handle: parentHandle,
      element: <Outlet />,
      children: [{ path: ':agentId', handle: childHandle, element: <Leaf /> }],
    },
  ];

  const router = createMemoryRouter(routes, { initialEntries: [path] });
  renderComponent(<RouterProvider router={router} />);

  return () => captured!;
};

const agentsCrumb: CrumbDef = { id: 'agents', label: 'Agents' };
const agentCrumb: CrumbDef = { id: 'agent', label: 'Weather' };
const docs: DocsLink = { href: 'https://mastra.ai/docs/agents', label: 'Agents docs' };

describe('useRouteHeader', () => {
  describe('when both matches declare static crumbs', () => {
    it('collects parents before children', () => {
      const read = render({ crumbs: [agentsCrumb] }, { crumbs: [agentCrumb] });

      expect(read().crumbs.map(c => c.id)).toEqual(['agents', 'agent']);
    });
  });

  describe('when a handle declares crumbs as a function', () => {
    it('resolves it with the match params and pathname', () => {
      let seen: CrumbCtx | undefined;
      const read = render(
        { crumbs: [agentsCrumb] },
        {
          crumbs: (ctx: CrumbCtx) => {
            seen = ctx;
            return [{ id: 'agent', label: ctx.params.agentId ?? 'unknown' }];
          },
        },
      );

      expect(read().crumbs.map(c => 'label' in c && c.label)).toEqual(['Agents', 'weather']);
      expect(seen?.params).toEqual({ agentId: 'weather' });
      expect(seen?.pathname).toBe('/agents/weather');
    });

    it('skips a resolver that returns nothing', () => {
      const read = render({ crumbs: [agentsCrumb] }, { crumbs: () => undefined });

      expect(read().crumbs.map(c => c.id)).toEqual(['agents']);
    });

    it('skips a resolver that returns an empty list', () => {
      const read = render({ crumbs: [agentsCrumb] }, { crumbs: () => [] });

      expect(read().crumbs.map(c => c.id)).toEqual(['agents']);
    });
  });

  describe('when a match has no route handle at all', () => {
    it('keeps walking the rest of the tree', () => {
      const read = render(undefined, { crumbs: [agentCrumb] });

      expect(read().crumbs.map(c => c.id)).toEqual(['agent']);
    });
  });

  describe('docs links', () => {
    it('takes the deepest handle that declares one', () => {
      const read = render(
        { crumbs: [agentsCrumb], docs: { href: 'https://mastra.ai/docs', label: 'Studio docs' } },
        { crumbs: [agentCrumb], docs },
      );

      expect(read().docs).toEqual(docs);
    });

    it('resolves a docs function with the match context', () => {
      const read = render(
        { crumbs: [agentsCrumb] },
        {
          crumbs: [agentCrumb],
          docs: (ctx: CrumbCtx) => ({ href: `https://mastra.ai/docs/${ctx.params.agentId}`, label: 'Agent docs' }),
        },
      );

      expect(read().docs).toEqual({ href: 'https://mastra.ai/docs/weather', label: 'Agent docs' });
    });

    it('lets a deeper handle clear an inherited docs link', () => {
      const read = render({ crumbs: [agentsCrumb], docs }, { crumbs: [agentCrumb], docs: undefined });

      expect(read().docs).toBeUndefined();
    });

    it('keeps the parent docs link when the child never mentions docs', () => {
      const read = render({ crumbs: [agentsCrumb], docs }, { crumbs: [agentCrumb] });

      expect(read().docs).toEqual(docs);
    });

    it('reports no docs when nothing declares one', () => {
      const read = render({ crumbs: [agentsCrumb] }, { crumbs: [agentCrumb] });

      expect(read().docs).toBeUndefined();
    });
  });
});
