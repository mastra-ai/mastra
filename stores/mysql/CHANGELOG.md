# @mastra/mysql

## 0.4.0

### Minor Changes

- Added atomic caller-defined dataset IDs for idempotent dataset creation across built-in storage adapters. Supplying `id` to `mastra.datasets.create()` now creates the dataset once and resolves compatible retries to the persisted record; incompatible immutable identity fields throw `DATASET_ID_CONFLICT`. ([#19370](https://github.com/mastra-ai/mastra/pull/19370))

- Added caller-defined dataset item identities for safe retries across all dataset storage adapters. ([#19384](https://github.com/mastra-ai/mastra/pull/19384))

  Dataset items can now include an `externalId` when calling `addItem` or `addItems`:

  ```ts
  await dataset.addItem({
    externalId: 'source-item-123',
    input: { prompt: 'Hello' },
  });
  ```

  Retrying with the same identity and payload returns the existing item. Reusing an identity with different content returns a typed conflict, including during concurrent writes. Updates and deletes preserve the identity, Spanner retries transactions without changing the outcome, and MySQL batch writes now preserve every supported dataset item field.

### Patch Changes

- Raised the `@mastra/core` peer dependency floor to `>=1.51.0-0` so the dataset item identity helpers used by the storage adapters are available at runtime. ([#19384](https://github.com/mastra-ai/mastra/pull/19384))

- Updated dependencies [[`bd6d240`](https://github.com/mastra-ai/mastra/commit/bd6d2402db93dddaef0721667e7e8a030e7c6e16), [`0111486`](https://github.com/mastra-ai/mastra/commit/01114867612593eef5cfa2fda6a1194dfedda841), [`96a3749`](https://github.com/mastra-ai/mastra/commit/96a37492235f5b8076b3e3177d83ed5a5e44a640), [`fe1bda0`](https://github.com/mastra-ai/mastra/commit/fe1bda06f6af92a694a51712db747cda1e7185f0), [`25e7c12`](https://github.com/mastra-ai/mastra/commit/25e7c126a770069ae7fb7ecf1d2adb40e017b009), [`1ce5121`](https://github.com/mastra-ai/mastra/commit/1ce512155d122bb21f47d98383e82ffbf84b39e8), [`fb8aea3`](https://github.com/mastra-ai/mastra/commit/fb8aea384291e77311be3a64ee1717320d5c3c73), [`4adc391`](https://github.com/mastra-ai/mastra/commit/4adc3911075249c352bb4832d2471922826344de), [`a5c6337`](https://github.com/mastra-ai/mastra/commit/a5c6337d23c7686c81a32ce62f550f610543a240), [`3cfc47a`](https://github.com/mastra-ai/mastra/commit/3cfc47a6b89940aadd0f46fb01ae9624a73a865d), [`2bb7817`](https://github.com/mastra-ai/mastra/commit/2bb78176112fde628483de2830528f7eee911e56), [`51d9870`](https://github.com/mastra-ai/mastra/commit/51d987032c689c2855374d0f244f5d654da809d1), [`5cab274`](https://github.com/mastra-ai/mastra/commit/5cab2744250e22d12fefa7b32637dce224233cee), [`7fa27d3`](https://github.com/mastra-ai/mastra/commit/7fa27d3b6f5ed68cd34e454a4d3ad9c482a0cfbc), [`8b97958`](https://github.com/mastra-ai/mastra/commit/8b979589f9aa59ba67cac565949475f2ffeb4ac3), [`8410541`](https://github.com/mastra-ai/mastra/commit/84105412c60ecd3bb33a9838146f59c4b588228f), [`a58dcbb`](https://github.com/mastra-ai/mastra/commit/a58dcbb546d7e1d65ebdc1f39e55f0908fcd9391), [`aa38805`](https://github.com/mastra-ai/mastra/commit/aa38805b878b827403be785eb90688d7172f5a40), [`153bd3b`](https://github.com/mastra-ai/mastra/commit/153bd3b396bdfed6b74cf43de12db8fd2d83c04a), [`45a8e65`](https://github.com/mastra-ai/mastra/commit/45a8e65e1556d1362cb3f25187023c36de26661d), [`e955965`](https://github.com/mastra-ai/mastra/commit/e955965dce575a903e37cf054d28ea99aa48785e), [`2d22570`](https://github.com/mastra-ai/mastra/commit/2d22570c7dfdd02123d0ecc529efb05ccba2d9fc), [`07bb863`](https://github.com/mastra-ai/mastra/commit/07bb8631919c6f7cf377dccd45b096e0f17fbed0), [`c8ed116`](https://github.com/mastra-ai/mastra/commit/c8ed11699f62bcac70102ab4ec84d80d20541da6), [`01b338c`](https://github.com/mastra-ai/mastra/commit/01b338c56271f0219606710e3e8b26dee27ac6c2), [`a99eae8`](https://github.com/mastra-ai/mastra/commit/a99eae8908e500c1b2d12f9d277be616b98617a5), [`860ef7e`](https://github.com/mastra-ai/mastra/commit/860ef7e77d92b63469cbe5857aa1e626197e43e9), [`17e818c`](https://github.com/mastra-ai/mastra/commit/17e818c51a958ba90641b1a959dc38faf8c034e9), [`edce8d2`](https://github.com/mastra-ai/mastra/commit/edce8d2769f19e27a05737c627af2d765472a4f8), [`8a586ec`](https://github.com/mastra-ai/mastra/commit/8a586eca9a4914f31dff6140d0d45ac375b00669), [`4451dfe`](https://github.com/mastra-ai/mastra/commit/4451dfe857428e7abcc0261a507a2e186dae6d47), [`8b7361d`](https://github.com/mastra-ai/mastra/commit/8b7361d35de68b80d05d30a74e0c69e7218fd612), [`1d39058`](https://github.com/mastra-ai/mastra/commit/1d39058e548efd691799985d5c8af2737f1c3bd2), [`3927473`](https://github.com/mastra-ai/mastra/commit/392747323ddb10c643d12be7b9ae913159dfaeed), [`dce50dc`](https://github.com/mastra-ai/mastra/commit/dce50dc9a1c1fcd0f427bb5f6250ec74910cb04b), [`fd13f8e`](https://github.com/mastra-ai/mastra/commit/fd13f8e21990f9904c3eedba3a626bb4a929cdb8), [`634caff`](https://github.com/mastra-ai/mastra/commit/634caff29a9200ad058b67d53f96d9e5832fb8a2), [`f703f87`](https://github.com/mastra-ai/mastra/commit/f703f878de072d51fda557f9c50867d8252bef05), [`3e26c87`](https://github.com/mastra-ai/mastra/commit/3e26c87de0c5bc2583b795ce6ca5889b6b161acb), [`33f2b88`](https://github.com/mastra-ai/mastra/commit/33f2b88842c09a567f906fac4cb61cd5277ced59), [`177010f`](https://github.com/mastra-ai/mastra/commit/177010ff096d2e4b28d89803be5b1a4cad2a0d6b), [`0ad646f`](https://github.com/mastra-ai/mastra/commit/0ad646f71a530f2454664299e5e01bfd13fa12e5), [`b486abf`](https://github.com/mastra-ai/mastra/commit/b486abfa2a7528c6f527e4015c819ea9fa54aaad), [`54a51e0`](https://github.com/mastra-ai/mastra/commit/54a51e0a484fe1ebad3fb1f7ef5282a075709eb7), [`c43f3a9`](https://github.com/mastra-ai/mastra/commit/c43f3a9d1efde99b38789364ba4d0ba670f430e3), [`a5008f2`](https://github.com/mastra-ai/mastra/commit/a5008f22ae710ad9402ea9f2547d8c02f74d384b), [`e2d5f37`](https://github.com/mastra-ai/mastra/commit/e2d5f373bd289be534d5f8694d34465010533df6), [`4ce0163`](https://github.com/mastra-ai/mastra/commit/4ce0163dc86e675a86809685c8ce6c49f1aeb87e), [`4378341`](https://github.com/mastra-ai/mastra/commit/43783412df5ea3dd35f5b1f6e4851e79c346fc89)]:
  - @mastra/core@1.51.0

## 0.4.0-alpha.0

### Minor Changes

- Added atomic caller-defined dataset IDs for idempotent dataset creation across built-in storage adapters. Supplying `id` to `mastra.datasets.create()` now creates the dataset once and resolves compatible retries to the persisted record; incompatible immutable identity fields throw `DATASET_ID_CONFLICT`. ([#19370](https://github.com/mastra-ai/mastra/pull/19370))

- Added caller-defined dataset item identities for safe retries across all dataset storage adapters. ([#19384](https://github.com/mastra-ai/mastra/pull/19384))

  Dataset items can now include an `externalId` when calling `addItem` or `addItems`:

  ```ts
  await dataset.addItem({
    externalId: 'source-item-123',
    input: { prompt: 'Hello' },
  });
  ```

  Retrying with the same identity and payload returns the existing item. Reusing an identity with different content returns a typed conflict, including during concurrent writes. Updates and deletes preserve the identity, Spanner retries transactions without changing the outcome, and MySQL batch writes now preserve every supported dataset item field.

### Patch Changes

- Raised the `@mastra/core` peer dependency floor to `>=1.51.0-0` so the dataset item identity helpers used by the storage adapters are available at runtime. ([#19384](https://github.com/mastra-ai/mastra/pull/19384))

- Updated dependencies [[`a99eae8`](https://github.com/mastra-ai/mastra/commit/a99eae8908e500c1b2d12f9d277be616b98617a5), [`fd13f8e`](https://github.com/mastra-ai/mastra/commit/fd13f8e21990f9904c3eedba3a626bb4a929cdb8), [`f703f87`](https://github.com/mastra-ai/mastra/commit/f703f878de072d51fda557f9c50867d8252bef05), [`0ad646f`](https://github.com/mastra-ai/mastra/commit/0ad646f71a530f2454664299e5e01bfd13fa12e5)]:
  - @mastra/core@1.51.0-alpha.13

## 0.3.4

### Patch Changes

- Update `@mastra/core` peer dependency for the unified schedules API ([#18874](https://github.com/mastra-ai/mastra/pull/18874))

- Schedule rows persisted with the legacy `target.type: 'heartbeat'` are now normalized to `target.type: 'agent'` when read, so existing agent schedules keep firing after the heartbeats-to-schedules rename in `@mastra/core`. ([#18874](https://github.com/mastra-ai/mastra/pull/18874))

- Updated dependencies [[`b291760`](https://github.com/mastra-ai/mastra/commit/b291760df9d6c7e4fc72606c8f0a4af2cf6e946c), [`3ffb8b7`](https://github.com/mastra-ai/mastra/commit/3ffb8b720e90f5e6977129ec1f6707d43c2bebe0), [`6ef59fe`](https://github.com/mastra-ai/mastra/commit/6ef59fef1da52ed8da5fbb2a892c71cf4fb6c739), [`4039488`](https://github.com/mastra-ai/mastra/commit/403948898af7293198d9e8b3e7fb47f623c78b94), [`29b7ea6`](https://github.com/mastra-ai/mastra/commit/29b7ea64e72b5523d5bdcbd34ee03d2b854d54e1), [`b2c9d70`](https://github.com/mastra-ai/mastra/commit/b2c9d70757207fb01a9069549e69b6f0d73a6636), [`a51c63d`](https://github.com/mastra-ai/mastra/commit/a51c63d8ee639e4daeba2a0be093efa6a1b5e52f), [`252f63d`](https://github.com/mastra-ai/mastra/commit/252f63d8fec723955adb2202be2f01a75ad0e69c), [`5ea76a7`](https://github.com/mastra-ai/mastra/commit/5ea76a723d966c72da9aa3ab30ae20276e049765), [`6445560`](https://github.com/mastra-ai/mastra/commit/6445560327045d20b239585fc63fed72e9ce36ec), [`e2b9f33`](https://github.com/mastra-ai/mastra/commit/e2b9f33456fd638eca555f9466c6519d8d049666), [`10959d5`](https://github.com/mastra-ai/mastra/commit/10959d509d824f682d40ff96e05ee044aec3b0e5), [`c547a77`](https://github.com/mastra-ai/mastra/commit/c547a7729bdf64dfc2df29c965046c0712a18f10), [`a0085fa`](https://github.com/mastra-ai/mastra/commit/a0085fa0934e52c37c8c8b3d75a6bb5cd199af36), [`a2ba369`](https://github.com/mastra-ai/mastra/commit/a2ba369e796dfab610f41c6875965b488272fa55), [`ffc3c17`](https://github.com/mastra-ai/mastra/commit/ffc3c17274ea17c11aa6f73d3140649cd7fc8abc), [`81542c1`](https://github.com/mastra-ai/mastra/commit/81542c1835c35bc32f2ce4fa9136ee11993cd299), [`3908e53`](https://github.com/mastra-ai/mastra/commit/3908e53ce04bbea04f5e0c097d7aa298c35fabee), [`cb24ce7`](https://github.com/mastra-ai/mastra/commit/cb24ce76bd16ca88eb6a963f6277f8780e703029), [`02705fd`](https://github.com/mastra-ai/mastra/commit/02705fd2f5a9062210d64ea061adeeb10dc9452e), [`ae51e81`](https://github.com/mastra-ai/mastra/commit/ae51e818825582d42500338dfc1929a082eff0ba), [`6f304ef`](https://github.com/mastra-ai/mastra/commit/6f304ef319e99725e884bdb8d3193c001b6e5964), [`5f9858f`](https://github.com/mastra-ai/mastra/commit/5f9858f791f1137ca7d52d23559fb4568f7a9026)]:
  - @mastra/core@1.50.0

## 0.3.4-alpha.0

### Patch Changes

- Update `@mastra/core` peer dependency for the unified schedules API ([#18874](https://github.com/mastra-ai/mastra/pull/18874))

- Schedule rows persisted with the legacy `target.type: 'heartbeat'` are now normalized to `target.type: 'agent'` when read, so existing agent schedules keep firing after the heartbeats-to-schedules rename in `@mastra/core`. ([#18874](https://github.com/mastra-ai/mastra/pull/18874))

- Updated dependencies [[`b291760`](https://github.com/mastra-ai/mastra/commit/b291760df9d6c7e4fc72606c8f0a4af2cf6e946c), [`29b7ea6`](https://github.com/mastra-ai/mastra/commit/29b7ea64e72b5523d5bdcbd34ee03d2b854d54e1), [`10959d5`](https://github.com/mastra-ai/mastra/commit/10959d509d824f682d40ff96e05ee044aec3b0e5), [`ffc3c17`](https://github.com/mastra-ai/mastra/commit/ffc3c17274ea17c11aa6f73d3140649cd7fc8abc), [`3908e53`](https://github.com/mastra-ai/mastra/commit/3908e53ce04bbea04f5e0c097d7aa298c35fabee)]:
  - @mastra/core@1.50.0-alpha.3

## 0.3.3

### Patch Changes

- Added optional tenancy arguments to `getDataset`, `updateDataset`, and `deleteDataset`. ([#18750](https://github.com/mastra-ai/mastra/pull/18750))

  You can now pass `organizationId` and `projectId` to scope dataset reads, updates, and deletes to a specific tenant. Reads and updates against a dataset in a different tenant throw `DATASET_NOT_FOUND` (surfaced as a 404 over HTTP). Deletes silently no-op on a tenancy mismatch — matching the existing "delete non-existent id is a no-op" semantics so cross-tenant existence is never leaked via error timing or status.

  **Example**

  ```ts
  // Before
  await client.getDataset('abc123');
  await client.deleteDataset('abc123');
  await client.updateDataset({ id: 'abc123', name: 'renamed' });

  // After — scope to a tenant
  await client.getDataset('abc123', { organizationId: 'org_a', projectId: 'proj_1' });
  await client.deleteDataset('abc123', { organizationId: 'org_a' });
  await client.updateDataset({ id: 'abc123', name: 'renamed', organizationId: 'org_a' });
  ```

- Fixed `listExperiments` in the MySQL store ignoring `targetType`, `targetId`, `agentVersion`, and `status` filters. Queries now correctly narrow on these fields, matching the behavior of the other stores (Postgres, LibSQL, Spanner, in-memory). ([#18769](https://github.com/mastra-ai/mastra/pull/18769))

  Also persisted `agentVersion` on experiment rows in the MySQL store. The column existed in the schema but `createExperiment` never wrote it and `getExperimentById`/`listExperiments` never returned it, so filtering by `agentVersion` would have matched nothing on rows created by this backend. New experiments now round-trip `agentVersion` end-to-end. Existing tables gain the column via the `init()` backfill.

- Pushed remaining dataset read filters and pagination down to storage. ([#18710](https://github.com/mastra-ai/mastra/pull/18710))

  `DatasetsManager.list({ filters })` now accepts `targetType`, `targetIds` (overlap/union semantics), and `name` (substring, case-insensitive) in addition to the existing tenancy and candidate filters. Filtering is pushed down to the storage layer so callers no longer have to post-filter results.

  Storage adapters must also be upgraded to the versions listed below to honor the new filters. If a caller is on this version of `@mastra/core` but on an older storage adapter, the new `targetType`/`targetIds`/`name` filter keys are silently ignored by the adapter — no runtime error, but the filter has no effect and every dataset in the tenancy is returned.

  `Dataset.listItems({ version, search, page, perPage })` now applies `search` and pagination at the storage layer when `version` is provided alongside any of those. Previously they were silently dropped whenever `version` was set. The return shape is unchanged: passing only `version` still returns a bare `DatasetItem[]` snapshot; passing `search`, `page`, or `perPage` (with or without `version`) returns the paginated `{ items, pagination }` shape. The bare-array branch is marked `@deprecated`; prefer passing `page` / `perPage` to always receive the paginated shape.

- Tenancy-scope experiments `getById` and `delete*` on `ExperimentsStorage`. ([#18770](https://github.com/mastra-ai/mastra/pull/18770))

  `ExperimentsStorage.getExperimentById`, `getExperimentResultById`, `deleteExperiment`, and `deleteExperimentResults` used to key on the primary id alone, so any caller who knew the id could read or delete the row regardless of tenant. All four now accept an optional `filters: { organizationId?, projectId? }` argument that is enforced on every adapter (inmemory, libsql, pg, mysql, mongodb, spanner):
  - On tenancy mismatch, `get*` returns `null` at the storage layer.
  - On tenancy mismatch, `delete*` is a silent no-op.
  - The tenancy predicate is folded into the destructive DML itself (scoped `WHERE` on the DELETE, an atomic gate + delete inside a transaction, or a scoped subquery for the results cascade). A concurrent tenant swap of the same id between a pre-check and the DELETE cannot let a scoped delete hit another tenant's row.

  Both behaviors match how a missing id already responds, so existence does not leak through error timing or messages.

  The same atomic-DML pattern is also applied to `DatasetsStorage.deleteDataset` across all 5 store adapters, closing a TOCTOU window between the pre-check and the parent DELETE that was introduced when tenancy filters were originally added.

  `Dataset.getExperiment` and the shared experiment-ownership gate on `Dataset` now forward the dataset's tenancy scope to storage, so experiment reads and downstream mutations (list results, update result, delete experiment) reached through a dataset handle are automatically scoped to the owning tenant.

  Legacy calls that omit `filters` are unchanged, so this is fully backwards-compatible.

  ```ts
  // Before: any caller who knew the id could read/delete across tenants.
  await store.experiments.getExperimentById({ id: experimentId });
  await store.experiments.deleteExperiment({ id: experimentId });

  // After: pass the caller's scope; wrong tenant gets null / silent no-op.
  await store.experiments.getExperimentById({
    id: experimentId,
    filters: { organizationId, projectId },
  });
  await store.experiments.deleteExperiment({
    id: experimentId,
    filters: { organizationId, projectId },
  });
  ```

- Filled a pre-existing CRUD gap so the new dataset filter API works end-to-end on MySQL. ([#18710](https://github.com/mastra-ai/mastra/pull/18710))

  `createDataset`, `updateDataset`, and `mapDataset` now persist and hydrate `targetType`, `targetIds`, `scorerIds`, `tags`, and `requestContextSchema`. The columns were already declared by the shared schema but were never written or read, so `listDatasets({ filters: { targetType, targetIds, name } })` would have matched nothing on MySQL before this fix. `alterTable.ifNotExists` was widened so in-place upgrades pick up the columns for older databases.

  Also fixed a `mapItem` row deserialization bug: when the stored input/groundTruth/metadata was a JSON string scalar, the mysql2 driver auto-parses the JSON column to a JS string and the previous `parseJSON` helper then tried to `JSON.parse` it again and silently returned `undefined`. It now falls back to the raw string when re-parsing fails, so versioned `listItems({ search })` results round-trip the original input.

- Fixed a cross-tenant data-access issue on datasets by scoping `DatasetsManager.get` and `DatasetsManager.delete` to tenancy filters. ([#18750](https://github.com/mastra-ai/mastra/pull/18750))

  Previously `get({ id })` and `delete({ id })` looked up a dataset by its primary key alone. Any caller who knew a dataset id could read or delete it regardless of which `organizationId` / `projectId` it belonged to. This is now closed at the storage layer via a scoped SQL predicate (option (a) — no fetch-then-assert).

  **What changed**
  - `DatasetsManager.get` and `DatasetsManager.delete` accept optional `organizationId` and `projectId`.
  - The tenancy is stashed on the returned `Dataset` handle and forwarded to every downstream storage call (`getDetails`, `update`, `addItem`, item batch ops, `startExperimentAsync`).
  - The abstract storage contract (`getDatasetById`, `deleteDataset`) gained an optional `filters?: DatasetTenancyFilters` arg.
  - Item-mutation inputs (`AddDatasetItemInput`, `UpdateDatasetItemInput`, `BatchInsertItemsInput`, `BatchDeleteItemsInput`) and `UpdateDatasetInput` accept optional `filters` for the internal existence check.

  **Behavior**
  - Omitting tenancy preserves the existing behavior (no predicate added) — fully backwards compatible.
  - On tenancy mismatch, `get` throws NOT_FOUND (returns null at the storage layer) and `delete` is a silent no-op — matching how a missing id already behaves, so existence does not leak through error timing or messages.

  **Example**

  ```ts
  // Before
  const ds = await mastra.datasets.get({ id });
  await mastra.datasets.delete({ id });

  // After — scope to a tenant
  const ds = await mastra.datasets.get({ id, organizationId, projectId });
  await mastra.datasets.delete({ id, organizationId, projectId });
  ```

- Add optional `batchId`, `datasetId`, and `datasetItemId` fields to persisted scores so saved baseline scores can be grouped as one scoring pass and joined back to the dataset items they came from. ([#18331](https://github.com/mastra-ai/mastra/pull/18331))
  - `scoreTrace()` accepts top-level `batchId`, `datasetId`, and `datasetItemId` when persisting a score for a stored trace.
  - `ScoreRowData` and score save payloads now include nullable `batchId`, `datasetId`, and `datasetItemId`.
  - Built-in stores with explicit score schema or attribute mappings now persist these provenance fields on saved scores.
  - D1, DSQL, MSSQL, and Upstash score stores now apply additive provenance migrations or deterministic score ordering for persisted score reads.

  ```ts
  await scoreTrace({
    storage,
    scorer,
    target: { traceId },
    batchId: 'baseline-batch-1',
    datasetId,
    datasetItemId,
  });
  ```

- Added optional `organizationId` and `projectId` fields to scores for multi-tenant isolation. Scores can now be saved with tenancy metadata and the `listScoresBy*` methods accept a `filters` option to scope results by organization and project. ([#18331](https://github.com/mastra-ai/mastra/pull/18331))

  ```ts
  await storage.saveScore({ ...score, organizationId: 'org-a', projectId: 'proj-1' });

  const result = await storage.listScoresByScorerId({
    scorerId,
    filters: { organizationId: 'org-a', projectId: 'proj-1' },
  });
  ```

  `projectId` identifies the project scope, separate from `resourceId` which continues to mean the agent memory resource.

- Raise `@mastra/core` peer floor to `>=1.49.0-0` on all storage adapters so the tenancy-related named exports the adapters now consume are guaranteed to exist at install time. ([#18861](https://github.com/mastra-ai/mastra/pull/18861))

- Scoped `getDatasetById` and `deleteDataset` to tenancy filters when the caller passes `organizationId` / `projectId`. ([#18750](https://github.com/mastra-ai/mastra/pull/18750))

  The adapters now push the tenancy predicate into the SQL/query when the new optional `filters` argument is present. Legacy calls that omit tenancy are unchanged. On mismatch, `getDatasetById` returns `null` and `deleteDataset` is a silent no-op — the cascade delete (dataset items and versions) is gated by a scoped parent pre-check, so cross-tenant data is never touched.

- Added optional `organizationId` and `projectId` query parameters to the dataset routes. ([#18750](https://github.com/mastra-ai/mastra/pull/18750))

  `GET /datasets/:datasetId`, `PATCH /datasets/:datasetId`, and `DELETE /datasets/:datasetId` now accept optional tenancy query parameters. When provided, they are forwarded to `mastra.datasets.get` / `.delete` and the operation returns 404 if the dataset does not belong to the requested tenant. Requests that omit the query parameters keep their existing behavior.

  **Example**

  ```
  GET /datasets/abc123?organizationId=org_a&projectId=proj_1
  DELETE /datasets/abc123?organizationId=org_a
  ```

- Updated dependencies [[`700619b`](https://github.com/mastra-ai/mastra/commit/700619b61d572e592cbaaf758121d168844ca4d2), [`0f69865`](https://github.com/mastra-ai/mastra/commit/0f69865aced225d98eac812e22699dc445ee18cb), [`9250acd`](https://github.com/mastra-ai/mastra/commit/9250acd1357f0f1f33d0dcca16f9655084c58eca), [`0c3d4bc`](https://github.com/mastra-ai/mastra/commit/0c3d4bcae13ea3699d379403e6f350d5cf4efe9f), [`cc440a3`](https://github.com/mastra-ai/mastra/commit/cc440a39400d8ce06655462b26c1666a1b3d4320), [`6a61846`](https://github.com/mastra-ai/mastra/commit/6a61846eeda29fb714549b70f1bee2bf6b141c44), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`17369b2`](https://github.com/mastra-ai/mastra/commit/17369b25250561e9ed994ae509be1d15bfb33bcb), [`c64c2a8`](https://github.com/mastra-ai/mastra/commit/c64c2a8503a50252f9ca6b8e8c54cadee31b92a2), [`bcae929`](https://github.com/mastra-ai/mastra/commit/bcae929945cbf265bd9f327cc715ecafa072b5b9), [`ea6327b`](https://github.com/mastra-ai/mastra/commit/ea6327ba2d63ca647804bc97b347e03a58617162), [`3439fa8`](https://github.com/mastra-ai/mastra/commit/3439fa836ecfcaa257b40c20b30ac2a8be22e9ea), [`85107f2`](https://github.com/mastra-ai/mastra/commit/85107f2758b527147fccbedff962961927c2d3b8), [`b33822e`](https://github.com/mastra-ai/mastra/commit/b33822e8d470884954b02f7b0745407ee4ef74b1), [`06e2680`](https://github.com/mastra-ai/mastra/commit/06e26806b51d2cbd858afdc66daa2b86ff3ba64a), [`06ff9e0`](https://github.com/mastra-ai/mastra/commit/06ff9e0befd1d642ab87ff749285ee4091205c7e), [`d5c11e3`](https://github.com/mastra-ai/mastra/commit/d5c11e3ba5045969caa7272a7bd1fd141c93ab6c), [`7f5e1ff`](https://github.com/mastra-ai/mastra/commit/7f5e1ff695a92f672bb3976363925d1e9136b54a), [`ff80671`](https://github.com/mastra-ai/mastra/commit/ff8067185e208b27198b4e5b71803013175c3643), [`b8375c1`](https://github.com/mastra-ai/mastra/commit/b8375c1f8fe905df8ae2ae9a893bb365f17aec4e), [`dab1257`](https://github.com/mastra-ai/mastra/commit/dab1257b64e4ed576dc5038bb7a3f7072338bc9f), [`1240f05`](https://github.com/mastra-ai/mastra/commit/1240f051c8e5371f1c014448bf37b1a1b9a05e47), [`705ff39`](https://github.com/mastra-ai/mastra/commit/705ff3969e57214ff2fdaf3815d751dd558886ed), [`e6fbd5b`](https://github.com/mastra-ai/mastra/commit/e6fbd5bfdc28e92c0c0433f29aa1bc152d3430f6), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`6f2026c`](https://github.com/mastra-ai/mastra/commit/6f2026cdf114ff1e21e49133ca774ec7d5085059), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`003f35d`](https://github.com/mastra-ai/mastra/commit/003f35d19e07b23b4bacc591c8bc0c59b42124ae), [`f890eda`](https://github.com/mastra-ai/mastra/commit/f890eda2c8a2ae83d9b30bc6d85842f93b6c266b), [`1340fb7`](https://github.com/mastra-ai/mastra/commit/1340fb76262a3ca062130aa71859f07257a0a5a4)]:
  - @mastra/core@1.49.0

## 0.3.3-alpha.2

### Patch Changes

- Raise `@mastra/core` peer floor to `>=1.49.0-0` on all storage adapters so the tenancy-related named exports the adapters now consume are guaranteed to exist at install time. ([#18861](https://github.com/mastra-ai/mastra/pull/18861))

## 0.3.3-alpha.1

### Patch Changes

- Added optional tenancy arguments to `getDataset`, `updateDataset`, and `deleteDataset`. ([#18750](https://github.com/mastra-ai/mastra/pull/18750))

  You can now pass `organizationId` and `projectId` to scope dataset reads, updates, and deletes to a specific tenant. Reads and updates against a dataset in a different tenant throw `DATASET_NOT_FOUND` (surfaced as a 404 over HTTP). Deletes silently no-op on a tenancy mismatch — matching the existing "delete non-existent id is a no-op" semantics so cross-tenant existence is never leaked via error timing or status.

  **Example**

  ```ts
  // Before
  await client.getDataset('abc123');
  await client.deleteDataset('abc123');
  await client.updateDataset({ id: 'abc123', name: 'renamed' });

  // After — scope to a tenant
  await client.getDataset('abc123', { organizationId: 'org_a', projectId: 'proj_1' });
  await client.deleteDataset('abc123', { organizationId: 'org_a' });
  await client.updateDataset({ id: 'abc123', name: 'renamed', organizationId: 'org_a' });
  ```

- Pushed remaining dataset read filters and pagination down to storage. ([#18710](https://github.com/mastra-ai/mastra/pull/18710))

  `DatasetsManager.list({ filters })` now accepts `targetType`, `targetIds` (overlap/union semantics), and `name` (substring, case-insensitive) in addition to the existing tenancy and candidate filters. Filtering is pushed down to the storage layer so callers no longer have to post-filter results.

  Storage adapters must also be upgraded to the versions listed below to honor the new filters. If a caller is on this version of `@mastra/core` but on an older storage adapter, the new `targetType`/`targetIds`/`name` filter keys are silently ignored by the adapter — no runtime error, but the filter has no effect and every dataset in the tenancy is returned.

  `Dataset.listItems({ version, search, page, perPage })` now applies `search` and pagination at the storage layer when `version` is provided alongside any of those. Previously they were silently dropped whenever `version` was set. The return shape is unchanged: passing only `version` still returns a bare `DatasetItem[]` snapshot; passing `search`, `page`, or `perPage` (with or without `version`) returns the paginated `{ items, pagination }` shape. The bare-array branch is marked `@deprecated`; prefer passing `page` / `perPage` to always receive the paginated shape.

- Tenancy-scope experiments `getById` and `delete*` on `ExperimentsStorage`. ([#18770](https://github.com/mastra-ai/mastra/pull/18770))

  `ExperimentsStorage.getExperimentById`, `getExperimentResultById`, `deleteExperiment`, and `deleteExperimentResults` used to key on the primary id alone, so any caller who knew the id could read or delete the row regardless of tenant. All four now accept an optional `filters: { organizationId?, projectId? }` argument that is enforced on every adapter (inmemory, libsql, pg, mysql, mongodb, spanner):
  - On tenancy mismatch, `get*` returns `null` at the storage layer.
  - On tenancy mismatch, `delete*` is a silent no-op.
  - The tenancy predicate is folded into the destructive DML itself (scoped `WHERE` on the DELETE, an atomic gate + delete inside a transaction, or a scoped subquery for the results cascade). A concurrent tenant swap of the same id between a pre-check and the DELETE cannot let a scoped delete hit another tenant's row.

  Both behaviors match how a missing id already responds, so existence does not leak through error timing or messages.

  The same atomic-DML pattern is also applied to `DatasetsStorage.deleteDataset` across all 5 store adapters, closing a TOCTOU window between the pre-check and the parent DELETE that was introduced when tenancy filters were originally added.

  `Dataset.getExperiment` and the shared experiment-ownership gate on `Dataset` now forward the dataset's tenancy scope to storage, so experiment reads and downstream mutations (list results, update result, delete experiment) reached through a dataset handle are automatically scoped to the owning tenant.

  Legacy calls that omit `filters` are unchanged, so this is fully backwards-compatible.

  ```ts
  // Before: any caller who knew the id could read/delete across tenants.
  await store.experiments.getExperimentById({ id: experimentId });
  await store.experiments.deleteExperiment({ id: experimentId });

  // After: pass the caller's scope; wrong tenant gets null / silent no-op.
  await store.experiments.getExperimentById({
    id: experimentId,
    filters: { organizationId, projectId },
  });
  await store.experiments.deleteExperiment({
    id: experimentId,
    filters: { organizationId, projectId },
  });
  ```

- Filled a pre-existing CRUD gap so the new dataset filter API works end-to-end on MySQL. ([#18710](https://github.com/mastra-ai/mastra/pull/18710))

  `createDataset`, `updateDataset`, and `mapDataset` now persist and hydrate `targetType`, `targetIds`, `scorerIds`, `tags`, and `requestContextSchema`. The columns were already declared by the shared schema but were never written or read, so `listDatasets({ filters: { targetType, targetIds, name } })` would have matched nothing on MySQL before this fix. `alterTable.ifNotExists` was widened so in-place upgrades pick up the columns for older databases.

  Also fixed a `mapItem` row deserialization bug: when the stored input/groundTruth/metadata was a JSON string scalar, the mysql2 driver auto-parses the JSON column to a JS string and the previous `parseJSON` helper then tried to `JSON.parse` it again and silently returned `undefined`. It now falls back to the raw string when re-parsing fails, so versioned `listItems({ search })` results round-trip the original input.

- Fixed a cross-tenant data-access issue on datasets by scoping `DatasetsManager.get` and `DatasetsManager.delete` to tenancy filters. ([#18750](https://github.com/mastra-ai/mastra/pull/18750))

  Previously `get({ id })` and `delete({ id })` looked up a dataset by its primary key alone. Any caller who knew a dataset id could read or delete it regardless of which `organizationId` / `projectId` it belonged to. This is now closed at the storage layer via a scoped SQL predicate (option (a) — no fetch-then-assert).

  **What changed**
  - `DatasetsManager.get` and `DatasetsManager.delete` accept optional `organizationId` and `projectId`.
  - The tenancy is stashed on the returned `Dataset` handle and forwarded to every downstream storage call (`getDetails`, `update`, `addItem`, item batch ops, `startExperimentAsync`).
  - The abstract storage contract (`getDatasetById`, `deleteDataset`) gained an optional `filters?: DatasetTenancyFilters` arg.
  - Item-mutation inputs (`AddDatasetItemInput`, `UpdateDatasetItemInput`, `BatchInsertItemsInput`, `BatchDeleteItemsInput`) and `UpdateDatasetInput` accept optional `filters` for the internal existence check.

  **Behavior**
  - Omitting tenancy preserves the existing behavior (no predicate added) — fully backwards compatible.
  - On tenancy mismatch, `get` throws NOT_FOUND (returns null at the storage layer) and `delete` is a silent no-op — matching how a missing id already behaves, so existence does not leak through error timing or messages.

  **Example**

  ```ts
  // Before
  const ds = await mastra.datasets.get({ id });
  await mastra.datasets.delete({ id });

  // After — scope to a tenant
  const ds = await mastra.datasets.get({ id, organizationId, projectId });
  await mastra.datasets.delete({ id, organizationId, projectId });
  ```

- Add optional `batchId`, `datasetId`, and `datasetItemId` fields to persisted scores so saved baseline scores can be grouped as one scoring pass and joined back to the dataset items they came from. ([#18331](https://github.com/mastra-ai/mastra/pull/18331))
  - `scoreTrace()` accepts top-level `batchId`, `datasetId`, and `datasetItemId` when persisting a score for a stored trace.
  - `ScoreRowData` and score save payloads now include nullable `batchId`, `datasetId`, and `datasetItemId`.
  - Built-in stores with explicit score schema or attribute mappings now persist these provenance fields on saved scores.
  - D1, DSQL, MSSQL, and Upstash score stores now apply additive provenance migrations or deterministic score ordering for persisted score reads.

  ```ts
  await scoreTrace({
    storage,
    scorer,
    target: { traceId },
    batchId: 'baseline-batch-1',
    datasetId,
    datasetItemId,
  });
  ```

- Added optional `organizationId` and `projectId` fields to scores for multi-tenant isolation. Scores can now be saved with tenancy metadata and the `listScoresBy*` methods accept a `filters` option to scope results by organization and project. ([#18331](https://github.com/mastra-ai/mastra/pull/18331))

  ```ts
  await storage.saveScore({ ...score, organizationId: 'org-a', projectId: 'proj-1' });

  const result = await storage.listScoresByScorerId({
    scorerId,
    filters: { organizationId: 'org-a', projectId: 'proj-1' },
  });
  ```

  `projectId` identifies the project scope, separate from `resourceId` which continues to mean the agent memory resource.

- Scoped `getDatasetById` and `deleteDataset` to tenancy filters when the caller passes `organizationId` / `projectId`. ([#18750](https://github.com/mastra-ai/mastra/pull/18750))

  The adapters now push the tenancy predicate into the SQL/query when the new optional `filters` argument is present. Legacy calls that omit tenancy are unchanged. On mismatch, `getDatasetById` returns `null` and `deleteDataset` is a silent no-op — the cascade delete (dataset items and versions) is gated by a scoped parent pre-check, so cross-tenant data is never touched.

- Added optional `organizationId` and `projectId` query parameters to the dataset routes. ([#18750](https://github.com/mastra-ai/mastra/pull/18750))

  `GET /datasets/:datasetId`, `PATCH /datasets/:datasetId`, and `DELETE /datasets/:datasetId` now accept optional tenancy query parameters. When provided, they are forwarded to `mastra.datasets.get` / `.delete` and the operation returns 404 if the dataset does not belong to the requested tenant. Requests that omit the query parameters keep their existing behavior.

  **Example**

  ```
  GET /datasets/abc123?organizationId=org_a&projectId=proj_1
  DELETE /datasets/abc123?organizationId=org_a
  ```

- Updated dependencies [[`9250acd`](https://github.com/mastra-ai/mastra/commit/9250acd1357f0f1f33d0dcca16f9655084c58eca), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`c64c2a8`](https://github.com/mastra-ai/mastra/commit/c64c2a8503a50252f9ca6b8e8c54cadee31b92a2), [`06e2680`](https://github.com/mastra-ai/mastra/commit/06e26806b51d2cbd858afdc66daa2b86ff3ba64a), [`1240f05`](https://github.com/mastra-ai/mastra/commit/1240f051c8e5371f1c014448bf37b1a1b9a05e47), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748)]:
  - @mastra/core@1.49.0-alpha.5

## 0.3.3-alpha.0

### Patch Changes

- Fixed `listExperiments` in the MySQL store ignoring `targetType`, `targetId`, `agentVersion`, and `status` filters. Queries now correctly narrow on these fields, matching the behavior of the other stores (Postgres, LibSQL, Spanner, in-memory). ([#18769](https://github.com/mastra-ai/mastra/pull/18769))

  Also persisted `agentVersion` on experiment rows in the MySQL store. The column existed in the schema but `createExperiment` never wrote it and `getExperimentById`/`listExperiments` never returned it, so filtering by `agentVersion` would have matched nothing on rows created by this backend. New experiments now round-trip `agentVersion` end-to-end. Existing tables gain the column via the `init()` backfill.

- Updated dependencies [[`6a61846`](https://github.com/mastra-ai/mastra/commit/6a61846eeda29fb714549b70f1bee2bf6b141c44)]:
  - @mastra/core@1.49.0-alpha.4

## 0.3.2

### Patch Changes

- Fixed buffered observation extraction metadata so stored OM chunks keep extracted values and extraction failures across memory storage adapters. ([#18655](https://github.com/mastra-ai/mastra/pull/18655))

- Updated dependencies [[`b9a2961`](https://github.com/mastra-ai/mastra/commit/b9a2961c1be81e3639c0879e58588c26dd0ae866), [`b33c77d`](https://github.com/mastra-ai/mastra/commit/b33c77d5293f14a794f3ec38dc947a6676de2764), [`1274eb3`](https://github.com/mastra-ai/mastra/commit/1274eb3a9508f579ceb3187fbce34408222d4b71), [`cdd5f93`](https://github.com/mastra-ai/mastra/commit/cdd5f939cefa67390629704dce92563ccbf492b2), [`1274eb3`](https://github.com/mastra-ai/mastra/commit/1274eb3a9508f579ceb3187fbce34408222d4b71), [`0ac14ce`](https://github.com/mastra-ai/mastra/commit/0ac14cea48e1b0a7857782153c78f7242fdf7e1a), [`9566d27`](https://github.com/mastra-ai/mastra/commit/9566d27ead3d95bdbe5a69e5a082a68222829cf2), [`8be63b0`](https://github.com/mastra-ai/mastra/commit/8be63b015fb8d72cea1220f05e7dc3bb997cc249), [`1009f77`](https://github.com/mastra-ai/mastra/commit/1009f772aa40016b49267c8566d0c29f6a16aa3c), [`1b8728a`](https://github.com/mastra-ai/mastra/commit/1b8728a57fd844205a452b0b4216d20ff60c784a), [`23c31de`](https://github.com/mastra-ai/mastra/commit/23c31de96ed8153402dcf092ac84b27a0c3638c1), [`0368766`](https://github.com/mastra-ai/mastra/commit/0368766744c7ea3df4d6059e2cc15f7bdf55f5a6), [`6f578ac`](https://github.com/mastra-ai/mastra/commit/6f578acba84930b406b2a0700b17cfdfaf5aae56), [`345eecc`](https://github.com/mastra-ai/mastra/commit/345eecce6ba519b5d987f0e10b5de4c8e5734580), [`1917c53`](https://github.com/mastra-ai/mastra/commit/1917c53b19dac43926f29c496893b0686462dca4), [`c01012f`](https://github.com/mastra-ai/mastra/commit/c01012f50368d29eb3fc3764df42d48291973d23), [`705ba98`](https://github.com/mastra-ai/mastra/commit/705ba98726d388a596e896225f237907ca6807a9), [`95857bc`](https://github.com/mastra-ai/mastra/commit/95857bcd6669da7193f503e803f0d72a2bd66be6), [`e62c108`](https://github.com/mastra-ai/mastra/commit/e62c108409dfd6a6cac0a48ec39c5cc81d24fd52), [`2866f04`](https://github.com/mastra-ai/mastra/commit/2866f04953edb78c1637fa45cc53abe24122edcb), [`ee14cae`](https://github.com/mastra-ai/mastra/commit/ee14cae244805783bde518a6142de28b744b169c), [`e84e791`](https://github.com/mastra-ai/mastra/commit/e84e79174031d7bc8793ca6c805eb38b06e7cfb1), [`c2f0b7f`](https://github.com/mastra-ai/mastra/commit/c2f0b7f1370f4428d165f51f0d1d9a48331cc257), [`213feb8`](https://github.com/mastra-ai/mastra/commit/213feb87bfdd1d8ec00ea660e218f9bcfcb34e7b), [`58e287b`](https://github.com/mastra-ai/mastra/commit/58e287b1edaf978b13745a1795989cad3826e82b), [`e420b3c`](https://github.com/mastra-ai/mastra/commit/e420b3c3ffc98bbc5b791897ea390bb47af99696), [`be875ed`](https://github.com/mastra-ai/mastra/commit/be875ed43f856742ce58529f531b5ea0ae6911f3), [`9eefdc0`](https://github.com/mastra-ai/mastra/commit/9eefdc0ac03f989718c6d835334940a977938895), [`bfbbb01`](https://github.com/mastra-ai/mastra/commit/bfbbb01bd845ba54cdc0c678c277d08a7cb847e4), [`7d112ca`](https://github.com/mastra-ai/mastra/commit/7d112ca17078479b2659b88ba1c85b936cfc111c)]:
  - @mastra/core@1.48.0

## 0.3.2-alpha.0

### Patch Changes

- Fixed buffered observation extraction metadata so stored OM chunks keep extracted values and extraction failures across memory storage adapters. ([#18655](https://github.com/mastra-ai/mastra/pull/18655))

- Updated dependencies [[`6f578ac`](https://github.com/mastra-ai/mastra/commit/6f578acba84930b406b2a0700b17cfdfaf5aae56), [`c01012f`](https://github.com/mastra-ai/mastra/commit/c01012f50368d29eb3fc3764df42d48291973d23), [`be875ed`](https://github.com/mastra-ai/mastra/commit/be875ed43f856742ce58529f531b5ea0ae6911f3), [`9eefdc0`](https://github.com/mastra-ai/mastra/commit/9eefdc0ac03f989718c6d835334940a977938895), [`7d112ca`](https://github.com/mastra-ai/mastra/commit/7d112ca17078479b2659b88ba1c85b936cfc111c)]:
  - @mastra/core@1.48.0-alpha.10

## 0.3.1

### Patch Changes

- Fixed workflow snapshots and AI spans creating duplicate records instead of updating in place. Each workflow step previously inserted a new row, causing unbounded table growth and degraded read performance. ([#18460](https://github.com/mastra-ai/mastra/pull/18460))

- Fixed workflow runs preserving their original creation time when re-persisted in MySQL storage, including concurrent saves. ([#18004](https://github.com/mastra-ai/mastra/pull/18004))

- Updated dependencies [[`86623c1`](https://github.com/mastra-ai/mastra/commit/86623c1adf7d22de32cc916dda17f4155184db36), [`023766f`](https://github.com/mastra-ai/mastra/commit/023766f44d59b30a50f3a381e33eddde8ab56c00), [`0200e75`](https://github.com/mastra-ai/mastra/commit/0200e7552d02d4221cd6040bf4eddf189a97a156), [`7c9dd77`](https://github.com/mastra-ai/mastra/commit/7c9dd77bd18cb8dc72797e25f1a0fbdc71a11347), [`7f9ae70`](https://github.com/mastra-ai/mastra/commit/7f9ae70826b047e5a66218f9e92f20e54a2d791f), [`a0509c7`](https://github.com/mastra-ai/mastra/commit/a0509c731a08aa3ed626557c5338126362856f57), [`06e0d63`](https://github.com/mastra-ai/mastra/commit/06e0d63d42bc2a202e18bc091f3781f409f5e6fb), [`bf3fe49`](https://github.com/mastra-ai/mastra/commit/bf3fe49f9467dbbdb8f9eaf74e0f7971ffb19559), [`01caf93`](https://github.com/mastra-ai/mastra/commit/01caf93d71ae2c1e65f49735cafb531975187426), [`438a971`](https://github.com/mastra-ai/mastra/commit/438a9715c8b4398e5eaf8914a1f19dc8a85dc1de), [`9990965`](https://github.com/mastra-ai/mastra/commit/999096571635a83b42ef40841fd7028cfa630779), [`77518cc`](https://github.com/mastra-ai/mastra/commit/77518ccb5bb8cc684875081e64213dc85cffdbee), [`fbeda0c`](https://github.com/mastra-ai/mastra/commit/fbeda0c0f35def07e6837936dd3a003b2b7c5172), [`8a68844`](https://github.com/mastra-ai/mastra/commit/8a688443013816105a09f89c6afa34b5ff13e26d), [`bb2a13b`](https://github.com/mastra-ai/mastra/commit/bb2a13bb4b32e6bb807200fe7b18ae8fa4322118), [`24ceaea`](https://github.com/mastra-ai/mastra/commit/24ceaea0bdd8609cabbab764380608ca6621a194), [`a73cd1a`](https://github.com/mastra-ai/mastra/commit/a73cd1a62a5e4ca023dcc39ba150029f4f1f74c1), [`c0ffa3c`](https://github.com/mastra-ai/mastra/commit/c0ffa3c897ccd326de880df734740a7f0681a18f), [`462a769`](https://github.com/mastra-ai/mastra/commit/462a769da61850862ca1be3d74134d33078ee6a7), [`0504bf5`](https://github.com/mastra-ai/mastra/commit/0504bf5e8cffc571a4b343326178de371e6f859b), [`0b5cc47`](https://github.com/mastra-ai/mastra/commit/0b5cc4726dc18d9a685a27520db39ff1b36bb89a), [`87f38a3`](https://github.com/mastra-ai/mastra/commit/87f38a3de03e24731f2dd6f8ed6a60b6722b85a1), [`d5fa3cd`](https://github.com/mastra-ai/mastra/commit/d5fa3cda1788c3cb93a361a3c6ec47de6ba21e98), [`fe98ef2`](https://github.com/mastra-ai/mastra/commit/fe98ef2e66dbfcbd7d645c88c9ee1e67b458a136), [`6ccf67b`](https://github.com/mastra-ai/mastra/commit/6ccf67bf075753754927a57bc2e1734ba2c820c5), [`793ea0f`](https://github.com/mastra-ai/mastra/commit/793ea0f52f831178837f21c83af6af93bf4ce638), [`825d8de`](https://github.com/mastra-ai/mastra/commit/825d8def9fa64c2bcc3d8dd6b49e09342c3ac5c7), [`507a5c4`](https://github.com/mastra-ai/mastra/commit/507a5c461bdc3136ad80744c0efbb55ce1f18f97), [`5afe423`](https://github.com/mastra-ai/mastra/commit/5afe423e4badf040f1b0d4525183a856fcb8146e), [`307573b`](https://github.com/mastra-ai/mastra/commit/307573b9ff3149b70c79540dbc86f1319b180f29), [`79b3626`](https://github.com/mastra-ai/mastra/commit/79b3626f8d647307eb07c8da14c9073c2699719d), [`c2c1d7b`](https://github.com/mastra-ai/mastra/commit/c2c1d7bb61d2602955f14ed3952f807c2d6eb576), [`86623c1`](https://github.com/mastra-ai/mastra/commit/86623c1adf7d22de32cc916dda17f4155184db36), [`1505c07`](https://github.com/mastra-ai/mastra/commit/1505c07603f6346bae12aa82f140e8b88ffea9ab), [`f328049`](https://github.com/mastra-ai/mastra/commit/f3280498c324afd2a8d36cd828f5b9f94a2dddc1), [`e545228`](https://github.com/mastra-ai/mastra/commit/e54522856934a5dc030b7b6385771e3548020d59), [`3eb852e`](https://github.com/mastra-ai/mastra/commit/3eb852e5435bc908b800193498103dc724f455b0), [`ffa09e7`](https://github.com/mastra-ai/mastra/commit/ffa09e772a5c92270eabe2090fc42d45bd8ec4b7), [`8c9f1c0`](https://github.com/mastra-ai/mastra/commit/8c9f1c0361d89066f9bcd14a2f69e761b01766c8), [`461a7c5`](https://github.com/mastra-ai/mastra/commit/461a7c501449295287f4f0ee4b0b42344f39fcf8), [`4211472`](https://github.com/mastra-ai/mastra/commit/4211472a5a2bd319c60cd2e42d9109c3eef7ac1c), [`9e45902`](https://github.com/mastra-ai/mastra/commit/9e4590208e745055cecca202e2db0e5c65e17d3c), [`5c0df77`](https://github.com/mastra-ai/mastra/commit/5c0df776c40efa420f8c07a2f3ee66010296618e), [`e940f09`](https://github.com/mastra-ai/mastra/commit/e940f099ef5d18b403e6f2b4937e086a4da857b1)]:
  - @mastra/core@1.47.0

## 0.3.1-alpha.0

### Patch Changes

- Fixed workflow snapshots and AI spans creating duplicate records instead of updating in place. Each workflow step previously inserted a new row, causing unbounded table growth and degraded read performance. ([#18460](https://github.com/mastra-ai/mastra/pull/18460))

- Fixed workflow runs preserving their original creation time when re-persisted in MySQL storage, including concurrent saves. ([#18004](https://github.com/mastra-ai/mastra/pull/18004))

- Updated dependencies [[`bf3fe49`](https://github.com/mastra-ai/mastra/commit/bf3fe49f9467dbbdb8f9eaf74e0f7971ffb19559), [`24ceaea`](https://github.com/mastra-ai/mastra/commit/24ceaea0bdd8609cabbab764380608ca6621a194), [`6ccf67b`](https://github.com/mastra-ai/mastra/commit/6ccf67bf075753754927a57bc2e1734ba2c820c5), [`825d8de`](https://github.com/mastra-ai/mastra/commit/825d8def9fa64c2bcc3d8dd6b49e09342c3ac5c7), [`ffa09e7`](https://github.com/mastra-ai/mastra/commit/ffa09e772a5c92270eabe2090fc42d45bd8ec4b7), [`461a7c5`](https://github.com/mastra-ai/mastra/commit/461a7c501449295287f4f0ee4b0b42344f39fcf8), [`4211472`](https://github.com/mastra-ai/mastra/commit/4211472a5a2bd319c60cd2e42d9109c3eef7ac1c), [`9e45902`](https://github.com/mastra-ai/mastra/commit/9e4590208e745055cecca202e2db0e5c65e17d3c), [`5c0df77`](https://github.com/mastra-ai/mastra/commit/5c0df776c40efa420f8c07a2f3ee66010296618e)]:
  - @mastra/core@1.47.0-alpha.3

## 0.3.0

### Minor Changes

- The MySQL store now rejects item-level tool mocks with a clear error instead of silently dropping them. Tool mock persistence is not yet supported on MySQL, so saving a dataset item with `toolMocks` (or an experiment result with a `toolMockReport`) fails fast rather than discarding the data. ([#18036](https://github.com/mastra-ai/mastra/pull/18036))

### Patch Changes

- Added multi-tenant scoping columns (`organizationId`, `projectId`) to the experiments domain so experiment records and per-item results inherit the tenancy bucket of their parent dataset. ([#18388](https://github.com/mastra-ai/mastra/pull/18388))

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

- Persist and filter dataset tenancy + candidate identity in storage adapters. ([#18314](https://github.com/mastra-ai/mastra/pull/18314))

  `createDataset` now persists `organizationId`, `projectId`, `candidateKey`, and `candidateId`. `listDatasets` and `listItems` accept matching tenancy filters. Dataset items inherit `organizationId` / `projectId` from their parent dataset on insert, update, delete, and batch insert/delete — items are never settable per call (item tenancy follows dataset tenancy).

  All new columns are nullable and added retroactively via each adapter's existing column-migration path; no breaking DDL. Existing rows continue to read and write fine; new writes can choose to stamp tenancy.

  ```ts
  await storage.createDataset({
    name: 'candidates/missing-tool-call/incident-123',
    organizationId: 'org_abc',
    projectId: 'project_xyz',
    candidateKey: 'missing-tool-call',
    candidateId: 'incident-123',
  });

  await storage.listDatasets({
    pagination: { page: 0, perPage: 20 },
    filters: { organizationId: 'org_abc', projectId: 'project_xyz' },
  });
  ```

- Fixed: `mastra build` output no longer hangs on the first storage-touching request when an app uses `LibSQLStore`, `PostgresStore`, or `MySQLStore` with observational memory. `mastra dev` was unaffected; only the bundled `mastra start` output deadlocked. No code changes or `bundler.externals` workaround required on the app side after upgrading. ([#18302](https://github.com/mastra-ai/mastra/pull/18302))

- Updated dependencies [[`5bd72d2`](https://github.com/mastra-ai/mastra/commit/5bd72d255f45b5ea8ab342643bd463814a980a24), [`1cc9ee1`](https://github.com/mastra-ai/mastra/commit/1cc9ee1ba51db53020a735626d33017a60b4b5b3), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`65f255a`](https://github.com/mastra-ai/mastra/commit/65f255a38667beb6ceeadabfa9eb5059bfec8298), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`30ebaf0`](https://github.com/mastra-ai/mastra/commit/30ebaf07bed5f4d30f2f257836c15d1bf7e40aae), [`5704634`](https://github.com/mastra-ai/mastra/commit/5704634b22133167dea337a942a34f57aaa3fa14), [`5c4e9a4`](https://github.com/mastra-ai/mastra/commit/5c4e9a4cfb2216bb3ea7f8988ad3727f3b92bb3a), [`4a88c6e`](https://github.com/mastra-ai/mastra/commit/4a88c6e2bdce316f8d7551b4ec3449b0b06fc71c), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`25961e3`](https://github.com/mastra-ai/mastra/commit/25961e3260ff3b1464637af8fcdb36210551c39f), [`6a1428a`](https://github.com/mastra-ai/mastra/commit/6a1428a23133fc070fc6c1caa08d28f3ba4fe5ff), [`87a17ef`](https://github.com/mastra-ai/mastra/commit/87a17efbd725aca6639febdc5e69e2abb3048689), [`e11ff30`](https://github.com/mastra-ai/mastra/commit/e11ff301408bf1731dca2fb7fbfcd8c819500a35), [`7794d71`](https://github.com/mastra-ai/mastra/commit/7794d71872c68733a30e028dfb7b1705daf6c5d2), [`9d2c946`](https://github.com/mastra-ai/mastra/commit/9d2c946d0859e90ae4bcec5beeb1da7398d2ad1e), [`c0eda2b`](https://github.com/mastra-ai/mastra/commit/c0eda2bcd91a228427314b12c91d8b147f3a739f), [`7b29f33`](https://github.com/mastra-ai/mastra/commit/7b29f332a357a83e555f29e718e5f2fab9979943), [`c0eda2b`](https://github.com/mastra-ai/mastra/commit/c0eda2bcd91a228427314b12c91d8b147f3a739f), [`b13925b`](https://github.com/mastra-ai/mastra/commit/b13925bfa91aa8700f56fa54a9ce707ee7e4ba62), [`f1ec385`](https://github.com/mastra-ai/mastra/commit/f1ec385386f62b1a0847ec5353ae2bb169d1c3d9), [`e14986f`](https://github.com/mastra-ai/mastra/commit/e14986f6e5478d6384d04ff9a7f9a79a46a8b529), [`24912b1`](https://github.com/mastra-ai/mastra/commit/24912b1f855d29ec36af4ef4bde1f7417e20cdf5), [`bf94ec6`](https://github.com/mastra-ai/mastra/commit/bf94ec68192d9f16e46ef7e5ac36370aeeddf35d), [`a29f371`](https://github.com/mastra-ai/mastra/commit/a29f371aef629ac8562661524a497127e93b5131), [`7686216`](https://github.com/mastra-ai/mastra/commit/7686216f37e74568feddec17cef3c3d24e10e60a), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`073f910`](https://github.com/mastra-ai/mastra/commit/073f910481e7d94b95ba3830f96531774ae95d33), [`0be490f`](https://github.com/mastra-ai/mastra/commit/0be490fabb538c5a7de796ea0aff7d04a0bea1f3), [`0be490f`](https://github.com/mastra-ai/mastra/commit/0be490fabb538c5a7de796ea0aff7d04a0bea1f3), [`ebbe1d3`](https://github.com/mastra-ai/mastra/commit/ebbe1d31a965a3adb0e728758f326b8122b4b55f), [`974f614`](https://github.com/mastra-ai/mastra/commit/974f614e083bd68278536f94453f7b320b86a3c7), [`3818814`](https://github.com/mastra-ai/mastra/commit/38188149ce454c4403fe9fcbdf73b735c68d36be), [`975c59a`](https://github.com/mastra-ai/mastra/commit/975c59ae363ee275fc55062392e1ffd2cbccbd53), [`1f97ce5`](https://github.com/mastra-ai/mastra/commit/1f97ce5695463bebb4eaacf501da6fb403e20885), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`7f51548`](https://github.com/mastra-ai/mastra/commit/7f515481213780be7047cef00640b9d35f3d545c), [`64f58c0`](https://github.com/mastra-ai/mastra/commit/64f58c04e78b40137497d47f781e897e416f22a5), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`ebbe1d3`](https://github.com/mastra-ai/mastra/commit/ebbe1d31a965a3adb0e728758f326b8122b4b55f), [`d95f394`](https://github.com/mastra-ai/mastra/commit/d95f394fd24c8411886930d727679c4d5252aa26), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`8e25a78`](https://github.com/mastra-ai/mastra/commit/8e25a78e0597575f0b0729bae8c5e190c84869b5), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`f3f0c9d`](https://github.com/mastra-ai/mastra/commit/f3f0c9d7c878db5a13177871ce3523a14f14b311), [`a5b22d3`](https://github.com/mastra-ai/mastra/commit/a5b22d314d62a68d801886a8d3d0eb6c089473db), [`31be1cf`](https://github.com/mastra-ai/mastra/commit/31be1cf5f2a7b5eef12f6123a40653b4d8115c16), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858)]:
  - @mastra/core@1.46.0

## 0.3.0-alpha.1

### Patch Changes

- Added multi-tenant scoping columns (`organizationId`, `projectId`) to the experiments domain so experiment records and per-item results inherit the tenancy bucket of their parent dataset. ([#18388](https://github.com/mastra-ai/mastra/pull/18388))

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

- Persist and filter dataset tenancy + candidate identity in storage adapters. ([#18314](https://github.com/mastra-ai/mastra/pull/18314))

  `createDataset` now persists `organizationId`, `projectId`, `candidateKey`, and `candidateId`. `listDatasets` and `listItems` accept matching tenancy filters. Dataset items inherit `organizationId` / `projectId` from their parent dataset on insert, update, delete, and batch insert/delete — items are never settable per call (item tenancy follows dataset tenancy).

  All new columns are nullable and added retroactively via each adapter's existing column-migration path; no breaking DDL. Existing rows continue to read and write fine; new writes can choose to stamp tenancy.

  ```ts
  await storage.createDataset({
    name: 'candidates/missing-tool-call/incident-123',
    organizationId: 'org_abc',
    projectId: 'project_xyz',
    candidateKey: 'missing-tool-call',
    candidateId: 'incident-123',
  });

  await storage.listDatasets({
    pagination: { page: 0, perPage: 20 },
    filters: { organizationId: 'org_abc', projectId: 'project_xyz' },
  });
  ```

- Updated dependencies [[`5c4e9a4`](https://github.com/mastra-ai/mastra/commit/5c4e9a4cfb2216bb3ea7f8988ad3727f3b92bb3a), [`25961e3`](https://github.com/mastra-ai/mastra/commit/25961e3260ff3b1464637af8fcdb36210551c39f), [`7b29f33`](https://github.com/mastra-ai/mastra/commit/7b29f332a357a83e555f29e718e5f2fab9979943), [`24912b1`](https://github.com/mastra-ai/mastra/commit/24912b1f855d29ec36af4ef4bde1f7417e20cdf5), [`7686216`](https://github.com/mastra-ai/mastra/commit/7686216f37e74568feddec17cef3c3d24e10e60a), [`975c59a`](https://github.com/mastra-ai/mastra/commit/975c59ae363ee275fc55062392e1ffd2cbccbd53), [`d95f394`](https://github.com/mastra-ai/mastra/commit/d95f394fd24c8411886930d727679c4d5252aa26), [`f3f0c9d`](https://github.com/mastra-ai/mastra/commit/f3f0c9d7c878db5a13177871ce3523a14f14b311)]:
  - @mastra/core@1.46.0-alpha.4

## 0.3.0-alpha.0

### Minor Changes

- The MySQL store now rejects item-level tool mocks with a clear error instead of silently dropping them. Tool mock persistence is not yet supported on MySQL, so saving a dataset item with `toolMocks` (or an experiment result with a `toolMockReport`) fails fast rather than discarding the data. ([#18036](https://github.com/mastra-ai/mastra/pull/18036))

### Patch Changes

- Fixed: `mastra build` output no longer hangs on the first storage-touching request when an app uses `LibSQLStore`, `PostgresStore`, or `MySQLStore` with observational memory. `mastra dev` was unaffected; only the bundled `mastra start` output deadlocked. No code changes or `bundler.externals` workaround required on the app side after upgrading. ([#18302](https://github.com/mastra-ai/mastra/pull/18302))

- Updated dependencies [[`65f255a`](https://github.com/mastra-ai/mastra/commit/65f255a38667beb6ceeadabfa9eb5059bfec8298), [`4a88c6e`](https://github.com/mastra-ai/mastra/commit/4a88c6e2bdce316f8d7551b4ec3449b0b06fc71c), [`87a17ef`](https://github.com/mastra-ai/mastra/commit/87a17efbd725aca6639febdc5e69e2abb3048689), [`e11ff30`](https://github.com/mastra-ai/mastra/commit/e11ff301408bf1731dca2fb7fbfcd8c819500a35), [`9d2c946`](https://github.com/mastra-ai/mastra/commit/9d2c946d0859e90ae4bcec5beeb1da7398d2ad1e), [`f1ec385`](https://github.com/mastra-ai/mastra/commit/f1ec385386f62b1a0847ec5353ae2bb169d1c3d9), [`e14986f`](https://github.com/mastra-ai/mastra/commit/e14986f6e5478d6384d04ff9a7f9a79a46a8b529), [`0be490f`](https://github.com/mastra-ai/mastra/commit/0be490fabb538c5a7de796ea0aff7d04a0bea1f3), [`0be490f`](https://github.com/mastra-ai/mastra/commit/0be490fabb538c5a7de796ea0aff7d04a0bea1f3), [`974f614`](https://github.com/mastra-ai/mastra/commit/974f614e083bd68278536f94453f7b320b86a3c7), [`31be1cf`](https://github.com/mastra-ai/mastra/commit/31be1cf5f2a7b5eef12f6123a40653b4d8115c16)]:
  - @mastra/core@1.46.0-alpha.3

## 0.2.0

### Minor Changes

- Random bump ([#18178](https://github.com/mastra-ai/mastra/pull/18178))

### Patch Changes

- Updated dependencies [[`7c0d868`](https://github.com/mastra-ai/mastra/commit/7c0d868d97d0fdbc04c14d0166dbf44d4c5a4a62), [`d9d2273`](https://github.com/mastra-ai/mastra/commit/d9d2273c702690c9a26eab2aebea879701d4355a), [`b04369d`](https://github.com/mastra-ai/mastra/commit/b04369d6b167c698ef103981171a8bf92808e756), [`8f3c262`](https://github.com/mastra-ai/mastra/commit/8f3c262587b335588a02d96b17fd6aca34c885b3)]:
  - @mastra/core@1.45.0

## 0.2.0-alpha.0

### Minor Changes

- Random bump ([#18178](https://github.com/mastra-ai/mastra/pull/18178))

### Patch Changes

- Updated dependencies [[`7c0d868`](https://github.com/mastra-ai/mastra/commit/7c0d868d97d0fdbc04c14d0166dbf44d4c5a4a62), [`d9d2273`](https://github.com/mastra-ai/mastra/commit/d9d2273c702690c9a26eab2aebea879701d4355a), [`b04369d`](https://github.com/mastra-ai/mastra/commit/b04369d6b167c698ef103981171a8bf92808e756), [`8f3c262`](https://github.com/mastra-ai/mastra/commit/8f3c262587b335588a02d96b17fd6aca34c885b3)]:
  - @mastra/core@1.45.0-alpha.0

## 0.1.3

### Patch Changes

- Security remediation for the 2026-06-17 "easy-day-js" supply-chain incident. Patch bump to publish clean versions and move the `latest` dist-tag forward, superseding the compromised versions that declared the malicious `easy-day-js` dependency. ([#18056](https://github.com/mastra-ai/mastra/pull/18056))

- Updated dependencies [[`339c57c`](https://github.com/mastra-ai/mastra/commit/339c57c5b2c6dbe75a125e138228e0556528976f), [`1dd4117`](https://github.com/mastra-ai/mastra/commit/1dd4117dcbd8e031ede9f0489436bfbc6f0315b8), [`2b11d1f`](https://github.com/mastra-ai/mastra/commit/2b11d1f6ac7024c5dd2b2dd12a48a956ac9d63bd), [`77a2351`](https://github.com/mastra-ai/mastra/commit/77a2351ee79296e360bce822cb3391f7cfd6489d), [`b7dff0a`](https://github.com/mastra-ai/mastra/commit/b7dff0a3d1022eb6868f48dc40a2b1febd5c277f), [`02087e1`](https://github.com/mastra-ai/mastra/commit/02087e1fbc54aa07f3071f7a200df1bf5be601a8), [`49af8df`](https://github.com/mastra-ai/mastra/commit/49af8df589c4ff71a5015a4553b377b32704b691), [`30ce559`](https://github.com/mastra-ai/mastra/commit/30ce55902ecf819b8ab8697398dd68b108228063), [`c241b92`](https://github.com/mastra-ai/mastra/commit/c241b929dc8c8d6a7b7219c99ed13ac1f3124a77), [`7d6ff70`](https://github.com/mastra-ai/mastra/commit/7d6ff708727297a0526ca0e26e93eeb5bbaaa187), [`ab975d4`](https://github.com/mastra-ai/mastra/commit/ab975d4dd9488752f05bda7afa03166d207e3e2a), [`9d6aa1b`](https://github.com/mastra-ai/mastra/commit/9d6aa1bae407e2afa6a089abc2a6accbbcb287b8)]:
  - @mastra/core@1.44.0

## 0.1.3-alpha.0

### Patch Changes

- Security remediation for the 2026-06-17 "easy-day-js" supply-chain incident. Patch bump to publish clean versions and move the `latest` dist-tag forward, superseding the compromised versions that declared the malicious `easy-day-js` dependency. ([#18056](https://github.com/mastra-ai/mastra/pull/18056))

- Updated dependencies [[`77a2351`](https://github.com/mastra-ai/mastra/commit/77a2351ee79296e360bce822cb3391f7cfd6489d)]:
  - @mastra/core@1.43.1-alpha.0

## 0.1.1

### Patch Changes

- Fixed skill updates creating duplicate versions when a snapshot had not meaningfully changed. Comparison previously relied on `JSON.stringify`, so reordered object keys (common with PostgreSQL JSONB) or optional fields round-tripping between `undefined` and `null` looked like changes. Skill snapshots are now compared by value, so repeated no-op publish/update cycles no longer increment the version number. ([#16811](https://github.com/mastra-ai/mastra/pull/16811))

- Updated dependencies [[`de66bb0`](https://github.com/mastra-ai/mastra/commit/de66bb040570444c702ce4d8e1e228a5de2949cb), [`67bf8e2`](https://github.com/mastra-ai/mastra/commit/67bf8e206dfe583954d96015cf0d09f7ac50e45f), [`8216d05`](https://github.com/mastra-ai/mastra/commit/8216d0528d866eb9a07f5d4c87ea3bb1e1139b45), [`d18b23c`](https://github.com/mastra-ai/mastra/commit/d18b23c5e29dfc381e73e3c51fcf6c779afd1823), [`5eb94eb`](https://github.com/mastra-ai/mastra/commit/5eb94ebcf66d4e28c9e26d5821ac93379bab20a0), [`1fa3e12`](https://github.com/mastra-ai/mastra/commit/1fa3e123582b63cfe49de4ee52dc6a065e8d956a), [`f9ee2ac`](https://github.com/mastra-ai/mastra/commit/f9ee2ac661af584e61bc063ac208c9035cd752ef), [`c853d53`](https://github.com/mastra-ai/mastra/commit/c853d535d2df84ab89db1adb4c28900c54c9a2d2), [`d8df1f8`](https://github.com/mastra-ai/mastra/commit/d8df1f8e947e1966c9d4e54713df56d0d0d65226), [`9192ddb`](https://github.com/mastra-ai/mastra/commit/9192ddbced8949113b30de444cbe763f075b59f5), [`ae96523`](https://github.com/mastra-ai/mastra/commit/ae965231f562d9766b0c90c49a69fc68acaa031c), [`17d5a92`](https://github.com/mastra-ai/mastra/commit/17d5a9211aa293b4d4418de3de70dc0394d58101), [`5573693`](https://github.com/mastra-ai/mastra/commit/5573693b589822250e20dfe6cf66e9ff3bc96da8), [`ec4da8a`](https://github.com/mastra-ai/mastra/commit/ec4da8a09e0d2ab452c6ee2c786042ea826b77e5), [`adc44e1`](https://github.com/mastra-ai/mastra/commit/adc44e13c7e570b91e86b20ea7556e61d819db31), [`ed346c0`](https://github.com/mastra-ai/mastra/commit/ed346c0bee2d8496690a4e538bfba1e46894660f), [`c9ce1b2`](https://github.com/mastra-ai/mastra/commit/c9ce1b28d10871110648f9d7b6d76e880b9fa999), [`3ef01fd`](https://github.com/mastra-ai/mastra/commit/3ef01fd130b53d5bd4f828beb174e516a2eb1158), [`245a9a3`](https://github.com/mastra-ai/mastra/commit/245a9a315705fce17ddd980f78a92504b6615c4a), [`dc0b611`](https://github.com/mastra-ai/mastra/commit/dc0b6119b769bd00ee2c5df9259fb376fe63077a), [`38b5de8`](https://github.com/mastra-ai/mastra/commit/38b5de8e5d1d41a69522addf53d96f4b3a1d5bf0), [`dc0b611`](https://github.com/mastra-ai/mastra/commit/dc0b6119b769bd00ee2c5df9259fb376fe63077a), [`dd6a66e`](https://github.com/mastra-ai/mastra/commit/dd6a66ea0b32e0dea8059aec6b35d151e2c87dc4), [`d785c59`](https://github.com/mastra-ai/mastra/commit/d785c593b67fcb4cdc4fab9fdbde5f3b7665efc0), [`1fa3e12`](https://github.com/mastra-ai/mastra/commit/1fa3e123582b63cfe49de4ee52dc6a065e8d956a), [`8b984f4`](https://github.com/mastra-ai/mastra/commit/8b984f4361c202270ceb69257185c4756c9a7c56), [`bf08402`](https://github.com/mastra-ai/mastra/commit/bf084022374fa5d06ca70ed67a86dd64e379071b), [`81fe587`](https://github.com/mastra-ai/mastra/commit/81fe587275035715c1720ddf3fee0505cf053036), [`1fa3e12`](https://github.com/mastra-ai/mastra/commit/1fa3e123582b63cfe49de4ee52dc6a065e8d956a), [`403c438`](https://github.com/mastra-ai/mastra/commit/403c438e417278989ce247233d2c465b8d902cdd), [`f8ba195`](https://github.com/mastra-ai/mastra/commit/f8ba1954e27ee2b20586cc6cd9cf13c002c232f2)]:
  - @mastra/core@1.43.0

## 0.1.0

### Minor Changes

- Added the MySQL storage adapter for Mastra. Use it as a storage backend with the same domain coverage as the other first-party adapters (memory, threads, workflows, observability, agents, and more). ([#17446](https://github.com/mastra-ai/mastra/pull/17446))

  ```ts
  import { MySQLStore } from '@mastra/mysql';

  const store = new MySQLStore({
    connectionString: 'mysql://user:password@localhost:3306/mastra',
  });
  ```

  This release also makes table and index setup reliable on a brand-new database:
  - Fixed store initialization failing on a fresh database. Idempotency for favorites is now enforced by the table's primary key instead of a separate index that MySQL rejected, which previously aborted setup and left the connection pool unusable.
  - Fixed default performance indexes silently failing to be created. Indexes on text columns now include a key-length prefix so they are created instead of skipped.

### Patch Changes

- Updated dependencies [[`fa63872`](https://github.com/mastra-ai/mastra/commit/fa6387280954e6b667bec5714b55ba082bc627ff), [`d779de3`](https://github.com/mastra-ai/mastra/commit/d779de3cd9d2e7ed8110547190e2f15e786a0e41), [`1750c97`](https://github.com/mastra-ai/mastra/commit/1750c975d6179fbf6db2813b15229d4f8f23fc55), [`9283971`](https://github.com/mastra-ai/mastra/commit/928397157009b4aef4d5fdf3a0a273cb371beb55), [`f07b646`](https://github.com/mastra-ai/mastra/commit/f07b64604ab7d25391179790b7fd4823df9e2dff), [`d8838ae`](https://github.com/mastra-ai/mastra/commit/d8838ae80b69780361693d27098f7f6684af12fe), [`40f9297`](https://github.com/mastra-ai/mastra/commit/40f9297003b921c62373d3e8d3a4bda76c9f6de3), [`19a8658`](https://github.com/mastra-ai/mastra/commit/19a86589c788ef48bb6c1b0612cc82a201857379), [`850af77`](https://github.com/mastra-ai/mastra/commit/850af7779cb87c350804488734544a5b1843de25), [`0f0d1ba`](https://github.com/mastra-ai/mastra/commit/0f0d1ba67bfcb2204e571401662f1eceefc03357), [`a18775a`](https://github.com/mastra-ai/mastra/commit/a18775a693172546ee2378d39b67d4e32895b251), [`1baf2d1`](https://github.com/mastra-ai/mastra/commit/1baf2d152c6881338ff8f114633d5316fe13dd15), [`8c31bcd`](https://github.com/mastra-ai/mastra/commit/8c31bcdb00e597880d5939b1b7d7566fbe5dacae), [`0e32507`](https://github.com/mastra-ai/mastra/commit/0e32507962cdfa5569b7bda5bc6fb3dd34e40b03), [`95b14cd`](https://github.com/mastra-ai/mastra/commit/95b14cdd820e86d97ac05fe568424c513a252e31), [`07c3de7`](https://github.com/mastra-ai/mastra/commit/07c3de7f7bc418beccaea3b5e6b7f7cdda79d492), [`0bf2d93`](https://github.com/mastra-ai/mastra/commit/0bf2d932d20e2936f2d9abb8c0a86e24fbc97ec6), [`7b0d34c`](https://github.com/mastra-ai/mastra/commit/7b0d34cfe4a2fce22ac86ae17404685ff67a2ddb), [`a659a77`](https://github.com/mastra-ai/mastra/commit/a659a779bdebe3a52a518c56d2260592d0240fe0), [`aa36be2`](https://github.com/mastra-ai/mastra/commit/aa36be23aa513b7dc53cb8ca16b7fab8f20e43ad), [`3332be9`](https://github.com/mastra-ai/mastra/commit/3332be9701ecd77aba840959d9a1d1ce7aef02d3), [`212c635`](https://github.com/mastra-ai/mastra/commit/212c635203e61d036ab41db8ff86c3893dc795b3), [`d8838ae`](https://github.com/mastra-ai/mastra/commit/d8838ae80b69780361693d27098f7f6684af12fe), [`9aa5a73`](https://github.com/mastra-ai/mastra/commit/9aa5a73e7e110f6e9365eec69364a33d5f03bb56), [`f73c789`](https://github.com/mastra-ai/mastra/commit/f73c789e8ef21561580395d2c410119cab5848c8), [`8bd16da`](https://github.com/mastra-ai/mastra/commit/8bd16da73a4cb874d739373643dbd6a6e7f88684), [`c8630f8`](https://github.com/mastra-ai/mastra/commit/c8630f80d4f40cb5d22e60ab162b618b1907167a), [`94dfef6`](https://github.com/mastra-ai/mastra/commit/94dfef6e2bf19a88467ea3940afcbce88a433f0f), [`47f71dc`](https://github.com/mastra-ai/mastra/commit/47f71dc6fbcbd12d71e21a979e676e20a02bd77d), [`50ceae2`](https://github.com/mastra-ai/mastra/commit/50ceae270878e2f8fb2b2c6c2faab09df0007c8a), [`a122f79`](https://github.com/mastra-ai/mastra/commit/a122f79427ae225ec79c7b2ed46278da48d04b17), [`8cdde58`](https://github.com/mastra-ai/mastra/commit/8cdde5875bbba6702d9df226f2b20232b8d75d6c), [`3a081c1`](https://github.com/mastra-ai/mastra/commit/3a081c1255c5ae8c99f6dad91cc612934ef6f2bd), [`49f8abc`](https://github.com/mastra-ai/mastra/commit/49f8abce8258e4f2f87bd326acfbdb641264a47c), [`847ff1e`](https://github.com/mastra-ai/mastra/commit/847ff1e0d94368d94b2e173e4e0908e115568ef3), [`0c1ed1d`](https://github.com/mastra-ai/mastra/commit/0c1ed1d00c7d87b5ac99ca95896211a2fa9189fa), [`259d409`](https://github.com/mastra-ai/mastra/commit/259d409a514174299dbde1ff5e1121209b3ba850), [`9e16c68`](https://github.com/mastra-ai/mastra/commit/9e16c6818b6485ccb43df28aba6f3a2219d28662), [`cefca33`](https://github.com/mastra-ai/mastra/commit/cefca33ae666e69810c935fedf95a929c173d1d7), [`d00e8c5`](https://github.com/mastra-ai/mastra/commit/d00e8c50daebe5bce5bf2f48bde39c86fc3d2fe4), [`36fa7e2`](https://github.com/mastra-ai/mastra/commit/36fa7e24d14e58a1eb46147097b32f583e5b8775), [`87e9774`](https://github.com/mastra-ai/mastra/commit/87e97741c1e493cd6d62f478eb810b49bda4d57c), [`65a72e7`](https://github.com/mastra-ai/mastra/commit/65a72e70c25eedea8ff985a6624b96be2850236b), [`fe9eacd`](https://github.com/mastra-ai/mastra/commit/fe9eacd9545a0a9d64aad31c9fa90294a425289e), [`4c02027`](https://github.com/mastra-ai/mastra/commit/4c020277235eaa6b1dc957c90ad0639eef213992), [`0f77241`](https://github.com/mastra-ai/mastra/commit/0f7724108806703799a8ba80ad0f09414afd5066), [`849efb9`](https://github.com/mastra-ai/mastra/commit/849efb9fca6dc976589c1f90a303fea618769109), [`92ff509`](https://github.com/mastra-ai/mastra/commit/92ff5098ef8a990438ca038077021a5f7541ec1d), [`3fce5e7`](https://github.com/mastra-ai/mastra/commit/3fce5e70d011d289043e75003ef3336ed4aa43c3), [`a763592`](https://github.com/mastra-ai/mastra/commit/a763592c3db46963ef1011cfe16fe372816e775e), [`db79c86`](https://github.com/mastra-ai/mastra/commit/db79c86c60723d57e02f9636ca2611bd4515f194), [`6855012`](https://github.com/mastra-ai/mastra/commit/685501247cc4717506f3e89beed03509d63a5370), [`80c7737`](https://github.com/mastra-ai/mastra/commit/80c7737e32d7917b5f356957d67c169d01744fd3), [`7fef31c`](https://github.com/mastra-ai/mastra/commit/7fef31c0d2a6d362a43a647a8a4f6ab893758a23), [`7fef31c`](https://github.com/mastra-ai/mastra/commit/7fef31c0d2a6d362a43a647a8a4f6ab893758a23), [`3f1cf47`](https://github.com/mastra-ai/mastra/commit/3f1cf476f74c1e4cc2df908837e05853a5347e31)]:
  - @mastra/core@1.38.0

## 0.1.0-alpha.0

### Minor Changes

- Added the MySQL storage adapter for Mastra. Use it as a storage backend with the same domain coverage as the other first-party adapters (memory, threads, workflows, observability, agents, and more). ([#17446](https://github.com/mastra-ai/mastra/pull/17446))

  ```ts
  import { MySQLStore } from '@mastra/mysql';

  const store = new MySQLStore({
    connectionString: 'mysql://user:password@localhost:3306/mastra',
  });
  ```

  This release also makes table and index setup reliable on a brand-new database:
  - Fixed store initialization failing on a fresh database. Idempotency for favorites is now enforced by the table's primary key instead of a separate index that MySQL rejected, which previously aborted setup and left the connection pool unusable.
  - Fixed default performance indexes silently failing to be created. Indexes on text columns now include a key-length prefix so they are created instead of skipped.

### Patch Changes

- Updated dependencies [[`19a8658`](https://github.com/mastra-ai/mastra/commit/19a86589c788ef48bb6c1b0612cc82a201857379), [`a659a77`](https://github.com/mastra-ai/mastra/commit/a659a779bdebe3a52a518c56d2260592d0240fe0), [`3332be9`](https://github.com/mastra-ai/mastra/commit/3332be9701ecd77aba840959d9a1d1ce7aef02d3)]:
  - @mastra/core@1.38.0-alpha.6
