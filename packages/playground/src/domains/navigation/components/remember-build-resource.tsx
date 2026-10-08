import type { Query } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { z } from 'zod/v4';
import { useBuildHistoryScope } from '../hooks/use-build-history-scope';
import { useStudioNavigation } from '../hooks/use-studio-navigation';
import { buildResourceCatalog } from '../utils/build-resource-catalog';
import { getBuildResourceRoute, rememberBuildResource } from '../utils/build-resource-history';

const resourceIdentity = z.object({ name: z.string().optional(), id: z.string().optional() });
interface HistoryScope {
  key: string;
  allowCached: boolean;
  started: Set<string>;
  resolved: Set<string>;
}

/** Observe successful page reads without fetching another copy of every resource or its catalog. */
export function RememberBuildResource() {
  const { pathname, hash } = useLocation();
  const key = useBuildHistoryScope();
  const queryClient = useQueryClient();
  const scopeRef = useRef<HistoryScope>(undefined);
  const { sections } = useStudioNavigation();
  const route = getBuildResourceRoute(`${pathname}${hash}`);
  const kind = route?.kind;
  const id = route?.id;
  const path = route?.path;
  const allowed =
    kind && sections.some(section => section.items.some(item => item.url === buildResourceCatalog[kind].path));

  useEffect(() => {
    if (!key) return;
    if (scopeRef.current?.key !== key) {
      scopeRef.current = { key, allowCached: !scopeRef.current, started: new Set(), resolved: new Set() };
    }
    const scope = scopeRef.current;
    if (!allowed || !kind || !id || !path) return;
    const cache = queryClient.getQueryCache();
    const queryKey = [buildResourceCatalog[kind].queryKey, id];
    const canRead = (query: Query) => scope.allowCached || scope.resolved.has(query.queryHash);
    const remember = (query: Query) => {
      if (!canRead(query) || !query.isActive() || query.state.status !== 'success') return;
      const identity = resourceIdentity.safeParse(query.state.data);
      if (!identity.success) return;
      const name = identity.data.name || identity.data.id;
      if (name) rememberBuildResource(key, { kind, id, path, name });
    };
    // Several request contexts can share this resource identity. Prefer the page's active, newest read.
    const latest = cache
      .findAll({ queryKey })
      .filter(query => query.isActive() && canRead(query))
      .reduce<Query | undefined>(
        (latest, query) => (!latest || query.state.dataUpdatedAt > latest.state.dataUpdatedAt ? query : latest),
        undefined,
      );
    if (latest) remember(latest);
    return cache.subscribe(event => {
      const query = event.query;
      if (query.queryKey[0] !== queryKey[0] || query.queryKey[1] !== id) return;
      if (event.type === 'updated' && event.action.type === 'fetch') scope.started.add(query.queryHash);
      if (event.type === 'updated' && event.action.type === 'success') {
        // An instance switch must never import old cached data or an old in-flight response.
        if (scope.started.delete(query.queryHash)) scope.resolved.add(query.queryHash);
        remember(query);
      }
      if (event.type === 'observerAdded') remember(query);
    });
  }, [key, allowed, kind, id, path, queryClient]);
  return null;
}
