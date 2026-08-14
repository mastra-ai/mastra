/**
 * Per-process monotonic sequence lane for pulse records: orders
 * same-millisecond rows across every producer in the process (span bridge,
 * session forwarder, writers), so interleavings hold at read time.
 */
let SEQ = 0;

export function nextPulseSeq(): number {
  return ++SEQ;
}
