import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ApiError } from '../api/client';
import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type {
  CheckCustomProviderBody,
  CustomProviderCheckFailure,
  CustomProviderCheckResponse,
  CustomProviderInfo,
  CustomProvidersResponse,
  OkResponse,
  SaveCustomProviderBody,
} from '../api/types';

/**
 * OpenAI-compatible providers the caller can reach: their own and their
 * organization's, each tagged with its `scope`. The API key is write-only;
 * the server only ever reports `hasApiKey`.
 */
export function useCustomProvidersQuery() {
  const { client } = useApiConfig();
  return useQuery<CustomProviderInfo[]>({
    queryKey: queryKeys.customProviders(),
    queryFn: async () => {
      const body = await client.get<CustomProvidersResponse>('/web/config/custom-providers');
      return body.providers;
    },
  });
}

const SAVE_CUSTOM_PROVIDER_KEY = ['save-custom-provider'] as const;

/** Saves a custom provider, or refuses with the failure when `check` is set and the connection test fails. */
export function useSaveCustomProvider() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: SAVE_CUSTOM_PROVIDER_KEY,
    mutationFn: (body: SaveCustomProviderBody) =>
      client.post<{ ok: true; provider: CustomProviderInfo }>('/web/config/custom-providers', body),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.customProviders() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.providers() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.availableModels() }),
      ]),
  });
}

/**
 * Whether a custom provider save is in flight. A dialog holding the form reads this to refuse closing until the
 * save settles, as the other credential dialogs do, so a save never lands after its dialog is gone.
 */
export function useCustomProviderSavePending(): boolean {
  return useIsMutating({ mutationKey: SAVE_CUSTOM_PROVIDER_KEY }) > 0;
}

/** The machine code of a refused request (`header_refused`, `api_key_required`, ...), when the server sent one. */
export function refusalCode(error: unknown): string | undefined {
  if (!(error instanceof ApiError) || !error.body || typeof error.body !== 'object') return undefined;
  const code = 'error' in error.body ? error.body.error : undefined;
  return typeof code === 'string' ? code : undefined;
}

/**
 * Tests a custom endpoint: a draft from the form (with `url`), or a saved row (only `previousId`). A failing
 * check resolves with the failure as data; only a refused request rejects. Checking a saved row records its
 * `lastCheck`, so the list refetches to show the new status.
 */
export function useCheckCustomProvider() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CheckCustomProviderBody) =>
      client.post<CustomProviderCheckResponse>('/web/config/custom-providers/check', body),
    onSuccess: (_response, body) =>
      body.url === undefined ? queryClient.invalidateQueries({ queryKey: queryKeys.customProviders() }) : undefined,
  });
}

const CHECK_FAILURE_KINDS: ReadonlySet<string> = new Set<CustomProviderCheckFailure['kind']>([
  'http',
  'network',
  'timeout',
  'redirect',
  'invalid_response',
]);

/** Whether `kind` names a failure kind this client knows how to show. */
function isCheckFailureKind(kind: unknown): kind is CustomProviderCheckFailure['kind'] {
  return typeof kind === 'string' && CHECK_FAILURE_KINDS.has(kind);
}

/**
 * The connection test failure of a save sent with `check: true`, read from its 422 body, or undefined for any
 * other error. The save wrote nothing in that case, so the caller can offer to save without the test.
 */
export function saveCheckFailure(error: unknown): CustomProviderCheckFailure | undefined {
  if (!(error instanceof ApiError) || error.status !== 422) return undefined;
  const body = error.body;
  if (!body || typeof body !== 'object' || !('error' in body) || body.error !== 'custom_endpoint_check_failed') {
    return undefined;
  }
  const failure = 'failure' in body ? body.failure : undefined;
  if (!failure || typeof failure !== 'object' || !('kind' in failure) || !('message' in failure)) return undefined;
  const { kind, message } = failure;
  if (!isCheckFailureKind(kind) || typeof message !== 'string') return undefined;
  const status = 'status' in failure && typeof failure.status === 'number' ? failure.status : undefined;
  const detail = 'detail' in failure && typeof failure.detail === 'string' ? failure.detail : undefined;
  return { kind, message, ...(status === undefined ? {} : { status }), ...(detail ? { detail } : {}) };
}

export interface RemoveCustomProviderArgs {
  id: string;
  /** The scope the provider is saved at. */
  scope: CustomProviderInfo['scope'];
}

export function useRemoveCustomProvider() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, scope }: RemoveCustomProviderArgs) =>
      client.del<OkResponse>(`/web/config/custom-providers/${encodeURIComponent(id)}?scope=${scope}`),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.customProviders() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.providers() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.availableModels() }),
      ]),
  });
}
