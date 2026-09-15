import process from 'node:process';
import type { Context } from 'hono';

const DEFAULT_AGENT_LEARNING_ENDPOINT = 'https://output.signals.mastra.ai';
const AGENT_LEARNING_TIMEOUT_MS = 8_000;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export async function agentLearningProxyHandler(c: Context): Promise<Response> {
  const requestUrl = new URL(c.req.url);
  if (!LOOPBACK_HOSTS.has(requestUrl.hostname)) {
    return c.json({ error: 'Agent Learning development proxy is only available on loopback hosts' }, 403);
  }

  const origin = c.req.header('Origin');
  if (origin && origin !== requestUrl.origin) {
    return c.json({ error: 'Cross-origin Agent Learning requests are not allowed' }, 403);
  }

  const accessToken = process.env.MASTRA_PLATFORM_ACCESS_TOKEN;
  const projectId = process.env.MASTRA_PROJECT_ID;
  if (!accessToken || !projectId) {
    return c.json(
      {
        error: 'MASTRA_PLATFORM_ACCESS_TOKEN and MASTRA_PROJECT_ID are required for Agent Learning',
      },
      503,
    );
  }

  const endpoint = process.env.MASTRA_PLATFORM_AGENT_LEARNING_ENDPOINT || DEFAULT_AGENT_LEARNING_ENDPOINT;
  let upstreamUrl: URL;
  try {
    upstreamUrl = new URL(`${requestUrl.pathname}${requestUrl.search}`, `${endpoint.replace(/\/+$/, '')}/`);
  } catch {
    return c.json({ error: 'MASTRA_PLATFORM_AGENT_LEARNING_ENDPOINT must be a valid URL' }, 503);
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        Accept: c.req.header('Accept') || 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Mastra-Project-Id': projectId,
      },
      signal: AbortSignal.timeout(AGENT_LEARNING_TIMEOUT_MS),
    });

    const headers = new Headers();
    const contentType = upstream.headers.get('content-type');
    const cacheControl = upstream.headers.get('cache-control');
    if (contentType) headers.set('content-type', contentType);
    if (cacheControl) headers.set('cache-control', cacheControl);

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  } catch {
    return c.json({ error: 'Agent Learning upstream unavailable' }, 502);
  }
}
