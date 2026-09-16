export type FailureDisposition = "retry" | "escalate";
export type OperationalSignal = {
  providerOrTool: string;
  occurredAt: Date;
  durationMs: number;
  failed: boolean;
  refundFailure?: boolean;
};

/** Classification is explicit so injected failures cannot disappear into a
 * generic dashboard counter. Financial failures always escalate; transient
 * provider failures retry. */
export function classifyFailure(signal: OperationalSignal): FailureDisposition {
  return signal.refundFailure || signal.durationMs >= 5_000
    ? "escalate"
    : "retry";
}

/** Apply the classification where work actually fails. A retry is bounded by
 * the durable dispatch lease; inability to requeue always becomes a durable
 * human escalation instead of a terminal unclassified failure. */
export async function retryOrEscalateOperationalFailure(input: {
  signal: OperationalSignal;
  retry(): Promise<boolean>;
  escalate(): Promise<boolean>;
}): Promise<{ disposition: FailureDisposition; applied: boolean }> {
  if (classifyFailure(input.signal) === "retry" && (await input.retry()))
    return { disposition: "retry", applied: true };
  return { disposition: "escalate", applied: await input.escalate() };
}

export function alertReasons(signals: OperationalSignal[], now = new Date()) {
  const windowStart = now.getTime() - 15 * 60_000;
  const recent = signals.filter(
    (signal) => signal.occurredAt.getTime() >= windowStart,
  );
  const reasons: string[] = [];
  if (recent.some((signal) => signal.refundFailure))
    reasons.push("refund-failure");
  if (
    recent.length > 0 &&
    recent.filter((signal) => signal.failed).length / recent.length > 0.02
  )
    reasons.push("error-rate");
  const durations = recent
    .map((signal) => signal.durationMs)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (
    durations.length > 0 &&
    durations[Math.ceil(durations.length * 0.95) - 1]! > 5_000
  )
    reasons.push("p95-latency");
  return reasons;
}
