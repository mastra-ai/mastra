/**
 * Signal identity helpers.
 *
 * UUID is used for all signals, consistent with `crypto.randomUUID` usage
 * elsewhere in the repo and allowed by the OTel `log.record.uid` convention.
 */

/** Generate a unique id for an observability signal (log, metric, score, feedback). */
export function generateSignalId(): string {
  return crypto.randomUUID();
}
