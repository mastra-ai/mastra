import { useMastraClient } from '@mastra/react';
import { isAuthenticated, useAuthCapabilities } from '@mastra/react/hooks/auth';
import { useSyncExternalStore } from 'react';
import { z } from 'zod/v4';

const PINS_CHANGED_EVENT = 'mastra:studio:agent-pins-changed';
const pinnedAgentIdsSchema = z.array(z.string());

function usePinsStorageKey() {
  const client = useMastraClient();
  const { data: auth } = useAuthCapabilities();
  if (!auth || (auth.enabled && !isAuthenticated(auth))) return undefined;
  const userId = isAuthenticated(auth) ? auth.user.id : undefined;
  return `mastra:studio:pinned-agents:v1:${JSON.stringify([client.options.baseUrl, client.options.apiPrefix, userId])}`;
}

function readPinsSnapshot(key: string | undefined) {
  try {
    return key ? (localStorage.getItem(key) ?? '') : '';
  } catch {
    return '';
  }
}

function parsePinnedAgentIds(snapshot: string) {
  try {
    const parsed = pinnedAgentIdsSchema.safeParse(JSON.parse(snapshot));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function subscribeToPins(listener: () => void) {
  window.addEventListener(PINS_CHANGED_EVENT, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(PINS_CHANGED_EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}

/** Chat and the Agents sidebar share one pin list; only ids are stored, names come from the server. */
export function useAgentPins() {
  const key = usePinsStorageKey();
  const snapshot = useSyncExternalStore(
    subscribeToPins,
    () => readPinsSnapshot(key),
    () => '',
  );
  const pinnedAgentIds = parsePinnedAgentIds(snapshot);
  return {
    pinnedAgentIds,
    toggleAgentPin: (agentId: string) => {
      if (!key) return;
      const next = pinnedAgentIds.includes(agentId)
        ? pinnedAgentIds.filter(id => id !== agentId)
        : [...pinnedAgentIds, agentId];
      try {
        localStorage.setItem(key, JSON.stringify(next));
        window.dispatchEvent(new Event(PINS_CHANGED_EVENT));
      } catch {
        // Pinning is a convenience; navigation keeps working without storage.
      }
    },
  };
}
