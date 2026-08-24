import { render, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { RouteHeaderCrumbs, RouteHeaderCrumbsProvider } from '../route-header-crumbs';
import { useRouteHeaderCrumbsOverride, useRouteHeaderCrumbsSetter } from '../route-header-crumbs-context';
import type { CrumbDef } from '../types';

const crumbs: CrumbDef[] = [{ label: 'Agents', to: '/agents' }];

const withProvider = ({ children }: { children: ReactNode }) => (
  <RouteHeaderCrumbsProvider>{children}</RouteHeaderCrumbsProvider>
);

describe('route header crumbs context', () => {
  describe('when no provider is mounted above the hook', () => {
    it('reports no override', () => {
      const { result } = renderHook(() => useRouteHeaderCrumbsOverride());

      expect(result.current).toBeNull();
    });

    it('hands back no setter instead of throwing', () => {
      const { result } = renderHook(() => useRouteHeaderCrumbsSetter());

      expect(result.current).toBeUndefined();
    });

    it('lets a page mount RouteHeaderCrumbs as a no-op', () => {
      expect(() => render(<RouteHeaderCrumbs crumbs={crumbs} />)).not.toThrow();
    });
  });

  describe('when a provider is mounted above the hook', () => {
    it('starts with no override', () => {
      const { result } = renderHook(() => useRouteHeaderCrumbsOverride(), { wrapper: withProvider });

      expect(result.current).toBeNull();
    });

    it('hands back the setter', () => {
      const { result } = renderHook(() => useRouteHeaderCrumbsSetter(), { wrapper: withProvider });

      expect(typeof result.current).toBe('function');
    });
  });

  describe('when a page renders RouteHeaderCrumbs inside the provider', () => {
    it('publishes the crumbs to readers and clears them on unmount', () => {
      const seen: Array<CrumbDef[] | null> = [];
      function Reader() {
        seen.push(useRouteHeaderCrumbsOverride());
        return null;
      }

      const view = render(
        <RouteHeaderCrumbsProvider>
          <RouteHeaderCrumbs crumbs={crumbs} />
          <Reader />
        </RouteHeaderCrumbsProvider>,
      );

      expect(seen.at(-1)).toEqual(crumbs);

      view.rerender(
        <RouteHeaderCrumbsProvider>
          <Reader />
        </RouteHeaderCrumbsProvider>,
      );

      expect(seen.at(-1)).toBeNull();
    });
  });
});
