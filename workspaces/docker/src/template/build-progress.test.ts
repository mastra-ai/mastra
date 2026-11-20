import { describe, it, expect } from 'vitest';
import { BoundedTail, createBuildEventNormalizer, decodeBuildkitStatus } from './build-progress';
import type { DockerTemplateBuildEvent } from './build-progress';

// Minimal protobuf encoder for BuildKit StatusResponse fixtures.
function varint(value: number): Buffer {
  const bytes: number[] = [];
  while (value > 0x7f) {
    bytes.push((value & 0x7f) | 0x80);
    value = Math.floor(value / 128);
  }
  bytes.push(value);
  return Buffer.from(bytes);
}
const bytesField = (field: number, value: Buffer | string) => {
  const data = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
  return Buffer.concat([varint(field * 8 + 2), varint(data.length), data]);
};
const varintField = (field: number, value: number) => Buffer.concat([varint(field * 8), varint(value)]);
const timestamp = bytesField(1, Buffer.concat([varintField(1, 1_700_000_000)]));

interface VertexFixture {
  digest: string;
  name?: string;
  cached?: boolean;
  started?: boolean;
  completed?: boolean;
  error?: string;
}
function vertex(v: VertexFixture): Buffer {
  return Buffer.concat([
    bytesField(1, v.digest),
    bytesField(2, 'sha256:input'),
    ...(v.name ? [bytesField(3, v.name)] : []),
    ...(v.cached ? [varintField(4, 1)] : []),
    ...(v.started ? [bytesField(5, timestamp)] : []),
    ...(v.completed ? [bytesField(6, timestamp)] : []),
    ...(v.error ? [bytesField(7, v.error)] : []),
  ]);
}
function log(vertexDigest: string, msg: Buffer | string): Buffer {
  return Buffer.concat([bytesField(1, vertexDigest), bytesField(2, timestamp), varintField(3, 1), bytesField(4, msg)]);
}
function trace(parts: { vertexes?: VertexFixture[]; logs?: Array<[string, Buffer | string]> }) {
  const aux = Buffer.concat([
    ...(parts.vertexes ?? []).map(v => bytesField(1, vertex(v))),
    ...(parts.logs ?? []).map(([d, m]) => bytesField(3, log(d, m))),
  ]).toString('base64');
  return { id: 'moby.buildkit.trace', aux };
}

function collect(maxBytes = 1024) {
  const events: DockerTemplateBuildEvent[] = [];
  const tail = new BoundedTail(maxBytes);
  const normalizer = createBuildEventNormalizer(event => events.push(event), tail);
  return { events, tail, normalizer };
}

describe('BoundedTail', () => {
  it('keeps everything under the limit', () => {
    const tail = new BoundedTail(10);
    tail.push('abc');
    tail.push('def');
    expect(tail.toString()).toBe('abcdef');
    expect(tail.truncated).toBe(false);
  });

  it('keeps only the most recent bytes and reports truncation', () => {
    const tail = new BoundedTail(5);
    tail.push('abc');
    tail.push('defg');
    expect(tail.toString()).toBe('cdefg');
    expect(tail.truncated).toBe(true);
    tail.push('x'.repeat(100));
    expect(tail.toString()).toBe('xxxxx');
  });

  it('drops a multibyte character split by truncation', () => {
    const tail = new BoundedTail(4);
    tail.push('é'.repeat(3)); // 6 bytes
    expect(tail.toString()).toBe('éé');
  });
});

describe('decodeBuildkitStatus', () => {
  it('decodes vertexes and logs', () => {
    const { aux } = trace({
      vertexes: [{ digest: 'sha256:a', name: '[1/2] RUN npm ci', cached: true, started: true, completed: true }],
      logs: [['sha256:a', 'hello\n']],
    });
    const status = decodeBuildkitStatus(aux);
    expect(status.vertexes).toEqual([
      { digest: 'sha256:a', name: '[1/2] RUN npm ci', cached: true, started: true, completed: true },
    ]);
    expect(status.logs).toEqual([{ vertex: 'sha256:a', data: Buffer.from('hello\n') }]);
  });

  it('throws on malformed input', () => {
    expect(() => decodeBuildkitStatus(Buffer.from([0x0a, 0x05, 0x01]).toString('base64'))).toThrow();
  });
});

describe('createBuildEventNormalizer — legacy builder', () => {
  it('emits step start/complete with cache state and attributes output', () => {
    const { events, tail, normalizer } = collect();
    normalizer.handle({ stream: 'Step 1/3 : FROM node:22-slim AS mastra-main-0\n' });
    normalizer.handle({ stream: ' ---> abc123\n' });
    normalizer.handle({ stream: 'Step 2/3 : RUN apt-get update\n ---> Using cache\n ---> def456\n' });
    normalizer.handle({ stream: 'Step 3/3 : RUN npm ci\n' });
    normalizer.handle({ stream: ' ---> Running in 1234\n' });
    normalizer.handle({ stream: 'added 12 pack' });
    normalizer.handle({ stream: 'ages\n' });
    normalizer.handle({ aux: { ID: 'sha256:final' } });
    normalizer.finish();

    const steps = events.filter(e => e.type === 'step-start' || e.type === 'step-complete');
    expect(steps).toEqual([
      { type: 'step-start', step: { id: '1', name: 'FROM node:22-slim AS mastra-main-0', index: 1, total: 3 } },
      { type: 'step-complete', step: { id: '1', name: 'FROM node:22-slim AS mastra-main-0', index: 1, total: 3 } },
      { type: 'step-start', step: { id: '2', name: 'RUN apt-get update', index: 2, total: 3 } },
      { type: 'step-complete', step: { id: '2', name: 'RUN apt-get update', index: 2, total: 3, cached: true } },
      { type: 'step-start', step: { id: '3', name: 'RUN npm ci', index: 3, total: 3 } },
      { type: 'step-complete', step: { id: '3', name: 'RUN npm ci', index: 3, total: 3, cached: false } },
    ]);
    expect(events).toContainEqual({ type: 'output', stepId: '3', text: 'added 12 packages\n' });
    expect(tail.toString()).toContain('added 12 packages\n');
    expect(tail.toString()).not.toContain('Step 1/3');
    expect(normalizer.failure()).toBeUndefined();
  });

  it('attributes an error to the running step', () => {
    const { events, normalizer } = collect();
    normalizer.handle({ stream: 'Step 1/2 : FROM node:22-slim\n' });
    normalizer.handle({ stream: 'Step 2/2 : RUN exit 3\n ---> Running in 99\n' });
    normalizer.handle({ stream: 'boom\n' });
    normalizer.handle({
      errorDetail: { code: 3, message: "The command '/bin/sh -c exit 3' returned a non-zero code: 3" },
    });

    const failure = normalizer.failure();
    expect(failure?.message).toContain('non-zero code: 3');
    expect(failure?.step).toMatchObject({ id: '2', name: 'RUN exit 3', cached: false });
    expect(events.at(-1)).toMatchObject({ type: 'step-complete', step: { id: '2' }, error: failure?.message });
  });

  it('ignores unknown shapes without throwing', () => {
    const { events, normalizer } = collect();
    for (const raw of [null, 42, 'text', {}, { status: 'Pulling' }, { id: 'moby.buildkit.trace', aux: '!!!' }]) {
      expect(() => normalizer.handle(raw)).not.toThrow();
    }
    expect(events).toEqual([]);
  });
});

describe('createBuildEventNormalizer — BuildKit', () => {
  it('emits steps, cached reuse, and per-vertex output; skips [internal] vertices', () => {
    const { events, tail, normalizer } = collect();
    normalizer.handle(
      trace({ vertexes: [{ digest: 'sha256:i', name: '[internal] load build definition', started: true }] }),
    );
    normalizer.handle(
      trace({
        vertexes: [
          { digest: 'sha256:a', name: '[1/2] RUN apt-get update', cached: true, started: true, completed: true },
          { digest: 'sha256:b', name: '[2/2] RUN npm ci', started: true },
        ],
      }),
    );
    normalizer.handle(trace({ logs: [['sha256:b', Buffer.from([0x68, 0xc3])]] }));
    normalizer.handle(trace({ logs: [['sha256:b', Buffer.from([0xa9, 0x0a])]], vertexes: [] }));
    normalizer.handle(
      trace({ vertexes: [{ digest: 'sha256:b', name: '[2/2] RUN npm ci', started: true, completed: true }] }),
    );
    normalizer.finish();

    expect(events).toEqual([
      { type: 'step-start', step: { id: 'sha256:a', name: '[1/2] RUN apt-get update', cached: true } },
      { type: 'step-complete', step: { id: 'sha256:a', name: '[1/2] RUN apt-get update', cached: true } },
      { type: 'step-start', step: { id: 'sha256:b', name: '[2/2] RUN npm ci' } },
      { type: 'output', stepId: 'sha256:b', text: 'h' },
      { type: 'output', stepId: 'sha256:b', text: 'é\n' },
      { type: 'step-complete', step: { id: 'sha256:b', name: '[2/2] RUN npm ci', cached: false } },
    ]);
    expect(tail.toString()).toBe('hé\n');
  });

  it('records the failing vertex', () => {
    const { normalizer } = collect();
    normalizer.handle(trace({ vertexes: [{ digest: 'sha256:x', name: '[1/1] RUN false', started: true }] }));
    normalizer.handle(
      trace({
        vertexes: [
          { digest: 'sha256:x', name: '[1/1] RUN false', started: true, completed: true, error: 'exit code: 1' },
        ],
      }),
    );
    normalizer.handle({ errorDetail: { message: 'process "/bin/sh -c false" did not complete successfully' } });
    expect(normalizer.failure()).toEqual({
      message: 'process "/bin/sh -c false" did not complete successfully',
      step: { id: 'sha256:x', name: '[1/1] RUN false', cached: false },
    });
  });

  it('starts an errored vertex before completing it', () => {
    const { events, normalizer } = collect();
    normalizer.handle(trace({ vertexes: [{ digest: 'sha256:x', name: '[1/1] RUN false', error: 'exit code: 1' }] }));
    expect(events).toEqual([
      { type: 'step-start', step: { id: 'sha256:x', name: '[1/1] RUN false' } },
      {
        type: 'step-complete',
        step: { id: 'sha256:x', name: '[1/1] RUN false', cached: false },
        error: 'exit code: 1',
      },
    ]);
  });
});
