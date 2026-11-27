export interface IntakeSelection {
  enabled: boolean;
  /** Source ids to sync; `null` = nothing selected. */
  sourceIds: string[] | null;
  repositoryByLinearProject?: Record<string, string>;
}

/** Built-in providers always present, plus any custom integration ids the server returns. */
export type IntakeConfig = Record<string, IntakeSelection> & {
  github: IntakeSelection;
  gitlab: IntakeSelection;
  linear: IntakeSelection;
  jira: IntakeSelection;
  incidentio: IntakeSelection;
};
