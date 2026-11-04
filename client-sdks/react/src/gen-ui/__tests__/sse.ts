import { HttpResponse } from 'msw';
import { TEST_BASE_URL } from '../../test/render';

export const AGENT_URL = `${TEST_BASE_URL}/api/agents/agent-1`;
export const STREAM_URL = `${AGENT_URL}/stream`;

const encoder = new TextEncoder();
const line = (chunk: object) => encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`);

export const chunk = (type: string, payload: object = {}) => ({ type, runId: 'run-1', from: 'AGENT', payload });
export const finish = (reason: 'stop' | 'tool-calls' | 'suspended') =>
  chunk('finish', { stepResult: { reason }, usage: { totalTokens: 1 } });
export const genUIChunk = (envelope: object) => ({
  type: 'data-gen-ui',
  runId: 'run-1',
  from: 'AGENT',
  data: envelope,
});

/** An SSE response the test pushes chunks into, so it can assert between chunks. */
export function controllableStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  return {
    response: () => new HttpResponse(body, { headers: { 'content-type': 'text/event-stream' } }),
    push: (...chunks: object[]) => chunks.forEach(c => controller.enqueue(line(c))),
    close: () => controller.close(),
  };
}

export function sseResponse(chunks: object[]) {
  return new HttpResponse(
    new ReadableStream<Uint8Array>({
      start(c) {
        chunks.forEach(item => c.enqueue(line(item)));
        c.close();
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );
}
