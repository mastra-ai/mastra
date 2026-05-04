# @mastra/e2b

## 0.3.0

### Minor Changes

- Added Azure Blob sandbox mount support via blobfuse2 in @mastra/e2b and @mastra/daytona. `sandbox.mount(azureBlobFilesystem, '/data')` now works for Azure containers, matching the existing s3fs (S3) and gcsfuse (GCS) integration. Supports authentication via accountKey, sasToken, connectionString, or managed identity/default credentials, and preserves AzureBlobFilesystem prefixes when mounting. ([#15874](https://github.com/mastra-ai/mastra/pull/15874))

  ```ts
  import { E2BSandbox } from '@mastra/e2b';
  import { AzureBlobFilesystem } from '@mastra/azure/blob';

  const azureFs = new AzureBlobFilesystem({ container: 'my-data', connectionString: '...' });
  const sandbox = new E2BSandbox();
  await sandbox.mount(azureFs, '/data');
  // Sandbox processes can now read/write /data/* directly against the Azure container.
  ```

### Patch Changes

- Updated dependencies [[`6db978c`](https://github.com/mastra-ai/mastra/commit/6db978c42e94e75540a504f7230086f0b5cd35f9), [`512a013`](https://github.com/mastra-ai/mastra/commit/512a013f285aa9c0aa8f08a35b2ce09f9938b017), [`e9becde`](https://github.com/mastra-ai/mastra/commit/e9becdeed9176b9f8392e557bde12b933f99cf7a), [`703a443`](https://github.com/mastra-ai/mastra/commit/703a44390c587d9c0b8ae94ec4edd8afb2a74044), [`808df1b`](https://github.com/mastra-ai/mastra/commit/808df1b39358b5f10b7317107e42b1fda7c87185)]:
  - @mastra/core@1.29.1

## 0.3.0-alpha.0

### Minor Changes

- Added Azure Blob sandbox mount support via blobfuse2 in @mastra/e2b and @mastra/daytona. `sandbox.mount(azureBlobFilesystem, '/data')` now works for Azure containers, matching the existing s3fs (S3) and gcsfuse (GCS) integration. Supports authentication via accountKey, sasToken, connectionString, or managed identity/default credentials, and preserves AzureBlobFilesystem prefixes when mounting. ([#15874](https://github.com/mastra-ai/mastra/pull/15874))

  ```ts
  import { E2BSandbox } from '@mastra/e2b';
  import { AzureBlobFilesystem } from '@mastra/azure/blob';

  const azureFs = new AzureBlobFilesystem({ container: 'my-data', connectionString: '...' });
  const sandbox = new E2BSandbox();
  await sandbox.mount(azureFs, '/data');
  // Sandbox processes can now read/write /data/* directly against the Azure container.
  ```

### Patch Changes

- Updated dependencies [[`512a013`](https://github.com/mastra-ai/mastra/commit/512a013f285aa9c0aa8f08a35b2ce09f9938b017), [`e9becde`](https://github.com/mastra-ai/mastra/commit/e9becdeed9176b9f8392e557bde12b933f99cf7a)]:
  - @mastra/core@1.29.1-alpha.2

## 0.2.0

### Minor Changes

- Added S3 prefix (subdirectory) mount support. You can now mount a specific folder within an S3 bucket instead of the entire bucket by setting the `prefix` option on your S3 filesystem. ([#15171](https://github.com/mastra-ai/mastra/pull/15171))

  **Example:**

  ```typescript
  const fs = new S3Filesystem({
    bucket: 'my-bucket',
    region: 'us-east-1',
    prefix: 'workspace/data',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  });
  ```

  When mounted in a sandbox, only the contents under `workspace/data/` in the bucket will be visible at the mount path. This uses the s3fs `bucket:/path` syntax under the hood.

  Closes #15147.

### Patch Changes

- Updated dependencies [[`f112db1`](https://github.com/mastra-ai/mastra/commit/f112db179557ae9b5a0f1d25dc47f928d7d61cd9), [`21d9706`](https://github.com/mastra-ai/mastra/commit/21d970604d89eee970cbf8013d26d7551aff6ea5), [`0a0aa94`](https://github.com/mastra-ai/mastra/commit/0a0aa94729592e99885af2efb90c56aaada62247), [`ed07df3`](https://github.com/mastra-ai/mastra/commit/ed07df32a9d539c8261e892fc1bade783f5b41a6), [`01a7d51`](https://github.com/mastra-ai/mastra/commit/01a7d513493d21562f677f98550f7ceb165ba78c)]:
  - @mastra/core@1.27.0

## 0.2.0-alpha.0

### Minor Changes

- Added S3 prefix (subdirectory) mount support. You can now mount a specific folder within an S3 bucket instead of the entire bucket by setting the `prefix` option on your S3 filesystem. ([#15171](https://github.com/mastra-ai/mastra/pull/15171))

  **Example:**

  ```typescript
  const fs = new S3Filesystem({
    bucket: 'my-bucket',
    region: 'us-east-1',
    prefix: 'workspace/data',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  });
  ```

  When mounted in a sandbox, only the contents under `workspace/data/` in the bucket will be visible at the mount path. This uses the s3fs `bucket:/path` syntax under the hood.

  Closes #15147.

### Patch Changes

- Updated dependencies [[`f112db1`](https://github.com/mastra-ai/mastra/commit/f112db179557ae9b5a0f1d25dc47f928d7d61cd9), [`21d9706`](https://github.com/mastra-ai/mastra/commit/21d970604d89eee970cbf8013d26d7551aff6ea5)]:
  - @mastra/core@1.26.1-alpha.0

## 0.1.2

### Patch Changes

- dependencies updates: ([#13591](https://github.com/mastra-ai/mastra/pull/13591))
  - Updated peerDependency `@mastra/core` to `>=1.12.0-0 <2.0.0-0`

- `ProcessHandle.pid` is now a string. Numeric PIDs from the E2B SDK are stringified automatically. ([#13591](https://github.com/mastra-ai/mastra/pull/13591))

  ```typescript
  const handle = await sandbox.processes.spawn('node server.js');
  handle.pid; // string (e.g., '1234')
  ```

- Updated dependencies [[`cddf895`](https://github.com/mastra-ai/mastra/commit/cddf895532b8ee7f9fa814136ec672f53d37a9ba), [`9cede11`](https://github.com/mastra-ai/mastra/commit/9cede110abac9d93072e0521bb3c8bcafb9fdadf), [`a59f126`](https://github.com/mastra-ai/mastra/commit/a59f1269104f54726699c5cdb98c72c93606d2df), [`ed8fd75`](https://github.com/mastra-ai/mastra/commit/ed8fd75cbff03bb5e19971ddb30ab7040fc60447), [`c510833`](https://github.com/mastra-ai/mastra/commit/c5108333e8cbc19dafee5f8bfefbcb5ee935335c), [`c4c7dad`](https://github.com/mastra-ai/mastra/commit/c4c7dadfe2e4584f079f6c24bfabdb8c4981827f), [`45c3112`](https://github.com/mastra-ai/mastra/commit/45c31122666a0cc56b94727099fcb1871ed1b3f6), [`7296fcc`](https://github.com/mastra-ai/mastra/commit/7296fcc599c876a68699a71c7054a16d5aaf2337), [`00c27f9`](https://github.com/mastra-ai/mastra/commit/00c27f9080731433230a61be69c44e39a7a7b4c7), [`5e7c287`](https://github.com/mastra-ai/mastra/commit/5e7c28701f2bce795dd5c811e4c3060bf2ea2242), [`7e17d3f`](https://github.com/mastra-ai/mastra/commit/7e17d3f656fdda2aad47c4beb8c491636d70820c), [`ee19c9b`](https://github.com/mastra-ai/mastra/commit/ee19c9ba3ec3ed91feb214ad539bdc766c53bb01)]:
  - @mastra/core@1.12.0

## 0.1.2-alpha.0

### Patch Changes

- dependencies updates: ([#13591](https://github.com/mastra-ai/mastra/pull/13591))
  - Updated peerDependency `@mastra/core` to `>=1.12.0-0 <2.0.0-0`

- `ProcessHandle.pid` is now a string. Numeric PIDs from the E2B SDK are stringified automatically. ([#13591](https://github.com/mastra-ai/mastra/pull/13591))

  ```typescript
  const handle = await sandbox.processes.spawn('node server.js');
  handle.pid; // string (e.g., '1234')
  ```

- Updated dependencies [[`9cede11`](https://github.com/mastra-ai/mastra/commit/9cede110abac9d93072e0521bb3c8bcafb9fdadf), [`a59f126`](https://github.com/mastra-ai/mastra/commit/a59f1269104f54726699c5cdb98c72c93606d2df), [`c510833`](https://github.com/mastra-ai/mastra/commit/c5108333e8cbc19dafee5f8bfefbcb5ee935335c), [`7296fcc`](https://github.com/mastra-ai/mastra/commit/7296fcc599c876a68699a71c7054a16d5aaf2337), [`00c27f9`](https://github.com/mastra-ai/mastra/commit/00c27f9080731433230a61be69c44e39a7a7b4c7), [`ee19c9b`](https://github.com/mastra-ai/mastra/commit/ee19c9ba3ec3ed91feb214ad539bdc766c53bb01)]:
  - @mastra/core@1.12.0-alpha.1

## 0.1.1

### Patch Changes

- Removed working directory from sandbox instructions to avoid breaking prompt caching. ([#13520](https://github.com/mastra-ai/mastra/pull/13520))

- Remove internal `processes` field from sandbox provider options ([#13597](https://github.com/mastra-ai/mastra/pull/13597))

  The `processes` field is no longer exposed in constructor options for E2B, Daytona, and Blaxel sandbox providers. This field is managed internally and was not intended to be user-configurable.

- Updated dependencies [[`504fc8b`](https://github.com/mastra-ai/mastra/commit/504fc8b9d0ddab717577ad3bf9c95ea4bd5377bd), [`f9c150b`](https://github.com/mastra-ai/mastra/commit/f9c150b7595ad05ad9cc9a11098e2944361e8c22), [`88de7e8`](https://github.com/mastra-ai/mastra/commit/88de7e8dfe4b7e1951a9e441bb33136e705ce24e), [`edee4b3`](https://github.com/mastra-ai/mastra/commit/edee4b37dff0af515fc7cc0e8d71ee39e6a762f0), [`3790c75`](https://github.com/mastra-ai/mastra/commit/3790c7578cc6a47d854eb12d89e6b1912867fe29), [`e7a235b`](https://github.com/mastra-ai/mastra/commit/e7a235be6472e0c870ed6c791ddb17c492dc188b), [`d51d298`](https://github.com/mastra-ai/mastra/commit/d51d298953967aab1f58ec965b644d109214f085), [`6dbeeb9`](https://github.com/mastra-ai/mastra/commit/6dbeeb94a8b1eebb727300d1a98961f882180794), [`d5f0d8d`](https://github.com/mastra-ai/mastra/commit/d5f0d8d6a03e515ddaa9b5da19b7e44b8357b07b), [`09c3b18`](https://github.com/mastra-ai/mastra/commit/09c3b1802ff14e243a8a8baea327440bc8cc2e32), [`b896379`](https://github.com/mastra-ai/mastra/commit/b8963791c6afa79484645fcec596a201f936b9a2), [`85c84eb`](https://github.com/mastra-ai/mastra/commit/85c84ebb78aebfcba9d209c8e152b16d7a00cb71), [`a89272a`](https://github.com/mastra-ai/mastra/commit/a89272a5d71939b9fcd284e6a6dc1dd091a6bdcf), [`ee9c8df`](https://github.com/mastra-ai/mastra/commit/ee9c8df644f19d055af5f496bf4942705f5a47b7), [`77b4a25`](https://github.com/mastra-ai/mastra/commit/77b4a254e51907f8ff3a3ba95596a18e93ae4b35), [`276246e`](https://github.com/mastra-ai/mastra/commit/276246e0b9066a1ea48bbc70df84dbe528daaf99), [`08ecfdb`](https://github.com/mastra-ai/mastra/commit/08ecfdbdad6fb8285deef86a034bdf4a6047cfca), [`d5f628c`](https://github.com/mastra-ai/mastra/commit/d5f628ca86c6f6f3ff1035d52f635df32dd81cab), [`524c0f3`](https://github.com/mastra-ai/mastra/commit/524c0f3c434c3d9d18f66338dcef383d6161b59c), [`c18a0e9`](https://github.com/mastra-ai/mastra/commit/c18a0e9cef1e4ca004b2963d35e4cfc031971eac), [`4bd21ea`](https://github.com/mastra-ai/mastra/commit/4bd21ea43d44d0a0427414fc047577f9f0aa3bec), [`115a7a4`](https://github.com/mastra-ai/mastra/commit/115a7a47db5e9896fec12ae6507501adb9ec89bf), [`22a48ae`](https://github.com/mastra-ai/mastra/commit/22a48ae2513eb54d8d79dad361fddbca97a155e8), [`3c6ef79`](https://github.com/mastra-ai/mastra/commit/3c6ef798481e00d6d22563be2de98818fd4dd5e0), [`9311c17`](https://github.com/mastra-ai/mastra/commit/9311c17d7a0640d9c4da2e71b814dc67c57c6369), [`7edf78f`](https://github.com/mastra-ai/mastra/commit/7edf78f80422c43e84585f08ba11df0d4d0b73c5), [`1c4221c`](https://github.com/mastra-ai/mastra/commit/1c4221cf6032ec98d0e094d4ee11da3e48490d96), [`d25b9ea`](https://github.com/mastra-ai/mastra/commit/d25b9eabd400167255a97b690ffbc4ee4097ded5), [`fe1ce5c`](https://github.com/mastra-ai/mastra/commit/fe1ce5c9211c03d561606fda95cbfe7df1d9a9b5), [`b03c0e0`](https://github.com/mastra-ai/mastra/commit/b03c0e0389a799523929a458b0509c9e4244d562), [`0a8366b`](https://github.com/mastra-ai/mastra/commit/0a8366b0a692fcdde56c4d526e4cf03c502ae4ac), [`85664e9`](https://github.com/mastra-ai/mastra/commit/85664e9fd857320fbc245e301f764f45f66f32a3), [`bc79650`](https://github.com/mastra-ai/mastra/commit/bc796500c6e0334faa158a96077e3fb332274869), [`9257d01`](https://github.com/mastra-ai/mastra/commit/9257d01d1366d81f84c582fe02b5e200cf9621f4), [`3a3a59e`](https://github.com/mastra-ai/mastra/commit/3a3a59e8ffaa6a985fe3d9a126a3f5ade11a6724), [`3108d4e`](https://github.com/mastra-ai/mastra/commit/3108d4e649c9fddbf03253a6feeb388a5fa9fa5a), [`0c33b2c`](https://github.com/mastra-ai/mastra/commit/0c33b2c9db537f815e1c59e2c898ffce2e395a79), [`191e5bd`](https://github.com/mastra-ai/mastra/commit/191e5bd29b82f5bda35243945790da7bc7b695c2), [`f77cd94`](https://github.com/mastra-ai/mastra/commit/f77cd94c44eabed490384e7d19232a865e13214c), [`e8135c7`](https://github.com/mastra-ai/mastra/commit/e8135c7e300dac5040670eec7eab896ac6092e30), [`daca48f`](https://github.com/mastra-ai/mastra/commit/daca48f0fb17b7ae0b62a2ac40cf0e491b2fd0b7), [`257d14f`](https://github.com/mastra-ai/mastra/commit/257d14faca5931f2e4186fc165b6f0b1f915deee), [`352f25d`](https://github.com/mastra-ai/mastra/commit/352f25da316b24cdd5b410fd8dddf6a8b763da2a), [`93477d0`](https://github.com/mastra-ai/mastra/commit/93477d0769b8a13ea5ed73d508d967fb23eaeed9), [`31c78b3`](https://github.com/mastra-ai/mastra/commit/31c78b3eb28f58a8017f1dcc795c33214d87feac), [`0bc0720`](https://github.com/mastra-ai/mastra/commit/0bc07201095791858087cc56f353fcd65e87ab54), [`36516ac`](https://github.com/mastra-ai/mastra/commit/36516aca1021cbeb42e74751b46a2614101f37c8), [`e947652`](https://github.com/mastra-ai/mastra/commit/e9476527fdecb4449e54570e80dfaf8466901254), [`3c6ef79`](https://github.com/mastra-ai/mastra/commit/3c6ef798481e00d6d22563be2de98818fd4dd5e0), [`9257d01`](https://github.com/mastra-ai/mastra/commit/9257d01d1366d81f84c582fe02b5e200cf9621f4), [`ec248f6`](https://github.com/mastra-ai/mastra/commit/ec248f6b56e8a037c066c49b2178e2507471d988)]:
  - @mastra/core@1.9.0

## 0.1.1-alpha.0

### Patch Changes

- Removed working directory from sandbox instructions to avoid breaking prompt caching. ([#13520](https://github.com/mastra-ai/mastra/pull/13520))

- Remove internal `processes` field from sandbox provider options ([#13597](https://github.com/mastra-ai/mastra/pull/13597))

  The `processes` field is no longer exposed in constructor options for E2B, Daytona, and Blaxel sandbox providers. This field is managed internally and was not intended to be user-configurable.

- Updated dependencies [[`504fc8b`](https://github.com/mastra-ai/mastra/commit/504fc8b9d0ddab717577ad3bf9c95ea4bd5377bd), [`f9c150b`](https://github.com/mastra-ai/mastra/commit/f9c150b7595ad05ad9cc9a11098e2944361e8c22), [`88de7e8`](https://github.com/mastra-ai/mastra/commit/88de7e8dfe4b7e1951a9e441bb33136e705ce24e), [`edee4b3`](https://github.com/mastra-ai/mastra/commit/edee4b37dff0af515fc7cc0e8d71ee39e6a762f0), [`3790c75`](https://github.com/mastra-ai/mastra/commit/3790c7578cc6a47d854eb12d89e6b1912867fe29), [`e7a235b`](https://github.com/mastra-ai/mastra/commit/e7a235be6472e0c870ed6c791ddb17c492dc188b), [`d51d298`](https://github.com/mastra-ai/mastra/commit/d51d298953967aab1f58ec965b644d109214f085), [`6dbeeb9`](https://github.com/mastra-ai/mastra/commit/6dbeeb94a8b1eebb727300d1a98961f882180794), [`d5f0d8d`](https://github.com/mastra-ai/mastra/commit/d5f0d8d6a03e515ddaa9b5da19b7e44b8357b07b), [`09c3b18`](https://github.com/mastra-ai/mastra/commit/09c3b1802ff14e243a8a8baea327440bc8cc2e32), [`b896379`](https://github.com/mastra-ai/mastra/commit/b8963791c6afa79484645fcec596a201f936b9a2), [`85c84eb`](https://github.com/mastra-ai/mastra/commit/85c84ebb78aebfcba9d209c8e152b16d7a00cb71), [`a89272a`](https://github.com/mastra-ai/mastra/commit/a89272a5d71939b9fcd284e6a6dc1dd091a6bdcf), [`ee9c8df`](https://github.com/mastra-ai/mastra/commit/ee9c8df644f19d055af5f496bf4942705f5a47b7), [`77b4a25`](https://github.com/mastra-ai/mastra/commit/77b4a254e51907f8ff3a3ba95596a18e93ae4b35), [`276246e`](https://github.com/mastra-ai/mastra/commit/276246e0b9066a1ea48bbc70df84dbe528daaf99), [`08ecfdb`](https://github.com/mastra-ai/mastra/commit/08ecfdbdad6fb8285deef86a034bdf4a6047cfca), [`d5f628c`](https://github.com/mastra-ai/mastra/commit/d5f628ca86c6f6f3ff1035d52f635df32dd81cab), [`524c0f3`](https://github.com/mastra-ai/mastra/commit/524c0f3c434c3d9d18f66338dcef383d6161b59c), [`c18a0e9`](https://github.com/mastra-ai/mastra/commit/c18a0e9cef1e4ca004b2963d35e4cfc031971eac), [`4bd21ea`](https://github.com/mastra-ai/mastra/commit/4bd21ea43d44d0a0427414fc047577f9f0aa3bec), [`115a7a4`](https://github.com/mastra-ai/mastra/commit/115a7a47db5e9896fec12ae6507501adb9ec89bf), [`22a48ae`](https://github.com/mastra-ai/mastra/commit/22a48ae2513eb54d8d79dad361fddbca97a155e8), [`3c6ef79`](https://github.com/mastra-ai/mastra/commit/3c6ef798481e00d6d22563be2de98818fd4dd5e0), [`9311c17`](https://github.com/mastra-ai/mastra/commit/9311c17d7a0640d9c4da2e71b814dc67c57c6369), [`7edf78f`](https://github.com/mastra-ai/mastra/commit/7edf78f80422c43e84585f08ba11df0d4d0b73c5), [`1c4221c`](https://github.com/mastra-ai/mastra/commit/1c4221cf6032ec98d0e094d4ee11da3e48490d96), [`d25b9ea`](https://github.com/mastra-ai/mastra/commit/d25b9eabd400167255a97b690ffbc4ee4097ded5), [`fe1ce5c`](https://github.com/mastra-ai/mastra/commit/fe1ce5c9211c03d561606fda95cbfe7df1d9a9b5), [`b03c0e0`](https://github.com/mastra-ai/mastra/commit/b03c0e0389a799523929a458b0509c9e4244d562), [`0a8366b`](https://github.com/mastra-ai/mastra/commit/0a8366b0a692fcdde56c4d526e4cf03c502ae4ac), [`85664e9`](https://github.com/mastra-ai/mastra/commit/85664e9fd857320fbc245e301f764f45f66f32a3), [`bc79650`](https://github.com/mastra-ai/mastra/commit/bc796500c6e0334faa158a96077e3fb332274869), [`9257d01`](https://github.com/mastra-ai/mastra/commit/9257d01d1366d81f84c582fe02b5e200cf9621f4), [`3a3a59e`](https://github.com/mastra-ai/mastra/commit/3a3a59e8ffaa6a985fe3d9a126a3f5ade11a6724), [`3108d4e`](https://github.com/mastra-ai/mastra/commit/3108d4e649c9fddbf03253a6feeb388a5fa9fa5a), [`0c33b2c`](https://github.com/mastra-ai/mastra/commit/0c33b2c9db537f815e1c59e2c898ffce2e395a79), [`191e5bd`](https://github.com/mastra-ai/mastra/commit/191e5bd29b82f5bda35243945790da7bc7b695c2), [`f77cd94`](https://github.com/mastra-ai/mastra/commit/f77cd94c44eabed490384e7d19232a865e13214c), [`e8135c7`](https://github.com/mastra-ai/mastra/commit/e8135c7e300dac5040670eec7eab896ac6092e30), [`daca48f`](https://github.com/mastra-ai/mastra/commit/daca48f0fb17b7ae0b62a2ac40cf0e491b2fd0b7), [`257d14f`](https://github.com/mastra-ai/mastra/commit/257d14faca5931f2e4186fc165b6f0b1f915deee), [`352f25d`](https://github.com/mastra-ai/mastra/commit/352f25da316b24cdd5b410fd8dddf6a8b763da2a), [`93477d0`](https://github.com/mastra-ai/mastra/commit/93477d0769b8a13ea5ed73d508d967fb23eaeed9), [`31c78b3`](https://github.com/mastra-ai/mastra/commit/31c78b3eb28f58a8017f1dcc795c33214d87feac), [`0bc0720`](https://github.com/mastra-ai/mastra/commit/0bc07201095791858087cc56f353fcd65e87ab54), [`36516ac`](https://github.com/mastra-ai/mastra/commit/36516aca1021cbeb42e74751b46a2614101f37c8), [`e947652`](https://github.com/mastra-ai/mastra/commit/e9476527fdecb4449e54570e80dfaf8466901254), [`3c6ef79`](https://github.com/mastra-ai/mastra/commit/3c6ef798481e00d6d22563be2de98818fd4dd5e0), [`9257d01`](https://github.com/mastra-ai/mastra/commit/9257d01d1366d81f84c582fe02b5e200cf9621f4), [`ec248f6`](https://github.com/mastra-ai/mastra/commit/ec248f6b56e8a037c066c49b2178e2507471d988)]:
  - @mastra/core@1.9.0-alpha.0

## 0.1.0

### Minor Changes

- Fixed `getInstructions()` to report sandbox-level facts only (working directory, provider type) instead of counting all mount entries regardless of state. Added `instructions` option to `E2BSandbox` to override or extend default instructions. ([#13304](https://github.com/mastra-ai/mastra/pull/13304))

- Added `E2BProcessManager` for background process management in E2B cloud sandboxes. ([#13293](https://github.com/mastra-ai/mastra/pull/13293))

  Wraps E2B SDK's `commands.run()` with `background: true` and `commands.connect()` for reconnection. Processes spawned in E2B sandboxes are automatically cleaned up on `stop()` and `destroy()`.

  Bumps `@mastra/core` peer dependency to `>=1.7.0-0` (requires `SandboxProcessManager` from core).

### Patch Changes

- Updated dependencies [[`24284ff`](https://github.com/mastra-ai/mastra/commit/24284ffae306ddf0ab83273e13f033520839ef40), [`f5097cc`](https://github.com/mastra-ai/mastra/commit/f5097cc8a813c82c3378882c31178320cadeb655), [`71e237f`](https://github.com/mastra-ai/mastra/commit/71e237fa852a3ad9a50a3ddb3b5f3b20b9a8181c), [`13a291e`](https://github.com/mastra-ai/mastra/commit/13a291ebb9f9bca80befa0d9166b916bb348e8e9), [`397af5a`](https://github.com/mastra-ai/mastra/commit/397af5a69f34d4157f51a7c8da3f1ded1e1d611c), [`d4701f7`](https://github.com/mastra-ai/mastra/commit/d4701f7e24822b081b70f9c806c39411b1a712e7), [`2b40831`](https://github.com/mastra-ai/mastra/commit/2b40831dcca2275c9570ddf09b7f25ba3e8dc7fc), [`6184727`](https://github.com/mastra-ai/mastra/commit/6184727e812bf7a65cee209bacec3a2f5a16e923), [`0c338b8`](https://github.com/mastra-ai/mastra/commit/0c338b87362dcd95ff8191ca00df645b6953f534), [`6f6385b`](https://github.com/mastra-ai/mastra/commit/6f6385be5b33687cd21e71fc27e972e6928bb34c), [`14aba61`](https://github.com/mastra-ai/mastra/commit/14aba61b9cff76d72bc7ef6f3a83ae2c5d059193), [`dd9dd1c`](https://github.com/mastra-ai/mastra/commit/dd9dd1c9ae32ae79093f8c4adde1732ac6357233)]:
  - @mastra/core@1.7.0

## 0.1.0-alpha.0

### Minor Changes

- Fixed `getInstructions()` to report sandbox-level facts only (working directory, provider type) instead of counting all mount entries regardless of state. Added `instructions` option to `E2BSandbox` to override or extend default instructions. ([#13304](https://github.com/mastra-ai/mastra/pull/13304))

- Added `E2BProcessManager` for background process management in E2B cloud sandboxes. ([#13293](https://github.com/mastra-ai/mastra/pull/13293))

  Wraps E2B SDK's `commands.run()` with `background: true` and `commands.connect()` for reconnection. Processes spawned in E2B sandboxes are automatically cleaned up on `stop()` and `destroy()`.

  Bumps `@mastra/core` peer dependency to `>=1.7.0-0` (requires `SandboxProcessManager` from core).

### Patch Changes

- Updated dependencies [[`24284ff`](https://github.com/mastra-ai/mastra/commit/24284ffae306ddf0ab83273e13f033520839ef40), [`f5097cc`](https://github.com/mastra-ai/mastra/commit/f5097cc8a813c82c3378882c31178320cadeb655), [`71e237f`](https://github.com/mastra-ai/mastra/commit/71e237fa852a3ad9a50a3ddb3b5f3b20b9a8181c), [`13a291e`](https://github.com/mastra-ai/mastra/commit/13a291ebb9f9bca80befa0d9166b916bb348e8e9), [`397af5a`](https://github.com/mastra-ai/mastra/commit/397af5a69f34d4157f51a7c8da3f1ded1e1d611c), [`d4701f7`](https://github.com/mastra-ai/mastra/commit/d4701f7e24822b081b70f9c806c39411b1a712e7), [`2b40831`](https://github.com/mastra-ai/mastra/commit/2b40831dcca2275c9570ddf09b7f25ba3e8dc7fc), [`6184727`](https://github.com/mastra-ai/mastra/commit/6184727e812bf7a65cee209bacec3a2f5a16e923), [`6f6385b`](https://github.com/mastra-ai/mastra/commit/6f6385be5b33687cd21e71fc27e972e6928bb34c), [`14aba61`](https://github.com/mastra-ai/mastra/commit/14aba61b9cff76d72bc7ef6f3a83ae2c5d059193), [`dd9dd1c`](https://github.com/mastra-ai/mastra/commit/dd9dd1c9ae32ae79093f8c4adde1732ac6357233)]:
  - @mastra/core@1.7.0-alpha.0

## 0.0.3

### Patch Changes

- Removed unused SandboxRuntime type, runtimes option, supportedRuntimes/defaultRuntime getters, and getMounts() method. These were defined but never used for any actual behavior. ([#13053](https://github.com/mastra-ai/mastra/pull/13053))

- Added editor provider descriptors for workspace filesystem, sandbox, and blob store packages. Each provider exports an object with `id`, `name`, `description`, `configSchema` (JSON Schema), and a factory method, enabling the editor UI to auto-discover and render configuration forms for workspace providers. ([#13156](https://github.com/mastra-ai/mastra/pull/13156))
  - `@mastra/gcs`: Added `gcsFilesystemProvider` with config schema for bucket, projectId, credentials, prefix, readOnly, and endpoint
  - `@mastra/e2b`: Added `e2bSandboxProvider` with config schema for template, timeout, env, metadata, runtimes, domain, and API settings

  ```ts
  import { gcsFilesystemProvider } from '@mastra/gcs';
  import { e2bSandboxProvider } from '@mastra/e2b';

  const editor = new MastraEditor({
    filesystems: {
      gcs: gcsFilesystemProvider,
    },
    sandboxes: {
      e2b: e2bSandboxProvider,
    },
  });

  // Enumerate available providers and their config schemas for UI rendering
  const fsProviders = editor.getFilesystemProviders();
  const sbProviders = editor.getSandboxProviders();
  ```

- Added workspace and skill storage domains with full CRUD, versioning, and implementations across LibSQL, Postgres, and MongoDB. Added `editor.workspace` and `editor.skill` namespaces for managing workspace configurations and skill definitions through the editor. Agents stored in the editor can now reference workspaces (by ID or inline config) and skills, with full hydration to runtime `Workspace` instances during agent resolution. ([#13156](https://github.com/mastra-ai/mastra/pull/13156))

  **Filesystem-native skill versioning (draft → publish model):**

  Skills are versioned as filesystem trees with content-addressable blob storage. The editing surface (live filesystem) is separated from the serving surface (versioned blob store), enabling a `draft → publish` workflow:
  - `editor.skill.publish(skillId, source, skillPath)` — Snapshots a skill directory from the filesystem into blob storage, creates a new version with a tree manifest, and sets `activeVersionId`
  - Version switching via `editor.skill.update({ id, activeVersionId })` — Points the skill to a previous version without re-publishing
  - Publishing a skill automatically invalidates cached agents that reference it, so they re-hydrate with the updated version on next access

  **Agent skill resolution strategies:**

  Agents can reference skills with different resolution strategies:
  - `strategy: 'latest'` — Resolves the skill's active version (honors `activeVersionId` for rollback)
  - `pin: '<versionId>'` — Pins to a specific version, immune to publishes
  - `strategy: 'live'` — Reads directly from the live filesystem (no blob store)

  **Blob storage infrastructure:**
  - `BlobStore` abstract class for content-addressable storage keyed by SHA-256 hash
  - `InMemoryBlobStore` for testing
  - LibSQL, Postgres, and MongoDB implementations
  - `S3BlobStore` for storing blobs in S3 or S3-compatible storage (AWS, R2, MinIO, DO Spaces)
  - `BlobStoreProvider` interface and `MastraEditorConfig.blobStores` registry for pluggable blob storage
  - `VersionedSkillSource` and `CompositeVersionedSkillSource` for reading skill files from the blob store at runtime

  **New storage types:**
  - `StorageWorkspaceSnapshotType` and `StorageSkillSnapshotType` with corresponding input/output types
  - `StorageWorkspaceRef` for ID-based or inline workspace references on agents
  - `StorageSkillConfig` for per-agent skill overrides (`pin`, `strategy`, description, instructions)
  - `SkillVersionTree` and `SkillVersionTreeEntry` for tree manifests
  - `StorageBlobEntry` for content-addressable blob entries
  - `SKILL_BLOBS_SCHEMA` for the `mastra_skill_blobs` table

  **New editor namespaces:**
  - `editor.workspace` — CRUD for workspace configs, plus `hydrateSnapshotToWorkspace()` for resolving to runtime `Workspace` instances
  - `editor.skill` — CRUD for skill definitions, plus `publish()` for filesystem-to-blob snapshots

  **Provider registries:**
  - `MastraEditorConfig` accepts `filesystems`, `sandboxes`, and `blobStores` provider registries (keyed by provider ID)
  - Built-in `local` filesystem and sandbox providers are auto-registered
  - `editor.resolveBlobStore()` resolves from provider registry or falls back to the storage backend's blobs domain
  - Providers expose `id`, `name`, `description`, `configSchema` (JSON Schema for UI form rendering), and a factory method

  **Storage adapter support:**
  - LibSQL: Full `workspaces`, `skills`, and `blobs` domain implementations
  - Postgres: Full `workspaces`, `skills`, and `blobs` domain implementations
  - MongoDB: Full `workspaces`, `skills`, and `blobs` domain implementations
  - All three include `workspace`, `skills`, and `skillsFormat` fields on agent versions

  **Server endpoints:**
  - `GET/POST/PATCH/DELETE /stored/workspaces` — CRUD for stored workspaces
  - `GET/POST/PATCH/DELETE /stored/skills` — CRUD for stored skills
  - `POST /stored/skills/:id/publish` — Publish a skill from a filesystem source

  ```ts
  import { MastraEditor } from '@mastra/editor';
  import { s3FilesystemProvider, s3BlobStoreProvider } from '@mastra/s3';
  import { e2bSandboxProvider } from '@mastra/e2b';

  const editor = new MastraEditor({
    filesystems: { s3: s3FilesystemProvider },
    sandboxes: { e2b: e2bSandboxProvider },
    blobStores: { s3: s3BlobStoreProvider },
  });

  // Create a skill and publish it
  const skill = await editor.skill.create({
    name: 'Code Review',
    description: 'Reviews code for best practices',
    instructions: 'Analyze the code and provide feedback...',
  });
  await editor.skill.publish(skill.id, source, 'skills/code-review');

  // Agents resolve skills by strategy
  await editor.agent.create({
    name: 'Dev Assistant',
    model: { provider: 'openai', name: 'gpt-4' },
    workspace: { type: 'id', workspaceId: workspace.id },
    skills: { [skill.id]: { strategy: 'latest' } },
    skillsFormat: 'xml',
  });
  ```

- Updated dependencies [[`252580a`](https://github.com/mastra-ai/mastra/commit/252580a71feb0e46d0ccab04a70a79ff6a2ee0ab), [`f8e819f`](https://github.com/mastra-ai/mastra/commit/f8e819fabdfdc43d2da546a3ad81ba23685f603d), [`5c75261`](https://github.com/mastra-ai/mastra/commit/5c7526120d936757d4ffb7b82232e1641ebd45cb), [`e27d832`](https://github.com/mastra-ai/mastra/commit/e27d83281b5e166fd63a13969689e928d8605944), [`e37ef84`](https://github.com/mastra-ai/mastra/commit/e37ef8404043c94ca0c8e35ecdedb093b8087878), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`10cf521`](https://github.com/mastra-ai/mastra/commit/10cf52183344743a0d7babe24cd24fd78870c354), [`efdb682`](https://github.com/mastra-ai/mastra/commit/efdb682887f6522149769383908f9790c188ab88), [`0dee7a0`](https://github.com/mastra-ai/mastra/commit/0dee7a0ff4c2507e6eb6e6ee5f9738877ebd4ad1), [`04c2c8e`](https://github.com/mastra-ai/mastra/commit/04c2c8e888984364194131aecb490a3d6e920e61), [`02dc07a`](https://github.com/mastra-ai/mastra/commit/02dc07acc4ad42d93335825e3308f5b42266eba2), [`bb7262b`](https://github.com/mastra-ai/mastra/commit/bb7262b7c0ca76320d985b40510b6ffbbb936582), [`cf1c6e7`](https://github.com/mastra-ai/mastra/commit/cf1c6e789b131f55638fed52183a89d5078b4876), [`5ffadfe`](https://github.com/mastra-ai/mastra/commit/5ffadfefb1468ac2612b20bb84d24c39de6961c0), [`1e1339c`](https://github.com/mastra-ai/mastra/commit/1e1339cc276e571a48cfff5014487877086bfe68), [`d03df73`](https://github.com/mastra-ai/mastra/commit/d03df73f8fe9496064a33e1c3b74ba0479bf9ee6), [`79b8f45`](https://github.com/mastra-ai/mastra/commit/79b8f45a6767e1a5c3d56cd3c5b1214326b81661), [`9bbf08e`](https://github.com/mastra-ai/mastra/commit/9bbf08e3c20731c79dea13a765895b9fcf29cbf1), [`0a25952`](https://github.com/mastra-ai/mastra/commit/0a259526b5e1ac11e6efa53db1f140272962af2d), [`ffa5468`](https://github.com/mastra-ai/mastra/commit/ffa546857fc4821753979b3a34e13b4d76fbbcd4), [`3264a04`](https://github.com/mastra-ai/mastra/commit/3264a04e30340c3c5447433300a035ea0878df85), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`088d9ba`](https://github.com/mastra-ai/mastra/commit/088d9ba2577518703c52b0dccd617178d9ee6b0d), [`74fbebd`](https://github.com/mastra-ai/mastra/commit/74fbebd918a03832a2864965a8bea59bf617d3a2), [`aea6217`](https://github.com/mastra-ai/mastra/commit/aea621790bfb2291431b08da0cc5e6e150303ae7), [`b6a855e`](https://github.com/mastra-ai/mastra/commit/b6a855edc056e088279075506442ba1d6fa6def9), [`ae408ea`](https://github.com/mastra-ai/mastra/commit/ae408ea7128f0d2710b78d8623185198e7cb19c1), [`17e942e`](https://github.com/mastra-ai/mastra/commit/17e942eee2ba44985b1f807e6208cdde672f82f9), [`2015cf9`](https://github.com/mastra-ai/mastra/commit/2015cf921649f44c3f5bcd32a2c052335f8e49b4), [`7ef454e`](https://github.com/mastra-ai/mastra/commit/7ef454eaf9dcec6de60021c8f42192052dd490d6), [`2be1d99`](https://github.com/mastra-ai/mastra/commit/2be1d99564ce79acc4846071082bff353035a87a), [`2708fa1`](https://github.com/mastra-ai/mastra/commit/2708fa1055ac91c03e08b598869f6b8fb51fa37f), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ec53e89`](https://github.com/mastra-ai/mastra/commit/ec53e8939c76c638991e21af762e51378eff7543), [`9b5a8cb`](https://github.com/mastra-ai/mastra/commit/9b5a8cb13e120811b0bf14140ada314f1c067894), [`607e66b`](https://github.com/mastra-ai/mastra/commit/607e66b02dc7f531ee37799f3456aa2dc0ca7ac5), [`a215d06`](https://github.com/mastra-ai/mastra/commit/a215d06758dcf590eabfe0b7afd4ae39bdbf082c), [`6909c74`](https://github.com/mastra-ai/mastra/commit/6909c74a7781e0447d475e9dbc1dc871b700f426), [`192438f`](https://github.com/mastra-ai/mastra/commit/192438f8a90c4f375e955f8ff179bf8dc6821a83)]:
  - @mastra/core@1.5.0

## 0.0.3-alpha.0

### Patch Changes

- Removed unused SandboxRuntime type, runtimes option, supportedRuntimes/defaultRuntime getters, and getMounts() method. These were defined but never used for any actual behavior. ([#13053](https://github.com/mastra-ai/mastra/pull/13053))

- Added editor provider descriptors for workspace filesystem, sandbox, and blob store packages. Each provider exports an object with `id`, `name`, `description`, `configSchema` (JSON Schema), and a factory method, enabling the editor UI to auto-discover and render configuration forms for workspace providers. ([#13156](https://github.com/mastra-ai/mastra/pull/13156))
  - `@mastra/gcs`: Added `gcsFilesystemProvider` with config schema for bucket, projectId, credentials, prefix, readOnly, and endpoint
  - `@mastra/e2b`: Added `e2bSandboxProvider` with config schema for template, timeout, env, metadata, runtimes, domain, and API settings

  ```ts
  import { gcsFilesystemProvider } from '@mastra/gcs';
  import { e2bSandboxProvider } from '@mastra/e2b';

  const editor = new MastraEditor({
    filesystems: {
      gcs: gcsFilesystemProvider,
    },
    sandboxes: {
      e2b: e2bSandboxProvider,
    },
  });

  // Enumerate available providers and their config schemas for UI rendering
  const fsProviders = editor.getFilesystemProviders();
  const sbProviders = editor.getSandboxProviders();
  ```

- Added workspace and skill storage domains with full CRUD, versioning, and implementations across LibSQL, Postgres, and MongoDB. Added `editor.workspace` and `editor.skill` namespaces for managing workspace configurations and skill definitions through the editor. Agents stored in the editor can now reference workspaces (by ID or inline config) and skills, with full hydration to runtime `Workspace` instances during agent resolution. ([#13156](https://github.com/mastra-ai/mastra/pull/13156))

  **Filesystem-native skill versioning (draft → publish model):**

  Skills are versioned as filesystem trees with content-addressable blob storage. The editing surface (live filesystem) is separated from the serving surface (versioned blob store), enabling a `draft → publish` workflow:
  - `editor.skill.publish(skillId, source, skillPath)` — Snapshots a skill directory from the filesystem into blob storage, creates a new version with a tree manifest, and sets `activeVersionId`
  - Version switching via `editor.skill.update({ id, activeVersionId })` — Points the skill to a previous version without re-publishing
  - Publishing a skill automatically invalidates cached agents that reference it, so they re-hydrate with the updated version on next access

  **Agent skill resolution strategies:**

  Agents can reference skills with different resolution strategies:
  - `strategy: 'latest'` — Resolves the skill's active version (honors `activeVersionId` for rollback)
  - `pin: '<versionId>'` — Pins to a specific version, immune to publishes
  - `strategy: 'live'` — Reads directly from the live filesystem (no blob store)

  **Blob storage infrastructure:**
  - `BlobStore` abstract class for content-addressable storage keyed by SHA-256 hash
  - `InMemoryBlobStore` for testing
  - LibSQL, Postgres, and MongoDB implementations
  - `S3BlobStore` for storing blobs in S3 or S3-compatible storage (AWS, R2, MinIO, DO Spaces)
  - `BlobStoreProvider` interface and `MastraEditorConfig.blobStores` registry for pluggable blob storage
  - `VersionedSkillSource` and `CompositeVersionedSkillSource` for reading skill files from the blob store at runtime

  **New storage types:**
  - `StorageWorkspaceSnapshotType` and `StorageSkillSnapshotType` with corresponding input/output types
  - `StorageWorkspaceRef` for ID-based or inline workspace references on agents
  - `StorageSkillConfig` for per-agent skill overrides (`pin`, `strategy`, description, instructions)
  - `SkillVersionTree` and `SkillVersionTreeEntry` for tree manifests
  - `StorageBlobEntry` for content-addressable blob entries
  - `SKILL_BLOBS_SCHEMA` for the `mastra_skill_blobs` table

  **New editor namespaces:**
  - `editor.workspace` — CRUD for workspace configs, plus `hydrateSnapshotToWorkspace()` for resolving to runtime `Workspace` instances
  - `editor.skill` — CRUD for skill definitions, plus `publish()` for filesystem-to-blob snapshots

  **Provider registries:**
  - `MastraEditorConfig` accepts `filesystems`, `sandboxes`, and `blobStores` provider registries (keyed by provider ID)
  - Built-in `local` filesystem and sandbox providers are auto-registered
  - `editor.resolveBlobStore()` resolves from provider registry or falls back to the storage backend's blobs domain
  - Providers expose `id`, `name`, `description`, `configSchema` (JSON Schema for UI form rendering), and a factory method

  **Storage adapter support:**
  - LibSQL: Full `workspaces`, `skills`, and `blobs` domain implementations
  - Postgres: Full `workspaces`, `skills`, and `blobs` domain implementations
  - MongoDB: Full `workspaces`, `skills`, and `blobs` domain implementations
  - All three include `workspace`, `skills`, and `skillsFormat` fields on agent versions

  **Server endpoints:**
  - `GET/POST/PATCH/DELETE /stored/workspaces` — CRUD for stored workspaces
  - `GET/POST/PATCH/DELETE /stored/skills` — CRUD for stored skills
  - `POST /stored/skills/:id/publish` — Publish a skill from a filesystem source

  ```ts
  import { MastraEditor } from '@mastra/editor';
  import { s3FilesystemProvider, s3BlobStoreProvider } from '@mastra/s3';
  import { e2bSandboxProvider } from '@mastra/e2b';

  const editor = new MastraEditor({
    filesystems: { s3: s3FilesystemProvider },
    sandboxes: { e2b: e2bSandboxProvider },
    blobStores: { s3: s3BlobStoreProvider },
  });

  // Create a skill and publish it
  const skill = await editor.skill.create({
    name: 'Code Review',
    description: 'Reviews code for best practices',
    instructions: 'Analyze the code and provide feedback...',
  });
  await editor.skill.publish(skill.id, source, 'skills/code-review');

  // Agents resolve skills by strategy
  await editor.agent.create({
    name: 'Dev Assistant',
    model: { provider: 'openai', name: 'gpt-4' },
    workspace: { type: 'id', workspaceId: workspace.id },
    skills: { [skill.id]: { strategy: 'latest' } },
    skillsFormat: 'xml',
  });
  ```

- Updated dependencies [[`252580a`](https://github.com/mastra-ai/mastra/commit/252580a71feb0e46d0ccab04a70a79ff6a2ee0ab), [`f8e819f`](https://github.com/mastra-ai/mastra/commit/f8e819fabdfdc43d2da546a3ad81ba23685f603d), [`5c75261`](https://github.com/mastra-ai/mastra/commit/5c7526120d936757d4ffb7b82232e1641ebd45cb), [`e27d832`](https://github.com/mastra-ai/mastra/commit/e27d83281b5e166fd63a13969689e928d8605944), [`e37ef84`](https://github.com/mastra-ai/mastra/commit/e37ef8404043c94ca0c8e35ecdedb093b8087878), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`10cf521`](https://github.com/mastra-ai/mastra/commit/10cf52183344743a0d7babe24cd24fd78870c354), [`efdb682`](https://github.com/mastra-ai/mastra/commit/efdb682887f6522149769383908f9790c188ab88), [`0dee7a0`](https://github.com/mastra-ai/mastra/commit/0dee7a0ff4c2507e6eb6e6ee5f9738877ebd4ad1), [`04c2c8e`](https://github.com/mastra-ai/mastra/commit/04c2c8e888984364194131aecb490a3d6e920e61), [`02dc07a`](https://github.com/mastra-ai/mastra/commit/02dc07acc4ad42d93335825e3308f5b42266eba2), [`bb7262b`](https://github.com/mastra-ai/mastra/commit/bb7262b7c0ca76320d985b40510b6ffbbb936582), [`cf1c6e7`](https://github.com/mastra-ai/mastra/commit/cf1c6e789b131f55638fed52183a89d5078b4876), [`5ffadfe`](https://github.com/mastra-ai/mastra/commit/5ffadfefb1468ac2612b20bb84d24c39de6961c0), [`1e1339c`](https://github.com/mastra-ai/mastra/commit/1e1339cc276e571a48cfff5014487877086bfe68), [`d03df73`](https://github.com/mastra-ai/mastra/commit/d03df73f8fe9496064a33e1c3b74ba0479bf9ee6), [`79b8f45`](https://github.com/mastra-ai/mastra/commit/79b8f45a6767e1a5c3d56cd3c5b1214326b81661), [`9bbf08e`](https://github.com/mastra-ai/mastra/commit/9bbf08e3c20731c79dea13a765895b9fcf29cbf1), [`0a25952`](https://github.com/mastra-ai/mastra/commit/0a259526b5e1ac11e6efa53db1f140272962af2d), [`ffa5468`](https://github.com/mastra-ai/mastra/commit/ffa546857fc4821753979b3a34e13b4d76fbbcd4), [`3264a04`](https://github.com/mastra-ai/mastra/commit/3264a04e30340c3c5447433300a035ea0878df85), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`088d9ba`](https://github.com/mastra-ai/mastra/commit/088d9ba2577518703c52b0dccd617178d9ee6b0d), [`74fbebd`](https://github.com/mastra-ai/mastra/commit/74fbebd918a03832a2864965a8bea59bf617d3a2), [`aea6217`](https://github.com/mastra-ai/mastra/commit/aea621790bfb2291431b08da0cc5e6e150303ae7), [`b6a855e`](https://github.com/mastra-ai/mastra/commit/b6a855edc056e088279075506442ba1d6fa6def9), [`ae408ea`](https://github.com/mastra-ai/mastra/commit/ae408ea7128f0d2710b78d8623185198e7cb19c1), [`17e942e`](https://github.com/mastra-ai/mastra/commit/17e942eee2ba44985b1f807e6208cdde672f82f9), [`2015cf9`](https://github.com/mastra-ai/mastra/commit/2015cf921649f44c3f5bcd32a2c052335f8e49b4), [`7ef454e`](https://github.com/mastra-ai/mastra/commit/7ef454eaf9dcec6de60021c8f42192052dd490d6), [`2be1d99`](https://github.com/mastra-ai/mastra/commit/2be1d99564ce79acc4846071082bff353035a87a), [`2708fa1`](https://github.com/mastra-ai/mastra/commit/2708fa1055ac91c03e08b598869f6b8fb51fa37f), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ec53e89`](https://github.com/mastra-ai/mastra/commit/ec53e8939c76c638991e21af762e51378eff7543), [`9b5a8cb`](https://github.com/mastra-ai/mastra/commit/9b5a8cb13e120811b0bf14140ada314f1c067894), [`607e66b`](https://github.com/mastra-ai/mastra/commit/607e66b02dc7f531ee37799f3456aa2dc0ca7ac5), [`a215d06`](https://github.com/mastra-ai/mastra/commit/a215d06758dcf590eabfe0b7afd4ae39bdbf082c), [`6909c74`](https://github.com/mastra-ai/mastra/commit/6909c74a7781e0447d475e9dbc1dc871b700f426), [`192438f`](https://github.com/mastra-ai/mastra/commit/192438f8a90c4f375e955f8ff179bf8dc6821a83)]:
  - @mastra/core@1.5.0-alpha.0

## 0.0.2

### Patch Changes

- `E2BSandboxOptions` now automatically inherits new lifecycle callbacks from `MastraSandboxOptions`, so new callbacks are available without updating the options type. ([#12978](https://github.com/mastra-ai/mastra/pull/12978))

- Updated dependencies [[`7ef618f`](https://github.com/mastra-ai/mastra/commit/7ef618f3c49c27e2f6b27d7f564c557c0734325b), [`b373564`](https://github.com/mastra-ai/mastra/commit/b37356491d43b4d53067f10cb669abaf2502f218), [`927c2af`](https://github.com/mastra-ai/mastra/commit/927c2af9792286c122e04409efce0f3c804f777f), [`b896b41`](https://github.com/mastra-ai/mastra/commit/b896b41343de7fcc14442fb40fe82d189e65bbe2), [`6415277`](https://github.com/mastra-ai/mastra/commit/6415277a438faa00db2af850ead5dee25f40c428), [`0831bbb`](https://github.com/mastra-ai/mastra/commit/0831bbb5bc750c18e9b22b45f18687c964b70828), [`63f7eda`](https://github.com/mastra-ai/mastra/commit/63f7eda605eb3e0c8c35ee3912ffe7c999c69f69), [`a5b67a3`](https://github.com/mastra-ai/mastra/commit/a5b67a3589a74415feb663a55d1858324a2afde9), [`877b02c`](https://github.com/mastra-ai/mastra/commit/877b02cdbb15e199184c7f2b8f217be8d3ebada7), [`7567222`](https://github.com/mastra-ai/mastra/commit/7567222b1366f0d39980594792dd9d5060bfe2ab), [`af71458`](https://github.com/mastra-ai/mastra/commit/af71458e3b566f09c11d0e5a0a836dc818e7a24a), [`eb36bd8`](https://github.com/mastra-ai/mastra/commit/eb36bd8c52fcd6ec9674ac3b7a6412405b5983e1), [`3cbf121`](https://github.com/mastra-ai/mastra/commit/3cbf121f55418141924754a83102aade89835947)]:
  - @mastra/core@1.4.0

## 0.0.2-alpha.0

### Patch Changes

- `E2BSandboxOptions` now automatically inherits new lifecycle callbacks from `MastraSandboxOptions`, so new callbacks are available without updating the options type. ([#12978](https://github.com/mastra-ai/mastra/pull/12978))

- Updated dependencies [[`7ef618f`](https://github.com/mastra-ai/mastra/commit/7ef618f3c49c27e2f6b27d7f564c557c0734325b), [`b373564`](https://github.com/mastra-ai/mastra/commit/b37356491d43b4d53067f10cb669abaf2502f218), [`927c2af`](https://github.com/mastra-ai/mastra/commit/927c2af9792286c122e04409efce0f3c804f777f), [`b896b41`](https://github.com/mastra-ai/mastra/commit/b896b41343de7fcc14442fb40fe82d189e65bbe2), [`6415277`](https://github.com/mastra-ai/mastra/commit/6415277a438faa00db2af850ead5dee25f40c428), [`0831bbb`](https://github.com/mastra-ai/mastra/commit/0831bbb5bc750c18e9b22b45f18687c964b70828), [`63f7eda`](https://github.com/mastra-ai/mastra/commit/63f7eda605eb3e0c8c35ee3912ffe7c999c69f69), [`a5b67a3`](https://github.com/mastra-ai/mastra/commit/a5b67a3589a74415feb663a55d1858324a2afde9), [`877b02c`](https://github.com/mastra-ai/mastra/commit/877b02cdbb15e199184c7f2b8f217be8d3ebada7), [`7567222`](https://github.com/mastra-ai/mastra/commit/7567222b1366f0d39980594792dd9d5060bfe2ab), [`af71458`](https://github.com/mastra-ai/mastra/commit/af71458e3b566f09c11d0e5a0a836dc818e7a24a), [`eb36bd8`](https://github.com/mastra-ai/mastra/commit/eb36bd8c52fcd6ec9674ac3b7a6412405b5983e1), [`3cbf121`](https://github.com/mastra-ai/mastra/commit/3cbf121f55418141924754a83102aade89835947)]:
  - @mastra/core@1.4.0-alpha.0

## 0.0.1

### Patch Changes

- Added `@mastra/e2b` package providing E2B sandbox integration for Mastra workspaces. Supports S3 and GCS filesystem mounting via FUSE inside sandboxes. ([#12605](https://github.com/mastra-ai/mastra/pull/12605))

  ```typescript
  import { E2BSandbox } from '@mastra/e2b';

  const sandbox = new E2BSandbox({ id: 'my-sandbox' });
  ```

- Updated dependencies [[`717ffab`](https://github.com/mastra-ai/mastra/commit/717ffab42cfd58ff723b5c19ada4939997773004), [`b31c922`](https://github.com/mastra-ai/mastra/commit/b31c922215b513791d98feaea1b98784aa00803a), [`e4b6dab`](https://github.com/mastra-ai/mastra/commit/e4b6dab171c5960e340b3ea3ea6da8d64d2b8672), [`5719fa8`](https://github.com/mastra-ai/mastra/commit/5719fa8880e86e8affe698ec4b3807c7e0e0a06f), [`83cda45`](https://github.com/mastra-ai/mastra/commit/83cda4523e588558466892bff8f80f631a36945a), [`11804ad`](https://github.com/mastra-ai/mastra/commit/11804adf1d6be46ebe216be40a43b39bb8b397d7), [`aa95f95`](https://github.com/mastra-ai/mastra/commit/aa95f958b186ae5c9f4219c88e268f5565c277a2), [`90f7894`](https://github.com/mastra-ai/mastra/commit/90f7894568dc9481f40a4d29672234fae23090bb), [`f5501ae`](https://github.com/mastra-ai/mastra/commit/f5501aedb0a11106c7db7e480d6eaf3971b7bda8), [`44573af`](https://github.com/mastra-ai/mastra/commit/44573afad0a4bc86f627d6cbc0207961cdcb3bc3), [`00e3861`](https://github.com/mastra-ai/mastra/commit/00e3861863fbfee78faeb1ebbdc7c0223aae13ff), [`8109aee`](https://github.com/mastra-ai/mastra/commit/8109aeeab758e16cd4255a6c36f044b70eefc6a6), [`7bfbc52`](https://github.com/mastra-ai/mastra/commit/7bfbc52a8604feb0fff2c0a082c13c0c2a3df1a2), [`1445994`](https://github.com/mastra-ai/mastra/commit/1445994aee19c9334a6a101cf7bd80ca7ed4d186), [`61f44a2`](https://github.com/mastra-ai/mastra/commit/61f44a26861c89e364f367ff40825bdb7f19df55), [`37145d2`](https://github.com/mastra-ai/mastra/commit/37145d25f99dc31f1a9105576e5452609843ce32), [`fdad759`](https://github.com/mastra-ai/mastra/commit/fdad75939ff008b27625f5ec0ce9c6915d99d9ec), [`e4569c5`](https://github.com/mastra-ai/mastra/commit/e4569c589e00c4061a686c9eb85afe1b7050b0a8), [`7309a85`](https://github.com/mastra-ai/mastra/commit/7309a85427281a8be23f4fb80ca52e18eaffd596), [`99424f6`](https://github.com/mastra-ai/mastra/commit/99424f6862ffb679c4ec6765501486034754a4c2), [`44eb452`](https://github.com/mastra-ai/mastra/commit/44eb4529b10603c279688318bebf3048543a1d61), [`6c40593`](https://github.com/mastra-ai/mastra/commit/6c40593d6d2b1b68b0c45d1a3a4c6ac5ecac3937), [`8c1135d`](https://github.com/mastra-ai/mastra/commit/8c1135dfb91b057283eae7ee11f9ec28753cc64f), [`dd39e54`](https://github.com/mastra-ai/mastra/commit/dd39e54ea34532c995b33bee6e0e808bf41a7341), [`b6fad9a`](https://github.com/mastra-ai/mastra/commit/b6fad9a602182b1cc0df47cd8c55004fa829ad61), [`4129c07`](https://github.com/mastra-ai/mastra/commit/4129c073349b5a66643fd8136ebfe9d7097cf793), [`5b930ab`](https://github.com/mastra-ai/mastra/commit/5b930aba1834d9898e8460a49d15106f31ac7c8d), [`4be93d0`](https://github.com/mastra-ai/mastra/commit/4be93d09d68e20aaf0ea3f210749422719618b5f), [`047635c`](https://github.com/mastra-ai/mastra/commit/047635ccd7861d726c62d135560c0022a5490aec), [`8c90ff4`](https://github.com/mastra-ai/mastra/commit/8c90ff4d3414e7f2a2d216ea91274644f7b29133), [`ed232d1`](https://github.com/mastra-ai/mastra/commit/ed232d1583f403925dc5ae45f7bee948cf2a182b), [`3891795`](https://github.com/mastra-ai/mastra/commit/38917953518eb4154a984ee36e6ededdcfe80f72), [`4f955b2`](https://github.com/mastra-ai/mastra/commit/4f955b20c7f66ed282ee1fd8709696fa64c4f19d), [`55a4c90`](https://github.com/mastra-ai/mastra/commit/55a4c9044ac7454349b9f6aeba0bbab5ee65d10f)]:
  - @mastra/core@1.3.0

## 0.0.1-alpha.0

### Patch Changes

- Added `@mastra/e2b` package providing E2B sandbox integration for Mastra workspaces. Supports S3 and GCS filesystem mounting via FUSE inside sandboxes. ([#12605](https://github.com/mastra-ai/mastra/pull/12605))

  ```typescript
  import { E2BSandbox } from '@mastra/e2b';

  const sandbox = new E2BSandbox({ id: 'my-sandbox' });
  ```

- Updated dependencies [[`717ffab`](https://github.com/mastra-ai/mastra/commit/717ffab42cfd58ff723b5c19ada4939997773004), [`e4b6dab`](https://github.com/mastra-ai/mastra/commit/e4b6dab171c5960e340b3ea3ea6da8d64d2b8672), [`5719fa8`](https://github.com/mastra-ai/mastra/commit/5719fa8880e86e8affe698ec4b3807c7e0e0a06f), [`83cda45`](https://github.com/mastra-ai/mastra/commit/83cda4523e588558466892bff8f80f631a36945a), [`11804ad`](https://github.com/mastra-ai/mastra/commit/11804adf1d6be46ebe216be40a43b39bb8b397d7), [`aa95f95`](https://github.com/mastra-ai/mastra/commit/aa95f958b186ae5c9f4219c88e268f5565c277a2), [`f5501ae`](https://github.com/mastra-ai/mastra/commit/f5501aedb0a11106c7db7e480d6eaf3971b7bda8), [`44573af`](https://github.com/mastra-ai/mastra/commit/44573afad0a4bc86f627d6cbc0207961cdcb3bc3), [`00e3861`](https://github.com/mastra-ai/mastra/commit/00e3861863fbfee78faeb1ebbdc7c0223aae13ff), [`7bfbc52`](https://github.com/mastra-ai/mastra/commit/7bfbc52a8604feb0fff2c0a082c13c0c2a3df1a2), [`1445994`](https://github.com/mastra-ai/mastra/commit/1445994aee19c9334a6a101cf7bd80ca7ed4d186), [`61f44a2`](https://github.com/mastra-ai/mastra/commit/61f44a26861c89e364f367ff40825bdb7f19df55), [`37145d2`](https://github.com/mastra-ai/mastra/commit/37145d25f99dc31f1a9105576e5452609843ce32), [`fdad759`](https://github.com/mastra-ai/mastra/commit/fdad75939ff008b27625f5ec0ce9c6915d99d9ec), [`e4569c5`](https://github.com/mastra-ai/mastra/commit/e4569c589e00c4061a686c9eb85afe1b7050b0a8), [`7309a85`](https://github.com/mastra-ai/mastra/commit/7309a85427281a8be23f4fb80ca52e18eaffd596), [`99424f6`](https://github.com/mastra-ai/mastra/commit/99424f6862ffb679c4ec6765501486034754a4c2), [`44eb452`](https://github.com/mastra-ai/mastra/commit/44eb4529b10603c279688318bebf3048543a1d61), [`6c40593`](https://github.com/mastra-ai/mastra/commit/6c40593d6d2b1b68b0c45d1a3a4c6ac5ecac3937), [`8c1135d`](https://github.com/mastra-ai/mastra/commit/8c1135dfb91b057283eae7ee11f9ec28753cc64f), [`dd39e54`](https://github.com/mastra-ai/mastra/commit/dd39e54ea34532c995b33bee6e0e808bf41a7341), [`b6fad9a`](https://github.com/mastra-ai/mastra/commit/b6fad9a602182b1cc0df47cd8c55004fa829ad61), [`4129c07`](https://github.com/mastra-ai/mastra/commit/4129c073349b5a66643fd8136ebfe9d7097cf793), [`5b930ab`](https://github.com/mastra-ai/mastra/commit/5b930aba1834d9898e8460a49d15106f31ac7c8d), [`4be93d0`](https://github.com/mastra-ai/mastra/commit/4be93d09d68e20aaf0ea3f210749422719618b5f), [`047635c`](https://github.com/mastra-ai/mastra/commit/047635ccd7861d726c62d135560c0022a5490aec), [`8c90ff4`](https://github.com/mastra-ai/mastra/commit/8c90ff4d3414e7f2a2d216ea91274644f7b29133), [`ed232d1`](https://github.com/mastra-ai/mastra/commit/ed232d1583f403925dc5ae45f7bee948cf2a182b), [`3891795`](https://github.com/mastra-ai/mastra/commit/38917953518eb4154a984ee36e6ededdcfe80f72), [`4f955b2`](https://github.com/mastra-ai/mastra/commit/4f955b20c7f66ed282ee1fd8709696fa64c4f19d), [`55a4c90`](https://github.com/mastra-ai/mastra/commit/55a4c9044ac7454349b9f6aeba0bbab5ee65d10f)]:
  - @mastra/core@1.3.0-alpha.1
