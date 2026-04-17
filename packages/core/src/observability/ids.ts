/** Generate a unique id for an observability signal (log, metric, score, feedback). */
export function generateSignalId(): string {
  return crypto.randomUUID();
}
