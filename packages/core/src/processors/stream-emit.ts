/**
 * Well-known key a stream processor can set on its `state` to emit an extra
 * part immediately before the part it returns from `processOutputStream`.
 *
 * A processor's `processOutputStream` can only return a single part, but some
 * processors (e.g. `BatchPartsProcessor`) need to emit a buffered part *and*
 * the current part in the same call. Setting `state[EMIT_BEFORE_PART_KEY]`
 * tells the runner to feed that buffered part through the remaining downstream
 * processors and emit it before the returned part — without bypassing the rest
 * of the processor chain.
 */
export const EMIT_BEFORE_PART_KEY = '__mastraEmitBeforePart';
