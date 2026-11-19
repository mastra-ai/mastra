import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  KnowledgeImporterHostConflictError,
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
