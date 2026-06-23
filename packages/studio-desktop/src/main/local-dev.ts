import { DEFAULT_DEV_SERVER_URL } from './defaults';
import { normalizeServerUrl } from './url';

export interface ProbeMastraServerResult {
  ok: boolean;
  serverUrl: string;
  error?: string;
}

export function normalizeDevServerUrl(input: string | number | undefined, fallback = DEFAULT_DEV_SERVER_URL) {
  const value = String(input ?? '').trim();
  if (!value) return fallback;

  const url = /^\d+$/.test(value)
    ? `http://127.0.0.1:${value}`
    : value.startsWith('http://') || value.startsWith('https://')
      ? value
      : `http://${value}`;

  return normalizeServerUrl(url);
}

export async function probeMastraServer(
  input: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ProbeMastraServerResult> {
  let serverUrl: string;
  try {
    serverUrl = normalizeDevServerUrl(input);
  } catch (error) {
    return {
      ok: false,
      serverUrl: input,
      error: error instanceof Error ? error.message : 'Invalid server URL',
    };
  }

  try {
    const response = await fetchImpl(`${serverUrl}/api/agents`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(2500),
    });

    if (response.ok) {
      return { ok: true, serverUrl };
    }

    return {
      ok: false,
      serverUrl,
      error: `Mastra server returned HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      serverUrl,
      error: error instanceof Error ? error.message : 'Unable to reach Mastra server',
    };
  }
}
