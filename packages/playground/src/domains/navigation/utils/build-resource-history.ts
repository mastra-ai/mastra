import { z } from 'zod/v4';

export const BUILD_HISTORY_LIMIT = 12;
export const BUILD_HISTORY_EVENT = 'mastra:studio:build-history-changed';
const resourceKind = z.enum(['agent', 'workflow', 'prompt', 'tool', 'processor']);
export type BuildResourceKind = z.infer<typeof resourceKind>;
export interface BuildResourceRoute {
  kind: BuildResourceKind;
  id: string;
  path: string;
}

/** Only known resource routes are persisted; queries can contain request context or credentials. */
export function getBuildResourceRoute(path: string): BuildResourceRoute | undefined {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('?')) return undefined;
  const [pathname, hash] = path.split('#');
  if (hash && !/^[a-z-]+$/.test(hash)) return undefined;
  const segments = pathname.split('/').slice(1);
  const [area, encodedId, section] = segments;
  if (!encodedId || encodedId === 'create' || encodedId === 'new') return undefined;
  const decodeId = (value: string) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return undefined;
    }
  };
  const id = decodeId(encodedId);
  if (!id) return undefined;
  if (
    area === 'agents' &&
    segments.length <= 3 &&
    ['overview', 'configuration', 'editor', 'metrics', 'traces'].includes(section ?? 'overview')
  ) {
    return { kind: 'agent', id, path };
  }
  if (area === 'workflows' && encodedId === 'schedules') return undefined;
  if (
    area === 'workflows' &&
    ((segments.length <= 3 && ['graph', 'traces', 'schedules'].includes(section ?? 'graph')) ||
      (section === 'graph' && segments.length === 4))
  ) {
    return { kind: 'workflow', id, path };
  }
  if (area === 'tools' && segments.length === 2) return { kind: 'tool', id, path };
  if (area === 'processors' && segments.length === 2) return { kind: 'processor', id, path };
  if (area === 'cms' && encodedId === 'agents' && segments[3] === 'edit' && segments.length <= 5) {
    const sectionAllowed = [
      'instruction-blocks',
      'tools',
      'agents',
      'scorers',
      'workflows',
      'skills',
      'memory',
      'variables',
    ].includes(segments[4] ?? 'tools');
    const agentId = decodeId(section);
    if (agentId && agentId !== 'create' && sectionAllowed) return { kind: 'agent', id: agentId, path };
  }
  if (area === 'cms' && encodedId === 'prompts' && segments.length === 4 && segments[3] === 'edit') {
    const promptId = decodeId(section);
    if (promptId && promptId !== 'create') return { kind: 'prompt', id: promptId, path };
  }
  return undefined;
}

const resourceSchema = z
  .object({ kind: resourceKind, id: z.string().min(1), name: z.string().min(1), path: z.string() })
  .refine(entry => {
    const route = getBuildResourceRoute(entry.path);
    return route?.kind === entry.kind && route.id === entry.id;
  });
export type BuildResource = z.infer<typeof resourceSchema>;
export interface BuildHistory {
  recent: BuildResource[];
  pinned: BuildResource[];
}

export function buildHistoryKey(baseUrl: string, apiPrefix?: string, userId?: string) {
  return `mastra:studio:build-history:v1:${JSON.stringify([baseUrl, apiPrefix, userId])}`;
}
export function sameBuildResource(first: BuildResourceRoute, second: BuildResourceRoute) {
  return first.kind === second.kind && first.id === second.id;
}
export function readBuildHistorySnapshot(key?: string) {
  try {
    return key ? (localStorage.getItem(key) ?? '') : '';
  } catch {
    return '';
  }
}
export function parseBuildHistory(snapshot: string): BuildHistory {
  try {
    const raw = z.object({ recent: z.array(z.unknown()), pinned: z.array(z.unknown()) }).parse(JSON.parse(snapshot));
    const validEntries = (entries: unknown[]) =>
      entries
        .flatMap(entry => {
          const parsed = resourceSchema.safeParse(entry);
          return parsed.success ? [parsed.data] : [];
        })
        .filter((entry, index, entries) => entries.findIndex(other => sameBuildResource(entry, other)) === index);
    return { recent: validEntries(raw.recent).slice(0, BUILD_HISTORY_LIMIT), pinned: validEntries(raw.pinned) };
  } catch {
    return { recent: [], pinned: [] };
  }
}
export function readBuildHistory(key: string) {
  return parseBuildHistory(readBuildHistorySnapshot(key));
}
function saveBuildHistory(key: string, history: BuildHistory) {
  try {
    const snapshot = JSON.stringify(history);
    if (snapshot === readBuildHistorySnapshot(key)) return;
    localStorage.setItem(key, snapshot);
    window.dispatchEvent(new Event(BUILD_HISTORY_EVENT));
  } catch {
    // Navigation and resource pages remain usable when storage is unavailable.
  }
}
export function rememberBuildResource(key: string, entry: BuildResource) {
  if (!resourceSchema.safeParse(entry).success) return;
  const history = readBuildHistory(key);
  saveBuildHistory(key, {
    recent: [entry, ...history.recent.filter(other => !sameBuildResource(entry, other))].slice(0, BUILD_HISTORY_LIMIT),
    pinned: history.pinned.map(other => (sameBuildResource(entry, other) ? entry : other)),
  });
}
export function toggleBuildResourcePin(key: string, entry: BuildResource) {
  if (!resourceSchema.safeParse(entry).success) return;
  const history = readBuildHistory(key);
  const pinned = history.pinned.some(other => sameBuildResource(entry, other));
  saveBuildHistory(key, {
    ...history,
    pinned: pinned ? history.pinned.filter(other => !sameBuildResource(entry, other)) : [...history.pinned, entry],
  });
}
export function subscribeBuildHistory(listener: () => void) {
  window.addEventListener(BUILD_HISTORY_EVENT, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(BUILD_HISTORY_EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}
