import type { AgentSignalDataPart } from '../../agent/signals';
import { compactStopReasonContext } from '../../observability/outcome-schema';

/** Reference the signal that interrupted this request without copying caller content. */
export function snapshotSignalOutcome(signals: AgentSignalDataPart['data'][] | undefined) {
  const signal = signals?.[0];
  return compactStopReasonContext('signal_received', { signalId: signal?.id, signalType: signal?.type });
}
