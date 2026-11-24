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
