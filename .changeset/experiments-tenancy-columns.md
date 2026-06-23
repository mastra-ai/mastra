---
'@mastra/core': minor
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mongodb': patch
'@mastra/mysql': patch
'@mastra/spanner': patch
---

Added multi-tenant scoping columns (`organizationId`, `projectId`) to the experiments domain so experiment records and per-item results inherit the tenancy bucket of their parent dataset.

`Experiment`, `ExperimentResult`, `CreateExperimentInput`, and `AddExperimentResultInput` now carry optional `organizationId` / `projectId` fields. `ListExperimentsInput` and `ListExperimentResultsInput` gain a `filters: ExperimentTenancyFilters` block (mirrors `DatasetTenancyFilters`) for scoping queries within a `(organizationId, projectId)` bucket. Tenancy is hydrated from the parent dataset on `createExperiment` and denormalized onto each `ExperimentResult` for efficient tenancy-scoped queries.

The corresponding columns are also added to the `mastra_experiments` and `mastra_experiment_results` table schemas. Existing rows backfill to `null`, matching the rest of the dataset-tenancy surface.

This release also clarifies the `targetType` contract via JSDoc:

- `CreateDatasetInput.targetType` remains optional. Datasets without a `TargetType` are **not experiment-eligible** — the experiment runner requires a non-null `CreateExperimentInput.targetType` to resolve an executor.
- `Experiment.targetType` / `CreateExperimentInput.targetType` stay required. An experiment by definition replays inputs against a specific target.

No behavior change for existing OSS-created experiments; the new fields are additive and optional.

Example:

```ts
// Create an experiment scoped to a tenancy bucket. When the parent dataset
// already carries `organizationId` / `projectId`, `runExperiment` hydrates
// these fields automatically from the dataset record.
const experiment = await storage.createExperiment({
  name: 'qa-regression',
  datasetId: 'ds_123',
  datasetVersion: 1,
  targetType: 'agent',
  targetId: 'agent_qa',
  totalItems: 10,
  organizationId: 'org_123',
  projectId: 'proj_123',
});

// List experiments within a tenancy bucket.
const experiments = await storage.listExperiments({
  pagination: { page: 0, perPage: 20 },
  filters: { organizationId: 'org_123', projectId: 'proj_123' },
});

// List per-item results within the same bucket.
const results = await storage.listExperimentResults({
  experimentId: experiment.id,
  pagination: { page: 0, perPage: 50 },
  filters: { organizationId: 'org_123', projectId: 'proj_123' },
});
```
