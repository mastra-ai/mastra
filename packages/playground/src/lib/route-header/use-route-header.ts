import { useMemo } from 'react';
import { useMatches } from 'react-router';
import type { CrumbDef, RouteHeaderHandle } from './types';

export interface RouteHeaderData {
  crumbs: CrumbDef[];
}

/**
 * Walks the matched route tree and collects `handle.crumbs` from each match.
 * Parent crumbs come first; children append.
 */
export function useRouteHeader(): RouteHeaderData {
  const matches = useMatches();

  return useMemo(() => {
    const crumbs: CrumbDef[] = [];

    for (const m of matches) {
      const handle = m.handle as RouteHeaderHandle | undefined;
      if (!handle?.crumbs) continue;
      const ctx = { params: m.params, pathname: m.pathname };

      const resolved = typeof handle.crumbs === 'function' ? handle.crumbs(ctx) : handle.crumbs;
      if (resolved?.length) crumbs.push(...resolved);
    }

    return { crumbs };
  }, [matches]);
}
