import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { Query } from '@tanstack/react-query';
import type { StudioConfig } from '../types';

/** Why a connection can't work as configured: retrying won't help, changing the connection or the server will. */
export type ConnectionFailure =
  | { reason: 'invalid-url' }
  | { reason: 'not-mastra' }
  | { reason: 'http'; httpStatus: number };

/** Why a connection doesn't work yet: the server can change it without the connection changing. */
export type WaitCause =
  | { reason: 'no-answer' }
  /** The server answers, but not to this origin: CORS, or a proxy's error without CORS headers. */
  | { reason: 'blocked' }
  /** An error a starting server can give. */
  | { reason: 'http'; httpStatus: number };

export type MastraInstanceStatus =
  | { status: 'active' }
  | { status: 'waiting'; cause: WaitCause }
  | { status: 'failed'; failure: ConnectionFailure };

export const instanceStatusQueryKey = ['mastra-instance-status'];

const DEFAULT_API_PREFIX = '/api';
const MAX_RETRY_DELAY = 5000;
const CORS_CHECK_TIMEOUT = 3000;
// Client errors a server can stop giving on its own.
const TEMPORARY_CLIENT_ERRORS = [408, 425, 429];

const normalizeApiPrefix = (apiPrefix: string): string => {
  const normalized = apiPrefix.trim().replace(/\/+/g, '/').replace(/\/$/, '');
  if (!normalized) return '';
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
};

// Probe a public route under the API prefix rather than the server root: when Mastra is
// mounted in a host app via a server adapter, the root belongs to the host app.
const getInstanceStatusUrl = (baseUrl: string, apiPrefix: string): string =>
  `${baseUrl.replace(/\/+$/, '')}${normalizeApiPrefix(apiPrefix)}/auth/capabilities`;

const parseUrl = (url: string): URL | undefined => {
  try {
    return new URL(url, window.location.href);
  } catch {
    return undefined;
  }
};

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

// A host app can answer unknown routes with a 200 fallback page, so require a capabilities body.
const isCapabilities = (body: unknown): boolean =>
  typeof body === 'object' && body !== null && 'enabled' in body && typeof body.enabled === 'boolean';

/** Throws when the server can't be reached. Sent like the requests Studio makes next, so CORS treats them the same. */
const requestStatus = async (url: string, headers: Record<string, string>): Promise<MastraInstanceStatus> => {
  const response = await fetch(url, { headers, credentials: 'include' });
  const { status: httpStatus } = response;

  if (httpStatus >= 500 || TEMPORARY_CLIENT_ERRORS.includes(httpStatus))
    return { status: 'waiting', cause: { reason: 'http', httpStatus } };
  if (!response.ok) return { status: 'failed', failure: { reason: 'http', httpStatus } };
  if (isCapabilities(parseJson(await response.text()))) return { status: 'active' };
  return { status: 'failed', failure: { reason: 'not-mastra' } };
};

// The browser reports a refused connection and a CORS block as the same error, but lets a `no-cors` request through.
const answersWithoutCors = (url: string): Promise<boolean> =>
  fetch(url, { mode: 'no-cors', credentials: 'omit', signal: AbortSignal.timeout(CORS_CHECK_TIMEOUT) }).then(
    () => true,
    () => false,
  );

const getMastraInstanceStatus = async ({
  baseUrl,
  apiPrefix = DEFAULT_API_PREFIX,
  headers,
}: StudioConfig): Promise<MastraInstanceStatus> => {
  const url = getInstanceStatusUrl(baseUrl, apiPrefix);
  const target = parseUrl(url);
  if (!target || !/^https?:$/.test(target.protocol)) return { status: 'failed', failure: { reason: 'invalid-url' } };

  try {
    return await requestStatus(url, headers);
  } catch {
    const crossOrigin = target.origin !== window.location.origin;
    const reason = crossOrigin && (await answersWithoutCors(url)) ? 'blocked' : 'no-answer';
    return { status: 'waiting', cause: { reason } };
  }
};

type StatusQuery = Query<MastraInstanceStatus>;

const isWaiting = (query: StatusQuery) => query.state.data?.status === 'waiting';

// 1s, 2s, 4s, then every 5s. React Query pauses it while the tab is hidden and checks again on focus.
const retryDelay = (query: StatusQuery) => Math.min(1000 * 2 ** (query.state.dataUpdateCount - 1), MAX_RETRY_DELAY);

export interface UseMastraInstanceStatusOptions {
  /** Changes with every saved connection. Stands in for the headers, which must stay out of query keys. */
  revision: number;
  /** Stops checking on its own. */
  paused: boolean;
}

/**
 * Whether Studio can use the connection. Keeps checking while the server isn't up yet, and stops for good once it
 * answered: a server that restarts later must not take Studio down with it.
 */
export const useMastraInstanceStatus = (config: StudioConfig, { revision, paused }: UseMastraInstanceStatusOptions) => {
  const checksAgain = (query: StatusQuery) => !paused && isWaiting(query);

  return useQuery<MastraInstanceStatus>({
    queryKey: [...instanceStatusQueryKey, config.baseUrl, config.apiPrefix, revision],
    queryFn: () => getMastraInstanceStatus(config),
    retry: false,
    // A connection saved while Studio is connected is checked behind the page that saved it.
    placeholderData: keepPreviousData,
    staleTime: query => (query.state.data?.status === 'active' ? Infinity : 0),
    refetchInterval: query => (checksAgain(query) ? retryDelay(query) : false),
    refetchOnWindowFocus: checksAgain,
    refetchOnReconnect: checksAgain,
  });
};
