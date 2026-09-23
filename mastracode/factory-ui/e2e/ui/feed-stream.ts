import { http } from 'msw';

import { TEST_BASE_URL } from './render';

/**
 * A pushable feed stream, overriding the ambient silent one. `push` writes a
 * `feed` frame; `close` ends the stream so the provider takes its retry path.
 */
export function pushableFeedStream(factoryProjectId: string) {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  let opens = 0;

  const handler = http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryProjectId}/feed-events`, () => {
    opens += 1;
    return new Response(
      new ReadableStream<Uint8Array>({
        start(c) {
          controller = c;
        },
        cancel() {
          controller = undefined;
        },
      }),
      { headers: { 'content-type': 'text/event-stream' } },
    );
  });

  return {
    handler,
    get opens() {
      return opens;
    },
    push(workItemId?: string) {
      const data = JSON.stringify(workItemId ? { workItemId } : {});
      controller?.enqueue(encoder.encode(`event: feed\ndata: ${data}\n\n`));
    },
    close() {
      controller?.close();
      controller = undefined;
    },
  };
}
