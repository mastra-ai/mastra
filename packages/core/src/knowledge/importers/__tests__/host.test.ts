import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  KnowledgeImporterHostConflictError,
  parseKnowledgeImporterFlushBody,
  canonicalJson,
  knowledgeImporterFlushDigest,
  normalizeKnowledgeImporterFinish,
} from '../index';
import type { KnowledgeImporterFinishRequest, KnowledgeImporterOp } from '../index';

describe('canonicalJson (RFC 8785)', () => {
  it('matches the RFC 8785 appendix example', () => {
    const parsed = JSON.parse(
      '{"numbers": [333333333.33333329, 1E30, 4.50, 2e-3, 0.000000000000000000000000001], "string": "\\u20ac$\\u000F\\u000aA\'\\u0042\\u0022\\u005c\\\\\\"\\/", "literals": [null, true, false]}',
    );
    expect(canonicalJson(parsed)).toBe(
      '{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"€$\\u000f\\nA\'B\\"\\\\\\\\\\"/"}',
    );
  });

  it('sorts keys by UTF-16 code units (RFC 8785 §3.2.3)', () => {
    const keys = ['\u20ac', '\r', '\ufb33', '1', '\ud83d\ude00', '\u0080', '\u00f6'];
    // Read the order from the string: a parsed object would put the integer-like key "1" first.
    const canonical = canonicalJson(Object.fromEntries(keys.map(key => [key, 0])));
    expect(canonical).toBe(
      `{${['\r', '1', '\u0080', '\u00f6', '\u20ac', '\ud83d\ude00', '\ufb33'].map(key => `${JSON.stringify(key)}:0`).join(',')}}`,
    );
  });

  it('writes array holes as null, as JSON.stringify does', () => {
    const sparse = Array<string>(2);
    sparse[1] = 'b';
    expect(canonicalJson({ a: sparse })).toBe(JSON.stringify({ a: sparse }));
    expect(canonicalJson({ a: sparse })).toBe('{"a":[null,"b"]}');
  });

  it('refuses lone UTF-16 surrogates in keys and values (RFC 8785 §3.2.2.2)', () => {
    expect(() => canonicalJson({ a: '\ud800' })).toThrow(/lone UTF-16 surrogate/);
    expect(() => canonicalJson({ a: 'x\udc00' })).toThrow(/lone UTF-16 surrogate/);
    expect(() => canonicalJson({ '\ud83d': 1 })).toThrow(/lone UTF-16 surrogate/);
    expect(canonicalJson({ a: '\ud83d\ude00' })).toBe('{"a":"😀"}');
  });

  it('drops undefined members, as the wire does, and refuses what JSON cannot hold', () => {
    expect(canonicalJson({ b: 1, a: undefined, c: [undefined] })).toBe('{"b":1,"c":[null]}');
    expect(canonicalJson({ z: -0 })).toBe('{"z":0}');
    expect(() => canonicalJson({ n: Number.NaN })).toThrow(TypeError);
    expect(() => canonicalJson({ f: () => 1 })).toThrow(TypeError);
  });
});

describe('knowledgeImporterFlushDigest', () => {
  const ops: KnowledgeImporterOp[] = [
    { op: 'upsert', item: { sourceId: 'request:1', title: 'Refunds', body: 'Ask first.', parent: null } },
    { op: 'remove', sourceId: 'request:2' },
  ];

  it('is SHA-256 hex of the canonical { ops, state }', async () => {
    const expected = createHash('sha256')
      .update(canonicalJson({ ops, state: { cursor: '42' } }))
      .digest('hex');
    await expect(knowledgeImporterFlushDigest({ ops, state: { cursor: '42' } })).resolves.toBe(expected);
  });

  it('pins the digest other hosts must reproduce', async () => {
    // Golden value shared with hosted Knowledge's applier: change it only with every host.
    await expect(knowledgeImporterFlushDigest({ ops, state: { cursor: '42' } })).resolves.toBe(
      createHash('sha256')
        .update(
          '{"ops":[{"item":{"body":"Ask first.","parent":null,"sourceId":"request:1","title":"Refunds"},"op":"upsert"},{"op":"remove","sourceId":"request:2"}],"state":{"cursor":"42"}}',
        )
        .digest('hex'),
    );
  });

  it('treats an absent state as null and ignores key order', async () => {
    const absent = await knowledgeImporterFlushDigest({ ops });
    expect(absent).toBe(
      createHash('sha256')
        .update(canonicalJson({ ops, state: null }))
        .digest('hex'),
    );
    const reordered = await knowledgeImporterFlushDigest({
      ops: [
        { op: 'upsert', item: { title: 'Refunds', parent: null, body: 'Ask first.', sourceId: 'request:1' } },
        ops[1]!,
      ],
    });
    expect(reordered).toBe(absent);
    expect(await knowledgeImporterFlushDigest({ ops, state: {} })).not.toBe(absent);
  });
});

describe('parseKnowledgeImporterFlushBody', () => {
  const upsert = { op: 'upsert', item: { sourceId: 'a', title: 'A', body: 'x' } };

  it.each(['2026-02-30T00:00Z', '2026-01-01T24:00Z', '2026-04-31T00:00:00+02:00'])(
    'refuses calendar rollover %s in either item timestamp',
    time => {
      for (const field of ['occurredAt', 'editedAt']) {
        expect(() =>
          parseKnowledgeImporterFlushBody({
            ops: [
              {
                op: 'sequenceItem',
                sequence: 'a',
                sequenceItem: {
                  externalId: '1',
                  body: '',
                  occurredAt: '2026-02-28T00:00Z',
                  [field]: time,
                },
              },
            ],
          }),
        ).toThrow(TypeError);
      }
    },
  );

  it.each([
    [
      'a sparse aliases array',
      { ops: [{ op: 'upsert', item: { sourceId: 'a', title: 'A', body: 'x', aliases: Array<string>(1) } }] },
    ],
    ['a null alias', { ops: [{ op: 'upsert', item: { sourceId: 'a', title: 'A', body: 'x', aliases: [null] } }] }],
    ['a sparse ops array', { ops: Array(1) }],
    ['a lone surrogate in a body', { ops: [{ op: 'upsert', item: { sourceId: 'a', title: 'A', body: '\ud800' } }] }],
    ['a lone surrogate in a state key', { ops: [], state: { '\udc00': '1' } }],
    ['an unknown item field', { ops: [{ op: 'upsert', item: { sourceId: 'a', title: 'A', body: 'x', path: 'p' } }] }],
    ['an unknown op field', { ops: [{ ...upsert, pageId: 'p' }] }],
    ['a body on a declare', { ops: [{ op: 'declare', item: { sourceId: 'a', title: 'A', body: 'x' } }] }],
    ['an upsert without a body', { ops: [{ op: 'upsert', item: { sourceId: 'a', title: 'A' } }] }],
    ['an empty sourceId', { ops: [{ op: 'remove', sourceId: '' }] }],
    ['an unknown op', { ops: [{ op: 'move', sourceId: 'a' }] }],
    [
      'a link without a sourceId',
      { ops: [{ op: 'upsert', item: { sourceId: 'a', title: 'A', body: 'x', links: [{ rel: 'r' }] } }] },
    ],
    ['a non-string state value', { ops: [], state: { cursor: 42 } }],
  ])('refuses %s', (_name, body) => {
    expect(() => parseKnowledgeImporterFlushBody(body)).toThrow(TypeError);
  });

  describe('sequence items and declarations', () => {
    const sequenceItem = {
      externalId: 'step-2',
      title: 'Roll back',
      links: [{ url: 'https://example.com/runbook', title: 'Runbook' }, { url: 'https://example.com/raw' }],
      properties: { owner: 'ops', checks: ['db', { name: 'cache', retries: 2 }], done: false },
      type: 'step',
      externalParentId: 'step-1',
      after: 'step-1',
    };
    const declaration = {
      sourceId: 'runbook',
      title: 'Runbook',
      sequence: {
        orderBy: 'position',
        propertiesSchema: { type: 'object', properties: { owner: { type: 'string' } } },
        itemTypes: { step: { label: 'Step' } },
      },
    };

    it('takes the whole item envelope, with no time or body on a position item', async () => {
      const body = { ops: [{ op: 'sequenceItem', sequence: 'runbook', sequenceItem }] };
      expect(parseKnowledgeImporterFlushBody(body).ops).toEqual(body.ops);
      expect(await knowledgeImporterFlushDigest(JSON.parse(JSON.stringify(body)))).toBe(
        await knowledgeImporterFlushDigest(body),
      );
    });

    it('takes position and before, and drops undefined property members as the wire does', () => {
      const [op] = parseKnowledgeImporterFlushBody({
        ops: [
          {
            op: 'sequenceItem',
            sequence: 'runbook',
            sequenceItem: { externalId: 'a', title: 'A', position: 'm', properties: { kept: 1, gone: undefined } },
          },
          { op: 'sequenceItem', sequence: 'runbook', sequenceItem: { externalId: 'b', title: 'B', before: 'a' } },
        ],
      }).ops;
      expect(op).toEqual({
        op: 'sequenceItem',
        sequence: 'runbook',
        sequenceItem: { externalId: 'a', title: 'A', position: 'm', properties: { kept: 1 } },
      });
    });

    // Storage keeps properties at any depth that fits in 16 KB, so the wire and the digest must too.
    const nest = (depth: number, wrap: (inner: unknown) => unknown) => {
      let value: unknown = 'leaf';
      for (let level = 0; level < depth; level++) value = wrap(value);
      return value;
    };
    it.each([
      ['object', nest(2_500, inner => ({ a: inner }))],
      ['array', { list: nest(2_500, inner => [inner]) }],
    ])('carries %s properties nested 2,500 deep through parse and digest', async (_kind, properties) => {
      const body = {
        ops: [{ op: 'sequenceItem', sequence: 'runbook', sequenceItem: { externalId: 'd', properties, title: 'D' } }],
      };
      const wire = JSON.parse(JSON.stringify(body));
      expect(JSON.stringify(wire).length).toBeLessThan(16 * 1024);
      expect(canonicalJson(parseKnowledgeImporterFlushBody(wire).ops)).toBe(JSON.stringify(wire.ops));
      // Keys are already sorted and one per level, so the canonical form is what JSON.stringify writes.
      expect(canonicalJson(wire)).toBe(JSON.stringify(wire));
      await expect(knowledgeImporterFlushDigest(wire)).resolves.toBe(
        createHash('sha256')
          .update(JSON.stringify({ ops: wire.ops, state: null }))
          .digest('hex'),
      );
    });

    it('copies a value repeated across properties, which is not a cycle', () => {
      const shared = { id: 1 };
      const [op] = parseKnowledgeImporterFlushBody(withItem({ properties: { a: shared, b: [shared, shared] } })).ops;
      expect(op).toMatchObject({ sequenceItem: { properties: { a: { id: 1 }, b: [{ id: 1 }, { id: 1 }] } } });
      expect(canonicalJson({ a: shared, b: [shared] })).toBe('{"a":{"id":1},"b":[{"id":1}]}');
    });

    it('refuses a cycle in canonical JSON with a TypeError', () => {
      const loop: unknown[] = [];
      loop.push(loop);
      expect(() => canonicalJson(loop)).toThrow(TypeError);
    });

    it('takes a sequence declaration on a declare and on an upsert', () => {
      const ops = [
        { op: 'declare', item: declaration },
        { op: 'upsert', item: { ...declaration, sourceId: 'log', body: 'Deploys.', sequence: {} } },
      ];
      expect(parseKnowledgeImporterFlushBody({ ops }).ops).toEqual(ops);
    });

    const withItem = (patch: Record<string, unknown>) => ({
      ops: [{ op: 'sequenceItem', sequence: 'runbook', sequenceItem: { ...sequenceItem, ...patch } }],
    });
    const withSequence = (sequence: unknown) => ({ ops: [{ op: 'declare', item: { ...declaration, sequence } }] });

    it.each([
      ['the old threadExternalId', withItem({ threadExternalId: 'step-1' })],
      ['a page link on an item', withItem({ links: [{ sourceId: 'page' }] })],
      ['a link without a url', withItem({ links: [{ title: 'T' }] })],
      ['an empty link url', withItem({ links: [{ url: '' }] })],
      ['array properties', withItem({ properties: ['a'] })],
      ['a sparse array in properties', withItem({ properties: { list: Array(1) } })],
      ['a non-finite number in properties', withItem({ properties: { n: Number.NaN } })],
      ['a lone surrogate in a property key', withItem({ properties: { '\ud800': 1 } })],
      [
        'a cycle in properties',
        withItem({
          properties: (() => {
            const loop: Record<string, unknown> = {};
            loop.self = loop;
            return loop;
          })(),
        }),
      ],
      ['an empty type', withItem({ type: '' })],
      ['an empty position', withItem({ position: '' })],
      ['an unknown orderBy', withSequence({ orderBy: 'alphabetical' })],
      ['an unknown sequence field', withSequence({ order: 'position' })],
      ['a non-object sequence', withSequence('position')],
      ['an array propertiesSchema', withSequence({ propertiesSchema: [] })],
      ['a non-object itemTypes', withSequence({ itemTypes: 'step' })],
    ])('refuses %s', (_name, body) => {
      expect(() => parseKnowledgeImporterFlushBody(body)).toThrow(TypeError);
    });
  });

  it('keeps a "__proto__" state key from JSON as data, so its value changes the digest', async () => {
    const a = JSON.parse('{"ops":[],"state":{"__proto__":"cursor-a"}}');
    const b = JSON.parse('{"ops":[],"state":{"__proto__":"cursor-b"}}');
    const parsed = parseKnowledgeImporterFlushBody(a);
    expect(Object.hasOwn(parsed.state!, '__proto__')).toBe(true);
    expect(parsed.state!['__proto__']).toBe('cursor-a');
    expect(await knowledgeImporterFlushDigest(a)).not.toBe(await knowledgeImporterFlushDigest(b));
    expect(canonicalJson(parsed.state)).toBe('{"__proto__":"cursor-a"}');
  });

  it('refuses a "__proto__" field on an item as unknown', () => {
    const body = JSON.parse('{"ops":[{"op":"upsert","item":{"sourceId":"a","title":"A","body":"x","__proto__":"p"}}]}');
    expect(() => parseKnowledgeImporterFlushBody(body)).toThrow(/unknown field "__proto__"/);
  });

  it('refuses a body it would hash differently after a JSON round trip', async () => {
    const aliases = Array<string>(1);
    await expect(
      knowledgeImporterFlushDigest({
        ops: [{ op: 'upsert', item: { sourceId: 'a', title: 'A', body: 'x', aliases } }],
      }),
    ).rejects.toThrow(TypeError);
  });

  it('hashes accepted bodies the same before and after a JSON round trip', async () => {
    const bodies = [
      {
        ops: [
          {
            op: 'upsert' as const,
            item: {
              sourceId: 'request:1',
              kind: 'request',
              title: 'Refunds 😀',
              parent: null,
              fallbackParent: '__orphans',
              description: undefined,
              body: 'Ask first.',
              links: [{ sourceId: 'request:2', rel: undefined }],
              aliases: ['https://help.example.com/1'],
            },
          },
          { op: 'declare' as const, item: { sourceId: 'category:9', title: 'Billing', parent: undefined } },
          { op: 'remove' as const, sourceId: 'request:3' },
        ],
        state: { cursor: '42', watermark: '' },
      },
      { ops: [] },
    ];
    for (const body of bodies) {
      const wire = JSON.parse(JSON.stringify(body));
      expect(parseKnowledgeImporterFlushBody(wire)).toEqual(parseKnowledgeImporterFlushBody(body));
      await expect(knowledgeImporterFlushDigest(wire)).resolves.toBe(await knowledgeImporterFlushDigest(body));
    }
  });
});

describe('normalizeKnowledgeImporterFinish', () => {
  const base: KnowledgeImporterFinishRequest = {
    runId: 'run-1',
    generation: 1,
    outcome: 'succeeded',
    backlog: true,
    lastSeq: 3,
  };

  it('fills missing optional fields with null so replays compare field for field', () => {
    expect(normalizeKnowledgeImporterFinish(base)).toEqual({
      outcome: 'succeeded',
      backlog: true,
      lastSeq: 3,
      error: null,
    });
    expect(
      normalizeKnowledgeImporterFinish({
        ...base,
        outcome: 'failed',
        backlog: false,
        error: { code: 'source_rate_limited' },
      }),
    ).toEqual({
      outcome: 'failed',
      backlog: false,
      lastSeq: 3,
      error: { code: 'source_rate_limited', retryable: null, httpStatus: null },
    });
  });

  it('reads error: null on a non-failed run from untyped wire input as no error', () => {
    const wire = JSON.parse(
      '{"runId":"run-1","generation":1,"outcome":"canceled","backlog":false,"lastSeq":0,"error":null}',
    );
    expect(normalizeKnowledgeImporterFinish(wire)).toEqual({
      outcome: 'canceled',
      backlog: false,
      lastSeq: 0,
      error: null,
    });
  });

  it.each([
    ['backlog on a failed run', { outcome: 'failed', error: { code: 'importer_error' } }],
    ['failed with no error', { outcome: 'failed', backlog: false }],
    ['an error on a succeeded run', { backlog: false, error: { code: 'importer_error' } }],
    ['an unknown code', { outcome: 'failed', backlog: false, error: { code: 'oops' } }],
    [
      'a status out of range',
      { outcome: 'failed', backlog: false, error: { code: 'source_bad_response', httpStatus: 99 } },
    ],
    ['a negative lastSeq', { lastSeq: -1 }],
    ['an unknown outcome', { outcome: 'skipped' }],
    ['failed with error: null', { outcome: 'failed', backlog: false, error: null }],
    ['failed with a non-object error', { outcome: 'failed', backlog: false, error: 'source_unreachable' }],
    [
      'an error with an unknown field',
      { outcome: 'failed', backlog: false, error: { code: 'importer_error', message: 'boom' } },
    ],
    ['a string backlog', { backlog: 'true' }],
    ['a string lastSeq', { lastSeq: '3' }],
  ])('refuses %s', (_name, change) => {
    expect(() => normalizeKnowledgeImporterFinish({ ...base, ...change } as KnowledgeImporterFinishRequest)).toThrow(
      TypeError,
    );
  });
});

describe('KnowledgeImporterHostConflictError', () => {
  it('carries a code and a 409 status', () => {
    const error = new KnowledgeImporterHostConflictError('seq_mismatch', 'Expected seq 4.');
    expect(error).toMatchObject({ name: 'KnowledgeImporterHostConflictError', code: 'seq_mismatch', status: 409 });
  });
});

describe('KnowledgeImporterHostError', () => {
  it('carries the HTTP status when there was a response, and none for a network error', async () => {
    const { KnowledgeImporterHostError } = await import('../index');
    expect(new KnowledgeImporterHostError('Bad gateway', 502)).toMatchObject({ status: 502 });
    expect(new KnowledgeImporterHostError('Connection reset').status).toBeUndefined();
  });
});
