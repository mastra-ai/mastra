import { authHeaders, createApiClient, MASTRA_PLATFORM_API_URL, platformFetch } from '../auth/client.js';
import { getToken, getCurrentOrgId, validateOrgAccess } from '../auth/credentials.js';

async function getLogs(deployId: string, tail: string | undefined, token: string, orgId: string) {
  const client = createApiClient(token, orgId);
  const { data, error } = await client.GET('/v1/studio/deploys/{id}/logs', {
    params: {
      path: { id: deployId },
      query: tail ? { tail } : undefined,
    },
  });

  if (error) {
    throw new Error(`Failed to fetch logs: ${error.detail}`);
  }

  if (data.logs) {
    process.stdout.write(data.logs);
  } else {
    console.info('(no logs available)');
  }
}

async function streamLogs(deployId: string, token: string, orgId: string) {
  const url = `${MASTRA_PLATFORM_API_URL}/v1/studio/deploys/${deployId}/logs/stream`;

  const resp = await platformFetch(url, {
    headers: {
      ...authHeaders(token, orgId),
      Accept: 'text/event-stream',
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to stream logs: ${resp.status} — ${text}`);
  }

  if (!resp.body) {
    throw new Error('No response body for log stream');
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    void reader.cancel();
    process.exit(0);
  });

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    // Parse SSE data lines, keeping any incomplete trailing line in the buffer
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.startsWith('data:')) {
        const data = line.slice(5).trimStart();
        process.stdout.write(data + '\n');
      }
    }
  }
}

export async function logsAction(deployId: string, opts: { follow?: boolean; tail?: string }) {
  const token = await getToken();
  const orgId = await getCurrentOrgId();
  if (!orgId) {
    console.error('No organization selected. Run: mastra auth login');
    process.exit(1);
  }

  await validateOrgAccess(token, orgId);

  if (opts.follow) {
    await streamLogs(deployId, token, orgId);
  } else {
    await getLogs(deployId, opts.tail, token, orgId);
  }
}
