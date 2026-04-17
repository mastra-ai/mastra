import type { StoredAgentResponse } from '@mastra/client-js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAgentStudioConfig } from './use-agent-studio-config';
import { useStarredAgentIds } from './use-user-preferences';
import { useStoredAgents } from '@/domains/agents/hooks/use-stored-agents';
import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';

const STORAGE_KEY_PREFIX = 'mastra.agentStudio.recents';
const ANONYMOUS_KEY = 'anonymous';

type RecentEntry = {
  id: string;
  lastOpenedAt: number;
};

const readEntries = (storageKey: string): RecentEntry[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is RecentEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as RecentEntry).id === 'string' &&
        typeof (entry as RecentEntry).lastOpenedAt === 'number',
    );
  } catch {
    return [];
  }
};

const writeEntries = (storageKey: string, entries: RecentEntry[]): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(entries));
  } catch {
    // Ignore quota / serialization issues — recents are non-critical.
  }
};

/**
 * Tracks the current user's most recently opened agents in localStorage,
 * merges them with their most recently created agents, and filters against
 * the live list of stored agents so deleted IDs drop out. Backed by
 * localStorage keyed by user id.
 */
export const useRecentAgents = () => {
  const { data: user } = useCurrentUser();
  const { config } = useAgentStudioConfig();
  const maxItems = config?.recents?.maxItems ?? 5;
  const starredAgentIds = useStarredAgentIds();

  const userId = user?.id ?? ANONYMOUS_KEY;
  const storageKey = `${STORAGE_KEY_PREFIX}.${userId}`;

  const [entries, setEntries] = useState<RecentEntry[]>(() => readEntries(storageKey));

  // Re-read when the user (and thus the storage key) changes.
  useEffect(() => {
    setEntries(readEntries(storageKey));
  }, [storageKey]);

  const { data: storedAgents, isLoading } = useStoredAgents({
    orderBy: { field: 'updatedAt', direction: 'DESC' },
    perPage: Math.max(maxItems * 4, 20),
  });

  const livingAgentsById = useMemo(() => {
    const map = new Map<string, StoredAgentResponse>();
    for (const agent of storedAgents?.agents ?? []) {
      map.set(agent.id, agent);
    }
    return map;
  }, [storedAgents]);

  // Drop entries that no longer exist in the server list.
  useEffect(() => {
    if (!storedAgents) return;
    const filtered = entries.filter(entry => livingAgentsById.has(entry.id));
    if (filtered.length !== entries.length) {
      setEntries(filtered);
      writeEntries(storageKey, filtered);
    }
  }, [entries, livingAgentsById, storageKey, storedAgents]);

  const trackAgentOpened = useCallback(
    (agentId: string) => {
      if (!agentId) return;
      setEntries(prev => {
        const next: RecentEntry[] = [
          { id: agentId, lastOpenedAt: Date.now() },
          ...prev.filter(entry => entry.id !== agentId),
        ].slice(0, Math.max(maxItems * 2, 10));
        writeEntries(storageKey, next);
        return next;
      });
    },
    [maxItems, storageKey],
  );

  const recents = useMemo<StoredAgentResponse[]>(() => {
    const ordered: StoredAgentResponse[] = [];
    const seen = new Set<string>();

    // 1. Starred agents always pin to the top of the user's recents.
    for (const starredId of starredAgentIds) {
      const agent = livingAgentsById.get(starredId);
      if (agent && !seen.has(agent.id)) {
        ordered.push(agent);
        seen.add(agent.id);
      }
      if (ordered.length >= maxItems) return ordered;
    }

    // 2. Entries the user explicitly opened (most recent first).
    for (const entry of entries) {
      const agent = livingAgentsById.get(entry.id);
      if (agent && !seen.has(agent.id)) {
        ordered.push(agent);
        seen.add(agent.id);
      }
      if (ordered.length >= maxItems) return ordered;
    }

    // 3. Fill from the user's own most-recently-updated stored agents.
    if (user?.id) {
      for (const agent of storedAgents?.agents ?? []) {
        if (seen.has(agent.id)) continue;
        if (agent.authorId && agent.authorId !== user.id) continue;
        ordered.push(agent);
        seen.add(agent.id);
        if (ordered.length >= maxItems) return ordered;
      }
    }

    return ordered;
  }, [entries, livingAgentsById, maxItems, starredAgentIds, storedAgents, user?.id]);

  return {
    recents,
    trackAgentOpened,
    isLoading,
    maxItems,
  };
};
