import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createDatasetSnapshot,
  datasetSnapshotContentSchema,
  datasetSnapshotSchema,
  DATASET_SNAPSHOT_DEFAULT_MAX_BYTES,
  DATASET_SNAPSHOT_MAX_DEPTH,
  parseDatasetSnapshot,
} from '../index';
import type { DatasetSnapshotContent } from '../index';

const datasetIdentity = '00000000-0000-4000-8000-000000000001';
const itemIdentity = '00000000-0000-4000-8000-000000000002';
const otherIdentity = '00000000-0000-4000-8000-000000000003';

function fixture(): DatasetSnapshotContent {
  return {
    formatVersion: 1,
    datasetIdentity,
    configuration: {
      name: 'Evaluation cases',
      description: 'Portable test cases',
      metadata: { team: 'quality' },
      inputSchema: { type: 'object' },
      groundTruthSchema: null,
      requestContextSchema: { type: 'object' },
      tags: ['reviewed'],
      targetType: 'agent',
      targetIds: ['support'],
      scorerIds: ['accuracy'],
    },
    items: [
      {
        itemIdentity,
        payload: {
          externalId: 'case-1',
          input: { question: 'Hello?', nested: [null, false, 0, ''] },
          groundTruth: 'Hello',
          expectedTrajectory: { arbitrary: { nested: ['preserved'] } },
          toolMocks: [{ toolName: 'lookup', args: { id: 1 }, output: null, matchArgs: 'ignore' }],
          unmockedToolPolicy: 'deny',
          scorerIds: [],
          requestContext: { locale: 'en' },
          metadata: { category: 'greeting' },
          source: { type: 'trace', referenceId: 'source-trace' },
        },
      },
    ],
    provenance: {
      exportedAt: '2026-09-11T12:00:00Z',
      sourceDatasetId: 'dev-dataset',
      itemVersion: 12,
      configurationBasis: 'export-time',
    },
  };
}

describe('dataset snapshots', () => {
  it('round-trips every authored field without mutating the caller', () => {
    const content = fixture();
    const before = structuredClone(content);
    const snapshot = createDatasetSnapshot(content);
    expect(parseDatasetSnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
    const { digest, ...roundTrip } = snapshot;
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(roundTrip).toEqual(content);
    expect(content).toEqual(before);
  });

  it('captures authored JSON independently of later caller mutations', () => {
    const content = fixture();
    const snapshot = createDatasetSnapshot(content);
    content.configuration.metadata!.team = 'changed';
    content.items[0]!.payload.toolMocks![0]!.args.id = 2;
    expect(snapshot.configuration.metadata!.team).toBe('quality');
    expect(snapshot.items[0]!.payload.toolMocks![0]!.args.id).toBe(1);
    expect(datasetSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  it('supports empty datasets', () => {
    const content = fixture();
    content.items = [];
    expect(parseDatasetSnapshot(JSON.stringify(createDatasetSnapshot(content))).items).toEqual([]);
  });

  it.each([undefined, null, ''])('preserves the stored description representation: %s', description => {
    const content = fixture();
    if (description === undefined) delete content.configuration.description;
    else content.configuration.description = description;
    const snapshot = parseDatasetSnapshot(JSON.stringify(createDatasetSnapshot(content)));
    expect(snapshot.configuration).toEqual(content.configuration);
  });

  it('preserves absent, null, and empty overrides and missing external IDs', () => {
    const content = fixture();
    content.items = [
      { itemIdentity, payload: { input: null } },
      { itemIdentity: otherIdentity, payload: { input: false, scorerIds: null, externalId: null } },
      { itemIdentity: datasetIdentity, payload: { input: 0, scorerIds: [] } },
    ];
    const result = parseDatasetSnapshot(JSON.stringify(createDatasetSnapshot(content)));
    expect(result.items).toEqual(content.items);
    expect(result.items[0]!.payload).not.toHaveProperty('scorerIds');
    expect(result.items[0]!.payload).not.toHaveProperty('externalId');
  });

  it('rejects duplicate portable identities and external IDs rather than deduplicating', () => {
    const content = fixture();
    content.items.push(structuredClone(content.items[0]!));
    const result = datasetSnapshotContentSchema.safeParse(content);
    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected invalid identities');
    expect(result.error.issues.map(issue => issue.path)).toEqual([
      ['items', 1, 'itemIdentity'],
      ['items', 1, 'payload', 'externalId'],
    ]);
  });

  it.each([
    (value: Record<string, any>) => {
      value.formatVersion = 2;
    },
    (value: Record<string, any>) => {
      value.extra = true;
    },
    (value: Record<string, any>) => {
      value.configuration.organizationId = 'foreign-tenant';
    },
    (value: Record<string, any>) => {
      value.items[0].payload.datasetId = 'local-id';
    },
    (value: Record<string, any>) => {
      value.items[0].payload.toolMocks[0].extra = true;
    },
    (value: Record<string, any>) => {
      value.items[0].payload.source.extra = true;
    },
    (value: Record<string, any>) => {
      value.provenance.configurationBasis = 'historical';
    },
    (value: Record<string, any>) => {
      value.provenance.itemVersion = -1;
    },
    (value: Record<string, any>) => {
      value.provenance.exportedAt = 'yesterday';
    },
    (value: Record<string, any>) => {
      value.datasetIdentity = 'local-id';
    },
    (value: Record<string, any>) => {
      delete value.items[0].payload.input;
    },
    (value: Record<string, any>) => {
      delete value.items[0].payload.toolMocks[0].output;
    },
  ])('rejects invalid envelope and authored-field shapes (%#)', mutate => {
    const content = fixture();
    mutate(content);
    expect(datasetSnapshotContentSchema.safeParse(content).success).toBe(false);
  });

  it.each([
    undefined,
    NaN,
    Infinity,
    -Infinity,
    1n,
    Symbol('value'),
    () => 1,
    new Date(),
    new Map(),
    new Set(),
    new (class Value {})(),
    { nested: undefined },
    { toJSON: () => 'changed' },
    '\ud800',
    '\udfff',
    { '\ud800': 'key' },
    new Array(1),
    Object.assign([1], { extra: 2 }),
    { [Symbol('hidden')]: 1 },
    Object.defineProperty({}, 'hidden', { value: 1 }),
    Object.defineProperty({}, 'accessor', { enumerable: true, get: () => 1 }),
  ])('rejects non-JSON or lossy payloads (%#)', input => {
    const content = fixture();
    const invalid = { ...content, items: [{ itemIdentity, payload: { input } }] };
    expect(datasetSnapshotContentSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects cycles without overflowing and accepts shared non-cyclic references', () => {
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(datasetSnapshotContentSchema.safeParse({ ...fixture(), configuration: cycle }).success).toBe(false);
    const shared = { value: 'ok' };
    const content = fixture();
    content.items[0]!.payload.input = { a: shared, b: shared };
    expect(createDatasetSnapshot(content).items[0]!.payload.input).toEqual({ a: shared, b: shared });
  });

  it('rejects array subclasses without invoking inherited serialization hooks', () => {
    let calls = 0;
    class RewrittenArray extends Array<string> {
      toJSON() {
        calls++;
        return ['different'];
      }
    }
    const content = fixture();
    content.items[0]!.payload.input = new RewrittenArray('original');
    expect(datasetSnapshotContentSchema.safeParse(content).success).toBe(false);
    expect(() => createDatasetSnapshot(content)).toThrow('Expected lossless JSON');
    expect(calls).toBe(0);
  });

  it('accepts exactly the nesting limit and rejects one level deeper in a valid payload', () => {
    const content = fixture();
    let nested: DatasetSnapshotContent['items'][number]['payload']['input'] = null;
    // The input itself is four levels below the envelope root.
    for (let i = 0; i < DATASET_SNAPSHOT_MAX_DEPTH - 4; i++) nested = { nested };
    content.items[0]!.payload.input = nested;
    const snapshot = createDatasetSnapshot(content);
    expect(parseDatasetSnapshot(JSON.stringify(snapshot))).toEqual(snapshot);

    content.items[0]!.payload.input = { nested };
    const result = datasetSnapshotContentSchema.safeParse(content);
    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected excessive nesting');
    expect(result.error.issues).toEqual([
      expect.objectContaining({ code: 'custom', path: [], message: expect.stringContaining('100 levels of nesting') }),
    ]);
    expect(() => createDatasetSnapshot(content)).toThrow('100 levels of nesting');
    expect(() => parseDatasetSnapshot(JSON.stringify({ ...content, digest: snapshot.digest }))).toThrow(
      '100 levels of nesting',
    );
  });

  it('canonicalizes object keys and item order but preserves authored array order', () => {
    const content = fixture();
    content.items.push({ itemIdentity: otherIdentity, payload: { input: { b: 2, a: 1 } } });
    const digest = createDatasetSnapshot(content).digest;
    content.items.reverse();
    content.items[0]!.payload.input = { a: 1, b: 2 };
    expect(createDatasetSnapshot(content).digest).toBe(digest);
    content.configuration.tags = ['a', 'b'];
    const arrayDigest = createDatasetSnapshot(content).digest;
    content.configuration.tags.reverse();
    expect(createDatasetSnapshot(content).digest).not.toBe(arrayDigest);
  });

  it('uses RFC 8785 primitive encoding and UTF-16 property ordering, including numeric keys', () => {
    const content: DatasetSnapshotContent = {
      formatVersion: 1,
      datasetIdentity,
      configuration: { name: '' },
      items: [
        {
          itemIdentity,
          payload: {
            input: {
              '2': 'two',
              '10': 'ten',
              '\r': 'control',
              '€': 'euro',
              '😀': 'emoji',
              numbers: [333333333.33333329, 1e30, 4.5, 2e-3, 1e-27, -0],
            },
          },
        },
      ],
      provenance: {
        exportedAt: '2026-09-11T12:00:00Z',
        sourceDatasetId: 'source',
        itemVersion: 0,
        configurationBasis: 'export-time',
      },
    };
    const canonical =
      '{"configuration":{"name":""},"datasetIdentity":"' +
      datasetIdentity +
      '","formatVersion":1,"items":[{"itemIdentity":"' +
      itemIdentity +
      '","payload":{"input":{"\\r":"control","10":"ten","2":"two","numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27,0],"€":"euro","😀":"emoji"}}}],"provenance":{"configurationBasis":"export-time","exportedAt":"2026-09-11T12:00:00Z","itemVersion":0,"sourceDatasetId":"source"}}';
    expect(createDatasetSnapshot(content).digest).toBe(createHash('sha256').update(canonical).digest('hex'));
  });

  it('covers configuration, payloads, identity, and provenance in the digest', () => {
    const snapshot = createDatasetSnapshot(fixture());
    const variants = [
      { ...snapshot, configuration: { ...snapshot.configuration, name: 'changed' } },
      { ...snapshot, items: [] },
      { ...snapshot, datasetIdentity: otherIdentity },
      { ...snapshot, provenance: { ...snapshot.provenance, itemVersion: 13 } },
      { ...snapshot, digest: '0'.repeat(64) },
    ];
    for (const variant of variants)
      expect(() => parseDatasetSnapshot(JSON.stringify(variant))).toThrow('digest mismatch');
    expect(datasetSnapshotSchema.safeParse({ ...snapshot, digest: 'not-a-hash' }).success).toBe(false);
  });

  it('uses a configurable default budget without making size part of the format', () => {
    const content = fixture();
    content.items[0]!.payload.input = 'é'.repeat(DATASET_SNAPSHOT_DEFAULT_MAX_BYTES / 2);
    const limitError = `${DATASET_SNAPSHOT_DEFAULT_MAX_BYTES} byte limit`;
    expect(() => createDatasetSnapshot(content)).toThrow(limitError);
    const options = { maxBytes: 8 * 1024 * 1024 };
    const snapshot = createDatasetSnapshot(content, options);
    const text = JSON.stringify(snapshot);
    expect(() => parseDatasetSnapshot(text)).toThrow(limitError);
    expect(parseDatasetSnapshot(text, options)).toEqual(snapshot);
    expect(datasetSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(datasetSnapshotSchema.safeParse({ ...snapshot, digest: '0'.repeat(64) }).success).toBe(false);
    expect(createDatasetSnapshot(content, { maxBytes: options.maxBytes * 2 })).toEqual(snapshot);
    expect(snapshot).not.toHaveProperty('maxBytes');
  });

  it('counts complete UTF-8 bytes and accepts exactly the configured budget', () => {
    const content = fixture();
    content.items[0]!.payload.input = 'é😀';
    const snapshot = createDatasetSnapshot(content);
    const text = JSON.stringify(snapshot);
    const maxBytes = Buffer.byteLength(text, 'utf8');
    expect(maxBytes).toBeGreaterThan(text.length);
    expect(createDatasetSnapshot(content, { maxBytes })).toEqual(snapshot);
    expect(parseDatasetSnapshot(text, { maxBytes })).toEqual(snapshot);
    expect(() => createDatasetSnapshot(content, { maxBytes: maxBytes - 1 })).toThrow('byte limit');
    expect(() => parseDatasetSnapshot(text, { maxBytes: maxBytes - 1 })).toThrow('byte limit');
    expect(() => parseDatasetSnapshot(text + ' ', { maxBytes })).toThrow('byte limit');
    expect(parseDatasetSnapshot(text + ' ', { maxBytes: maxBytes + 1 })).toEqual(snapshot);
    const pretty = JSON.stringify(snapshot, null, 2);
    expect(() => parseDatasetSnapshot(pretty, { maxBytes })).toThrow('byte limit');
    expect(parseDatasetSnapshot(pretty, { maxBytes: Buffer.byteLength(pretty) })).toEqual(snapshot);
  });

  it('checks raw size before parsing JSON', () => {
    expect(() => parseDatasetSnapshot('{{', { maxBytes: 1 })).toThrow('byte limit');
    expect(() => parseDatasetSnapshot('{{', { maxBytes: 2 })).toThrow('Invalid dataset snapshot JSON');
  });

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid maxBytes: %s', maxBytes => {
    const content = fixture();
    const text = JSON.stringify(createDatasetSnapshot(content));
    expect(() => createDatasetSnapshot(content, { maxBytes })).toThrow();
    expect(() => parseDatasetSnapshot(text, { maxBytes })).toThrow();
  });

  it('rejects duplicate JSON property names, including escaped spellings', () => {
    const text = JSON.stringify(createDatasetSnapshot(fixture()));
    expect(() =>
      parseDatasetSnapshot(text.replace('"formatVersion":1', '"formatVersion":2,"formatVersion":1')),
    ).toThrow('Duplicate JSON property');
    expect(() =>
      parseDatasetSnapshot(text.replace('"formatVersion":1', '"formatVersion":2,"format\\u0056ersion":1')),
    ).toThrow('Duplicate JSON property');
  });

  it('preserves special property names in authored JSON', () => {
    const content = fixture();
    content.items[0]!.payload.input = JSON.parse('{"__proto__":{"safe":true},"constructor":"authored","prototype":1}');
    expect(createDatasetSnapshot(content).items[0]!.payload.input).toEqual(content.items[0]!.payload.input);
    content.configuration.metadata = JSON.parse('{"__proto__":{"safe":true}}');
    expect(createDatasetSnapshot(content).configuration.metadata).toEqual(content.configuration.metadata);
    expect({}).not.toHaveProperty('safe');
  });
});
