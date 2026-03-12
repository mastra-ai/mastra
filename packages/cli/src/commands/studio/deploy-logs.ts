import { MASTRA_CLOUD_API_URL, authHeaders } from '../auth/client.js';
import { getToken, getCurrentOrgId } from '../auth/credentials.js';

async function getLogs(deployId: string, tail: string | undefined, token: string, orgId: string) {
  const params = new URLSearchParams();
  if (tail) params.set('tail', tail);

  const qs = params.toString();
  const url = `${MASTRA_CLOUD_API_URL}/v1/studio/deploys/${deployId}/logs${qs ? `?${qs}` : ''}`;

  const resp = await fetch(url, {
    headers: authHeaders(token, orgId),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to fetch logs: ${resp.status} — ${text}`);
  }

  const data = (await resp.json()) as { logs: string | null };

  if (data.logs) {
    process.stdout.write(data.logs);
  } else {
    console.info('(no logs available)');
  }
}

async function streamLogs(deployId: string, token: string, orgId: string) {
  const url = `${MASTRA_CLOUD_API_URL}/v1/studio/deploys/${deployId}/logs/stream`;

  const resp = await fetch(url, {
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

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    void reader.cancel();
    process.exit(0);
  });

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    // Parse SSE data lines
    for (const line of chunk.split('\n')) {
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

  if (opts.follow) {
    await streamLogs(deployId, token, orgId);
  } else {
    await getLogs(deployId, opts.tail, token, orgId);
  }
}
