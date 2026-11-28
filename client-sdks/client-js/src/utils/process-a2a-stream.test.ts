import { describe, expect, it } from 'vitest';
import { processA2AStream } from './process-a2a-stream';

const status = { kind: 'status-update', taskId: 'task', status: { state: 'working' } };
const artifact = { kind: 'artifact-update', taskId: 'task', artifact: { artifactId: 'réponse' } };

async function readEvents(...chunks: string[]) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  const events = [];
  for await (const event of processA2AStream(stream)) {
    events.push(event);
  }
  return events;
}

const eventFrame = (result: object) => `data: ${JSON.stringify({ result })}\n\n`;

describe('processA2AStream', () => {
  // Non-payload SSE frames must not drop later task events (#30448).
  it.each([
    ['heartbeat comments', ': keep-alive\n\n'],
    ['metadata-only frames', 'event: ping\r\nid: 42\r\nretry: 1000\r\n\r\n'],
    ['empty data frames', 'data:\n\n'],
    ['whitespace-only multiline data frames', 'data: \ndata:\n\n'],
    ['blank separators', '\n\n'],
  ])('delivers updates after %s', async (_name, frame) => {
    expect(await readEvents(eventFrame(status), frame.slice(0, -1), frame.slice(-1) + eventFrame(artifact))).toEqual([
      status,
      artifact,
    ]);
  });

  it.each([
    ['colonless', 'event: ping\nx-heartbeat\n\n'],
    ['punctuated', 'event: ping\nx.heartbeat: alive\n\n'],
  ])('delivers artifact updates before the stream closes after %s metadata', async (_name, frame) => {
    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream<Uint8Array>();
    const writer = writable.getWriter();
    const events = processA2AStream(readable);

    try {
      const first = events.next();
      await writer.write(encoder.encode(eventFrame(status)));
      expect(await first).toEqual({ done: false, value: status });

      const next = events.next();
      await writer.write(encoder.encode(frame + eventFrame(artifact)));
      expect(await next).toEqual({ done: false, value: artifact });
    } finally {
      await writer.close();
      await events.return();
    }
  });

  it('accepts raw JSON records and a final record without a delimiter', async () => {
    expect(
      await readEvents(`\x1e${JSON.stringify({ result: status })}\n\n`, `\x1e${JSON.stringify(artifact, null, 2)}`),
    ).toEqual([status, artifact]);
  });

  it.each(['data: [DONE]', '[DONE]'])('stops on an explicit %s record', async done => {
    expect(await readEvents(eventFrame(status), `${done}\n\n${eventFrame(artifact)}`)).toEqual([status]);
  });

  it.each(['data: {broken}\n\n', '\x1e{\nevent: ping\n}\n\n'])('still reports malformed JSON in %j', async frame => {
    await expect(readEvents(frame)).rejects.toThrow('Failed to parse A2A stream event');
  });
});
