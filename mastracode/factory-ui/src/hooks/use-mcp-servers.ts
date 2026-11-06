import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type {
  CreateMcpServerRequest,
  McpOAuthStartResponse,
  McpServerResponse,
  McpServersResponse,
  SelectMcpServerToolsRequest,
  UpdateMcpServerRequest,
} from '../api/types';

const BASE_PATH = '/web/config/mcp-servers';

/** A failed MCP server request, carrying the server's human-readable `message` and the HTTP status. */
export class McpServersRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'McpServersRequestError';
  }
}

async function send<T>(baseUrl: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${baseUrl}${BASE_PATH}${path}`, {
    method,
    credentials: 'include',
    headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = (await res.json().catch(() => undefined)) as { message?: unknown; error?: unknown } | undefined;
  if (!res.ok) {
    const message =
      typeof data?.message === 'string'
        ? data.message
        : typeof data?.error === 'string'
          ? data.error
          : `Request failed (${res.status})`;
    throw new McpServersRequestError(message, res.status);
  }
  return data as T;
}

const serverPath = (id: string, suffix = '') => `/${encodeURIComponent(id)}${suffix}`;

function useInvalidateMcpServers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.mcpServers() });
}

/**
 * The organization's MCP servers, whether the caller may manage them, and
 * whether OAuth sign-in works without a client ID. Secrets never come back:
 * only header names and whether a client secret is saved.
 */
export function useMcpServersQuery({ enabled = true }: { enabled?: boolean } = {}) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.mcpServers(),
    queryFn: () => send<McpServersResponse>(baseUrl, 'GET', ''),
    enabled,
  });
}

export function useCreateMcpServer() {
  const { baseUrl } = useApiConfig();
  const invalidate = useInvalidateMcpServers();
  return useMutation({
    mutationFn: (body: CreateMcpServerRequest) => send<McpServerResponse>(baseUrl, 'POST', '', body),
    onSuccess: invalidate,
  });
}

export function useUpdateMcpServer() {
  const { baseUrl } = useApiConfig();
  const invalidate = useInvalidateMcpServers();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateMcpServerRequest }) =>
      send<McpServerResponse>(baseUrl, 'PATCH', serverPath(id), body),
    onSuccess: invalidate,
  });
}

export function useDeleteMcpServer() {
  const { baseUrl } = useApiConfig();
  const invalidate = useInvalidateMcpServers();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => send<{ ok: true }>(baseUrl, 'DELETE', serverPath(id)),
    onSuccess: invalidate,
  });
}

/** Connect to the server and save the tools it lists. */
export function useDiscoverMcpServer() {
  const { baseUrl } = useApiConfig();
  const invalidate = useInvalidateMcpServers();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => send<McpServerResponse>(baseUrl, 'POST', serverPath(id, '/discover')),
    onSuccess: invalidate,
  });
}

/** Choose the tools sessions get. */
export function useSetMcpServerTools() {
  const { baseUrl } = useApiConfig();
  const invalidate = useInvalidateMcpServers();
  return useMutation({
    mutationFn: ({ id, selected }: { id: string } & SelectMcpServerToolsRequest) =>
      send<McpServerResponse>(baseUrl, 'PUT', serverPath(id, '/tools'), { selected }),
    onSuccess: invalidate,
  });
}

/**
 * Begin an OAuth sign-in. The callback returns the admin to this Factory's
 * MCP server settings. When the saved sign-in was still good the server is
 * reconnected instead and no authorization URL comes back.
 */
export function useStartMcpServerOAuth() {
  const { baseUrl } = useApiConfig();
  const invalidate = useInvalidateMcpServers();
  return useMutation({
    mutationFn: ({ id, factoryProjectId }: { id: string; factoryProjectId?: string }) =>
      send<McpOAuthStartResponse>(
        baseUrl,
        'POST',
        serverPath(id, '/oauth/start'),
        factoryProjectId ? { factoryProjectId } : {},
      ),
    onSuccess: result => {
      if ('server' in result) return invalidate();
    },
  });
}

/** Sign the server out: its saved tokens are deleted and sessions lose its tools until someone signs in again. */
export function useDisconnectMcpServerOAuth() {
  const { baseUrl } = useApiConfig();
  const invalidate = useInvalidateMcpServers();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => send<McpServerResponse>(baseUrl, 'DELETE', serverPath(id, '/oauth')),
    onSuccess: invalidate,
  });
}
