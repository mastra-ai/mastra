/**
 * Value binding and row normalization for the Turso engine.
 *
 * Turso's driver coerces unsupported bind values with `toString()` instead of
 * rejecting them, so a mistake is written to disk as plausible-looking data and
 * only surfaces much later as a corrupt read. Verified against
 * `@tursodatabase/database@0.7.2`:
 *
 * ```
 * undefined -> "undefined"                                   (TEXT)
 * Date      -> "Thu Jan 02 2020 03:04:05 GMT+0000 (…)"        (TEXT)
 * NaN       -> null                                          (NULL)
 * Infinity  -> null                                          (REAL)
 * true      -> 1                                             (INTEGER)
 * Uint8Array-> blob                                          (BLOB)
 * ```
 *
 * A `Date` silently persisted as a locale string is unsortable, unparseable
 * across locales, and unrecoverable once written. `undefined` — the natural
 * result of reading an absent optional field — becomes the literal text
 * `"undefined"` rather than SQL `NULL`. Both are converted explicitly here;
 * values with no sound SQLite representation are rejected loudly at bind time
 * instead of being written as garbage.
 */

import { TursoError } from './errors';

/** Values SQLite can store natively. */
export type TursoValue = null | string | number | bigint | Uint8Array;

/** Values accepted for binding, before normalization. */
export type TursoInputValue = TursoValue | undefined | boolean | Date;

/** Positional or named bind parameters. */
export type TursoBindParams = TursoInputValue[] | Record<string, TursoInputValue>;

/** A normalized result row. */
export type TursoRow = Record<string, TursoValue>;

/**
 * Converts a single bind value to something SQLite stores faithfully.
 *
 * `Date` becomes epoch milliseconds — an integer that sorts and round-trips
 * exactly, unlike the driver's locale-formatted string. `undefined` becomes
 * `NULL`. Non-finite numbers are rejected rather than silently written as
 * `NULL`, since a lost `NaN` is indistinguishable from an intentionally absent
 * value on read.
 */
export function toBindValue(value: TursoInputValue, label: string): TursoValue {
  if (value === undefined || value === null) return null;

  switch (typeof value) {
    case 'string':
    case 'bigint':
      return value;
    case 'boolean':
      return value ? 1 : 0;
    case 'number':
      if (!Number.isFinite(value)) {
        throw new TursoError(
          `Cannot bind non-finite number (${value}) for ${label}; SQLite has no representation for it and Turso would store NULL.`,
          'SQLITE_MISUSE',
        );
      }
      return value;
    case 'object':
      if (value instanceof Date) {
        const time = value.getTime();
        if (Number.isNaN(time)) {
          throw new TursoError(`Cannot bind an invalid Date for ${label}.`, 'SQLITE_MISUSE');
        }
        return time;
      }
      if (value instanceof Uint8Array) return value;
      break;
  }

  throw new TursoError(
    `Cannot bind value of type ${Object.prototype.toString.call(value)} for ${label}; Turso would coerce it to a string.`,
    'SQLITE_MISUSE',
  );
}

/** Normalizes a full parameter set, preserving positional vs named form. */
export function toBindParams(params?: TursoBindParams): TursoValue[] | Record<string, TursoValue> | undefined {
  if (params === undefined) return undefined;

  if (Array.isArray(params)) {
    return params.map((value, index) => toBindValue(value, `parameter ${index + 1}`));
  }

  const normalized: Record<string, TursoValue> = {};
  for (const [key, value] of Object.entries(params)) {
    normalized[key] = toBindValue(value, `parameter '${key}'`);
  }
  return normalized;
}

/**
 * Normalizes a value read back from Turso.
 *
 * Statements run with `safeIntegers` enabled so large integers survive the
 * read (without it, `9007199254740993` comes back as `…992`). Integers within
 * the safe range are narrowed back to `number` so callers get ordinary numbers
 * and only genuinely large values stay `bigint`.
 */
export function fromColumnValue(value: unknown): TursoValue {
  if (value === null || value === undefined) return null;

  if (typeof value === 'bigint') {
    return value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(value)
      : value;
  }

  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  // Node returns BLOBs as Buffer, which is already a Uint8Array.
  if (value instanceof Uint8Array) return value;

  return String(value);
}

/** Normalizes a raw driver row into a plain record of SQLite values. */
export function fromRow(row: Record<string, unknown>): TursoRow {
  const normalized: TursoRow = {};
  for (const key of Object.keys(row)) {
    normalized[key] = fromColumnValue(row[key]);
  }
  return normalized;
}
