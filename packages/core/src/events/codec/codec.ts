import type { SerializedError } from '../../error/utils';
import { rehydrateError, serializeError } from './error';
import { getClassCodec } from './registry';
import { CODEC_TAG, isEnvelope } from './tags';
import type { Envelope } from './tags';

/**
 * Encode a value into a JSON-safe shape. Non-JSON-safe types (Date, Error,
 * Map, Set, RegExp, URL, BigInt, undefined, registered classes) are wrapped
 * in tagged envelopes that the decoder can reconstruct.
 *
 * Functions and symbols are dropped (parity with JSON.stringify). Cycles are
 * replaced with null at the second visit. NaN/Infinity become null. Honors
 * user `toJSON()` methods on plain objects.
 */
export function encode(value: unknown): unknown {
  return walk(value, new WeakSet());
}

function walk(v: unknown, seen: WeakSet<object>): unknown {
  if (v === undefined) return { [CODEC_TAG]: 'Undefined' } satisfies Envelope;
  if (v === null) return null;

  const t = typeof v;
  if (t === 'string' || t === 'boolean') return v;
  if (t === 'number') return Number.isFinite(v as number) ? v : null;
  if (t === 'bigint') return { [CODEC_TAG]: 'BigInt', v: (v as bigint).toString() } satisfies Envelope;
  if (t === 'function' || t === 'symbol') return undefined;

  if (v instanceof Date) {
    return { [CODEC_TAG]: 'Date', v: v.toISOString() } satisfies Envelope;
  }
  if (v instanceof RegExp) {
    return { [CODEC_TAG]: 'RegExp', v: { source: v.source, flags: v.flags } } satisfies Envelope;
  }
  if (v instanceof URL) {
    return { [CODEC_TAG]: 'URL', v: v.toString() } satisfies Envelope;
  }
  if (v instanceof Error) {
    return { [CODEC_TAG]: 'Error', v: serializeError(v) } satisfies Envelope;
  }
  if (v instanceof Map) {
    if (seen.has(v)) return null;
    seen.add(v);
    const entries: Array<[unknown, unknown]> = [];
    for (const [k, val] of v.entries()) {
      entries.push([walk(k, seen), walk(val, seen)]);
    }
    return { [CODEC_TAG]: 'Map', v: entries } satisfies Envelope;
  }
  if (v instanceof Set) {
    if (seen.has(v)) return null;
    seen.add(v);
    const values: unknown[] = [];
    for (const x of v) values.push(walk(x, seen));
    return { [CODEC_TAG]: 'Set', v: values } satisfies Envelope;
  }

  if (Array.isArray(v)) {
    if (seen.has(v)) return null;
    seen.add(v);
    return v.map(x => walk(x, seen));
  }

  if (t === 'object') {
    if (seen.has(v as object)) return null;
    seen.add(v as object);

    // Honor toJSON() — matches JSON.stringify behavior. Skip for plain objects
    // that already carry a literal CODEC_TAG key (defensive: do not let user
    // data masquerade as an envelope through toJSON).
    const maybeToJSON = (v as { toJSON?: unknown }).toJSON;
    if (typeof maybeToJSON === 'function') {
      return walk((maybeToJSON as () => unknown).call(v), seen);
    }

    // Class registry lookup by exact constructor name. Falls back to plain
    // object walk for unknown classes — they decode to plain data.
    const ctor = (v as object).constructor;
    const ctorName = ctor?.name;
    if (ctorName && ctorName !== 'Object') {
      const reg = getClassCodec(ctorName);
      if (reg) {
        return {
          [CODEC_TAG]: 'Class',
          n: ctorName,
          v: walk(reg.toData(v), seen),
        } satisfies Envelope;
      }
    }

    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>)) {
      // Skip prototype-pollution vectors.
      if (k === '__proto__') continue;
      const raw = (v as Record<string, unknown>)[k];
      if (raw === undefined) {
        // Preserve explicit undefined keys (JSON.stringify drops them).
        out[k] = { [CODEC_TAG]: 'Undefined' } satisfies Envelope;
        continue;
      }
      const encoded = walk(raw, seen);
      if (encoded === undefined) continue; // function/symbol fields are dropped
      out[k] = encoded;
    }
    return out;
  }

  return v;
}

/**
 * Decode a value previously produced by `encode`. Reconstructs envelope-tagged
 * types and recursively decodes nested values. Plain objects that happen to
 * carry a `CODEC_TAG` key but do not match an envelope shape are preserved.
 */
export function decode(value: unknown): unknown {
  if (value === null) return null;
  if (typeof value !== 'object') return value;

  if (Array.isArray(value)) return value.map(decode);

  if (CODEC_TAG in value && isEnvelope(value)) {
    const env = value as Envelope;
    switch (env[CODEC_TAG]) {
      case 'Undefined':
        return undefined;
      case 'Date':
        return new Date(env.v);
      case 'BigInt':
        return BigInt(env.v);
      case 'RegExp':
        return new RegExp(env.v.source, env.v.flags);
      case 'URL':
        return new URL(env.v);
      case 'Map':
        return new Map(env.v.map(([k, val]) => [decode(k), decode(val)]));
      case 'Set':
        return new Set(env.v.map(decode));
      case 'Error':
        return rehydrateError(decodeSerializedError(env.v));
      case 'Class': {
        const reg = getClassCodec(env.n);
        const data = decode(env.v);
        return reg ? reg.fromData(data) : data;
      }
    }
  }

  const out: Record<string, unknown> = {};
  for (const k of Object.keys(value as Record<string, unknown>)) {
    if (k === '__proto__') continue;
    out[k] = decode((value as Record<string, unknown>)[k]);
  }
  return out;
}

/**
 * Recursively decode any envelopes embedded inside a SerializedError's custom
 * fields (e.g. an error with a `details: Map` field). The top-level shape
 * stays a SerializedError so `rehydrateError` can consume it.
 */
function decodeSerializedError(s: SerializedError): SerializedError {
  const decoded = decode(s) as SerializedError;
  return decoded;
}
