# @mastra/mysql

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
