# @mastra/dsql

## 1.3.4-alpha.2

### Patch Changes

- Update README to include accurate, up-to-date information ([#22858](https://github.com/mastra-ai/mastra/pull/22858))

- Updated dependencies [[`e983f74`](https://github.com/mastra-ai/mastra/commit/e983f749873189f767f509eb33d1a3596c0f1c74), [`cedc25d`](https://github.com/mastra-ai/mastra/commit/cedc25d8c2dec005d8b10b6ce2d36feef1162ff0), [`9fdb3bc`](https://github.com/mastra-ai/mastra/commit/9fdb3bc0f9bfab5269b4f3045595e62323da5d3a)]:
  - @mastra/core@1.64.0-alpha.7

## 1.3.4-alpha.1

### Patch Changes

- Fixed memory thread and resource timestamps being written in the server's local timezone. `createdAt` and `updatedAt` are now stored as UTC, so both timestamp column variants hold the same instant regardless of where the process runs. ([#22818](https://github.com/mastra-ai/mastra/pull/22818))

- Updated dependencies [[`decd47d`](https://github.com/mastra-ai/mastra/commit/decd47d0db2a891a6832e226557145b6658b0b19), [`285ce1c`](https://github.com/mastra-ai/mastra/commit/285ce1c1399341a37e76233aa94dbf9f1a41bd5d), [`5b5e3cc`](https://github.com/mastra-ai/mastra/commit/5b5e3cc006950b0ff9720c5be8396d4c95e8a6ac), [`045c3c7`](https://github.com/mastra-ai/mastra/commit/045c3c78f2129fea5d4467bb26cff2b49788b3d0), [`d53a056`](https://github.com/mastra-ai/mastra/commit/d53a05614893e8d1bbfdab50b42c19435e6bd065)]:
  - @mastra/core@1.64.0-alpha.5

## 1.3.4-alpha.0

### Patch Changes

- Corrected the minimum supported @mastra/core version to match the APIs used by this store. ([#22564](https://github.com/mastra-ai/mastra/pull/22564))

- Remove `CHANGELOG.md` from distributed npm files resulting in reduced package size ([#22737](https://github.com/mastra-ai/mastra/pull/22737))

- Updated dependencies [[`cf58c86`](https://github.com/mastra-ai/mastra/commit/cf58c86cb48ccc72677bdaa422e43f102683184c), [`449d112`](https://github.com/mastra-ai/mastra/commit/449d1120cc1f9c43a71308a9fd8b178cfb11355f), [`2a0ca02`](https://github.com/mastra-ai/mastra/commit/2a0ca021d95e23f1d1c0b5fe858b0b56f71fe0ba), [`ff539f6`](https://github.com/mastra-ai/mastra/commit/ff539f6dc21137fbeb3f0867f07069cbce45c15f), [`420052f`](https://github.com/mastra-ai/mastra/commit/420052fcac3fc672be17fe655667dfbdbd35a2cc), [`28ce924`](https://github.com/mastra-ai/mastra/commit/28ce924276eeca492e6a360e5482ed20c2785ef6)]:
  - @mastra/core@1.64.0-alpha.2

## 1.3.3

### Patch Changes

- Fix missing $ prefix on the WHERE id placeholder in AgentsDSQL.update(), which caused "operator does not exist: text = integer" on every agent update. ([#22389](https://github.com/mastra-ai/mastra/pull/22389))

- Updated dependencies [[`7176362`](https://github.com/mastra-ai/mastra/commit/717636281a3339911a05ea2cc8ae38afe4fd2cef), [`9045b8f`](https://github.com/mastra-ai/mastra/commit/9045b8fdf622e1d735b96ddd6500bd32556636d9), [`7677a2c`](https://github.com/mastra-ai/mastra/commit/7677a2cd47729221ca28afc5067d26e22d925b59), [`e3b796d`](https://github.com/mastra-ai/mastra/commit/e3b796d29a63f0d5c97dd815aadec40687346d70), [`f7a7467`](https://github.com/mastra-ai/mastra/commit/f7a74678193921e7ea4790232d707b3237626cac), [`49ccd14`](https://github.com/mastra-ai/mastra/commit/49ccd142268a61fb55ea75bc76287643a21f3677), [`f9c56f3`](https://github.com/mastra-ai/mastra/commit/f9c56f336ee8c250763a438990f8e60a428353c9), [`3855b38`](https://github.com/mastra-ai/mastra/commit/3855b38c4c25af32ab8e298e148becc963abe92c)]:
  - @mastra/core@1.63.0

## 1.3.3-alpha.0

### Patch Changes

- Fix missing $ prefix on the WHERE id placeholder in AgentsDSQL.update(), which caused "operator does not exist: text = integer" on every agent update. ([#22389](https://github.com/mastra-ai/mastra/pull/22389))

- Updated dependencies [[`7176362`](https://github.com/mastra-ai/mastra/commit/717636281a3339911a05ea2cc8ae38afe4fd2cef), [`e3b796d`](https://github.com/mastra-ai/mastra/commit/e3b796d29a63f0d5c97dd815aadec40687346d70), [`49ccd14`](https://github.com/mastra-ai/mastra/commit/49ccd142268a61fb55ea75bc76287643a21f3677), [`3855b38`](https://github.com/mastra-ai/mastra/commit/3855b38c4c25af32ab8e298e148becc963abe92c)]:
  - @mastra/core@1.63.0-alpha.0

## 1.3.2

### Patch Changes

- Fixed concurrent resume() calls on the same suspended workflow run executing downstream steps more than once. A resume now atomically claims the run before executing anything, so only one caller continues a given suspension. Losing callers throw WORKFLOW_RESUME_ALREADY_CLAIMED without running any steps. Fixes #20443 ([#21725](https://github.com/mastra-ai/mastra/pull/21725))

- Workflow state updates now support an optional expectedStatus guard, so a status change is only applied when the stored run is in an expected state. This is what makes concurrent workflow resumes safe. ([#21725](https://github.com/mastra-ai/mastra/pull/21725))

- Resume conflicts now return 409 Conflict. When a suspended workflow run has already been resumed by another caller, the resume endpoints respond with 409 instead of a generic error. ([#21725](https://github.com/mastra-ai/mastra/pull/21725))

- Updated dependencies [[`88d14ca`](https://github.com/mastra-ai/mastra/commit/88d14cac008582a618fecc3d5c7fd3bdf4f6ddc3), [`480e491`](https://github.com/mastra-ai/mastra/commit/480e491588bd6a7a1c9ee4407590ad625dd33952), [`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`acc3471`](https://github.com/mastra-ai/mastra/commit/acc3471de5f3fde8027ee4e355af292b2bc1bc30), [`b6a771e`](https://github.com/mastra-ai/mastra/commit/b6a771ef23d203ddb348efca8065eff65def8191), [`84a5b69`](https://github.com/mastra-ai/mastra/commit/84a5b699f84d6bae0a34efe5a970d891090b9f41), [`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`3bb88dd`](https://github.com/mastra-ai/mastra/commit/3bb88ddf07fb98f3cd16d3bff94e51cd3b45d011), [`d23e75d`](https://github.com/mastra-ai/mastra/commit/d23e75d57cc7cf5b9bfdbee896bf5a6a2484fed7), [`c8faa4e`](https://github.com/mastra-ai/mastra/commit/c8faa4e1cfebaec56b65e754e90b9fe46d153359), [`d378d75`](https://github.com/mastra-ai/mastra/commit/d378d7511f71309ed61a8f6b93cd0361dc6cb70f), [`84a5b69`](https://github.com/mastra-ai/mastra/commit/84a5b699f84d6bae0a34efe5a970d891090b9f41), [`26d4016`](https://github.com/mastra-ai/mastra/commit/26d40160ff7f7d8bf95fee2039a52cbc83863533), [`7c60df5`](https://github.com/mastra-ai/mastra/commit/7c60df5c7872343fbac5c3e5b1175c8076a5abfd), [`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`84a5b69`](https://github.com/mastra-ai/mastra/commit/84a5b699f84d6bae0a34efe5a970d891090b9f41), [`f2031a4`](https://github.com/mastra-ai/mastra/commit/f2031a47445e8f67a89ba1309036816f97ab7a65), [`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`cad4208`](https://github.com/mastra-ai/mastra/commit/cad42082e6aa1776168a94914f523334be45d929), [`8e529d4`](https://github.com/mastra-ai/mastra/commit/8e529d4ac754efef04b225841349e0da9edf89a6), [`57c5103`](https://github.com/mastra-ai/mastra/commit/57c51035a2a36e3df3c4f32f46bb789a66ed5946), [`038b7b4`](https://github.com/mastra-ai/mastra/commit/038b7b405cb4ac25ab3f3031334111b1f87ac112), [`4132d61`](https://github.com/mastra-ai/mastra/commit/4132d61f8367077120ee9e6420d3224dffd93c93), [`d378d75`](https://github.com/mastra-ai/mastra/commit/d378d7511f71309ed61a8f6b93cd0361dc6cb70f)]:
  - @mastra/core@1.61.0

## 1.3.2-alpha.0

### Patch Changes

- Fixed concurrent resume() calls on the same suspended workflow run executing downstream steps more than once. A resume now atomically claims the run before executing anything, so only one caller continues a given suspension. Losing callers throw WORKFLOW_RESUME_ALREADY_CLAIMED without running any steps. Fixes #20443 ([#21725](https://github.com/mastra-ai/mastra/pull/21725))

- Workflow state updates now support an optional expectedStatus guard, so a status change is only applied when the stored run is in an expected state. This is what makes concurrent workflow resumes safe. ([#21725](https://github.com/mastra-ai/mastra/pull/21725))

- Resume conflicts now return 409 Conflict. When a suspended workflow run has already been resumed by another caller, the resume endpoints respond with 409 instead of a generic error. ([#21725](https://github.com/mastra-ai/mastra/pull/21725))

- Updated dependencies [[`88d14ca`](https://github.com/mastra-ai/mastra/commit/88d14cac008582a618fecc3d5c7fd3bdf4f6ddc3), [`84a5b69`](https://github.com/mastra-ai/mastra/commit/84a5b699f84d6bae0a34efe5a970d891090b9f41), [`84a5b69`](https://github.com/mastra-ai/mastra/commit/84a5b699f84d6bae0a34efe5a970d891090b9f41), [`84a5b69`](https://github.com/mastra-ai/mastra/commit/84a5b699f84d6bae0a34efe5a970d891090b9f41), [`038b7b4`](https://github.com/mastra-ai/mastra/commit/038b7b405cb4ac25ab3f3031334111b1f87ac112), [`4132d61`](https://github.com/mastra-ai/mastra/commit/4132d61f8367077120ee9e6420d3224dffd93c93)]:
  - @mastra/core@1.60.1-alpha.0

## 1.3.1

### Patch Changes

- Added a `durable` option to stored agents so agents created through the Agents API can run with durable execution — no code deployment required. ([#21715](https://github.com/mastra-ai/mastra/pull/21715))

  ```typescript
  await mastraClient.createStoredAgent({
    id: 'helper',
    name: 'Helper',
    instructions: 'You are a helpful assistant.',
    model: { provider: 'openai', name: 'gpt-5' },
    durable: true,
  });
  ```

  Pass `true` for defaults, or `{ maxSteps, cleanupTimeoutMs }` to tune the durable loop. Cache and pubsub are inherited from the server's Mastra instance, so configure distributed backends there for durability across replicas. Automatic recovery is still configured in code via `recovery.durableAgents`.

- Updated dependencies [[`587f6ef`](https://github.com/mastra-ai/mastra/commit/587f6efcfc25880b93760a8607d1cd381ec612fe), [`7e096f0`](https://github.com/mastra-ai/mastra/commit/7e096f02f0dddbf09b85d306458351245ed2f886), [`d7e6745`](https://github.com/mastra-ai/mastra/commit/d7e67456954863c55440ea9c49bc6ceb9949972d), [`6223446`](https://github.com/mastra-ai/mastra/commit/6223446ddce6166e96e0ba5e00d628b615dee8ca), [`15101bb`](https://github.com/mastra-ai/mastra/commit/15101bb53c0d934f31af6b8813b88191e382a5e5), [`4e7a421`](https://github.com/mastra-ai/mastra/commit/4e7a421dce8a48742f785d1e93ad2f43a572b282), [`c2c3deb`](https://github.com/mastra-ai/mastra/commit/c2c3debcf670c7082d0a5e553aa99818a864698c), [`d8308a2`](https://github.com/mastra-ai/mastra/commit/d8308a2be3c07e777393d1017a381dcae3890d30), [`b0a2a07`](https://github.com/mastra-ai/mastra/commit/b0a2a07800d42bd9823292e7db832374ed084c9c), [`74e5bd3`](https://github.com/mastra-ai/mastra/commit/74e5bd315b8b3a1e04cb6cf480bb0f5fc4951dc8), [`242e324`](https://github.com/mastra-ai/mastra/commit/242e3241e73cbd5c9bb86a31ebb49ca0256488d4), [`217e967`](https://github.com/mastra-ai/mastra/commit/217e9672d8b3160eb729d8e9f0044949e88da239), [`d774e89`](https://github.com/mastra-ai/mastra/commit/d774e8930c781df8c9effe3763e6b501c099b6cc), [`9c27a53`](https://github.com/mastra-ai/mastra/commit/9c27a53cd9d3de4f3f025bc387d94ce371c33f95), [`8f0a332`](https://github.com/mastra-ai/mastra/commit/8f0a3321bf180368d76fe7b36aa1a8f60f00b6de), [`0b4f108`](https://github.com/mastra-ai/mastra/commit/0b4f1089aa8d92e67c2a8e99726822c5ee410784), [`9acb50f`](https://github.com/mastra-ai/mastra/commit/9acb50f71cec9c362f06820033f90ae6b1f8282f), [`46e9e3f`](https://github.com/mastra-ai/mastra/commit/46e9e3f73babe1bc70080a596cf2ac0b9da48519), [`3f9a190`](https://github.com/mastra-ai/mastra/commit/3f9a19057c027155867b9317294ee4ca7bd0581a), [`dff25a1`](https://github.com/mastra-ai/mastra/commit/dff25a1103fa72ee082a9b6f805ebeb5ce400753), [`6db7a5d`](https://github.com/mastra-ai/mastra/commit/6db7a5dd3dd2b6f7ef75dcd804fcffef5fa83963), [`217e967`](https://github.com/mastra-ai/mastra/commit/217e9672d8b3160eb729d8e9f0044949e88da239), [`583e235`](https://github.com/mastra-ai/mastra/commit/583e23519c13af16c1746f9c49722d011216611b), [`b098de9`](https://github.com/mastra-ai/mastra/commit/b098de9d7cb9f672e0883a5c716465a3a689693d), [`e8808e3`](https://github.com/mastra-ai/mastra/commit/e8808e3d8eb585a2565be53e56a7e0e1477352a4), [`a77f8d4`](https://github.com/mastra-ai/mastra/commit/a77f8d4740d2178a74c41e4bf678b4fcd8fa0bb2), [`7f78585`](https://github.com/mastra-ai/mastra/commit/7f785857e401570e2ffb316911f126ed363aa537), [`33374ba`](https://github.com/mastra-ai/mastra/commit/33374ba359e4fb13eaa918ae925fe167a3c55414), [`940bf5c`](https://github.com/mastra-ai/mastra/commit/940bf5ccf04f2c9ebd8a1390431733222a03b1cd), [`c549e2f`](https://github.com/mastra-ai/mastra/commit/c549e2f40edc1cac5d9e74e82f90da22b48df084), [`58c43d3`](https://github.com/mastra-ai/mastra/commit/58c43d3f7cb2eeaeb8ac733ae71dde822348e588), [`ef6e295`](https://github.com/mastra-ai/mastra/commit/ef6e295b59bc25a5b61b633a89c97bcfce9fb465), [`208e1b3`](https://github.com/mastra-ai/mastra/commit/208e1b39f30f4b386e494394e9d71d96f0f90241), [`c938d34`](https://github.com/mastra-ai/mastra/commit/c938d34739936c8ecbabd67ad6a4a4396f41c4c6), [`88ddc7c`](https://github.com/mastra-ai/mastra/commit/88ddc7ce01d40175f13a3228b789a906779680bd), [`f2a4afd`](https://github.com/mastra-ai/mastra/commit/f2a4afd7e37e809669001ed17724b341a5c1f45e), [`d438148`](https://github.com/mastra-ai/mastra/commit/d438148e222c1e2fb3c652725ce75680962ebec4), [`ba05fe0`](https://github.com/mastra-ai/mastra/commit/ba05fe0738f70cb686777546e968237d09269142), [`40d358e`](https://github.com/mastra-ai/mastra/commit/40d358e29d55543803e64b49241122f598ffabc7), [`d26a8d4`](https://github.com/mastra-ai/mastra/commit/d26a8d4281f28414715b333c85bedaf70d0b2890), [`e80cd7e`](https://github.com/mastra-ai/mastra/commit/e80cd7e7683e7d732e1cc6784bcac1d2640d2ce3), [`ccbbcd9`](https://github.com/mastra-ai/mastra/commit/ccbbcd974eedff4367a54ed0e24c9ee742ab2f61), [`1d9a0ea`](https://github.com/mastra-ai/mastra/commit/1d9a0ea4a9901baee6cd56737243bd6d1f631ac0), [`677cdc6`](https://github.com/mastra-ai/mastra/commit/677cdc6af564dec29a13464d12b7ab2a4efc22e9), [`c549e2f`](https://github.com/mastra-ai/mastra/commit/c549e2f40edc1cac5d9e74e82f90da22b48df084), [`a7dd322`](https://github.com/mastra-ai/mastra/commit/a7dd32247d95afc539f483ca37f4594af0387f59), [`3f5c6f7`](https://github.com/mastra-ai/mastra/commit/3f5c6f728ea35da344248de9aa070f12849f3aa0), [`a318490`](https://github.com/mastra-ai/mastra/commit/a318490e17da32f338d50929c770d901a9b3dd72), [`b860493`](https://github.com/mastra-ai/mastra/commit/b86049391100e665d579f700c8a2034c036defc3), [`d4be8c1`](https://github.com/mastra-ai/mastra/commit/d4be8c1739d22d621e3f78790e1dd5eb5ecc3589), [`a5d2eb1`](https://github.com/mastra-ai/mastra/commit/a5d2eb10347eade1ae2816d88f466c25186c54a5), [`3667679`](https://github.com/mastra-ai/mastra/commit/3667679db057edfb086846d13369fdda4902ad65), [`49696e8`](https://github.com/mastra-ai/mastra/commit/49696e8e42f870674a0a58f5abcd22cc54dd2864), [`2ef2f23`](https://github.com/mastra-ai/mastra/commit/2ef2f230a7aed342e7dc3b2000cd42e4c43e08a7), [`763e0c6`](https://github.com/mastra-ai/mastra/commit/763e0c61e04d76ad9a9efd301aa57525ca0cbea9), [`20504b2`](https://github.com/mastra-ai/mastra/commit/20504b2ecebd0e077acda3d457ab57480a98ed3e), [`77e6b1b`](https://github.com/mastra-ai/mastra/commit/77e6b1bc4c46ce94fe501023fb4393c812ec6be3), [`c5f964d`](https://github.com/mastra-ai/mastra/commit/c5f964d3f77064e978f8066ec506eed77ba5c63c), [`23e0be2`](https://github.com/mastra-ai/mastra/commit/23e0be261381e49534b4ff3101c60ee64a946cbf), [`7fc8806`](https://github.com/mastra-ai/mastra/commit/7fc880627d3cbf995d31ea0e8b807bf15417e651), [`0e02eac`](https://github.com/mastra-ai/mastra/commit/0e02eacdb2e30e1697a41910b41163742a181dc1), [`4df174c`](https://github.com/mastra-ai/mastra/commit/4df174c32bddf093a82f273070b8380aef7c9e90), [`f7c25b5`](https://github.com/mastra-ai/mastra/commit/f7c25b5106ddfb48e591f98df7a51e0f2dd01dba), [`7aad631`](https://github.com/mastra-ai/mastra/commit/7aad631b43bc10db77d5b8c66b200d7a49d18bf2), [`512100a`](https://github.com/mastra-ai/mastra/commit/512100a7d8b7e9c920f2590c6b3612f5de0d3cff), [`e81744c`](https://github.com/mastra-ai/mastra/commit/e81744cd13c46619c142dc521dc0baac47607a84), [`f8f653f`](https://github.com/mastra-ai/mastra/commit/f8f653f10980d01a73706cc3c8689ca5e40ce808), [`dc09cc1`](https://github.com/mastra-ai/mastra/commit/dc09cc1083d861cde192c1cd235324dc75b8c731), [`9ef432b`](https://github.com/mastra-ai/mastra/commit/9ef432b6faa534b57b0d182a610e13dd9a7123ff), [`36b4649`](https://github.com/mastra-ai/mastra/commit/36b4649045a3a380cbab8ceca866db4086223aff), [`b9cf308`](https://github.com/mastra-ai/mastra/commit/b9cf30846f97f99ac1906ee8a68f4f2d117b0378), [`2e1d098`](https://github.com/mastra-ai/mastra/commit/2e1d0984e325fd319d32ea182f596b3170be3847), [`377eb81`](https://github.com/mastra-ai/mastra/commit/377eb81ce43b964e3a6b541df172da74a8ff3716), [`1794a79`](https://github.com/mastra-ai/mastra/commit/1794a79178c418004a7261b1ad9114066f7ef01d), [`0cdc5dc`](https://github.com/mastra-ai/mastra/commit/0cdc5dc69024957815da4f51acc4119eb4f447d7), [`5740ec6`](https://github.com/mastra-ai/mastra/commit/5740ec60c760ffdfbfaa59d603d03b847c864e05)]:
  - @mastra/core@1.60.0

## 1.3.1-alpha.0

### Patch Changes

- Added a `durable` option to stored agents so agents created through the Agents API can run with durable execution — no code deployment required. ([#21715](https://github.com/mastra-ai/mastra/pull/21715))

  ```typescript
  await mastraClient.createStoredAgent({
    id: 'helper',
    name: 'Helper',
    instructions: 'You are a helpful assistant.',
    model: { provider: 'openai', name: 'gpt-5' },
    durable: true,
  });
  ```

  Pass `true` for defaults, or `{ maxSteps, cleanupTimeoutMs }` to tune the durable loop. Cache and pubsub are inherited from the server's Mastra instance, so configure distributed backends there for durability across replicas. Automatic recovery is still configured in code via `recovery.durableAgents`.

- Updated dependencies [[`6223446`](https://github.com/mastra-ai/mastra/commit/6223446ddce6166e96e0ba5e00d628b615dee8ca), [`583e235`](https://github.com/mastra-ai/mastra/commit/583e23519c13af16c1746f9c49722d011216611b), [`a77f8d4`](https://github.com/mastra-ai/mastra/commit/a77f8d4740d2178a74c41e4bf678b4fcd8fa0bb2), [`40d358e`](https://github.com/mastra-ai/mastra/commit/40d358e29d55543803e64b49241122f598ffabc7), [`e80cd7e`](https://github.com/mastra-ai/mastra/commit/e80cd7e7683e7d732e1cc6784bcac1d2640d2ce3), [`20504b2`](https://github.com/mastra-ai/mastra/commit/20504b2ecebd0e077acda3d457ab57480a98ed3e)]:
  - @mastra/core@1.60.0-alpha.11

## 1.3.0

### Minor Changes

- Memory list reads now surface database errors instead of silently returning empty results. ([#17910](https://github.com/mastra-ai/mastra/pull/17910))

  Previously, the paginated memory reads (`listThreads`, `listMessages`, `listMessagesByResourceId`, and `listMessagesById`) caught backend failures, logged them, and returned an empty payload like `{ threads: [], total: 0, hasMore: false }`. A transient outage (locked table, dropped connection) was therefore indistinguishable from a genuinely empty result, so an agent reading conversation history during a brief failure would treat it as "no history" and could overwrite real state. These methods now re-throw the failure as a `MastraError`. Validation (USER) errors and genuinely empty results are unchanged.

  **Behavior change**

  Callers that previously received an empty result on a backend failure will now receive a thrown `MastraError`. If you call these read methods directly (rather than through an agent, which already surfaces errors), wrap them so a transient outage doesn't crash the caller:

  ```ts
  try {
    const { threads } = await storage.listThreads({ resourceId });
    // ...use threads
  } catch (error) {
    // a real backend failure. Decide whether to retry, surface, or degrade.
    // An empty thread list no longer hides here; it only means "no threads".
  }
  ```

### Patch Changes

- dependencies updates: ([#20406](https://github.com/mastra-ai/mastra/pull/20406))
  - Updated dependency [`@aws-sdk/types@^3.974.2` ↗︎](https://www.npmjs.com/package/@aws-sdk/types/v/3.974.2) (from `^3.973.9`, in `dependencies`)

- Fixed a crash where updating a thread without a title (for example during observational memory buffering) could write a null title and violate the database's not-null constraint when running a newer @mastra/memory against an older storage package. Memory now checks whether the connected storage adapter supports partial thread updates and backfills the existing title for older adapters, so mixed-version deployments keep working. See #21041 for the original title-clobbering fix this makes backward compatible. ([#21257](https://github.com/mastra-ai/mastra/pull/21257))

- Storage adapters now declare support for partial thread updates, letting newer @mastra/memory preserve existing thread titles instead of overwriting them, while remaining safe against older versions. ([#21257](https://github.com/mastra-ai/mastra/pull/21257))

- Fixed resource-scoped message includes across storage adapters so included context cannot cross resource boundaries. ([#20984](https://github.com/mastra-ai/mastra/pull/20984))

- Fixed generated thread titles being clobbered during a turn ([#21041](https://github.com/mastra-ai/mastra/pull/21041))

  `updateThread` required both `title` and `metadata`, so callers that only needed to
  change metadata (message persistence, working memory, observational memory, channel
  subscriptions) had to read the thread and pass its title back. When title generation
  finished between that read and the write, the freshly generated title was overwritten
  with the stale one.

  `title` and `metadata` are now independently optional: omitting one leaves that column
  untouched. Callers that only change metadata no longer send a title, and message
  persistence no longer rewrites a thread row it just read.

- Fixed transaction completion when applications start several database operations at the same time. Pending operations now finish before the transaction completes or is cancelled, preventing query conflicts after batch failures and operations that application code does not await. ([#20869](https://github.com/mastra-ai/mastra/pull/20869))

- Updated dependencies [[`e7109ee`](https://github.com/mastra-ai/mastra/commit/e7109ee6f731bacc79c885906f3c7dca8d8f013a), [`b8ce7ec`](https://github.com/mastra-ai/mastra/commit/b8ce7ec96e39343c6c2f36d12d68a9ad816c09f7), [`2e4624e`](https://github.com/mastra-ai/mastra/commit/2e4624edb6917e61249cb60ee377735e7af7e4a9), [`45a9147`](https://github.com/mastra-ai/mastra/commit/45a914741f578754d79d8b7de7b4e4f304d8e14a), [`a3a3624`](https://github.com/mastra-ai/mastra/commit/a3a3624f646b98e409424d8defccbd334da9e8b8), [`6246914`](https://github.com/mastra-ai/mastra/commit/62469146636911f3cbbe0880bd011c6a897a59a7), [`6445eba`](https://github.com/mastra-ai/mastra/commit/6445eba6020abac681aba1cc9289f446cb400cbe), [`86b7b77`](https://github.com/mastra-ai/mastra/commit/86b7b777980d30f66e1fd134a37d2af4c22e54cc), [`1c75e32`](https://github.com/mastra-ai/mastra/commit/1c75e32f7fc0b9fb6f548b4407feaec8a1440212), [`296dc9a`](https://github.com/mastra-ai/mastra/commit/296dc9af29f3616e786c7825ec32e0df92d754c5), [`f59032a`](https://github.com/mastra-ai/mastra/commit/f59032a73699443555a08a479e7ac578975784f2), [`cdd5c33`](https://github.com/mastra-ai/mastra/commit/cdd5c33ac6c7118a9f139e6dc0e14e6a8ae31658), [`3f73c07`](https://github.com/mastra-ai/mastra/commit/3f73c076727e8c36b4fff7a1b40290fb68957fa8), [`772c0c8`](https://github.com/mastra-ai/mastra/commit/772c0c897cec383258de2e6178147f8014767c7b), [`d7cf7fa`](https://github.com/mastra-ai/mastra/commit/d7cf7fafc1ae1b50bd8462dd0e6c671a8606db93), [`7c1ebb1`](https://github.com/mastra-ai/mastra/commit/7c1ebb15690c4b3f0eabb19077cf8af573311e57), [`0f9a448`](https://github.com/mastra-ai/mastra/commit/0f9a448502157e59f7b76f24360ad497168f5ef8), [`578bf2e`](https://github.com/mastra-ai/mastra/commit/578bf2e6a88e9d5b8bf502204e15a95dfbb679ae), [`c47165c`](https://github.com/mastra-ai/mastra/commit/c47165c983c87594c6952f1fd2fa51a90205034c), [`289f4ce`](https://github.com/mastra-ai/mastra/commit/289f4ce16e3293370440172132c52ee787cbc09f), [`df31eb0`](https://github.com/mastra-ai/mastra/commit/df31eb0c7087d782a0d9346e467f9a4af4b0eef6), [`9571e3a`](https://github.com/mastra-ai/mastra/commit/9571e3a06ed2c5220196460bf82a2129255c3a8b), [`4f16ff8`](https://github.com/mastra-ai/mastra/commit/4f16ff824bf2f9b0ddc93f210477c10c8a4fb1ab), [`b4c89b4`](https://github.com/mastra-ai/mastra/commit/b4c89b4371b0c86da57403ad1a3b3ef0681f3128), [`e6534fa`](https://github.com/mastra-ai/mastra/commit/e6534fab031216f6cb48c4c9907cbfdce9d60bc6), [`210cb7a`](https://github.com/mastra-ai/mastra/commit/210cb7a167998c7bbf72cb3b93e6eb0563330239), [`06b2d87`](https://github.com/mastra-ai/mastra/commit/06b2d87e63bcdd0ed59215c6789692b9b12de376), [`1c67d85`](https://github.com/mastra-ai/mastra/commit/1c67d85e9da8285662f4dbbf47e0378c3fee0747), [`ac01d63`](https://github.com/mastra-ai/mastra/commit/ac01d6355974aec73fdb8781449ed12bac582094), [`80a3324`](https://github.com/mastra-ai/mastra/commit/80a33245d3110204de6f56d61211523ffe338692), [`e44e8f3`](https://github.com/mastra-ai/mastra/commit/e44e8f370b66c339ddcaba946d33da6d3c3f06cd), [`d9d2881`](https://github.com/mastra-ai/mastra/commit/d9d2881ede6dd6c023d144215fc812062aed0890), [`a810a05`](https://github.com/mastra-ai/mastra/commit/a810a058f62ad407cfc1701e0be36ae91145d7cf), [`ba24be6`](https://github.com/mastra-ai/mastra/commit/ba24be662439c331ab23a600041f93803c89eca8), [`842b5fe`](https://github.com/mastra-ai/mastra/commit/842b5fe22b6a7fa811bd14e48eb9af523ac989f2), [`990611b`](https://github.com/mastra-ai/mastra/commit/990611ba76eb876d86c9c594371ae5f02f94b432), [`80bdf3a`](https://github.com/mastra-ai/mastra/commit/80bdf3ae16ade6ff63bde0cb16fa2df8ab7dd4dd), [`c967a5e`](https://github.com/mastra-ai/mastra/commit/c967a5eec150c5dc5418c4a4388982d1fb7ad27c), [`dc4a25d`](https://github.com/mastra-ai/mastra/commit/dc4a25d41af4e2fe97a816070eaec6aa963ab53b), [`9ba1247`](https://github.com/mastra-ai/mastra/commit/9ba12470c77f1c03642d720ce67e517e878f666e), [`fd96298`](https://github.com/mastra-ai/mastra/commit/fd96298a8367622f4ebfcaa97b5b6c1fbbd14564), [`66bbfb5`](https://github.com/mastra-ai/mastra/commit/66bbfb5f05b473d39f88c0e4a481ccac41634f3a), [`dc4a25d`](https://github.com/mastra-ai/mastra/commit/dc4a25d41af4e2fe97a816070eaec6aa963ab53b), [`f8da216`](https://github.com/mastra-ai/mastra/commit/f8da21633e7eb0e31c9ce0fc30567870d19416d3), [`4a09a9c`](https://github.com/mastra-ai/mastra/commit/4a09a9c0474ef643558fcb5f0edc542b82f1cab0), [`5f798b3`](https://github.com/mastra-ai/mastra/commit/5f798b3362e9bdf4d690f85245606e146eef60b9), [`6a84954`](https://github.com/mastra-ai/mastra/commit/6a84954a2667f85b6d59da652dab1bbff007ccb0), [`1e83a47`](https://github.com/mastra-ai/mastra/commit/1e83a4734ab61ba5926af6793e3569a78b72ed37), [`52d8ef0`](https://github.com/mastra-ai/mastra/commit/52d8ef03801f1deb7ee48532fc4190dd4a33916c), [`cdd5c33`](https://github.com/mastra-ai/mastra/commit/cdd5c33ac6c7118a9f139e6dc0e14e6a8ae31658), [`7fdcaa6`](https://github.com/mastra-ai/mastra/commit/7fdcaa66105d64290f9b14432a12ec99f39c4d3a), [`d6c56f9`](https://github.com/mastra-ai/mastra/commit/d6c56f951db3213330b98b0abafa9778c8770e58), [`e08e789`](https://github.com/mastra-ai/mastra/commit/e08e789c1bf4cd2fe46363f7a4728536ceccc9bd), [`bf936e2`](https://github.com/mastra-ai/mastra/commit/bf936e2c89b2ff0dad5695b873ddc009ba96d41e), [`7fb580a`](https://github.com/mastra-ai/mastra/commit/7fb580ac73fbcacf2ff00872a3395f73ae1b9fa5), [`ed5d606`](https://github.com/mastra-ai/mastra/commit/ed5d606739c5e3fbdfa9f272df7809aa5ab43b1d), [`f53d5bd`](https://github.com/mastra-ai/mastra/commit/f53d5bd4885b29e4ac29a428a6044088ea8d6aa3), [`32980a3`](https://github.com/mastra-ai/mastra/commit/32980a3e2413d0274ac244d32c37d910edc13f00), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437), [`82e3365`](https://github.com/mastra-ai/mastra/commit/82e3365ef7c9bf7bee2e7a7029035ea262d68895), [`6104347`](https://github.com/mastra-ai/mastra/commit/61043473ba6bfd0a25156824e853e13165562e6c), [`35cc901`](https://github.com/mastra-ai/mastra/commit/35cc90102cf834a84827acaf9eee0b6d6d1e2a3b), [`a8b4cf0`](https://github.com/mastra-ai/mastra/commit/a8b4cf02823cffebc4751a53337dfacf097c1ae1), [`9571e3a`](https://github.com/mastra-ai/mastra/commit/9571e3a06ed2c5220196460bf82a2129255c3a8b), [`333785c`](https://github.com/mastra-ai/mastra/commit/333785c93cbb01e42c60167e995457c28897ddbf), [`bda2235`](https://github.com/mastra-ai/mastra/commit/bda22353ee28f2df0eaea555f7cae1549f979c0b), [`efd5c81`](https://github.com/mastra-ai/mastra/commit/efd5c81cc25fde3c2ddd86fc1178deb4ec176e19), [`1b482c2`](https://github.com/mastra-ai/mastra/commit/1b482c2d89244dd758c41e5f927a2b44041388d2), [`45bfb88`](https://github.com/mastra-ai/mastra/commit/45bfb88fd52f1dd3be20e2a38905777c96499c90), [`ff28284`](https://github.com/mastra-ai/mastra/commit/ff2828416f14daff9d956e6a352fdaa23c950979), [`4bcdfaf`](https://github.com/mastra-ai/mastra/commit/4bcdfaf0eac3199d7cb171b0a19a92c9c341eea4), [`e3b9307`](https://github.com/mastra-ai/mastra/commit/e3b9307098daefbfae2a52ae2ef51bc9fc701190), [`d6834c5`](https://github.com/mastra-ai/mastra/commit/d6834c5a7866b16734d23900163c2414ed70d791), [`f33264f`](https://github.com/mastra-ai/mastra/commit/f33264f517ae603279afd5c4251e2b40f6dd3618), [`689f2c4`](https://github.com/mastra-ai/mastra/commit/689f2c4b6c0835fe455702b01d21daa8abcd9331), [`fcd0667`](https://github.com/mastra-ai/mastra/commit/fcd0667a4e378be35c9a1b1eb19cce78fbfd7282), [`cfd0d9e`](https://github.com/mastra-ai/mastra/commit/cfd0d9ec77ec3c69dd96f79cdb579e03d79f22ce), [`acc3513`](https://github.com/mastra-ai/mastra/commit/acc3513b19f79bf0a7ec2998694580edca54086c), [`1670533`](https://github.com/mastra-ai/mastra/commit/1670533986f6bacf567746245348125e3a106448), [`a7eb4a1`](https://github.com/mastra-ai/mastra/commit/a7eb4a11450f6170274ed5141bffe821d4fdd5a6), [`0976933`](https://github.com/mastra-ai/mastra/commit/0976933142333ec78451feef265b68bcb45aa5e7), [`242b945`](https://github.com/mastra-ai/mastra/commit/242b94558777bfbdeb42cbfea84afff0b6ad0633), [`c52d346`](https://github.com/mastra-ai/mastra/commit/c52d3462ec831a5d95926ecd3d3373f5928ad2e5), [`af4636a`](https://github.com/mastra-ai/mastra/commit/af4636a74463275d71c1d13a38f7d2b738f128bf), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437), [`2eabc09`](https://github.com/mastra-ai/mastra/commit/2eabc097d86d52fbd0123da36a7c874154cc384f), [`0023e79`](https://github.com/mastra-ai/mastra/commit/0023e7919431078280abd11c89d1edeae35fcc69), [`c2ad51e`](https://github.com/mastra-ai/mastra/commit/c2ad51e2467f901eecba8c9f4a45e22a50bd7c18), [`25ca73d`](https://github.com/mastra-ai/mastra/commit/25ca73d25dee7ce9f0ca72939e3a505c4db7257e), [`2f9ef3f`](https://github.com/mastra-ai/mastra/commit/2f9ef3f4ca06fc2dcdd5088c26b7f4da6a016791), [`e7eefcb`](https://github.com/mastra-ai/mastra/commit/e7eefcb162cda7c493e8c3bf43050ead0efbcb2c), [`fea5cae`](https://github.com/mastra-ai/mastra/commit/fea5caedc7e2cfea51784a15e015952692027abf), [`4d7aca2`](https://github.com/mastra-ai/mastra/commit/4d7aca2fe75f225c83d1502d63079568e6ec163f), [`e1cead1`](https://github.com/mastra-ai/mastra/commit/e1cead17b5f3653cf00d2f90cc19b113119c02ba), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437), [`d9d93b2`](https://github.com/mastra-ai/mastra/commit/d9d93b25e4a65ad5fa153fa35be7ed149c8d587f), [`c4ec889`](https://github.com/mastra-ai/mastra/commit/c4ec889561c0264c43f66d04d587bee4ce35e792), [`4b59f78`](https://github.com/mastra-ai/mastra/commit/4b59f786cbc9a7d1ef07a07517dbd4b96865e99d), [`eeae63e`](https://github.com/mastra-ai/mastra/commit/eeae63e7fbe8e1f237adc69bca6e2ac13c5ca907), [`3dc97ea`](https://github.com/mastra-ai/mastra/commit/3dc97ea415fad353b48a13095fad1835933cc12a), [`94e7ae9`](https://github.com/mastra-ai/mastra/commit/94e7ae970b37c888cd1244ef013292639a2fe6d1), [`e6a2860`](https://github.com/mastra-ai/mastra/commit/e6a2860649cc51f87d32d78b766ae2126446ba07), [`7010c5d`](https://github.com/mastra-ai/mastra/commit/7010c5d15728bf9c5dfe4fb6b1bf80ce23bf143a), [`bab06b1`](https://github.com/mastra-ai/mastra/commit/bab06b18923873a584bdfc71a6b4ec7fb4727fb7), [`3d01cd3`](https://github.com/mastra-ai/mastra/commit/3d01cd387321b6f9c5cac31d487c84bf51b19c78), [`7bf3086`](https://github.com/mastra-ai/mastra/commit/7bf308663f0115ca74ad20554ade740f06640859), [`4c186a0`](https://github.com/mastra-ai/mastra/commit/4c186a017275f45e6ed4c09de0f89550e2d09e8c), [`b0fa077`](https://github.com/mastra-ai/mastra/commit/b0fa077bcbc9b08551846fe372a0d3d15b71ed72), [`0282e16`](https://github.com/mastra-ai/mastra/commit/0282e16115538c8e9b248b90f0748eb01cb5dc98), [`a8dd139`](https://github.com/mastra-ai/mastra/commit/a8dd1391a9fe9a6632c25809ef236980afa9a020), [`6a667b4`](https://github.com/mastra-ai/mastra/commit/6a667b4b7cd6a93fe41fcdd357b08c5a8c09b9ab), [`9be8878`](https://github.com/mastra-ai/mastra/commit/9be8878dcf0388e84fc4873e0eec27bd49b881a4), [`e5786be`](https://github.com/mastra-ai/mastra/commit/e5786be02bb903073082bd9d6da880ebaacc343f), [`2440e09`](https://github.com/mastra-ai/mastra/commit/2440e096ea6c2def1ccc1eb2d0f3f5b88c4af940), [`2093fbd`](https://github.com/mastra-ai/mastra/commit/2093fbd53bb744bae19ec89f6d73db9a66fbe8a7), [`a59049b`](https://github.com/mastra-ai/mastra/commit/a59049b1652a13efff66ac826326b5ed9a550342), [`7bd85ea`](https://github.com/mastra-ai/mastra/commit/7bd85ea7588b71c25ce9f4019c88f8539be5dcbc), [`83fa004`](https://github.com/mastra-ai/mastra/commit/83fa0044bfda8b703a83883dbd8bef204844d13f), [`a463cdf`](https://github.com/mastra-ai/mastra/commit/a463cdf1c95c3059e70f0bff27959e8558bb899d), [`e7a5da4`](https://github.com/mastra-ai/mastra/commit/e7a5da4ef8e4dd452d2f232961b4e682a85ffe43), [`7b4393d`](https://github.com/mastra-ai/mastra/commit/7b4393d557411fdcf07b0e30e5acaf7cc85154ae), [`0ea6b80`](https://github.com/mastra-ai/mastra/commit/0ea6b8001408ce02b56e8be0536b0fd8cbaf8ad2)]:
  - @mastra/core@1.58.0

## 1.3.0-alpha.3

### Patch Changes

- Fixed a crash where updating a thread without a title (for example during observational memory buffering) could write a null title and violate the database's not-null constraint when running a newer @mastra/memory against an older storage package. Memory now checks whether the connected storage adapter supports partial thread updates and backfills the existing title for older adapters, so mixed-version deployments keep working. See #21041 for the original title-clobbering fix this makes backward compatible. ([#21257](https://github.com/mastra-ai/mastra/pull/21257))

- Storage adapters now declare support for partial thread updates, letting newer @mastra/memory preserve existing thread titles instead of overwriting them, while remaining safe against older versions. ([#21257](https://github.com/mastra-ai/mastra/pull/21257))

- Updated dependencies [[`dc4a25d`](https://github.com/mastra-ai/mastra/commit/dc4a25d41af4e2fe97a816070eaec6aa963ab53b), [`dc4a25d`](https://github.com/mastra-ai/mastra/commit/dc4a25d41af4e2fe97a816070eaec6aa963ab53b)]:
  - @mastra/core@1.58.0-alpha.15

## 1.3.0-alpha.2

### Patch Changes

- Fixed generated thread titles being clobbered during a turn ([#21041](https://github.com/mastra-ai/mastra/pull/21041))

  `updateThread` required both `title` and `metadata`, so callers that only needed to
  change metadata (message persistence, working memory, observational memory, channel
  subscriptions) had to read the thread and pass its title back. When title generation
  finished between that read and the write, the freshly generated title was overwritten
  with the stale one.

  `title` and `metadata` are now independently optional: omitting one leaves that column
  untouched. Callers that only change metadata no longer send a title, and message
  persistence no longer rewrites a thread row it just read.

- Updated dependencies [[`1c75e32`](https://github.com/mastra-ai/mastra/commit/1c75e32f7fc0b9fb6f548b4407feaec8a1440212), [`c47165c`](https://github.com/mastra-ai/mastra/commit/c47165c983c87594c6952f1fd2fa51a90205034c), [`e08e789`](https://github.com/mastra-ai/mastra/commit/e08e789c1bf4cd2fe46363f7a4728536ceccc9bd), [`35cc901`](https://github.com/mastra-ai/mastra/commit/35cc90102cf834a84827acaf9eee0b6d6d1e2a3b), [`a8b4cf0`](https://github.com/mastra-ai/mastra/commit/a8b4cf02823cffebc4751a53337dfacf097c1ae1), [`f33264f`](https://github.com/mastra-ai/mastra/commit/f33264f517ae603279afd5c4251e2b40f6dd3618), [`689f2c4`](https://github.com/mastra-ai/mastra/commit/689f2c4b6c0835fe455702b01d21daa8abcd9331), [`eeae63e`](https://github.com/mastra-ai/mastra/commit/eeae63e7fbe8e1f237adc69bca6e2ac13c5ca907), [`4c186a0`](https://github.com/mastra-ai/mastra/commit/4c186a017275f45e6ed4c09de0f89550e2d09e8c), [`b0fa077`](https://github.com/mastra-ai/mastra/commit/b0fa077bcbc9b08551846fe372a0d3d15b71ed72)]:
  - @mastra/core@1.58.0-alpha.8

## 1.3.0-alpha.1

### Patch Changes

- Fixed resource-scoped message includes across storage adapters so included context cannot cross resource boundaries. ([#20984](https://github.com/mastra-ai/mastra/pull/20984))

- Updated dependencies [[`6445eba`](https://github.com/mastra-ai/mastra/commit/6445eba6020abac681aba1cc9289f446cb400cbe), [`df31eb0`](https://github.com/mastra-ai/mastra/commit/df31eb0c7087d782a0d9346e467f9a4af4b0eef6), [`fcd0667`](https://github.com/mastra-ai/mastra/commit/fcd0667a4e378be35c9a1b1eb19cce78fbfd7282), [`bab06b1`](https://github.com/mastra-ai/mastra/commit/bab06b18923873a584bdfc71a6b4ec7fb4727fb7)]:
  - @mastra/core@1.58.0-alpha.5

## 1.3.0-alpha.0

### Minor Changes

- Memory list reads now surface database errors instead of silently returning empty results. ([#17910](https://github.com/mastra-ai/mastra/pull/17910))

  Previously, the paginated memory reads (`listThreads`, `listMessages`, `listMessagesByResourceId`, and `listMessagesById`) caught backend failures, logged them, and returned an empty payload like `{ threads: [], total: 0, hasMore: false }`. A transient outage (locked table, dropped connection) was therefore indistinguishable from a genuinely empty result, so an agent reading conversation history during a brief failure would treat it as "no history" and could overwrite real state. These methods now re-throw the failure as a `MastraError`. Validation (USER) errors and genuinely empty results are unchanged.

  **Behavior change**

  Callers that previously received an empty result on a backend failure will now receive a thrown `MastraError`. If you call these read methods directly (rather than through an agent, which already surfaces errors), wrap them so a transient outage doesn't crash the caller:

  ```ts
  try {
    const { threads } = await storage.listThreads({ resourceId });
    // ...use threads
  } catch (error) {
    // a real backend failure. Decide whether to retry, surface, or degrade.
    // An empty thread list no longer hides here; it only means "no threads".
  }
  ```

### Patch Changes

- dependencies updates: ([#20406](https://github.com/mastra-ai/mastra/pull/20406))
  - Updated dependency [`@aws-sdk/types@^3.974.2` ↗︎](https://www.npmjs.com/package/@aws-sdk/types/v/3.974.2) (from `^3.973.9`, in `dependencies`)

- Fixed transaction completion when applications start several database operations at the same time. Pending operations now finish before the transaction completes or is cancelled, preventing query conflicts after batch failures and operations that application code does not await. ([#20869](https://github.com/mastra-ai/mastra/pull/20869))

- Updated dependencies [[`e7109ee`](https://github.com/mastra-ai/mastra/commit/e7109ee6f731bacc79c885906f3c7dca8d8f013a), [`772c0c8`](https://github.com/mastra-ai/mastra/commit/772c0c897cec383258de2e6178147f8014767c7b), [`578bf2e`](https://github.com/mastra-ai/mastra/commit/578bf2e6a88e9d5b8bf502204e15a95dfbb679ae), [`06b2d87`](https://github.com/mastra-ai/mastra/commit/06b2d87e63bcdd0ed59215c6789692b9b12de376), [`ac01d63`](https://github.com/mastra-ai/mastra/commit/ac01d6355974aec73fdb8781449ed12bac582094), [`a810a05`](https://github.com/mastra-ai/mastra/commit/a810a058f62ad407cfc1701e0be36ae91145d7cf), [`f8da216`](https://github.com/mastra-ai/mastra/commit/f8da21633e7eb0e31c9ce0fc30567870d19416d3), [`6104347`](https://github.com/mastra-ai/mastra/commit/61043473ba6bfd0a25156824e853e13165562e6c), [`45bfb88`](https://github.com/mastra-ai/mastra/commit/45bfb88fd52f1dd3be20e2a38905777c96499c90), [`e3b9307`](https://github.com/mastra-ai/mastra/commit/e3b9307098daefbfae2a52ae2ef51bc9fc701190), [`d6834c5`](https://github.com/mastra-ai/mastra/commit/d6834c5a7866b16734d23900163c2414ed70d791), [`c52d346`](https://github.com/mastra-ai/mastra/commit/c52d3462ec831a5d95926ecd3d3373f5928ad2e5), [`0023e79`](https://github.com/mastra-ai/mastra/commit/0023e7919431078280abd11c89d1edeae35fcc69), [`c2ad51e`](https://github.com/mastra-ai/mastra/commit/c2ad51e2467f901eecba8c9f4a45e22a50bd7c18), [`3dc97ea`](https://github.com/mastra-ai/mastra/commit/3dc97ea415fad353b48a13095fad1835933cc12a), [`3d01cd3`](https://github.com/mastra-ai/mastra/commit/3d01cd387321b6f9c5cac31d487c84bf51b19c78), [`7bf3086`](https://github.com/mastra-ai/mastra/commit/7bf308663f0115ca74ad20554ade740f06640859), [`a8dd139`](https://github.com/mastra-ai/mastra/commit/a8dd1391a9fe9a6632c25809ef236980afa9a020), [`e5786be`](https://github.com/mastra-ai/mastra/commit/e5786be02bb903073082bd9d6da880ebaacc343f), [`2093fbd`](https://github.com/mastra-ai/mastra/commit/2093fbd53bb744bae19ec89f6d73db9a66fbe8a7), [`e7a5da4`](https://github.com/mastra-ai/mastra/commit/e7a5da4ef8e4dd452d2f232961b4e682a85ffe43), [`7b4393d`](https://github.com/mastra-ai/mastra/commit/7b4393d557411fdcf07b0e30e5acaf7cc85154ae)]:
  - @mastra/core@1.58.0-alpha.1

## 1.2.2

### Patch Changes

- Fixed nine storage adapters declaring a `@mastra/core` peer range that permitted core versions too old to load them. Each adapter imports `storageMessageMatchesMetadataFilter` from `@mastra/core/storage`, which core only exports from 1.53.0, but every one of them still advertised a floor below that — as low as `>=1.0.0-0`. Package managers accepted the incompatible pair without a warning and the install then failed at import time: ([#20591](https://github.com/mastra-ai/mastra/pull/20591))

  ```
  SyntaxError: The requested module '@mastra/core/storage' does not provide an export named 'storageMessageMatchesMetadataFilter'
  ```

  All nine now declare `>=1.53.0-0 <2.0.0-0`, so npm and pnpm surface a peer conflict at install time instead of letting the project break on first import.

  Fixes [#20586](https://github.com/mastra-ai/mastra/issues/20586).

- Updated dependencies [[`4844167`](https://github.com/mastra-ai/mastra/commit/4844167cff2d5ec5004e94edd34970833040fa3f), [`c5e56ff`](https://github.com/mastra-ai/mastra/commit/c5e56ff3bcabdf062708f2d48744fec304df6792), [`594f7b2`](https://github.com/mastra-ai/mastra/commit/594f7b28f5263fb9982fd50d95c471fb971ea984), [`7f4e26d`](https://github.com/mastra-ai/mastra/commit/7f4e26dd57bd9b23c278ea21235ab823a3810a6c), [`311f943`](https://github.com/mastra-ai/mastra/commit/311f943bee60e8fdf5c84499ea50e884276c936c), [`322daa6`](https://github.com/mastra-ai/mastra/commit/322daa6d90552909204044790d850958f6745fed), [`db4e6ff`](https://github.com/mastra-ai/mastra/commit/db4e6ff744503112eb64deeaf6c2b54bf26a54c7), [`5faf93f`](https://github.com/mastra-ai/mastra/commit/5faf93f03e19daea394b9e2a923f2e4f833407f2), [`82201f7`](https://github.com/mastra-ai/mastra/commit/82201f75fae8e050a8de2df08b74875ee74c6b83), [`cadaa13`](https://github.com/mastra-ai/mastra/commit/cadaa1372e1077c8e85eb64c5499ba8803caa323), [`0c89896`](https://github.com/mastra-ai/mastra/commit/0c8989673fb7d106837098398131e570c6023b68), [`6d19a65`](https://github.com/mastra-ai/mastra/commit/6d19a6517f5da3911023d446b7e2d5dad8adb1cb), [`23b4238`](https://github.com/mastra-ai/mastra/commit/23b423844ad0bcf2a502a68dd62866d6160f9f6d), [`80ad891`](https://github.com/mastra-ai/mastra/commit/80ad891f8cd10379aa5b5af7510c763783b2ab56), [`fb18da5`](https://github.com/mastra-ai/mastra/commit/fb18da56fc35689ae370621a8f10b5b0d8606e20), [`fb18da5`](https://github.com/mastra-ai/mastra/commit/fb18da56fc35689ae370621a8f10b5b0d8606e20), [`e320a76`](https://github.com/mastra-ai/mastra/commit/e320a763feaf65c6be3cebecf746defcbde161b3), [`03b4918`](https://github.com/mastra-ai/mastra/commit/03b4918c80d188ce375334c393e131c6e94bd7eb), [`14ef73a`](https://github.com/mastra-ai/mastra/commit/14ef73a4bbd73e7808414816eb0628ce1d80b5d7), [`b582f7f`](https://github.com/mastra-ai/mastra/commit/b582f7fa2f9c1f87d19efc63d344fbe5dda2608c), [`0a6598b`](https://github.com/mastra-ai/mastra/commit/0a6598bde80bde008986ad6616bed9632b9294cb), [`06000d7`](https://github.com/mastra-ai/mastra/commit/06000d73712911572e913b8a83339270296d0a22), [`1d677d5`](https://github.com/mastra-ai/mastra/commit/1d677d5f99d7db403f7828585e8c25f299f72628), [`9e1dad8`](https://github.com/mastra-ai/mastra/commit/9e1dad8f7b1cab2bb7ade90e5b7561f24577b88a), [`2f43145`](https://github.com/mastra-ai/mastra/commit/2f4314504c03cbba280414ac81ba3197448ee6b0), [`4e35a56`](https://github.com/mastra-ai/mastra/commit/4e35a56cdf8d74a5ff6d5eda01f2c1deaf6cc7be), [`d94b8e1`](https://github.com/mastra-ai/mastra/commit/d94b8e1cee67416d518a8c30099040061bef6a1c), [`93e28ec`](https://github.com/mastra-ai/mastra/commit/93e28ecce9031c02397e0ae8406593e5c7a95883), [`729dab4`](https://github.com/mastra-ai/mastra/commit/729dab408faccfaef0cbb048e5a4338f9172847e), [`484003d`](https://github.com/mastra-ai/mastra/commit/484003d33ff59330c86b19863e4a38732d7e4155), [`3de0188`](https://github.com/mastra-ai/mastra/commit/3de0188bfaf9a9c09c95fe322b53838cf52c70b6), [`34d34d8`](https://github.com/mastra-ai/mastra/commit/34d34d8c811df512fef4dd5459f79b7821be1866), [`b582f7f`](https://github.com/mastra-ai/mastra/commit/b582f7fa2f9c1f87d19efc63d344fbe5dda2608c), [`933d291`](https://github.com/mastra-ai/mastra/commit/933d291146b789c19442ad206f94da3e4be90c64), [`a1cb98d`](https://github.com/mastra-ai/mastra/commit/a1cb98d11990b560b98482292a1f34aa1a2d9092), [`598ad82`](https://github.com/mastra-ai/mastra/commit/598ad82d41c41389a686338a1d0e50b7400e1938), [`1fd6aad`](https://github.com/mastra-ai/mastra/commit/1fd6aad1ea4a9d32f65efa832307c35e981a4c0a)]:
  - @mastra/core@1.56.0

## 1.2.2-alpha.0

### Patch Changes

- Fixed nine storage adapters declaring a `@mastra/core` peer range that permitted core versions too old to load them. Each adapter imports `storageMessageMatchesMetadataFilter` from `@mastra/core/storage`, which core only exports from 1.53.0, but every one of them still advertised a floor below that — as low as `>=1.0.0-0`. Package managers accepted the incompatible pair without a warning and the install then failed at import time: ([#20591](https://github.com/mastra-ai/mastra/pull/20591))

  ```
  SyntaxError: The requested module '@mastra/core/storage' does not provide an export named 'storageMessageMatchesMetadataFilter'
  ```

  All nine now declare `>=1.53.0-0 <2.0.0-0`, so npm and pnpm surface a peer conflict at install time instead of letting the project break on first import.

  Fixes [#20586](https://github.com/mastra-ai/mastra/issues/20586).

- Updated dependencies [[`82201f7`](https://github.com/mastra-ai/mastra/commit/82201f75fae8e050a8de2df08b74875ee74c6b83), [`fb18da5`](https://github.com/mastra-ai/mastra/commit/fb18da56fc35689ae370621a8f10b5b0d8606e20), [`fb18da5`](https://github.com/mastra-ai/mastra/commit/fb18da56fc35689ae370621a8f10b5b0d8606e20), [`0a6598b`](https://github.com/mastra-ai/mastra/commit/0a6598bde80bde008986ad6616bed9632b9294cb), [`9e1dad8`](https://github.com/mastra-ai/mastra/commit/9e1dad8f7b1cab2bb7ade90e5b7561f24577b88a), [`2f43145`](https://github.com/mastra-ai/mastra/commit/2f4314504c03cbba280414ac81ba3197448ee6b0), [`34d34d8`](https://github.com/mastra-ai/mastra/commit/34d34d8c811df512fef4dd5459f79b7821be1866)]:
  - @mastra/core@1.56.0-alpha.6

## 1.2.1

### Patch Changes

- dependencies updates: ([#19779](https://github.com/mastra-ai/mastra/pull/19779))
  - Updated dependency [`pg@^8.22.0` ↗︎](https://www.npmjs.com/package/pg/v/8.22.0) (from `^8.21.0`, in `dependencies`)
- Updated dependencies [[`3f472b4`](https://github.com/mastra-ai/mastra/commit/3f472b468892a1ff14ccb43cc0343b86f7d8fd7d), [`ba369f2`](https://github.com/mastra-ai/mastra/commit/ba369f2a0aaf998da0d6aa033d26f64f96bef8ac), [`35b929b`](https://github.com/mastra-ai/mastra/commit/35b929b7abc3d20d85c7985880960ac2d04a6c86), [`55c9e24`](https://github.com/mastra-ai/mastra/commit/55c9e248c27c1d72b5bb7e94ea6b8a3999eee49f), [`dcfed93`](https://github.com/mastra-ai/mastra/commit/dcfed93e1e256c6abfa792cbb7ca836f5d0e8638), [`2876e15`](https://github.com/mastra-ai/mastra/commit/2876e15b4d2f616a3bc1ed3af57d546c268384ce), [`9b3626a`](https://github.com/mastra-ai/mastra/commit/9b3626aeb1d16fcd34b0a8e94c114ddb80a3b240), [`4696963`](https://github.com/mastra-ai/mastra/commit/469696312ac4c618bc8475b0c5ed7949b8a3455e), [`723aa54`](https://github.com/mastra-ai/mastra/commit/723aa5437106bdb708ae03c0ef6b77aa11291e73), [`07f5b4b`](https://github.com/mastra-ai/mastra/commit/07f5b4ba9d608d88865030732e580298296adf99), [`723aa54`](https://github.com/mastra-ai/mastra/commit/723aa5437106bdb708ae03c0ef6b77aa11291e73), [`723aa54`](https://github.com/mastra-ai/mastra/commit/723aa5437106bdb708ae03c0ef6b77aa11291e73), [`598080f`](https://github.com/mastra-ai/mastra/commit/598080f224edb3f0f5b801035b067fac50a56a03)]:
  - @mastra/core@1.55.0

## 1.2.1-alpha.0

### Patch Changes

- dependencies updates: ([#19779](https://github.com/mastra-ai/mastra/pull/19779))
  - Updated dependency [`pg@^8.22.0` ↗︎](https://www.npmjs.com/package/pg/v/8.22.0) (from `^8.21.0`, in `dependencies`)
- Updated dependencies [[`723aa54`](https://github.com/mastra-ai/mastra/commit/723aa5437106bdb708ae03c0ef6b77aa11291e73), [`723aa54`](https://github.com/mastra-ai/mastra/commit/723aa5437106bdb708ae03c0ef6b77aa11291e73), [`723aa54`](https://github.com/mastra-ai/mastra/commit/723aa5437106bdb708ae03c0ef6b77aa11291e73)]:
  - @mastra/core@1.55.0-alpha.3

## 1.2.0

### Minor Changes

- Added exact metadata filtering to message history queries across Memory APIs and supported storage providers. ([#19991](https://github.com/mastra-ai/mastra/pull/19991))

  ```ts
  const messages = await memory.recall({
    threadId: 'thread-1',
    filter: {
      metadata: {
        status: 'done',
        priority: 'high',
      },
    },
  });
  ```

  Multiple fields use AND semantics. Supported values are strings, finite numbers, booleans, and `null`.

### Patch Changes

- Updated dependencies [[`ce93a3c`](https://github.com/mastra-ai/mastra/commit/ce93a3c114ea1cbfbd576f3db41d7c26c9844f5b), [`5718a22`](https://github.com/mastra-ai/mastra/commit/5718a229281dcfd36bcd1f42a242e3717e510a33), [`a211d09`](https://github.com/mastra-ai/mastra/commit/a211d09185dc65a746534914cf38b67f21ee9bac), [`0dca9d0`](https://github.com/mastra-ai/mastra/commit/0dca9d0b1356024a53b72ea6f040db528b126caa), [`6218217`](https://github.com/mastra-ai/mastra/commit/62182171b6cfca0b099f1c6a77a2e65e7639ab86), [`5807d3a`](https://github.com/mastra-ai/mastra/commit/5807d3ae1d259b8b7d6df7e5bf2b485c694af9c8), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`05db566`](https://github.com/mastra-ai/mastra/commit/05db566fcbdcbf33d0bffca0c72ec30129e2e3ca), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`5718a22`](https://github.com/mastra-ai/mastra/commit/5718a229281dcfd36bcd1f42a242e3717e510a33), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`d1b7e3a`](https://github.com/mastra-ai/mastra/commit/d1b7e3a978a309a5653eeaa490d2d6c7c53bd093), [`29c584a`](https://github.com/mastra-ai/mastra/commit/29c584a13a88831e5ed1fdeb0ff8e82eae180433), [`c093146`](https://github.com/mastra-ai/mastra/commit/c0931466404d3c521308ea119cb165bb7e695155), [`8124754`](https://github.com/mastra-ai/mastra/commit/8124754ae89fbc69f8136d1df4a91904d0f84c4e), [`d12b2e4`](https://github.com/mastra-ai/mastra/commit/d12b2e4023fd9e3d3e93a9169f5088bcee2a849c)]:
  - @mastra/core@1.54.0

## 1.2.0-alpha.0

### Minor Changes

- Added exact metadata filtering to message history queries across Memory APIs and supported storage providers. ([#19991](https://github.com/mastra-ai/mastra/pull/19991))

  ```ts
  const messages = await memory.recall({
    threadId: 'thread-1',
    filter: {
      metadata: {
        status: 'done',
        priority: 'high',
      },
    },
  });
  ```

  Multiple fields use AND semantics. Supported values are strings, finite numbers, booleans, and `null`.

### Patch Changes

- Updated dependencies [[`0dca9d0`](https://github.com/mastra-ai/mastra/commit/0dca9d0b1356024a53b72ea6f040db528b126caa)]:
  - @mastra/core@1.54.0-alpha.0

## 1.1.2

### Patch Changes

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

- Updated dependencies [[`700619b`](https://github.com/mastra-ai/mastra/commit/700619b61d572e592cbaaf758121d168844ca4d2), [`0f69865`](https://github.com/mastra-ai/mastra/commit/0f69865aced225d98eac812e22699dc445ee18cb), [`9250acd`](https://github.com/mastra-ai/mastra/commit/9250acd1357f0f1f33d0dcca16f9655084c58eca), [`0c3d4bc`](https://github.com/mastra-ai/mastra/commit/0c3d4bcae13ea3699d379403e6f350d5cf4efe9f), [`cc440a3`](https://github.com/mastra-ai/mastra/commit/cc440a39400d8ce06655462b26c1666a1b3d4320), [`6a61846`](https://github.com/mastra-ai/mastra/commit/6a61846eeda29fb714549b70f1bee2bf6b141c44), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`17369b2`](https://github.com/mastra-ai/mastra/commit/17369b25250561e9ed994ae509be1d15bfb33bcb), [`c64c2a8`](https://github.com/mastra-ai/mastra/commit/c64c2a8503a50252f9ca6b8e8c54cadee31b92a2), [`bcae929`](https://github.com/mastra-ai/mastra/commit/bcae929945cbf265bd9f327cc715ecafa072b5b9), [`ea6327b`](https://github.com/mastra-ai/mastra/commit/ea6327ba2d63ca647804bc97b347e03a58617162), [`3439fa8`](https://github.com/mastra-ai/mastra/commit/3439fa836ecfcaa257b40c20b30ac2a8be22e9ea), [`85107f2`](https://github.com/mastra-ai/mastra/commit/85107f2758b527147fccbedff962961927c2d3b8), [`b33822e`](https://github.com/mastra-ai/mastra/commit/b33822e8d470884954b02f7b0745407ee4ef74b1), [`06e2680`](https://github.com/mastra-ai/mastra/commit/06e26806b51d2cbd858afdc66daa2b86ff3ba64a), [`06ff9e0`](https://github.com/mastra-ai/mastra/commit/06ff9e0befd1d642ab87ff749285ee4091205c7e), [`d5c11e3`](https://github.com/mastra-ai/mastra/commit/d5c11e3ba5045969caa7272a7bd1fd141c93ab6c), [`7f5e1ff`](https://github.com/mastra-ai/mastra/commit/7f5e1ff695a92f672bb3976363925d1e9136b54a), [`ff80671`](https://github.com/mastra-ai/mastra/commit/ff8067185e208b27198b4e5b71803013175c3643), [`b8375c1`](https://github.com/mastra-ai/mastra/commit/b8375c1f8fe905df8ae2ae9a893bb365f17aec4e), [`dab1257`](https://github.com/mastra-ai/mastra/commit/dab1257b64e4ed576dc5038bb7a3f7072338bc9f), [`1240f05`](https://github.com/mastra-ai/mastra/commit/1240f051c8e5371f1c014448bf37b1a1b9a05e47), [`705ff39`](https://github.com/mastra-ai/mastra/commit/705ff3969e57214ff2fdaf3815d751dd558886ed), [`e6fbd5b`](https://github.com/mastra-ai/mastra/commit/e6fbd5bfdc28e92c0c0433f29aa1bc152d3430f6), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`6f2026c`](https://github.com/mastra-ai/mastra/commit/6f2026cdf114ff1e21e49133ca774ec7d5085059), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`003f35d`](https://github.com/mastra-ai/mastra/commit/003f35d19e07b23b4bacc591c8bc0c59b42124ae), [`f890eda`](https://github.com/mastra-ai/mastra/commit/f890eda2c8a2ae83d9b30bc6d85842f93b6c266b), [`1340fb7`](https://github.com/mastra-ai/mastra/commit/1340fb76262a3ca062130aa71859f07257a0a5a4)]:
  - @mastra/core@1.49.0

## 1.1.2-alpha.0

### Patch Changes

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

- Updated dependencies [[`9250acd`](https://github.com/mastra-ai/mastra/commit/9250acd1357f0f1f33d0dcca16f9655084c58eca), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`c64c2a8`](https://github.com/mastra-ai/mastra/commit/c64c2a8503a50252f9ca6b8e8c54cadee31b92a2), [`06e2680`](https://github.com/mastra-ai/mastra/commit/06e26806b51d2cbd858afdc66daa2b86ff3ba64a), [`1240f05`](https://github.com/mastra-ai/mastra/commit/1240f051c8e5371f1c014448bf37b1a1b9a05e47), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748)]:
  - @mastra/core@1.49.0-alpha.5

## 1.1.1

### Patch Changes

- Fixed SQL query failures when filtering threads by resourceId or metadata in Aurora DSQL storage ([#18311](https://github.com/mastra-ai/mastra/pull/18311))

- Updated dependencies [[`5bd72d2`](https://github.com/mastra-ai/mastra/commit/5bd72d255f45b5ea8ab342643bd463814a980a24), [`1cc9ee1`](https://github.com/mastra-ai/mastra/commit/1cc9ee1ba51db53020a735626d33017a60b4b5b3), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`65f255a`](https://github.com/mastra-ai/mastra/commit/65f255a38667beb6ceeadabfa9eb5059bfec8298), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`30ebaf0`](https://github.com/mastra-ai/mastra/commit/30ebaf07bed5f4d30f2f257836c15d1bf7e40aae), [`5704634`](https://github.com/mastra-ai/mastra/commit/5704634b22133167dea337a942a34f57aaa3fa14), [`5c4e9a4`](https://github.com/mastra-ai/mastra/commit/5c4e9a4cfb2216bb3ea7f8988ad3727f3b92bb3a), [`4a88c6e`](https://github.com/mastra-ai/mastra/commit/4a88c6e2bdce316f8d7551b4ec3449b0b06fc71c), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`25961e3`](https://github.com/mastra-ai/mastra/commit/25961e3260ff3b1464637af8fcdb36210551c39f), [`6a1428a`](https://github.com/mastra-ai/mastra/commit/6a1428a23133fc070fc6c1caa08d28f3ba4fe5ff), [`87a17ef`](https://github.com/mastra-ai/mastra/commit/87a17efbd725aca6639febdc5e69e2abb3048689), [`e11ff30`](https://github.com/mastra-ai/mastra/commit/e11ff301408bf1731dca2fb7fbfcd8c819500a35), [`7794d71`](https://github.com/mastra-ai/mastra/commit/7794d71872c68733a30e028dfb7b1705daf6c5d2), [`9d2c946`](https://github.com/mastra-ai/mastra/commit/9d2c946d0859e90ae4bcec5beeb1da7398d2ad1e), [`c0eda2b`](https://github.com/mastra-ai/mastra/commit/c0eda2bcd91a228427314b12c91d8b147f3a739f), [`7b29f33`](https://github.com/mastra-ai/mastra/commit/7b29f332a357a83e555f29e718e5f2fab9979943), [`c0eda2b`](https://github.com/mastra-ai/mastra/commit/c0eda2bcd91a228427314b12c91d8b147f3a739f), [`b13925b`](https://github.com/mastra-ai/mastra/commit/b13925bfa91aa8700f56fa54a9ce707ee7e4ba62), [`f1ec385`](https://github.com/mastra-ai/mastra/commit/f1ec385386f62b1a0847ec5353ae2bb169d1c3d9), [`e14986f`](https://github.com/mastra-ai/mastra/commit/e14986f6e5478d6384d04ff9a7f9a79a46a8b529), [`24912b1`](https://github.com/mastra-ai/mastra/commit/24912b1f855d29ec36af4ef4bde1f7417e20cdf5), [`bf94ec6`](https://github.com/mastra-ai/mastra/commit/bf94ec68192d9f16e46ef7e5ac36370aeeddf35d), [`a29f371`](https://github.com/mastra-ai/mastra/commit/a29f371aef629ac8562661524a497127e93b5131), [`7686216`](https://github.com/mastra-ai/mastra/commit/7686216f37e74568feddec17cef3c3d24e10e60a), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`073f910`](https://github.com/mastra-ai/mastra/commit/073f910481e7d94b95ba3830f96531774ae95d33), [`0be490f`](https://github.com/mastra-ai/mastra/commit/0be490fabb538c5a7de796ea0aff7d04a0bea1f3), [`0be490f`](https://github.com/mastra-ai/mastra/commit/0be490fabb538c5a7de796ea0aff7d04a0bea1f3), [`ebbe1d3`](https://github.com/mastra-ai/mastra/commit/ebbe1d31a965a3adb0e728758f326b8122b4b55f), [`974f614`](https://github.com/mastra-ai/mastra/commit/974f614e083bd68278536f94453f7b320b86a3c7), [`3818814`](https://github.com/mastra-ai/mastra/commit/38188149ce454c4403fe9fcbdf73b735c68d36be), [`975c59a`](https://github.com/mastra-ai/mastra/commit/975c59ae363ee275fc55062392e1ffd2cbccbd53), [`1f97ce5`](https://github.com/mastra-ai/mastra/commit/1f97ce5695463bebb4eaacf501da6fb403e20885), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`7f51548`](https://github.com/mastra-ai/mastra/commit/7f515481213780be7047cef00640b9d35f3d545c), [`64f58c0`](https://github.com/mastra-ai/mastra/commit/64f58c04e78b40137497d47f781e897e416f22a5), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`ebbe1d3`](https://github.com/mastra-ai/mastra/commit/ebbe1d31a965a3adb0e728758f326b8122b4b55f), [`d95f394`](https://github.com/mastra-ai/mastra/commit/d95f394fd24c8411886930d727679c4d5252aa26), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`8e25a78`](https://github.com/mastra-ai/mastra/commit/8e25a78e0597575f0b0729bae8c5e190c84869b5), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`f3f0c9d`](https://github.com/mastra-ai/mastra/commit/f3f0c9d7c878db5a13177871ce3523a14f14b311), [`a5b22d3`](https://github.com/mastra-ai/mastra/commit/a5b22d314d62a68d801886a8d3d0eb6c089473db), [`31be1cf`](https://github.com/mastra-ai/mastra/commit/31be1cf5f2a7b5eef12f6123a40653b4d8115c16), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858)]:
  - @mastra/core@1.46.0

## 1.1.1-alpha.0

### Patch Changes

- Fixed SQL query failures when filtering threads by resourceId or metadata in Aurora DSQL storage ([#18311](https://github.com/mastra-ai/mastra/pull/18311))

- Updated dependencies [[`6a1428a`](https://github.com/mastra-ai/mastra/commit/6a1428a23133fc070fc6c1caa08d28f3ba4fe5ff), [`7f51548`](https://github.com/mastra-ai/mastra/commit/7f515481213780be7047cef00640b9d35f3d545c)]:
  - @mastra/core@1.46.0-alpha.2

## 1.1.0

### Minor Changes

- Random bump ([#18178](https://github.com/mastra-ai/mastra/pull/18178))

### Patch Changes

- Updated dependencies [[`7c0d868`](https://github.com/mastra-ai/mastra/commit/7c0d868d97d0fdbc04c14d0166dbf44d4c5a4a62), [`d9d2273`](https://github.com/mastra-ai/mastra/commit/d9d2273c702690c9a26eab2aebea879701d4355a), [`b04369d`](https://github.com/mastra-ai/mastra/commit/b04369d6b167c698ef103981171a8bf92808e756), [`8f3c262`](https://github.com/mastra-ai/mastra/commit/8f3c262587b335588a02d96b17fd6aca34c885b3)]:
  - @mastra/core@1.45.0

## 1.1.0-alpha.0

### Minor Changes

- Random bump ([#18178](https://github.com/mastra-ai/mastra/pull/18178))

### Patch Changes

- Updated dependencies [[`7c0d868`](https://github.com/mastra-ai/mastra/commit/7c0d868d97d0fdbc04c14d0166dbf44d4c5a4a62), [`d9d2273`](https://github.com/mastra-ai/mastra/commit/d9d2273c702690c9a26eab2aebea879701d4355a), [`b04369d`](https://github.com/mastra-ai/mastra/commit/b04369d6b167c698ef103981171a8bf92808e756), [`8f3c262`](https://github.com/mastra-ai/mastra/commit/8f3c262587b335588a02d96b17fd6aca34c885b3)]:
  - @mastra/core@1.45.0-alpha.0

## 1.0.3

### Patch Changes

- Security remediation for the 2026-06-17 "easy-day-js" supply-chain incident. Patch bump to publish clean versions and move the `latest` dist-tag forward, superseding the compromised versions that declared the malicious `easy-day-js` dependency. ([#18056](https://github.com/mastra-ai/mastra/pull/18056))

- Updated dependencies [[`339c57c`](https://github.com/mastra-ai/mastra/commit/339c57c5b2c6dbe75a125e138228e0556528976f), [`1dd4117`](https://github.com/mastra-ai/mastra/commit/1dd4117dcbd8e031ede9f0489436bfbc6f0315b8), [`2b11d1f`](https://github.com/mastra-ai/mastra/commit/2b11d1f6ac7024c5dd2b2dd12a48a956ac9d63bd), [`77a2351`](https://github.com/mastra-ai/mastra/commit/77a2351ee79296e360bce822cb3391f7cfd6489d), [`b7dff0a`](https://github.com/mastra-ai/mastra/commit/b7dff0a3d1022eb6868f48dc40a2b1febd5c277f), [`02087e1`](https://github.com/mastra-ai/mastra/commit/02087e1fbc54aa07f3071f7a200df1bf5be601a8), [`49af8df`](https://github.com/mastra-ai/mastra/commit/49af8df589c4ff71a5015a4553b377b32704b691), [`30ce559`](https://github.com/mastra-ai/mastra/commit/30ce55902ecf819b8ab8697398dd68b108228063), [`c241b92`](https://github.com/mastra-ai/mastra/commit/c241b929dc8c8d6a7b7219c99ed13ac1f3124a77), [`7d6ff70`](https://github.com/mastra-ai/mastra/commit/7d6ff708727297a0526ca0e26e93eeb5bbaaa187), [`ab975d4`](https://github.com/mastra-ai/mastra/commit/ab975d4dd9488752f05bda7afa03166d207e3e2a), [`9d6aa1b`](https://github.com/mastra-ai/mastra/commit/9d6aa1bae407e2afa6a089abc2a6accbbcb287b8)]:
  - @mastra/core@1.44.0

## 1.0.3-alpha.0

### Patch Changes

- Security remediation for the 2026-06-17 "easy-day-js" supply-chain incident. Patch bump to publish clean versions and move the `latest` dist-tag forward, superseding the compromised versions that declared the malicious `easy-day-js` dependency. ([#18056](https://github.com/mastra-ai/mastra/pull/18056))

- Updated dependencies [[`77a2351`](https://github.com/mastra-ai/mastra/commit/77a2351ee79296e360bce822cb3391f7cfd6489d)]:
  - @mastra/core@1.43.1-alpha.0

## 1.0.2

### Patch Changes

- dependencies updates: ([#17148](https://github.com/mastra-ai/mastra/pull/17148))
  - Updated dependency [`pg@^8.21.0` ↗︎](https://www.npmjs.com/package/pg/v/8.21.0) (from `^8.14.0`, in `dependencies`)

- dependencies updates: ([#17521](https://github.com/mastra-ai/mastra/pull/17521))
  - Updated dependency [`@aws-sdk/types@^3.973.9` ↗︎](https://www.npmjs.com/package/@aws-sdk/types/v/3.973.9) (from `^3.731.0`, in `dependencies`)
- Updated dependencies [[`d468acb`](https://github.com/mastra-ai/mastra/commit/d468acb07aec1bb19a2cb0ada8042b05b46746b2), [`575f815`](https://github.com/mastra-ai/mastra/commit/575f815c5c3567b71c0b83cbb7fa98c8253a9d9c), [`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`053735a`](https://github.com/mastra-ai/mastra/commit/053735a75c2c18e23ce34d9468007efa4a45f4c4), [`306909a`](https://github.com/mastra-ai/mastra/commit/306909a693de77d709b38706e2673c9547d24a28), [`5191af8`](https://github.com/mastra-ai/mastra/commit/5191af80c799eea25357c545fc05d91b3883531d), [`43bd3d4`](https://github.com/mastra-ai/mastra/commit/43bd3d421987463fdf35386a45199c49499ed069), [`e6fa79e`](https://github.com/mastra-ai/mastra/commit/e6fa79ec72a2ddffdd25e85270398951e9d552a4), [`904bcdf`](https://github.com/mastra-ai/mastra/commit/904bcdf7b8004aa7be823f9f70ca63580e47e470), [`7f5ee1d`](https://github.com/mastra-ai/mastra/commit/7f5ee1dca46daee8d2817f2ebe49e6335da81956), [`1e9aab5`](https://github.com/mastra-ai/mastra/commit/1e9aab50ff11e6e88fde4d7cbf512c44a9fe8d61), [`2bccba4`](https://github.com/mastra-ai/mastra/commit/2bccba4c03cadc815c2d54cbf4dd43a922140a8d), [`bf8eb6d`](https://github.com/mastra-ai/mastra/commit/bf8eb6d0ec213a403eb9265a594ad283c44ab3dc), [`e9be4e7`](https://github.com/mastra-ai/mastra/commit/e9be4e747ec3d8b65548bff92f9377db06105376), [`493a328`](https://github.com/mastra-ai/mastra/commit/493a328f4346a1deeb9f1e2e44c8f2a3a4d7591b), [`d53cfc2`](https://github.com/mastra-ai/mastra/commit/d53cfc2c7f8d78343a4aa84ec4e129ba25f3325e), [`65799d4`](https://github.com/mastra-ai/mastra/commit/65799d4d549e5ebb9c848fbe3f51ac090f64becf), [`c268c89`](https://github.com/mastra-ai/mastra/commit/c268c89f4c63a93ee474d3cffdf3ea60bf00d4f2), [`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`014e00f`](https://github.com/mastra-ai/mastra/commit/014e00f2b3a597a016b72f9901c6ab27d491f822), [`029a414`](https://github.com/mastra-ai/mastra/commit/029a4141719793bd3e898a39eb5a0466a55f5f3a), [`d468acb`](https://github.com/mastra-ai/mastra/commit/d468acb07aec1bb19a2cb0ada8042b05b46746b2), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`d371ac1`](https://github.com/mastra-ai/mastra/commit/d371ac1d9820afaaf7cfdbc380a475946a994d8f), [`2bccba4`](https://github.com/mastra-ai/mastra/commit/2bccba4c03cadc815c2d54cbf4dd43a922140a8d), [`0c72f03`](https://github.com/mastra-ai/mastra/commit/0c72f032abb13254df5a7856d64be2f207b8006d), [`cf182b7`](https://github.com/mastra-ai/mastra/commit/cf182b7fb495767946d9840ef29f19cfa906f31f), [`3b45ea9`](https://github.com/mastra-ai/mastra/commit/3b45ea95015557a6cb9d70dc5252af54ab1b78ac), [`a049c2a`](https://github.com/mastra-ai/mastra/commit/a049c2a9dfb41d0ee2e7a28874a88cd64fd5669f), [`f084be1`](https://github.com/mastra-ai/mastra/commit/f084be1fcbe33ad7480913e44d6130c421c0976f), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`2a96528`](https://github.com/mastra-ai/mastra/commit/2a9652848dfa3c5a2426f952e9d93554c26fd90f), [`f2ab060`](https://github.com/mastra-ai/mastra/commit/f2ab060162bea81505fda553e2cee29c1979fd04), [`5d302c8`](https://github.com/mastra-ai/mastra/commit/5d302c8eda1a6ac74eab5e442c4f64db6cc97a06), [`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`a952852`](https://github.com/mastra-ai/mastra/commit/a952852c971a21fb646cd907c75fcf4443cdc963), [`2656d9c`](https://github.com/mastra-ai/mastra/commit/2656d9c2976d4f3354253bfbbbf9b88a1b2bbf34), [`63e3fe1`](https://github.com/mastra-ai/mastra/commit/63e3fe13cc1ea96f91d7c68aea92f400faf9e4da), [`1d4ce8d`](https://github.com/mastra-ai/mastra/commit/1d4ce8daaa54511f325c1b609d31b8e54009d677), [`8c68372`](https://github.com/mastra-ai/mastra/commit/8c68372e85fe0b066ec12c58bd29ffb93e54c552)]:
  - @mastra/core@1.42.0

## 1.0.2-alpha.1

### Patch Changes

- dependencies updates: ([#17148](https://github.com/mastra-ai/mastra/pull/17148))
  - Updated dependency [`pg@^8.21.0` ↗︎](https://www.npmjs.com/package/pg/v/8.21.0) (from `^8.14.0`, in `dependencies`)
- Updated dependencies [[`575f815`](https://github.com/mastra-ai/mastra/commit/575f815c5c3567b71c0b83cbb7fa98c8253a9d9c), [`306909a`](https://github.com/mastra-ai/mastra/commit/306909a693de77d709b38706e2673c9547d24a28), [`5191af8`](https://github.com/mastra-ai/mastra/commit/5191af80c799eea25357c545fc05d91b3883531d), [`43bd3d4`](https://github.com/mastra-ai/mastra/commit/43bd3d421987463fdf35386a45199c49499ed069), [`e6fa79e`](https://github.com/mastra-ai/mastra/commit/e6fa79ec72a2ddffdd25e85270398951e9d552a4), [`904bcdf`](https://github.com/mastra-ai/mastra/commit/904bcdf7b8004aa7be823f9f70ca63580e47e470), [`7f5ee1d`](https://github.com/mastra-ai/mastra/commit/7f5ee1dca46daee8d2817f2ebe49e6335da81956), [`1e9aab5`](https://github.com/mastra-ai/mastra/commit/1e9aab50ff11e6e88fde4d7cbf512c44a9fe8d61), [`bf8eb6d`](https://github.com/mastra-ai/mastra/commit/bf8eb6d0ec213a403eb9265a594ad283c44ab3dc), [`493a328`](https://github.com/mastra-ai/mastra/commit/493a328f4346a1deeb9f1e2e44c8f2a3a4d7591b), [`029a414`](https://github.com/mastra-ai/mastra/commit/029a4141719793bd3e898a39eb5a0466a55f5f3a), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`d371ac1`](https://github.com/mastra-ai/mastra/commit/d371ac1d9820afaaf7cfdbc380a475946a994d8f), [`cf182b7`](https://github.com/mastra-ai/mastra/commit/cf182b7fb495767946d9840ef29f19cfa906f31f), [`a049c2a`](https://github.com/mastra-ai/mastra/commit/a049c2a9dfb41d0ee2e7a28874a88cd64fd5669f), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`2a96528`](https://github.com/mastra-ai/mastra/commit/2a9652848dfa3c5a2426f952e9d93554c26fd90f), [`2656d9c`](https://github.com/mastra-ai/mastra/commit/2656d9c2976d4f3354253bfbbbf9b88a1b2bbf34), [`63e3fe1`](https://github.com/mastra-ai/mastra/commit/63e3fe13cc1ea96f91d7c68aea92f400faf9e4da), [`1d4ce8d`](https://github.com/mastra-ai/mastra/commit/1d4ce8daaa54511f325c1b609d31b8e54009d677), [`8c68372`](https://github.com/mastra-ai/mastra/commit/8c68372e85fe0b066ec12c58bd29ffb93e54c552)]:
  - @mastra/core@1.42.0-alpha.4

## 1.0.2-alpha.0

### Patch Changes

- dependencies updates: ([#17521](https://github.com/mastra-ai/mastra/pull/17521))
  - Updated dependency [`@aws-sdk/types@^3.973.9` ↗︎](https://www.npmjs.com/package/@aws-sdk/types/v/3.973.9) (from `^3.731.0`, in `dependencies`)
- Updated dependencies [[`d468acb`](https://github.com/mastra-ai/mastra/commit/d468acb07aec1bb19a2cb0ada8042b05b46746b2), [`e9be4e7`](https://github.com/mastra-ai/mastra/commit/e9be4e747ec3d8b65548bff92f9377db06105376), [`d53cfc2`](https://github.com/mastra-ai/mastra/commit/d53cfc2c7f8d78343a4aa84ec4e129ba25f3325e), [`65799d4`](https://github.com/mastra-ai/mastra/commit/65799d4d549e5ebb9c848fbe3f51ac090f64becf), [`c268c89`](https://github.com/mastra-ai/mastra/commit/c268c89f4c63a93ee474d3cffdf3ea60bf00d4f2), [`d468acb`](https://github.com/mastra-ai/mastra/commit/d468acb07aec1bb19a2cb0ada8042b05b46746b2), [`0c72f03`](https://github.com/mastra-ai/mastra/commit/0c72f032abb13254df5a7856d64be2f207b8006d), [`3b45ea9`](https://github.com/mastra-ai/mastra/commit/3b45ea95015557a6cb9d70dc5252af54ab1b78ac), [`f084be1`](https://github.com/mastra-ai/mastra/commit/f084be1fcbe33ad7480913e44d6130c421c0976f)]:
  - @mastra/core@1.42.0-alpha.0

## 1.0.1

### Patch Changes

- dependencies updates: ([#17252](https://github.com/mastra-ai/mastra/pull/17252))
  - Updated dependency [`@aws/aurora-dsql-node-postgres-connector@^0.1.9` ↗︎](https://www.npmjs.com/package/@aws/aurora-dsql-node-postgres-connector/v/0.1.9) (from `^0.1.1`, in `dependencies`)
- Updated dependencies [[`fa63872`](https://github.com/mastra-ai/mastra/commit/fa6387280954e6b667bec5714b55ba082bc627ff), [`d779de3`](https://github.com/mastra-ai/mastra/commit/d779de3cd9d2e7ed8110547190e2f15e786a0e41), [`1750c97`](https://github.com/mastra-ai/mastra/commit/1750c975d6179fbf6db2813b15229d4f8f23fc55), [`9283971`](https://github.com/mastra-ai/mastra/commit/928397157009b4aef4d5fdf3a0a273cb371beb55), [`f07b646`](https://github.com/mastra-ai/mastra/commit/f07b64604ab7d25391179790b7fd4823df9e2dff), [`d8838ae`](https://github.com/mastra-ai/mastra/commit/d8838ae80b69780361693d27098f7f6684af12fe), [`40f9297`](https://github.com/mastra-ai/mastra/commit/40f9297003b921c62373d3e8d3a4bda76c9f6de3), [`19a8658`](https://github.com/mastra-ai/mastra/commit/19a86589c788ef48bb6c1b0612cc82a201857379), [`850af77`](https://github.com/mastra-ai/mastra/commit/850af7779cb87c350804488734544a5b1843de25), [`0f0d1ba`](https://github.com/mastra-ai/mastra/commit/0f0d1ba67bfcb2204e571401662f1eceefc03357), [`a18775a`](https://github.com/mastra-ai/mastra/commit/a18775a693172546ee2378d39b67d4e32895b251), [`1baf2d1`](https://github.com/mastra-ai/mastra/commit/1baf2d152c6881338ff8f114633d5316fe13dd15), [`8c31bcd`](https://github.com/mastra-ai/mastra/commit/8c31bcdb00e597880d5939b1b7d7566fbe5dacae), [`0e32507`](https://github.com/mastra-ai/mastra/commit/0e32507962cdfa5569b7bda5bc6fb3dd34e40b03), [`95b14cd`](https://github.com/mastra-ai/mastra/commit/95b14cdd820e86d97ac05fe568424c513a252e31), [`07c3de7`](https://github.com/mastra-ai/mastra/commit/07c3de7f7bc418beccaea3b5e6b7f7cdda79d492), [`0bf2d93`](https://github.com/mastra-ai/mastra/commit/0bf2d932d20e2936f2d9abb8c0a86e24fbc97ec6), [`7b0d34c`](https://github.com/mastra-ai/mastra/commit/7b0d34cfe4a2fce22ac86ae17404685ff67a2ddb), [`a659a77`](https://github.com/mastra-ai/mastra/commit/a659a779bdebe3a52a518c56d2260592d0240fe0), [`aa36be2`](https://github.com/mastra-ai/mastra/commit/aa36be23aa513b7dc53cb8ca16b7fab8f20e43ad), [`3332be9`](https://github.com/mastra-ai/mastra/commit/3332be9701ecd77aba840959d9a1d1ce7aef02d3), [`212c635`](https://github.com/mastra-ai/mastra/commit/212c635203e61d036ab41db8ff86c3893dc795b3), [`d8838ae`](https://github.com/mastra-ai/mastra/commit/d8838ae80b69780361693d27098f7f6684af12fe), [`9aa5a73`](https://github.com/mastra-ai/mastra/commit/9aa5a73e7e110f6e9365eec69364a33d5f03bb56), [`f73c789`](https://github.com/mastra-ai/mastra/commit/f73c789e8ef21561580395d2c410119cab5848c8), [`8bd16da`](https://github.com/mastra-ai/mastra/commit/8bd16da73a4cb874d739373643dbd6a6e7f88684), [`c8630f8`](https://github.com/mastra-ai/mastra/commit/c8630f80d4f40cb5d22e60ab162b618b1907167a), [`94dfef6`](https://github.com/mastra-ai/mastra/commit/94dfef6e2bf19a88467ea3940afcbce88a433f0f), [`47f71dc`](https://github.com/mastra-ai/mastra/commit/47f71dc6fbcbd12d71e21a979e676e20a02bd77d), [`50ceae2`](https://github.com/mastra-ai/mastra/commit/50ceae270878e2f8fb2b2c6c2faab09df0007c8a), [`a122f79`](https://github.com/mastra-ai/mastra/commit/a122f79427ae225ec79c7b2ed46278da48d04b17), [`8cdde58`](https://github.com/mastra-ai/mastra/commit/8cdde5875bbba6702d9df226f2b20232b8d75d6c), [`3a081c1`](https://github.com/mastra-ai/mastra/commit/3a081c1255c5ae8c99f6dad91cc612934ef6f2bd), [`49f8abc`](https://github.com/mastra-ai/mastra/commit/49f8abce8258e4f2f87bd326acfbdb641264a47c), [`847ff1e`](https://github.com/mastra-ai/mastra/commit/847ff1e0d94368d94b2e173e4e0908e115568ef3), [`0c1ed1d`](https://github.com/mastra-ai/mastra/commit/0c1ed1d00c7d87b5ac99ca95896211a2fa9189fa), [`259d409`](https://github.com/mastra-ai/mastra/commit/259d409a514174299dbde1ff5e1121209b3ba850), [`9e16c68`](https://github.com/mastra-ai/mastra/commit/9e16c6818b6485ccb43df28aba6f3a2219d28662), [`cefca33`](https://github.com/mastra-ai/mastra/commit/cefca33ae666e69810c935fedf95a929c173d1d7), [`d00e8c5`](https://github.com/mastra-ai/mastra/commit/d00e8c50daebe5bce5bf2f48bde39c86fc3d2fe4), [`36fa7e2`](https://github.com/mastra-ai/mastra/commit/36fa7e24d14e58a1eb46147097b32f583e5b8775), [`87e9774`](https://github.com/mastra-ai/mastra/commit/87e97741c1e493cd6d62f478eb810b49bda4d57c), [`65a72e7`](https://github.com/mastra-ai/mastra/commit/65a72e70c25eedea8ff985a6624b96be2850236b), [`fe9eacd`](https://github.com/mastra-ai/mastra/commit/fe9eacd9545a0a9d64aad31c9fa90294a425289e), [`4c02027`](https://github.com/mastra-ai/mastra/commit/4c020277235eaa6b1dc957c90ad0639eef213992), [`0f77241`](https://github.com/mastra-ai/mastra/commit/0f7724108806703799a8ba80ad0f09414afd5066), [`849efb9`](https://github.com/mastra-ai/mastra/commit/849efb9fca6dc976589c1f90a303fea618769109), [`92ff509`](https://github.com/mastra-ai/mastra/commit/92ff5098ef8a990438ca038077021a5f7541ec1d), [`3fce5e7`](https://github.com/mastra-ai/mastra/commit/3fce5e70d011d289043e75003ef3336ed4aa43c3), [`a763592`](https://github.com/mastra-ai/mastra/commit/a763592c3db46963ef1011cfe16fe372816e775e), [`db79c86`](https://github.com/mastra-ai/mastra/commit/db79c86c60723d57e02f9636ca2611bd4515f194), [`6855012`](https://github.com/mastra-ai/mastra/commit/685501247cc4717506f3e89beed03509d63a5370), [`80c7737`](https://github.com/mastra-ai/mastra/commit/80c7737e32d7917b5f356957d67c169d01744fd3), [`7fef31c`](https://github.com/mastra-ai/mastra/commit/7fef31c0d2a6d362a43a647a8a4f6ab893758a23), [`7fef31c`](https://github.com/mastra-ai/mastra/commit/7fef31c0d2a6d362a43a647a8a4f6ab893758a23), [`3f1cf47`](https://github.com/mastra-ai/mastra/commit/3f1cf476f74c1e4cc2df908837e05853a5347e31)]:
  - @mastra/core@1.38.0

## 1.0.1-alpha.0

### Patch Changes

- dependencies updates: ([#17252](https://github.com/mastra-ai/mastra/pull/17252))
  - Updated dependency [`@aws/aurora-dsql-node-postgres-connector@^0.1.9` ↗︎](https://www.npmjs.com/package/@aws/aurora-dsql-node-postgres-connector/v/0.1.9) (from `^0.1.1`, in `dependencies`)
- Updated dependencies [[`8ace89d`](https://github.com/mastra-ai/mastra/commit/8ace89df77f762e622d3b9f7f65ad7524350d050), [`fa63872`](https://github.com/mastra-ai/mastra/commit/fa6387280954e6b667bec5714b55ba082bc627ff), [`f07b646`](https://github.com/mastra-ai/mastra/commit/f07b64604ab7d25391179790b7fd4823df9e2dff), [`d8838ae`](https://github.com/mastra-ai/mastra/commit/d8838ae80b69780361693d27098f7f6684af12fe), [`40f9297`](https://github.com/mastra-ai/mastra/commit/40f9297003b921c62373d3e8d3a4bda76c9f6de3), [`0f0d1ba`](https://github.com/mastra-ai/mastra/commit/0f0d1ba67bfcb2204e571401662f1eceefc03357), [`8c31bcd`](https://github.com/mastra-ai/mastra/commit/8c31bcdb00e597880d5939b1b7d7566fbe5dacae), [`95b14cd`](https://github.com/mastra-ai/mastra/commit/95b14cdd820e86d97ac05fe568424c513a252e31), [`aa36be2`](https://github.com/mastra-ai/mastra/commit/aa36be23aa513b7dc53cb8ca16b7fab8f20e43ad), [`212c635`](https://github.com/mastra-ai/mastra/commit/212c635203e61d036ab41db8ff86c3893dc795b3), [`d8838ae`](https://github.com/mastra-ai/mastra/commit/d8838ae80b69780361693d27098f7f6684af12fe), [`9aa5a73`](https://github.com/mastra-ai/mastra/commit/9aa5a73e7e110f6e9365eec69364a33d5f03bb56), [`f73c789`](https://github.com/mastra-ai/mastra/commit/f73c789e8ef21561580395d2c410119cab5848c8), [`8bd16da`](https://github.com/mastra-ai/mastra/commit/8bd16da73a4cb874d739373643dbd6a6e7f88684), [`c8630f8`](https://github.com/mastra-ai/mastra/commit/c8630f80d4f40cb5d22e60ab162b618b1907167a), [`47f71dc`](https://github.com/mastra-ai/mastra/commit/47f71dc6fbcbd12d71e21a979e676e20a02bd77d), [`50ceae2`](https://github.com/mastra-ai/mastra/commit/50ceae270878e2f8fb2b2c6c2faab09df0007c8a), [`8cdde58`](https://github.com/mastra-ai/mastra/commit/8cdde5875bbba6702d9df226f2b20232b8d75d6c), [`847ff1e`](https://github.com/mastra-ai/mastra/commit/847ff1e0d94368d94b2e173e4e0908e115568ef3), [`259d409`](https://github.com/mastra-ai/mastra/commit/259d409a514174299dbde1ff5e1121209b3ba850), [`9e16c68`](https://github.com/mastra-ai/mastra/commit/9e16c6818b6485ccb43df28aba6f3a2219d28662), [`cefca33`](https://github.com/mastra-ai/mastra/commit/cefca33ae666e69810c935fedf95a929c173d1d7), [`d00e8c5`](https://github.com/mastra-ai/mastra/commit/d00e8c50daebe5bce5bf2f48bde39c86fc3d2fe4), [`36fa7e2`](https://github.com/mastra-ai/mastra/commit/36fa7e24d14e58a1eb46147097b32f583e5b8775), [`87e9774`](https://github.com/mastra-ai/mastra/commit/87e97741c1e493cd6d62f478eb810b49bda4d57c), [`65a72e7`](https://github.com/mastra-ai/mastra/commit/65a72e70c25eedea8ff985a6624b96be2850236b), [`0f77241`](https://github.com/mastra-ai/mastra/commit/0f7724108806703799a8ba80ad0f09414afd5066), [`92ff509`](https://github.com/mastra-ai/mastra/commit/92ff5098ef8a990438ca038077021a5f7541ec1d), [`3fce5e7`](https://github.com/mastra-ai/mastra/commit/3fce5e70d011d289043e75003ef3336ed4aa43c3), [`a763592`](https://github.com/mastra-ai/mastra/commit/a763592c3db46963ef1011cfe16fe372816e775e), [`80c7737`](https://github.com/mastra-ai/mastra/commit/80c7737e32d7917b5f356957d67c169d01744fd3), [`3f1cf47`](https://github.com/mastra-ai/mastra/commit/3f1cf476f74c1e4cc2df908837e05853a5347e31)]:
  - @mastra/core@1.38.0-alpha.3

## 1.0.0

### Minor Changes

- Added Amazon Aurora DSQL storage provider with IAM authentication support. ([#10930](https://github.com/mastra-ai/mastra/pull/10930))

  Enables storing threads, messages, workflows, traces, and agent data in Amazon Aurora DSQL clusters.

  ```typescript
  import { DSQLStore } from '@mastra/dsql';

  const storage = new DSQLStore({
    id: 'my-dsql-store',
    host: 'abc123.dsql.us-east-1.on.aws',
  });

  await storage.init();
  ```

  Related: #10929

### Patch Changes

- Updated dependencies [[`9f17410`](https://github.com/mastra-ai/mastra/commit/9f1741080def23d42ee50b39887a385ae316a3c6), [`7ad5585`](https://github.com/mastra-ai/mastra/commit/7ad55856406f1de398dc713f6a9eaa78b2784bb6), [`ac47842`](https://github.com/mastra-ai/mastra/commit/ac478427aa7a5f5fdaed633a911218689b438c60), [`cc189cc`](https://github.com/mastra-ai/mastra/commit/cc189cc0128eb7af233476b5e421ec6888bffde7), [`d1fdbd0`](https://github.com/mastra-ai/mastra/commit/d1fdbd012add5623cb7e6b7f882b605ab358bbb4), [`210ea7a`](https://github.com/mastra-ai/mastra/commit/210ea7af559791b73a44fc9c12179908aaa3183f), [`7c275a8`](https://github.com/mastra-ai/mastra/commit/7c275a810595e1a6c41ccc39720531ab65734700), [`bae019e`](https://github.com/mastra-ai/mastra/commit/bae019ecb6694da96909f7ec7b9eb3a0a33aa887), [`890b24c`](https://github.com/mastra-ai/mastra/commit/890b24cc7d32ed6aa4dfe253e54dc6bf4099f690), [`f984b4d`](https://github.com/mastra-ai/mastra/commit/f984b4d6c60bf2ae2a9b156f0e8c35a66fe96c91), [`6742347`](https://github.com/mastra-ai/mastra/commit/6742347d71955d7639adc9ddf6ff8282de7ee3ba), [`b59316f`](https://github.com/mastra-ai/mastra/commit/b59316ffa0f7688165b0f9c81ccdf85da461e5b2), [`0f48ebf`](https://github.com/mastra-ai/mastra/commit/0f48ebfc7ac7897b2092a189f45751924cf56d1c), [`37c0dc5`](https://github.com/mastra-ai/mastra/commit/37c0dc5697d343db98628bf867bf71ce6deec6d7), [`087e413`](https://github.com/mastra-ai/mastra/commit/087e4133e5d6efa36619e9556c16750e4179c047), [`83218c8`](https://github.com/mastra-ai/mastra/commit/83218c88b37773c9424fbe733b37be556e55e94d), [`ef6b584`](https://github.com/mastra-ai/mastra/commit/ef6b5847ac33c0a7e80af3a86e8801e2933dd3ee), [`c6eb39e`](https://github.com/mastra-ai/mastra/commit/c6eb39ea6dca381c6563cb240237fbe608e02f93), [`7b0ad1f`](https://github.com/mastra-ai/mastra/commit/7b0ad1f5c53dc118c6da12ae82ae2587037dc2b8), [`d91ebe2`](https://github.com/mastra-ai/mastra/commit/d91ebe28ee065d8f2ed6df741c3c07f58d359529), [`62666c3`](https://github.com/mastra-ai/mastra/commit/62666c367eaeac3941ead454b1d38810cc855721), [`33f5061`](https://github.com/mastra-ai/mastra/commit/33f5061cd1c0335020c3faae61ce96de822854fa), [`4af2160`](https://github.com/mastra-ai/mastra/commit/4af2160322f4718cac421930cce85641e9512389), [`087e413`](https://github.com/mastra-ai/mastra/commit/087e4133e5d6efa36619e9556c16750e4179c047), [`265ec9f`](https://github.com/mastra-ai/mastra/commit/265ec9f887b5c81255c873a76ff7796f16e4f99b), [`ce01024`](https://github.com/mastra-ai/mastra/commit/ce010242eee9bdfc09e4c26725b9d37998679a8d), [`6ce80bf`](https://github.com/mastra-ai/mastra/commit/6ce80bf4872a891e0bddf8b80561a80584efb14b), [`f984b4d`](https://github.com/mastra-ai/mastra/commit/f984b4d6c60bf2ae2a9b156f0e8c35a66fe96c91), [`136c959`](https://github.com/mastra-ai/mastra/commit/136c9592fb0eeb0cd212f28629d8a29b7557a2fc), [`9268531`](https://github.com/mastra-ai/mastra/commit/9268531e7ec4be98beeba3b3ae8be0a7ea380662), [`13ead79`](https://github.com/mastra-ai/mastra/commit/13ead79149486b88144db7e11e6ff551caef5be1), [`dccd8f1`](https://github.com/mastra-ai/mastra/commit/dccd8f1f8b8f1ad203b77556207e5529567c616d), [`4df7cc7`](https://github.com/mastra-ai/mastra/commit/4df7cc79342fd065fe7fdeef93c094db14b12bcd), [`f180e49`](https://github.com/mastra-ai/mastra/commit/f180e4990e71b04c9a475b523584071712f0048f), [`9260e01`](https://github.com/mastra-ai/mastra/commit/9260e015276fb1b500f7878ee452b47476bf1583), [`2f6c54e`](https://github.com/mastra-ai/mastra/commit/2f6c54e17c041cac1def54baaa6b771647836414), [`aca3121`](https://github.com/mastra-ai/mastra/commit/aca31211233dac25459f140ea4fcfb3a5af64c18), [`e06a159`](https://github.com/mastra-ai/mastra/commit/e06a1598ca07a6c3778aefc2a2d288363c6294ff), [`4dd900d`](https://github.com/mastra-ai/mastra/commit/4dd900d75dfe9be89f8c15188b368a8622aa1e18), [`b560d6f`](https://github.com/mastra-ai/mastra/commit/b560d6f88b9b904b15c10f75c949eb145bc27684), [`99869ec`](https://github.com/mastra-ai/mastra/commit/99869ecb1f2aa6dfcc44fa4e843e5ee0344efa64), [`900d086`](https://github.com/mastra-ai/mastra/commit/900d086bb737b9cf2fcf68f11b0389b801a2738c), [`4c0e286`](https://github.com/mastra-ai/mastra/commit/4c0e28637c9cfb4f416549b55e97ebfa13319dfc), [`55f1e2d`](https://github.com/mastra-ai/mastra/commit/55f1e2d65425b95a49ae788053b266f256e38c96), [`4ff5bdf`](https://github.com/mastra-ai/mastra/commit/4ff5bdfe170cba6dfb5260c6af0f4ba668430772), [`9cdf38e`](https://github.com/mastra-ai/mastra/commit/9cdf38e58506e1109c8b38f97cd7770978a4218e), [`087e413`](https://github.com/mastra-ai/mastra/commit/087e4133e5d6efa36619e9556c16750e4179c047), [`db34bc6`](https://github.com/mastra-ai/mastra/commit/db34bc6fb36cf125bda0c46be4d3fdc774b70cc4), [`990851e`](https://github.com/mastra-ai/mastra/commit/990851edcb0e30be5c2c18b6532f1a876cc2d335), [`bbcd93c`](https://github.com/mastra-ai/mastra/commit/bbcd93cf7d8aa1007d6d84bfd033b8015c912087), [`8373ff4`](https://github.com/mastra-ai/mastra/commit/8373ff46745d77af79f183c4470f80fa2727a6b2), [`d48a705`](https://github.com/mastra-ai/mastra/commit/d48a705ff3dfbdc7a996e07ecd8293b5effd9a2a), [`308bd07`](https://github.com/mastra-ai/mastra/commit/308bd074f35cef0c75d82fc1eb19382fe04ecf6f), [`6068a6c`](https://github.com/mastra-ai/mastra/commit/6068a6c42950fad3ebfc92346417896ba60803d2), [`36b3bbf`](https://github.com/mastra-ai/mastra/commit/36b3bbf5a8d59f7e23d47e29340e76c681b4929c), [`d86f031`](https://github.com/mastra-ai/mastra/commit/d86f031eb6b0b2570145afafea664e59bf688962), [`b275631`](https://github.com/mastra-ai/mastra/commit/b275631dc10541a482b2e2d4a3e3cfa843bd5fa1), [`00106be`](https://github.com/mastra-ai/mastra/commit/00106bede59b81e5b0e9cd6aad8d3b5dbc336387), [`bd36d8e`](https://github.com/mastra-ai/mastra/commit/bd36d8eb6de8c9a0310352649dbd4b06703c2299), [`11c1528`](https://github.com/mastra-ai/mastra/commit/11c152848c5d0ef227184853b5040f5b41ee7b1e), [`4999667`](https://github.com/mastra-ai/mastra/commit/49996678b68356cad7f088430009690406c50fbd), [`e2a079c`](https://github.com/mastra-ai/mastra/commit/e2a079cc3755b1895f7bd5dc36e9be81b11c7c22), [`8ac9141`](https://github.com/mastra-ai/mastra/commit/8ac9141439caa8fdd674944c4d84f29b3c730296), [`25184ff`](https://github.com/mastra-ai/mastra/commit/25184ffaf1293ec95119426eb1a1f8d38831b96c), [`534a456`](https://github.com/mastra-ai/mastra/commit/534a456a25e4df1e5407e7e632f4cb3b1fa14f9d), [`105e454`](https://github.com/mastra-ai/mastra/commit/105e454c95af06a7c741c15969d8f9b0f02463a7), [`aebde9c`](https://github.com/mastra-ai/mastra/commit/aebde9cfacf56592c6b6350cae721740fe090b8a), [`36bae07`](https://github.com/mastra-ai/mastra/commit/36bae07c0e70b1b3006f2fd20830e8883dcbd066), [`5688881`](https://github.com/mastra-ai/mastra/commit/5688881669c7ed157f31ac77f6fc5f8d95ceea32)]:
  - @mastra/core@1.33.0

## 1.0.0-alpha.3

### Minor Changes

- Added Amazon Aurora DSQL storage provider with IAM authentication support. ([#10930](https://github.com/mastra-ai/mastra/pull/10930))

  Enables storing threads, messages, workflows, traces, and agent data in Amazon Aurora DSQL clusters.

  ```typescript
  import { DSQLStore } from '@mastra/dsql';

  const storage = new DSQLStore({
    id: 'my-dsql-store',
    host: 'abc123.dsql.us-east-1.on.aws',
  });

  await storage.init();
  ```

  Related: #10929

### Patch Changes

- Updated dependencies [[`f984b4d`](https://github.com/mastra-ai/mastra/commit/f984b4d6c60bf2ae2a9b156f0e8c35a66fe96c91), [`ce01024`](https://github.com/mastra-ai/mastra/commit/ce010242eee9bdfc09e4c26725b9d37998679a8d), [`f984b4d`](https://github.com/mastra-ai/mastra/commit/f984b4d6c60bf2ae2a9b156f0e8c35a66fe96c91), [`8373ff4`](https://github.com/mastra-ai/mastra/commit/8373ff46745d77af79f183c4470f80fa2727a6b2), [`11c1528`](https://github.com/mastra-ai/mastra/commit/11c152848c5d0ef227184853b5040f5b41ee7b1e)]:
  - @mastra/core@1.33.0-alpha.13
