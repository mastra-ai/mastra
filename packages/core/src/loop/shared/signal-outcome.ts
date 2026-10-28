import type { AgentSignalDataPart } from '../../agent/signals';
import { boundedStringify } from '../../utils/safe-stringify';

type SignalData = AgentSignalDataPart['data'];

/** Capture transport values without allowing optional metadata to prevent interruption. */
export function snapshotSignalOutcome(signals: SignalData[] | undefined): SignalData[] | undefined {
  return signals?.map(
    signal =>
      Object.fromEntries(
        Object.entries(signal).flatMap(([key, value]) => {
          // Match JSON transport semantics (including omitted functions and normalized
          // dates). Capture each field independently so invalid optional metadata cannot
          // discard the signal's identity, content, or other serializable fields.
          const serialized = boundedStringify(value);
          return serialized === undefined ? [] : [[key, JSON.parse(serialized)]];
        }),
      ) as SignalData,
  );
}
