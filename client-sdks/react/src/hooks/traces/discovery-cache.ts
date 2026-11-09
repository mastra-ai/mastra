/**
 * How long discovery results (tags, environments, service names, entity
 * names) stay fresh on the client.
 *
 * Discovery values are filter suggestions that change slowly, and the server
 * caches them for 5 minutes anyway. Without a staleTime, React Query refetches
 * on every mount and window focus, which pushes those refetches straight
 * through to the store's discovery refresh. Matching the server TTL keeps the
 * client from asking more often than the answer can change.
 */
export const DISCOVERY_STALE_TIME = 5 * 60 * 1000;
