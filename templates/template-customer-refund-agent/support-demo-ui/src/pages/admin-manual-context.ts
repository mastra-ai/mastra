export type ManualContextSelection = {
  caseId?: string;
  generation: number;
};

/** A manual-resolution completion belongs only to the modal route that made
 * its request. Both a POST result and a conflict refresh use this guard. */
export function isCurrentManualContextSelection(
  current: ManualContextSelection,
  submitted: Required<ManualContextSelection>,
) {
  return (
    current.generation === submitted.generation &&
    current.caseId === submitted.caseId
  );
}
