export type DeterministicRecord = Record<string, unknown>;
export declare function isPlainJsonRecord(
  value: unknown,
): value is DeterministicRecord;
export declare function canonicalScorerRecord(
  value: unknown,
): DeterministicRecord | null;
export declare const SUPPORTED_AXES: readonly string[];
export declare function evaluateDatasetAssertions(
  assertions: DeterministicRecord,
  observed: DeterministicRecord,
  evaluationCaseId?: string,
): Record<string, boolean>;
export declare function truthForDatasetCase(
  axis: string,
  assertions: DeterministicRecord,
  evaluationCaseId?: string,
): DeterministicRecord;
export declare function trajectoryAuthorityForDatasetCase(
  caseId: string,
): DeterministicRecord;
export declare function scorerInputFromObservation(
  axis: string,
  observed: DeterministicRecord,
): DeterministicRecord;
export declare function scoreAxis(
  axis: string,
  output: DeterministicRecord,
  truth: DeterministicRecord,
): number;
