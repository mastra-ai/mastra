import { isRecord } from '../../../../lib/isRecord';
import { readSSE } from '../../../lib/readSSE';
import { RequestError } from './request';

export interface FeedEvent {
  workItemId: string;
}

export async function streamFeedEvents(
  baseUrl: string,
  factoryProjectId: string,
  handlers: { onEvent: (event: FeedEvent) => void; onConnected: () => void },
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(`${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/feed-events`, {
    headers: { Accept: 'text/event-stream' },
    credentials: 'include',
    signal,
  });
  if (!response.ok || !response.body) {
    throw new RequestError(`Feed stream failed (${response.status})`, response.status);
  }
  handlers.onConnected();
  await readSSE(response.body, (event, data) => {
    if (event !== 'feed') return;
    const parsed: unknown = JSON.parse(data);
    if (!isRecord(parsed) || typeof parsed.workItemId !== 'string') return;
    handlers.onEvent({ workItemId: parsed.workItemId });
  });
}
