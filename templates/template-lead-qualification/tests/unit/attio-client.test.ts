import { describe, expect, it, vi } from 'vitest';
import { AttioApi } from '../../src/mastra/providers/attio/client';

describe('Attio response bodies', () => {
  it.each([
    new TypeError('Connection terminated'),
    new DOMException('Request timed out', 'TimeoutError'),
    new DOMException('Request aborted', 'AbortError'),
  ])('keeps_stream_failures_retryable_after_successful_headers: %s', async error => {
    const transport = vi.fn<typeof fetch>(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('{"data":'));
            },
            pull(controller) {
              controller.error(error);
            },
          }),
          { status: 200 },
        ),
    );
    const api = new AttioApi('controlled-token', 100, transport);
    await expect(api.request('lists/list/entries/entry', 'PUT', {})).rejects.toMatchObject({
      code: 'attio_unavailable',
      retryable: true,
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('keeps_invalid_json_and_oversized_completed_responses_non_retryable', async () => {
    for (const [response, code] of [
      [new Response('{"data":'), 'attio_invalid_response'],
      [new Response(new Uint8Array(12 * 1024 * 1024 + 1)), 'attio_response_too_large'],
    ] as const) {
      const api = new AttioApi('controlled-token', 100, async () => response);
      await expect(api.request('lists/list/entries/entry')).rejects.toMatchObject({ code, retryable: false });
    }
  });
});
