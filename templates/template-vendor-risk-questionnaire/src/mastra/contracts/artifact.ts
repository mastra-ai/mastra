export const artifactCatalog = [
  {
    name: 'questionnaire.xlsx',
    format: 'xlsx',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    role: 'questionnaire_and_evidence',
  },
  { name: 'questionnaire.csv', format: 'csv', mime: 'text/csv', role: 'questionnaire' },
  { name: 'evidence.csv', format: 'csv', mime: 'text/csv', role: 'evidence' },
  { name: 'completed.json', format: 'json', mime: 'application/json', role: 'approved_projection' },
  { name: 'completed.md', format: 'markdown', mime: 'text/markdown', role: 'questionnaire_and_evidence' },
  { name: 'completed.pdf', format: 'pdf', mime: 'application/pdf', role: 'questionnaire_and_evidence' },
] as const;
export type Artifact = (typeof artifactCatalog)[number];
export type ArtifactName = Artifact['name'];
export const artifactNames = artifactCatalog.map(a => a.name);
