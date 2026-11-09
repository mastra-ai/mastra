import { isRecord } from '../../../../lib/isRecord';
import { readSSE } from '../../../lib/readSSE';
import { RequestError } from './request';

export interface FeedEvent {
  /** Absent when the project's attention moved but no work item's comments did. */
  workItemId?: string;
}

/** The server pings every 25 s, so a stream this quiet has nobody on the other end and never ends on its own. */
const FEED_SILENCE_LIMIT_MS = 60_000;

export async function streamFeedEvents(
  baseUrl: string,
  factoryProjectId: string,
  handlers: { onEvent: (event: FeedEvent) => void; onConnected: () => void },
  signal: AbortSignal,
): Promise<void> {
  const silence = new AbortController();
  let silent: ReturnType<typeof setTimeout> | undefined;
  const heard = () => {
    clearTimeout(silent);
    silent = setTimeout(() => silence.abort(), FEED_SILENCE_LIMIT_MS);
  };
  heard();
  const stopped = AbortSignal.any([signal, silence.signal]);
  try {
    const response = await fetch(
      `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/feed-events`,
      { headers: { Accept: 'text/event-stream' }, credentials: 'include', signal: stopped },
    );
    if (!response.ok || !response.body) {
      throw new RequestError(`Feed stream failed (${response.status})`, response.status);
    }
    handlers.onConnected();
    const heardBytes = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        heard();
        controller.enqueue(chunk);
      },
    });
    await readSSE(response.body.pipeThrough(heardBytes, { signal: stopped }), (event, data) => {
      if (event !== 'feed') return;
      const parsed: unknown = JSON.parse(data);
      if (!isRecord(parsed)) return;
      handlers.onEvent(typeof parsed.workItemId === 'string' ? { workItemId: parsed.workItemId } : {});
    });
  } finally {
    clearTimeout(silent);
  }
}
