/**
 * Well-known key a stream output processor can set on its `state` to ask the
 * ProcessorRunner to re-drive an additional part through the full output
 * processor chain after the current part has been emitted.
 *
 * `processOutputStream` can only return a single part, but some processors
 * (e.g. `BatchPartsProcessor`) need to emit two parts for one input: a flushed
 * batch of buffered text plus the non-text part that triggered the flush. The
 * processor returns the flushed batch (so it flows through downstream
 * processors normally) and stashes the non-text part under this key. The runner
 * then re-feeds the stashed part through the whole chain so it also receives
 * downstream processing and is emitted in order — instead of being deferred to
 * a "next" call that may never happen (which dropped the part when a `stopWhen`
 * condition stopped the agent on that part — issue #17094).
 */
export const REPROCESS_PART_KEY = '__mastraReprocessPart';
