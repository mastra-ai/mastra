# @mastra/daytona

## 0.3.0

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

## 0.3.0-alpha.0

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

## 0.2.1

### Patch Changes

- Fixed Daytona sandbox reconnection with newer Daytona SDK releases. Existing sandboxes now reconnect more reliably across stop/start cycles and process restarts. ([#14667](https://github.com/mastra-ai/mastra/pull/14667))

- Updated dependencies [[`dc514a8`](https://github.com/mastra-ai/mastra/commit/dc514a83dba5f719172dddfd2c7b858e4943d067), [`e333b77`](https://github.com/mastra-ai/mastra/commit/e333b77e2d76ba57ccec1818e08cebc1993469ff), [`dc9fc19`](https://github.com/mastra-ai/mastra/commit/dc9fc19da4437f6b508cc355f346a8856746a76b), [`60a224d`](https://github.com/mastra-ai/mastra/commit/60a224dd497240e83698cfa5bfd02e3d1d854844), [`fbf22a7`](https://github.com/mastra-ai/mastra/commit/fbf22a7ad86bcb50dcf30459f0d075e51ddeb468), [`f16d92c`](https://github.com/mastra-ai/mastra/commit/f16d92c677a119a135cebcf7e2b9f51ada7a9df4), [`949b7bf`](https://github.com/mastra-ai/mastra/commit/949b7bfd4e40f2b2cba7fef5eb3f108a02cfe938), [`404fea1`](https://github.com/mastra-ai/mastra/commit/404fea13042181f0b0c73a101392ac87c79ceae2), [`ebf5047`](https://github.com/mastra-ai/mastra/commit/ebf5047e825c38a1a356f10b214c1d4260dfcd8d), [`12c647c`](https://github.com/mastra-ai/mastra/commit/12c647cf3a26826eb72d40b42e3c8356ceae16ed), [`d084b66`](https://github.com/mastra-ai/mastra/commit/d084b6692396057e83c086b954c1857d20b58a14), [`79c699a`](https://github.com/mastra-ai/mastra/commit/79c699acf3cd8a77e11c55530431f48eb48456e9), [`62757b6`](https://github.com/mastra-ai/mastra/commit/62757b6db6e8bb86569d23ad0b514178f57053f8), [`675f15b`](https://github.com/mastra-ai/mastra/commit/675f15b7eaeea649158d228ea635be40480c584d), [`b174c63`](https://github.com/mastra-ai/mastra/commit/b174c63a093108d4e53b9bc89a078d9f66202b3f), [`819f03c`](https://github.com/mastra-ai/mastra/commit/819f03c25823373b32476413bd76be28a5d8705a), [`04160ee`](https://github.com/mastra-ai/mastra/commit/04160eedf3130003cf842ad08428c8ff69af4cc1), [`2c27503`](https://github.com/mastra-ai/mastra/commit/2c275032510d131d2cde47f99953abf0fe02c081), [`424a1df`](https://github.com/mastra-ai/mastra/commit/424a1df7bee59abb5c83717a54807fdd674a6224), [`3d70b0b`](https://github.com/mastra-ai/mastra/commit/3d70b0b3524d817173ad870768f259c06d61bd23), [`eef7cb2`](https://github.com/mastra-ai/mastra/commit/eef7cb2abe7ef15951e2fdf792a5095c6c643333), [`260fe12`](https://github.com/mastra-ai/mastra/commit/260fe1295fe7354e39d6def2775e0797a7a277f0), [`12c88a6`](https://github.com/mastra-ai/mastra/commit/12c88a6e32bf982c2fe0c6af62e65a3414519a75), [`43595bf`](https://github.com/mastra-ai/mastra/commit/43595bf7b8df1a6edce7a23b445b5124d2a0b473), [`78670e9`](https://github.com/mastra-ai/mastra/commit/78670e97e76d7422cf7025faf371b2aeafed860d), [`e8a5b0b`](https://github.com/mastra-ai/mastra/commit/e8a5b0b9bc94d12dee4150095512ca27a288d778), [`3b45a13`](https://github.com/mastra-ai/mastra/commit/3b45a138d09d040779c0aba1edbbfc1b57442d23), [`d400e7c`](https://github.com/mastra-ai/mastra/commit/d400e7c8b8d7afa6ba2c71769eace4048e3cef8e), [`f58d1a7`](https://github.com/mastra-ai/mastra/commit/f58d1a7a457588a996c3ecb53201a68f3d28c432), [`a49a929`](https://github.com/mastra-ai/mastra/commit/a49a92904968b4fc67e01effee8c7c8d0464ba85), [`8127d96`](https://github.com/mastra-ai/mastra/commit/8127d96280492e335d49b244501088dfdd59a8f1)]:
  - @mastra/core@1.18.0

## 0.2.1-alpha.0

### Patch Changes

- Fixed Daytona sandbox reconnection with newer Daytona SDK releases. Existing sandboxes now reconnect more reliably across stop/start cycles and process restarts. ([#14667](https://github.com/mastra-ai/mastra/pull/14667))

- Updated dependencies [[`dc514a8`](https://github.com/mastra-ai/mastra/commit/dc514a83dba5f719172dddfd2c7b858e4943d067), [`404fea1`](https://github.com/mastra-ai/mastra/commit/404fea13042181f0b0c73a101392ac87c79ceae2), [`ebf5047`](https://github.com/mastra-ai/mastra/commit/ebf5047e825c38a1a356f10b214c1d4260dfcd8d), [`675f15b`](https://github.com/mastra-ai/mastra/commit/675f15b7eaeea649158d228ea635be40480c584d), [`b174c63`](https://github.com/mastra-ai/mastra/commit/b174c63a093108d4e53b9bc89a078d9f66202b3f), [`eef7cb2`](https://github.com/mastra-ai/mastra/commit/eef7cb2abe7ef15951e2fdf792a5095c6c643333), [`e8a5b0b`](https://github.com/mastra-ai/mastra/commit/e8a5b0b9bc94d12dee4150095512ca27a288d778)]:
  - @mastra/core@1.18.0-alpha.0

## 0.2.0

### Minor Changes

- Added provider-specific `daytona` getter to access the underlying Daytona `Sandbox` instance directly. Deprecated the generic `instance` getter in favor of the new `daytona` getter for better IDE discoverability and consistency with other sandbox providers. ([#14166](https://github.com/mastra-ai/mastra/pull/14166))

  ```typescript
  // Before
  const daytonaSandbox = sandbox.instance;

  // After
  const daytonaSandbox = sandbox.daytona;
  ```

### Patch Changes

- Improved Daytona process handling to use provider session IDs directly as `ProcessHandle.pid`. ([#13591](https://github.com/mastra-ai/mastra/pull/13591))

  ```typescript
  const handle = await sandbox.processes.spawn('node server.js');
  await sandbox.processes.get(handle.pid);
  ```

- Fixed sandbox reconnection when Daytona sandbox is externally stopped or times out due to inactivity. Previously, the error thrown by the Daytona SDK (e.g. "failed to resolve container IP") did not match the known dead-sandbox patterns, so the automatic retry logic would not trigger and the error would propagate to the user. Added two new error patterns to correctly detect stopped sandboxes and trigger automatic recovery. ([#14175](https://github.com/mastra-ai/mastra/pull/14175))

- dependencies updates: ([#13591](https://github.com/mastra-ai/mastra/pull/13591))
  - Updated peerDependency `@mastra/core` to `>=1.12.0-0 <2.0.0-0`
- Updated dependencies [[`cddf895`](https://github.com/mastra-ai/mastra/commit/cddf895532b8ee7f9fa814136ec672f53d37a9ba), [`9cede11`](https://github.com/mastra-ai/mastra/commit/9cede110abac9d93072e0521bb3c8bcafb9fdadf), [`a59f126`](https://github.com/mastra-ai/mastra/commit/a59f1269104f54726699c5cdb98c72c93606d2df), [`ed8fd75`](https://github.com/mastra-ai/mastra/commit/ed8fd75cbff03bb5e19971ddb30ab7040fc60447), [`c510833`](https://github.com/mastra-ai/mastra/commit/c5108333e8cbc19dafee5f8bfefbcb5ee935335c), [`c4c7dad`](https://github.com/mastra-ai/mastra/commit/c4c7dadfe2e4584f079f6c24bfabdb8c4981827f), [`45c3112`](https://github.com/mastra-ai/mastra/commit/45c31122666a0cc56b94727099fcb1871ed1b3f6), [`7296fcc`](https://github.com/mastra-ai/mastra/commit/7296fcc599c876a68699a71c7054a16d5aaf2337), [`00c27f9`](https://github.com/mastra-ai/mastra/commit/00c27f9080731433230a61be69c44e39a7a7b4c7), [`5e7c287`](https://github.com/mastra-ai/mastra/commit/5e7c28701f2bce795dd5c811e4c3060bf2ea2242), [`7e17d3f`](https://github.com/mastra-ai/mastra/commit/7e17d3f656fdda2aad47c4beb8c491636d70820c), [`ee19c9b`](https://github.com/mastra-ai/mastra/commit/ee19c9ba3ec3ed91feb214ad539bdc766c53bb01)]:
  - @mastra/core@1.12.0

## 0.2.0-alpha.0

### Minor Changes

- Added provider-specific `daytona` getter to access the underlying Daytona `Sandbox` instance directly. Deprecated the generic `instance` getter in favor of the new `daytona` getter for better IDE discoverability and consistency with other sandbox providers. ([#14166](https://github.com/mastra-ai/mastra/pull/14166))

  ```typescript
  // Before
  const daytonaSandbox = sandbox.instance;

  // After
  const daytonaSandbox = sandbox.daytona;
  ```

### Patch Changes

- Improved Daytona process handling to use provider session IDs directly as `ProcessHandle.pid`. ([#13591](https://github.com/mastra-ai/mastra/pull/13591))

  ```typescript
  const handle = await sandbox.processes.spawn('node server.js');
  await sandbox.processes.get(handle.pid);
  ```

- Fixed sandbox reconnection when Daytona sandbox is externally stopped or times out due to inactivity. Previously, the error thrown by the Daytona SDK (e.g. "failed to resolve container IP") did not match the known dead-sandbox patterns, so the automatic retry logic would not trigger and the error would propagate to the user. Added two new error patterns to correctly detect stopped sandboxes and trigger automatic recovery. ([#14175](https://github.com/mastra-ai/mastra/pull/14175))

- dependencies updates: ([#13591](https://github.com/mastra-ai/mastra/pull/13591))
  - Updated peerDependency `@mastra/core` to `>=1.12.0-0 <2.0.0-0`
- Updated dependencies [[`9cede11`](https://github.com/mastra-ai/mastra/commit/9cede110abac9d93072e0521bb3c8bcafb9fdadf), [`a59f126`](https://github.com/mastra-ai/mastra/commit/a59f1269104f54726699c5cdb98c72c93606d2df), [`c510833`](https://github.com/mastra-ai/mastra/commit/c5108333e8cbc19dafee5f8bfefbcb5ee935335c), [`7296fcc`](https://github.com/mastra-ai/mastra/commit/7296fcc599c876a68699a71c7054a16d5aaf2337), [`00c27f9`](https://github.com/mastra-ai/mastra/commit/00c27f9080731433230a61be69c44e39a7a7b4c7), [`ee19c9b`](https://github.com/mastra-ai/mastra/commit/ee19c9ba3ec3ed91feb214ad539bdc766c53bb01)]:
  - @mastra/core@1.12.0-alpha.1

## 0.1.0

### Minor Changes

- Add DaytonaSandbox workspace provider — Daytona cloud sandbox integration for Mastra workspaces, implementing the WorkspaceSandbox interface with support for command execution, environment variables, resource configuration, snapshots, and Daytona volumes. ([#13112](https://github.com/mastra-ai/mastra/pull/13112))

  **Basic usage**

  ```ts
  import { Workspace } from '@mastra/core/workspace';
  import { DaytonaSandbox } from '@mastra/daytona';

  const sandbox = new DaytonaSandbox({
    id: 'my-sandbox',
    env: { NODE_ENV: 'production' },
  });

  const workspace = new Workspace({ sandbox });
  await workspace.init();

  const result = await workspace.sandbox.executeCommand('echo', ['Hello!']);
  console.log(result.stdout); // "Hello!"

  await workspace.destroy();
  ```

- Added S3 and GCS cloud filesystem mounting support via FUSE (s3fs-fuse, gcsfuse). Daytona sandboxes can now mount cloud storage as local directories, matching the mount capabilities of E2B and Blaxel providers. ([#13544](https://github.com/mastra-ai/mastra/pull/13544))

  **New methods:**
  - `mount(filesystem, mountPath)` — Mount an S3 or GCS filesystem at a path in the sandbox
  - `unmount(mountPath)` — Unmount a previously mounted filesystem

  **What changed:**
  - Added S3 and GCS bucket mounts as local directories in Daytona sandboxes.
  - Improved reconnect behavior so mounts are restored reliably.
  - Added safety checks to prevent mounting into non-empty directories.
  - Improved concurrent mount support by isolating credentials per mount.

  **Usage:**

  ```typescript
  import { Workspace } from '@mastra/core/workspace';
  import { S3Filesystem } from '@mastra/s3';
  import { DaytonaSandbox } from '@mastra/daytona';

  const workspace = new Workspace({
    mounts: {
      '/data': new S3Filesystem({
        bucket: 'my-bucket',
        region: 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }),
    },
    sandbox: new DaytonaSandbox(),
  });
  ```

### Patch Changes

- Remove internal `processes` field from sandbox provider options ([#13597](https://github.com/mastra-ai/mastra/pull/13597))

  The `processes` field is no longer exposed in constructor options for E2B, Daytona, and Blaxel sandbox providers. This field is managed internally and was not intended to be user-configurable.

- Improved S3/GCS FUSE mounting reliability and sandbox reconnection. ([#13543](https://github.com/mastra-ai/mastra/pull/13543))

  **Mounting improvements**
  - Replaced direct SDK coupling in mount helpers with callback-based context, making mount operations more testable and resilient
  - Added tmpfs overlay to handle FUSE-on-FUSE remount scenarios that previously failed with ENOENT
  - Added `mount --move` fallback when standard FUSE unmount fails on stuck mounts
  - `stop()` now unmounts all filesystems before stopping the sandbox
  - Added early connectivity check for GCS mounting that detects Daytona's restricted internet tiers and fails fast with an actionable error message instead of hanging
  - Improved gcsfuse installation with distro-aware codename detection (bookworm for Debian, jammy for Ubuntu)
  - Added input validation for bucket names, endpoints, and credentials before interpolating into shell commands

  **Reconnection improvements**
  - `findExistingSandbox` now looks up sandboxes by name first (works for stopped sandboxes), then falls back to label search
  - Added transitional state handling that polls and waits when a sandbox is starting/stopping/restoring before attempting to start it, avoiding "State change in progress" errors

- Sandbox instructions no longer include a working directory path, keeping instructions stable across sessions. ([#13520](https://github.com/mastra-ai/mastra/pull/13520))

- Updated dependencies [[`504fc8b`](https://github.com/mastra-ai/mastra/commit/504fc8b9d0ddab717577ad3bf9c95ea4bd5377bd), [`f9c150b`](https://github.com/mastra-ai/mastra/commit/f9c150b7595ad05ad9cc9a11098e2944361e8c22), [`88de7e8`](https://github.com/mastra-ai/mastra/commit/88de7e8dfe4b7e1951a9e441bb33136e705ce24e), [`edee4b3`](https://github.com/mastra-ai/mastra/commit/edee4b37dff0af515fc7cc0e8d71ee39e6a762f0), [`3790c75`](https://github.com/mastra-ai/mastra/commit/3790c7578cc6a47d854eb12d89e6b1912867fe29), [`e7a235b`](https://github.com/mastra-ai/mastra/commit/e7a235be6472e0c870ed6c791ddb17c492dc188b), [`d51d298`](https://github.com/mastra-ai/mastra/commit/d51d298953967aab1f58ec965b644d109214f085), [`6dbeeb9`](https://github.com/mastra-ai/mastra/commit/6dbeeb94a8b1eebb727300d1a98961f882180794), [`d5f0d8d`](https://github.com/mastra-ai/mastra/commit/d5f0d8d6a03e515ddaa9b5da19b7e44b8357b07b), [`09c3b18`](https://github.com/mastra-ai/mastra/commit/09c3b1802ff14e243a8a8baea327440bc8cc2e32), [`b896379`](https://github.com/mastra-ai/mastra/commit/b8963791c6afa79484645fcec596a201f936b9a2), [`85c84eb`](https://github.com/mastra-ai/mastra/commit/85c84ebb78aebfcba9d209c8e152b16d7a00cb71), [`a89272a`](https://github.com/mastra-ai/mastra/commit/a89272a5d71939b9fcd284e6a6dc1dd091a6bdcf), [`ee9c8df`](https://github.com/mastra-ai/mastra/commit/ee9c8df644f19d055af5f496bf4942705f5a47b7), [`77b4a25`](https://github.com/mastra-ai/mastra/commit/77b4a254e51907f8ff3a3ba95596a18e93ae4b35), [`276246e`](https://github.com/mastra-ai/mastra/commit/276246e0b9066a1ea48bbc70df84dbe528daaf99), [`08ecfdb`](https://github.com/mastra-ai/mastra/commit/08ecfdbdad6fb8285deef86a034bdf4a6047cfca), [`d5f628c`](https://github.com/mastra-ai/mastra/commit/d5f628ca86c6f6f3ff1035d52f635df32dd81cab), [`524c0f3`](https://github.com/mastra-ai/mastra/commit/524c0f3c434c3d9d18f66338dcef383d6161b59c), [`c18a0e9`](https://github.com/mastra-ai/mastra/commit/c18a0e9cef1e4ca004b2963d35e4cfc031971eac), [`4bd21ea`](https://github.com/mastra-ai/mastra/commit/4bd21ea43d44d0a0427414fc047577f9f0aa3bec), [`115a7a4`](https://github.com/mastra-ai/mastra/commit/115a7a47db5e9896fec12ae6507501adb9ec89bf), [`22a48ae`](https://github.com/mastra-ai/mastra/commit/22a48ae2513eb54d8d79dad361fddbca97a155e8), [`3c6ef79`](https://github.com/mastra-ai/mastra/commit/3c6ef798481e00d6d22563be2de98818fd4dd5e0), [`9311c17`](https://github.com/mastra-ai/mastra/commit/9311c17d7a0640d9c4da2e71b814dc67c57c6369), [`7edf78f`](https://github.com/mastra-ai/mastra/commit/7edf78f80422c43e84585f08ba11df0d4d0b73c5), [`1c4221c`](https://github.com/mastra-ai/mastra/commit/1c4221cf6032ec98d0e094d4ee11da3e48490d96), [`d25b9ea`](https://github.com/mastra-ai/mastra/commit/d25b9eabd400167255a97b690ffbc4ee4097ded5), [`fe1ce5c`](https://github.com/mastra-ai/mastra/commit/fe1ce5c9211c03d561606fda95cbfe7df1d9a9b5), [`b03c0e0`](https://github.com/mastra-ai/mastra/commit/b03c0e0389a799523929a458b0509c9e4244d562), [`0a8366b`](https://github.com/mastra-ai/mastra/commit/0a8366b0a692fcdde56c4d526e4cf03c502ae4ac), [`85664e9`](https://github.com/mastra-ai/mastra/commit/85664e9fd857320fbc245e301f764f45f66f32a3), [`bc79650`](https://github.com/mastra-ai/mastra/commit/bc796500c6e0334faa158a96077e3fb332274869), [`9257d01`](https://github.com/mastra-ai/mastra/commit/9257d01d1366d81f84c582fe02b5e200cf9621f4), [`3a3a59e`](https://github.com/mastra-ai/mastra/commit/3a3a59e8ffaa6a985fe3d9a126a3f5ade11a6724), [`3108d4e`](https://github.com/mastra-ai/mastra/commit/3108d4e649c9fddbf03253a6feeb388a5fa9fa5a), [`0c33b2c`](https://github.com/mastra-ai/mastra/commit/0c33b2c9db537f815e1c59e2c898ffce2e395a79), [`191e5bd`](https://github.com/mastra-ai/mastra/commit/191e5bd29b82f5bda35243945790da7bc7b695c2), [`f77cd94`](https://github.com/mastra-ai/mastra/commit/f77cd94c44eabed490384e7d19232a865e13214c), [`e8135c7`](https://github.com/mastra-ai/mastra/commit/e8135c7e300dac5040670eec7eab896ac6092e30), [`daca48f`](https://github.com/mastra-ai/mastra/commit/daca48f0fb17b7ae0b62a2ac40cf0e491b2fd0b7), [`257d14f`](https://github.com/mastra-ai/mastra/commit/257d14faca5931f2e4186fc165b6f0b1f915deee), [`352f25d`](https://github.com/mastra-ai/mastra/commit/352f25da316b24cdd5b410fd8dddf6a8b763da2a), [`93477d0`](https://github.com/mastra-ai/mastra/commit/93477d0769b8a13ea5ed73d508d967fb23eaeed9), [`31c78b3`](https://github.com/mastra-ai/mastra/commit/31c78b3eb28f58a8017f1dcc795c33214d87feac), [`0bc0720`](https://github.com/mastra-ai/mastra/commit/0bc07201095791858087cc56f353fcd65e87ab54), [`36516ac`](https://github.com/mastra-ai/mastra/commit/36516aca1021cbeb42e74751b46a2614101f37c8), [`e947652`](https://github.com/mastra-ai/mastra/commit/e9476527fdecb4449e54570e80dfaf8466901254), [`3c6ef79`](https://github.com/mastra-ai/mastra/commit/3c6ef798481e00d6d22563be2de98818fd4dd5e0), [`9257d01`](https://github.com/mastra-ai/mastra/commit/9257d01d1366d81f84c582fe02b5e200cf9621f4), [`ec248f6`](https://github.com/mastra-ai/mastra/commit/ec248f6b56e8a037c066c49b2178e2507471d988)]:
  - @mastra/core@1.9.0

## 0.1.0-alpha.0

### Minor Changes

- Add DaytonaSandbox workspace provider — Daytona cloud sandbox integration for Mastra workspaces, implementing the WorkspaceSandbox interface with support for command execution, environment variables, resource configuration, snapshots, and Daytona volumes. ([#13112](https://github.com/mastra-ai/mastra/pull/13112))

  **Basic usage**

  ```ts
  import { Workspace } from '@mastra/core/workspace';
  import { DaytonaSandbox } from '@mastra/daytona';

  const sandbox = new DaytonaSandbox({
    id: 'my-sandbox',
    env: { NODE_ENV: 'production' },
  });

  const workspace = new Workspace({ sandbox });
  await workspace.init();

  const result = await workspace.sandbox.executeCommand('echo', ['Hello!']);
  console.log(result.stdout); // "Hello!"

  await workspace.destroy();
  ```

- Added S3 and GCS cloud filesystem mounting support via FUSE (s3fs-fuse, gcsfuse). Daytona sandboxes can now mount cloud storage as local directories, matching the mount capabilities of E2B and Blaxel providers. ([#13544](https://github.com/mastra-ai/mastra/pull/13544))

  **New methods:**
  - `mount(filesystem, mountPath)` — Mount an S3 or GCS filesystem at a path in the sandbox
  - `unmount(mountPath)` — Unmount a previously mounted filesystem

  **What changed:**
  - Added S3 and GCS bucket mounts as local directories in Daytona sandboxes.
  - Improved reconnect behavior so mounts are restored reliably.
  - Added safety checks to prevent mounting into non-empty directories.
  - Improved concurrent mount support by isolating credentials per mount.

  **Usage:**

  ```typescript
  import { Workspace } from '@mastra/core/workspace';
  import { S3Filesystem } from '@mastra/s3';
  import { DaytonaSandbox } from '@mastra/daytona';

  const workspace = new Workspace({
    mounts: {
      '/data': new S3Filesystem({
        bucket: 'my-bucket',
        region: 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }),
    },
    sandbox: new DaytonaSandbox(),
  });
  ```

### Patch Changes

- Remove internal `processes` field from sandbox provider options ([#13597](https://github.com/mastra-ai/mastra/pull/13597))

  The `processes` field is no longer exposed in constructor options for E2B, Daytona, and Blaxel sandbox providers. This field is managed internally and was not intended to be user-configurable.

- Improved S3/GCS FUSE mounting reliability and sandbox reconnection. ([#13543](https://github.com/mastra-ai/mastra/pull/13543))

  **Mounting improvements**
  - Replaced direct SDK coupling in mount helpers with callback-based context, making mount operations more testable and resilient
  - Added tmpfs overlay to handle FUSE-on-FUSE remount scenarios that previously failed with ENOENT
  - Added `mount --move` fallback when standard FUSE unmount fails on stuck mounts
  - `stop()` now unmounts all filesystems before stopping the sandbox
  - Added early connectivity check for GCS mounting that detects Daytona's restricted internet tiers and fails fast with an actionable error message instead of hanging
  - Improved gcsfuse installation with distro-aware codename detection (bookworm for Debian, jammy for Ubuntu)
  - Added input validation for bucket names, endpoints, and credentials before interpolating into shell commands

  **Reconnection improvements**
  - `findExistingSandbox` now looks up sandboxes by name first (works for stopped sandboxes), then falls back to label search
  - Added transitional state handling that polls and waits when a sandbox is starting/stopping/restoring before attempting to start it, avoiding "State change in progress" errors

- Sandbox instructions no longer include a working directory path, keeping instructions stable across sessions. ([#13520](https://github.com/mastra-ai/mastra/pull/13520))

- Updated dependencies [[`504fc8b`](https://github.com/mastra-ai/mastra/commit/504fc8b9d0ddab717577ad3bf9c95ea4bd5377bd), [`f9c150b`](https://github.com/mastra-ai/mastra/commit/f9c150b7595ad05ad9cc9a11098e2944361e8c22), [`88de7e8`](https://github.com/mastra-ai/mastra/commit/88de7e8dfe4b7e1951a9e441bb33136e705ce24e), [`edee4b3`](https://github.com/mastra-ai/mastra/commit/edee4b37dff0af515fc7cc0e8d71ee39e6a762f0), [`3790c75`](https://github.com/mastra-ai/mastra/commit/3790c7578cc6a47d854eb12d89e6b1912867fe29), [`e7a235b`](https://github.com/mastra-ai/mastra/commit/e7a235be6472e0c870ed6c791ddb17c492dc188b), [`d51d298`](https://github.com/mastra-ai/mastra/commit/d51d298953967aab1f58ec965b644d109214f085), [`6dbeeb9`](https://github.com/mastra-ai/mastra/commit/6dbeeb94a8b1eebb727300d1a98961f882180794), [`d5f0d8d`](https://github.com/mastra-ai/mastra/commit/d5f0d8d6a03e515ddaa9b5da19b7e44b8357b07b), [`09c3b18`](https://github.com/mastra-ai/mastra/commit/09c3b1802ff14e243a8a8baea327440bc8cc2e32), [`b896379`](https://github.com/mastra-ai/mastra/commit/b8963791c6afa79484645fcec596a201f936b9a2), [`85c84eb`](https://github.com/mastra-ai/mastra/commit/85c84ebb78aebfcba9d209c8e152b16d7a00cb71), [`a89272a`](https://github.com/mastra-ai/mastra/commit/a89272a5d71939b9fcd284e6a6dc1dd091a6bdcf), [`ee9c8df`](https://github.com/mastra-ai/mastra/commit/ee9c8df644f19d055af5f496bf4942705f5a47b7), [`77b4a25`](https://github.com/mastra-ai/mastra/commit/77b4a254e51907f8ff3a3ba95596a18e93ae4b35), [`276246e`](https://github.com/mastra-ai/mastra/commit/276246e0b9066a1ea48bbc70df84dbe528daaf99), [`08ecfdb`](https://github.com/mastra-ai/mastra/commit/08ecfdbdad6fb8285deef86a034bdf4a6047cfca), [`d5f628c`](https://github.com/mastra-ai/mastra/commit/d5f628ca86c6f6f3ff1035d52f635df32dd81cab), [`524c0f3`](https://github.com/mastra-ai/mastra/commit/524c0f3c434c3d9d18f66338dcef383d6161b59c), [`c18a0e9`](https://github.com/mastra-ai/mastra/commit/c18a0e9cef1e4ca004b2963d35e4cfc031971eac), [`4bd21ea`](https://github.com/mastra-ai/mastra/commit/4bd21ea43d44d0a0427414fc047577f9f0aa3bec), [`115a7a4`](https://github.com/mastra-ai/mastra/commit/115a7a47db5e9896fec12ae6507501adb9ec89bf), [`22a48ae`](https://github.com/mastra-ai/mastra/commit/22a48ae2513eb54d8d79dad361fddbca97a155e8), [`3c6ef79`](https://github.com/mastra-ai/mastra/commit/3c6ef798481e00d6d22563be2de98818fd4dd5e0), [`9311c17`](https://github.com/mastra-ai/mastra/commit/9311c17d7a0640d9c4da2e71b814dc67c57c6369), [`7edf78f`](https://github.com/mastra-ai/mastra/commit/7edf78f80422c43e84585f08ba11df0d4d0b73c5), [`1c4221c`](https://github.com/mastra-ai/mastra/commit/1c4221cf6032ec98d0e094d4ee11da3e48490d96), [`d25b9ea`](https://github.com/mastra-ai/mastra/commit/d25b9eabd400167255a97b690ffbc4ee4097ded5), [`fe1ce5c`](https://github.com/mastra-ai/mastra/commit/fe1ce5c9211c03d561606fda95cbfe7df1d9a9b5), [`b03c0e0`](https://github.com/mastra-ai/mastra/commit/b03c0e0389a799523929a458b0509c9e4244d562), [`0a8366b`](https://github.com/mastra-ai/mastra/commit/0a8366b0a692fcdde56c4d526e4cf03c502ae4ac), [`85664e9`](https://github.com/mastra-ai/mastra/commit/85664e9fd857320fbc245e301f764f45f66f32a3), [`bc79650`](https://github.com/mastra-ai/mastra/commit/bc796500c6e0334faa158a96077e3fb332274869), [`9257d01`](https://github.com/mastra-ai/mastra/commit/9257d01d1366d81f84c582fe02b5e200cf9621f4), [`3a3a59e`](https://github.com/mastra-ai/mastra/commit/3a3a59e8ffaa6a985fe3d9a126a3f5ade11a6724), [`3108d4e`](https://github.com/mastra-ai/mastra/commit/3108d4e649c9fddbf03253a6feeb388a5fa9fa5a), [`0c33b2c`](https://github.com/mastra-ai/mastra/commit/0c33b2c9db537f815e1c59e2c898ffce2e395a79), [`191e5bd`](https://github.com/mastra-ai/mastra/commit/191e5bd29b82f5bda35243945790da7bc7b695c2), [`f77cd94`](https://github.com/mastra-ai/mastra/commit/f77cd94c44eabed490384e7d19232a865e13214c), [`e8135c7`](https://github.com/mastra-ai/mastra/commit/e8135c7e300dac5040670eec7eab896ac6092e30), [`daca48f`](https://github.com/mastra-ai/mastra/commit/daca48f0fb17b7ae0b62a2ac40cf0e491b2fd0b7), [`257d14f`](https://github.com/mastra-ai/mastra/commit/257d14faca5931f2e4186fc165b6f0b1f915deee), [`352f25d`](https://github.com/mastra-ai/mastra/commit/352f25da316b24cdd5b410fd8dddf6a8b763da2a), [`93477d0`](https://github.com/mastra-ai/mastra/commit/93477d0769b8a13ea5ed73d508d967fb23eaeed9), [`31c78b3`](https://github.com/mastra-ai/mastra/commit/31c78b3eb28f58a8017f1dcc795c33214d87feac), [`0bc0720`](https://github.com/mastra-ai/mastra/commit/0bc07201095791858087cc56f353fcd65e87ab54), [`36516ac`](https://github.com/mastra-ai/mastra/commit/36516aca1021cbeb42e74751b46a2614101f37c8), [`e947652`](https://github.com/mastra-ai/mastra/commit/e9476527fdecb4449e54570e80dfaf8466901254), [`3c6ef79`](https://github.com/mastra-ai/mastra/commit/3c6ef798481e00d6d22563be2de98818fd4dd5e0), [`9257d01`](https://github.com/mastra-ai/mastra/commit/9257d01d1366d81f84c582fe02b5e200cf9621f4), [`ec248f6`](https://github.com/mastra-ai/mastra/commit/ec248f6b56e8a037c066c49b2178e2507471d988)]:
  - @mastra/core@1.9.0-alpha.0
