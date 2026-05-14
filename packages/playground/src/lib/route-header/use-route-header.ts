import { useMemo } from 'react';
import { useMatches } from 'react-router';
import type { CrumbDef, DocsLink, RouteHeaderHandle } from './types';

export interface RouteHeaderData {
  crumbs: CrumbDef[];
  docs?: DocsLink;
}

/**
 * Walks the matched route tree and collects `handle.crumbs` from each match.
 * Parent crumbs come first; children append. Returns the deepest `handle.docs`.
 */
export function useRouteHeader(): RouteHeaderData {
  const matches = useMatches();

  return useMemo(() => {
    const crumbs: CrumbDef[] = [];
    let docs: DocsLink | undefined;

    for (const m of matches) {
      const handle = m.handle as RouteHeaderHandle | undefined;
      if (!handle) continue;
      const ctx = { params: m.params, pathname: m.pathname };

      if (handle.crumbs) {
        const resolved = typeof handle.crumbs === 'function' ? handle.crumbs(ctx) : handle.crumbs;
        if (resolved?.length) crumbs.push(...resolved);
      }

      if ('docs' in handle) {
        docs = typeof handle.docs === 'function' ? handle.docs(ctx) : handle.docs;
      }
    }

    return { crumbs, docs };
  }, [matches]);
}
