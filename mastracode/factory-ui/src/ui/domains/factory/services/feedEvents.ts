import { readSSE } from '../../../lib/readSSE';
import { RequestError } from './request';

/** The server pings every 25 s, so a stream this quiet has nobody on the other end and never ends on its own. */
const FEED_SILENCE_LIMIT_MS = 60_000;

export async function streamFeedEvents(
  baseUrl: string,
  factoryProjectId: string,
  handlers: { onEvent: () => void; onConnected: () => void },
  signal: AbortSignal,
): Promise<void> {
  const silence = new AbortController();
  let silenceTimer: ReturnType<typeof setTimeout> | undefined;
  const heard = () => {
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => silence.abort(), FEED_SILENCE_LIMIT_MS);
  };
  heard();
  const closedOrSilent = AbortSignal.any([signal, silence.signal]);
  try {
    const response = await fetch(
      `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/feed-events`,
      { headers: { Accept: 'text/event-stream' }, credentials: 'include', signal: closedOrSilent },
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
    await readSSE(response.body.pipeThrough(heardBytes, { signal: closedOrSilent }), (event, data) => {
      if (event === 'feed') handlers.onEvent();
    });
  } finally {
    clearTimeout(silenceTimer);
  }
}
