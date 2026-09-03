# @mastra/railway

## 0.8.0

### Minor Changes

- **Added a `workingDirectory` option to `MastraSandboxOptions`, honored by every sandbox provider** ([#22697](https://github.com/mastra-ai/mastra/pull/22697))

  Every sandbox now accepts one instance-level `workingDirectory` option that sets the default directory for command execution and process spawns. A per-command `cwd` always wins over it, and when neither is provided each provider keeps its previous default (E2B home, docker `/workspace`, Vercel serverless `/tmp`, and so on). The effective value is readable through the new `sandbox.workingDirectory` getter.

  ```ts
  const sandbox = new E2BSandbox({ workingDirectory: '/home/user/my-repo' });
  await sandbox.executeCommand('pwd'); // /home/user/my-repo
  await sandbox.executeCommand('pwd', [], { cwd: '/tmp' }); // /tmp
  ```

  Providers that already carried this concept under other names keep those names working as deprecated aliases feeding the same field: `workingDir` on `@mastra/docker` and `@mastra/apple-container`, and `workdir` on `@mastra/modal`. When both the alias and `workingDirectory` are set, `workingDirectory` wins. Use absolute paths: the value is passed to the provider as-is, so `~` and environment variables like `$HOME` are not expanded (except where a provider documents expansion, such as `LocalSandbox` expanding `~`).

### Patch Changes

- Update README to include accurate, up-to-date information ([#22858](https://github.com/mastra-ai/mastra/pull/22858))

- Remove `CHANGELOG.md` from distributed npm files resulting in reduced package size ([#22737](https://github.com/mastra-ai/mastra/pull/22737))

- Updated dependencies [[`3910c77`](https://github.com/mastra-ai/mastra/commit/3910c77413a3058ab270c6dbc74a59bc3cdf67ea), [`decd47d`](https://github.com/mastra-ai/mastra/commit/decd47d0db2a891a6832e226557145b6658b0b19), [`c1d3422`](https://github.com/mastra-ai/mastra/commit/c1d3422e8052a4282e8547df914b6231e5345f01), [`285ce1c`](https://github.com/mastra-ai/mastra/commit/285ce1c1399341a37e76233aa94dbf9f1a41bd5d), [`e983f74`](https://github.com/mastra-ai/mastra/commit/e983f749873189f767f509eb33d1a3596c0f1c74), [`4596348`](https://github.com/mastra-ai/mastra/commit/45963483f4cd2810f0646469916f74266a3dd607), [`7686114`](https://github.com/mastra-ai/mastra/commit/7686114e3802f4cea414377eaf10999524d670fa), [`ea56b1f`](https://github.com/mastra-ai/mastra/commit/ea56b1fa6e0f99673d2f8a5b7dacc8d351507ff7), [`50469b2`](https://github.com/mastra-ai/mastra/commit/50469b2d085fc8550579ca4b741eb359d1705abc), [`5b5e3cc`](https://github.com/mastra-ai/mastra/commit/5b5e3cc006950b0ff9720c5be8396d4c95e8a6ac), [`809e882`](https://github.com/mastra-ai/mastra/commit/809e882ee9c154ac642eaed396163df706db6ae4), [`cedc25d`](https://github.com/mastra-ai/mastra/commit/cedc25d8c2dec005d8b10b6ce2d36feef1162ff0), [`1255235`](https://github.com/mastra-ai/mastra/commit/125523539237c39f84d126d16476093336089c0d), [`2e87ffb`](https://github.com/mastra-ai/mastra/commit/2e87ffbb454cc88bd8a8c022d1e46325e7907482), [`a499422`](https://github.com/mastra-ai/mastra/commit/a499422cd7eccca184cac7b7a684a6199784aa82), [`cf58c86`](https://github.com/mastra-ai/mastra/commit/cf58c86cb48ccc72677bdaa422e43f102683184c), [`a3606a0`](https://github.com/mastra-ai/mastra/commit/a3606a09f3deaeef17caf04b9c6a0d7cd6b80fe6), [`4095752`](https://github.com/mastra-ai/mastra/commit/40957529233d202446ebecab1f59c76e99910230), [`74b21fd`](https://github.com/mastra-ai/mastra/commit/74b21fd9bbe88e770d9acf4e00e01c8bbb7c9e61), [`045c3c7`](https://github.com/mastra-ai/mastra/commit/045c3c78f2129fea5d4467bb26cff2b49788b3d0), [`a3606a0`](https://github.com/mastra-ai/mastra/commit/a3606a09f3deaeef17caf04b9c6a0d7cd6b80fe6), [`449d112`](https://github.com/mastra-ai/mastra/commit/449d1120cc1f9c43a71308a9fd8b178cfb11355f), [`e8aca33`](https://github.com/mastra-ai/mastra/commit/e8aca339dc92c0b60baad3d948a7c48ec9ae106f), [`c5c9ffc`](https://github.com/mastra-ai/mastra/commit/c5c9ffc3b36bdc7b17d6f911be81e28ba02acfad), [`9d3073c`](https://github.com/mastra-ai/mastra/commit/9d3073c230dbff45d58c259d676b2b137afd2ff5), [`19b71cf`](https://github.com/mastra-ai/mastra/commit/19b71cf1de8afe6f69a3171d8a5a28086790e49b), [`2a0ca02`](https://github.com/mastra-ai/mastra/commit/2a0ca021d95e23f1d1c0b5fe858b0b56f71fe0ba), [`ff539f6`](https://github.com/mastra-ai/mastra/commit/ff539f6dc21137fbeb3f0867f07069cbce45c15f), [`9fdb3bc`](https://github.com/mastra-ai/mastra/commit/9fdb3bc0f9bfab5269b4f3045595e62323da5d3a), [`d53a056`](https://github.com/mastra-ai/mastra/commit/d53a05614893e8d1bbfdab50b42c19435e6bd065), [`420052f`](https://github.com/mastra-ai/mastra/commit/420052fcac3fc672be17fe655667dfbdbd35a2cc), [`28ce924`](https://github.com/mastra-ai/mastra/commit/28ce924276eeca492e6a360e5482ed20c2785ef6)]:
  - @mastra/core@1.64.0

## 0.8.0-alpha.1

### Patch Changes

- Update README to include accurate, up-to-date information ([#22858](https://github.com/mastra-ai/mastra/pull/22858))

- Updated dependencies [[`e983f74`](https://github.com/mastra-ai/mastra/commit/e983f749873189f767f509eb33d1a3596c0f1c74), [`cedc25d`](https://github.com/mastra-ai/mastra/commit/cedc25d8c2dec005d8b10b6ce2d36feef1162ff0), [`9fdb3bc`](https://github.com/mastra-ai/mastra/commit/9fdb3bc0f9bfab5269b4f3045595e62323da5d3a)]:
  - @mastra/core@1.64.0-alpha.7

## 0.8.0-alpha.0

### Minor Changes

- **Added a `workingDirectory` option to `MastraSandboxOptions`, honored by every sandbox provider** ([#22697](https://github.com/mastra-ai/mastra/pull/22697))

  Every sandbox now accepts one instance-level `workingDirectory` option that sets the default directory for command execution and process spawns. A per-command `cwd` always wins over it, and when neither is provided each provider keeps its previous default (E2B home, docker `/workspace`, Vercel serverless `/tmp`, and so on). The effective value is readable through the new `sandbox.workingDirectory` getter.

  ```ts
  const sandbox = new E2BSandbox({ workingDirectory: '/home/user/my-repo' });
  await sandbox.executeCommand('pwd'); // /home/user/my-repo
  await sandbox.executeCommand('pwd', [], { cwd: '/tmp' }); // /tmp
  ```

  Providers that already carried this concept under other names keep those names working as deprecated aliases feeding the same field: `workingDir` on `@mastra/docker` and `@mastra/apple-container`, and `workdir` on `@mastra/modal`. When both the alias and `workingDirectory` are set, `workingDirectory` wins. Use absolute paths: the value is passed to the provider as-is, so `~` and environment variables like `$HOME` are not expanded (except where a provider documents expansion, such as `LocalSandbox` expanding `~`).

### Patch Changes

- Remove `CHANGELOG.md` from distributed npm files resulting in reduced package size ([#22737](https://github.com/mastra-ai/mastra/pull/22737))

- Updated dependencies [[`cf58c86`](https://github.com/mastra-ai/mastra/commit/cf58c86cb48ccc72677bdaa422e43f102683184c), [`449d112`](https://github.com/mastra-ai/mastra/commit/449d1120cc1f9c43a71308a9fd8b178cfb11355f), [`2a0ca02`](https://github.com/mastra-ai/mastra/commit/2a0ca021d95e23f1d1c0b5fe858b0b56f71fe0ba), [`ff539f6`](https://github.com/mastra-ai/mastra/commit/ff539f6dc21137fbeb3f0867f07069cbce45c15f), [`420052f`](https://github.com/mastra-ai/mastra/commit/420052fcac3fc672be17fe655667dfbdbd35a2cc), [`28ce924`](https://github.com/mastra-ai/mastra/commit/28ce924276eeca492e6a360e5482ed20c2785ef6)]:
  - @mastra/core@1.64.0-alpha.2

## 0.7.0

### Minor Changes

- Honor the sandbox runtime environment (`setEnv()`/`getEnv()` from `@mastra/core`) in every workspace sandbox provider. Environment variables set after construction now reach subsequent commands on all providers: ([#22250](https://github.com/mastra-ai/mastra/pull/22250))

  - Process-manager-routed providers (E2B, Blaxel, Cloudflare, Daytona, Docker, Modal, Vercel microVM spawns) inherit the merge from the core spawn wrapper; their duplicated per-manager env plumbing is removed.
  - Providers with their own exec transports (AgentCore, Apple Container, Railway, Vercel microVM and serverless `executeCommand`, Platform's private-network, WebSocket lease, and E2B lease paths) now merge `getEnv()` under per-call env.

  Constructor `env` continues to behave as before: it seeds the sandbox runtime environment, and providers that bake env into the VM or container at creation time (Docker, Modal, Railway, Apple Container, Vercel, Platform) still do so. Per-call `env` on `executeCommand` still takes precedence for that command only.

  Removed exported types (minor bump for these two packages): `BlaxelProcessManagerOptions` from `@mastra/blaxel` and `RailwayProcessManagerOptions` from `@mastra/railway`. Both existed only to pass `env` into a process manager constructed by hand; the core spawn wrapper now owns that merge, so the option and its type are gone.

### Patch Changes

- Starting a sandbox now reports whether it created a fresh sandbox or reconnected to an existing one, so an `onStart` handler can run first-time setup only when it's actually needed: ([#21984](https://github.com/mastra-ai/mastra/pull/21984))

  ```typescript
  new E2BSandbox({
    id: 'session-1',
    onStart: async ({ outcome }) => {
      if (outcome === 'created') await cloneRepo();
    },
  });
  ```

- Updated dependencies [[`79f04a7`](https://github.com/mastra-ai/mastra/commit/79f04a7f6c6829da541139f638f2f1d267916e08), [`65edab1`](https://github.com/mastra-ai/mastra/commit/65edab1c233d17b8f163bad12fca410d0e6f16b1), [`1e47b75`](https://github.com/mastra-ai/mastra/commit/1e47b7520cab4cfaa8daed52f17e2e6d14ff7539), [`ab20a38`](https://github.com/mastra-ai/mastra/commit/ab20a38d0275f8d85e0f3833bd87ef487bcc609f), [`fd4d5fe`](https://github.com/mastra-ai/mastra/commit/fd4d5fe4f943699b85db5e74404f190d5a6b8c2a), [`ae8790c`](https://github.com/mastra-ai/mastra/commit/ae8790c4bfaa088d2ab279d1dcc06f326b9fd109), [`2c85f42`](https://github.com/mastra-ai/mastra/commit/2c85f428e04ccd63ea31a7ec80b5b327afdad555), [`11bbeb9`](https://github.com/mastra-ai/mastra/commit/11bbeb9b108ef2264e05acefc6dafb9cbb342921), [`48ef1f1`](https://github.com/mastra-ai/mastra/commit/48ef1f1d24eedafbb07f64e659a81b52b67b8bf6), [`aa3a85d`](https://github.com/mastra-ai/mastra/commit/aa3a85daf094c683bb97efdf4b6a696d2e474af5), [`d29d06f`](https://github.com/mastra-ai/mastra/commit/d29d06fe00bbd35b4571150ea04c59d2ed783c71), [`e6516df`](https://github.com/mastra-ai/mastra/commit/e6516dfcdae4f4ac0e7971d84359a81385ee602f), [`1a485f3`](https://github.com/mastra-ai/mastra/commit/1a485f3538f5ec64d58bd8b5e1e99de0c695c87b), [`0d37487`](https://github.com/mastra-ai/mastra/commit/0d37487d9f349388a3f1cef6a536cf9dcc4b6273), [`8661d7d`](https://github.com/mastra-ai/mastra/commit/8661d7d7179f0a024456aabdd8679bcecd09ac28), [`dbbfeb8`](https://github.com/mastra-ai/mastra/commit/dbbfeb85ec949dc9ebc0755e1ad262e4f5eba8db), [`575e343`](https://github.com/mastra-ai/mastra/commit/575e343900451021d96110916497d334af7bc252), [`0b2a3d1`](https://github.com/mastra-ai/mastra/commit/0b2a3d1783875c5b97b7b36ab3d03d7360e0dde7), [`6bb5d71`](https://github.com/mastra-ai/mastra/commit/6bb5d7193fe9166b219f0fccae17db7a5ae86e65), [`3cc9d00`](https://github.com/mastra-ai/mastra/commit/3cc9d00b2b4333e0377a5e9df5eff92c17ce7630), [`cacb839`](https://github.com/mastra-ai/mastra/commit/cacb8392d9e74189b56d857290b0615f98a2683d), [`57de7d6`](https://github.com/mastra-ai/mastra/commit/57de7d644ba7146edb4e9e6111ec4fa98c3a59e9), [`c8e4cea`](https://github.com/mastra-ai/mastra/commit/c8e4ceac9a390d78c8327dff3cdb2861dd71957f), [`ed01e9a`](https://github.com/mastra-ai/mastra/commit/ed01e9a807514a904374bf687a7b8f18750f6f78), [`b47b26e`](https://github.com/mastra-ai/mastra/commit/b47b26e6fe95cb8a3482be2c5e52de157fe59d0b), [`0d37487`](https://github.com/mastra-ai/mastra/commit/0d37487d9f349388a3f1cef6a536cf9dcc4b6273), [`733a537`](https://github.com/mastra-ai/mastra/commit/733a537489a858b5880b2e98809334fba895a221), [`e8e299c`](https://github.com/mastra-ai/mastra/commit/e8e299cc6abdfc39947e2fec25803493015d3882), [`edfc548`](https://github.com/mastra-ai/mastra/commit/edfc548886bc7bae17b681f8b6b41a47eb32bcd2), [`b05f486`](https://github.com/mastra-ai/mastra/commit/b05f48612984d5fe2447ea2d6cdd5c604d285b97), [`a8a4871`](https://github.com/mastra-ai/mastra/commit/a8a4871215f51da95c47129602157ce5372f634a), [`eb9ecaa`](https://github.com/mastra-ai/mastra/commit/eb9ecaa89c36e889749e3b825cfc507ce7f7980b), [`4ff3ee2`](https://github.com/mastra-ai/mastra/commit/4ff3ee2bff7ed07528b4817f8f49639031c72a4d), [`9207dfa`](https://github.com/mastra-ai/mastra/commit/9207dfab8062e5fc68b751684797ff86fe0b4e70), [`5165cdc`](https://github.com/mastra-ai/mastra/commit/5165cdcdcf50e144bb8113278535196cc9b07065), [`e737014`](https://github.com/mastra-ai/mastra/commit/e737014e0fc7035759762bb5b48baef1d6c0f6a7), [`6bb5d71`](https://github.com/mastra-ai/mastra/commit/6bb5d7193fe9166b219f0fccae17db7a5ae86e65), [`f591643`](https://github.com/mastra-ai/mastra/commit/f591643becdf0be9bddce6ba1748e64bc30d77f1), [`63796ba`](https://github.com/mastra-ai/mastra/commit/63796ba0fda60253be17535e68f6bbbf1e6ffa09), [`b1ad324`](https://github.com/mastra-ai/mastra/commit/b1ad324d657f3544b0701332aef7eb10e9a36258), [`61c566d`](https://github.com/mastra-ai/mastra/commit/61c566dd2f2cde2b23ed8f139924e530d4202214), [`c24754c`](https://github.com/mastra-ai/mastra/commit/c24754c1fb6fe144e5051e536e98c8a18b0214ac), [`12c61d2`](https://github.com/mastra-ai/mastra/commit/12c61d280c8cb208bc3c8dbcbe5dcc60cf9d1cd0), [`c46eb09`](https://github.com/mastra-ai/mastra/commit/c46eb09ce4987509af57a0ac582c61241a6dd2f1), [`9ee8120`](https://github.com/mastra-ai/mastra/commit/9ee8120ce17f76b9f617489e05a283353742690a), [`d975e92`](https://github.com/mastra-ai/mastra/commit/d975e924d4936f46c386bd3dee39c671720289f6), [`45dd6ee`](https://github.com/mastra-ai/mastra/commit/45dd6ee089bd7df0d0c98a10098e483fd388e04a), [`4e9a228`](https://github.com/mastra-ai/mastra/commit/4e9a2283d5fd6ed1b70a2751eb3dc2cbf82ada20), [`d6ce34a`](https://github.com/mastra-ai/mastra/commit/d6ce34aeceb06ddf3d595a1eed5cc74f481a46a1), [`f95f468`](https://github.com/mastra-ai/mastra/commit/f95f468cf1e7c2b924a13826494f98b8f2ccd581), [`30ed33e`](https://github.com/mastra-ai/mastra/commit/30ed33ee14084a26019aba15fceadda6d6ddefaf), [`04a815f`](https://github.com/mastra-ai/mastra/commit/04a815fc8971d29e97fcdcc5008a1eb472fc00ff), [`1cfa878`](https://github.com/mastra-ai/mastra/commit/1cfa8784d8da0dfaa0317e5048bc48b6084a5ea5), [`9a12ef3`](https://github.com/mastra-ai/mastra/commit/9a12ef3fccf3f4186db0f294f4ee1f02cf4d8db2), [`32d3583`](https://github.com/mastra-ai/mastra/commit/32d358332cb8ac2306b83b73cf3536e74dbd435e), [`7960688`](https://github.com/mastra-ai/mastra/commit/7960688828e04eaf3106e34f7758fa580257eef6), [`91ad69d`](https://github.com/mastra-ai/mastra/commit/91ad69d64994c89199b0c55399e64ed91c61df2f), [`8dc408d`](https://github.com/mastra-ai/mastra/commit/8dc408d34438f9e13297f792c11a5cfd6cf952e1), [`c92def1`](https://github.com/mastra-ai/mastra/commit/c92def10a13c822972c96f0a4ca6ffc1f4258aed), [`63041eb`](https://github.com/mastra-ai/mastra/commit/63041eb4c50b520a0a80e03d4cd6ea99f67715a0), [`c118318`](https://github.com/mastra-ai/mastra/commit/c1183181c9804303db4b511c2e2648f8b714712b), [`c5eaec5`](https://github.com/mastra-ai/mastra/commit/c5eaec5a860d80d0e3805e67db0414b87ac8cbed), [`fc07c64`](https://github.com/mastra-ai/mastra/commit/fc07c6465043e08e99193a6751a01c56ffc2e7a1), [`cced745`](https://github.com/mastra-ai/mastra/commit/cced745a056ec2225c5bc702e32d848847aa8b65), [`542dee2`](https://github.com/mastra-ai/mastra/commit/542dee254167f974ff8cbbbfc0ce10f9a2616a7b), [`3c19dce`](https://github.com/mastra-ai/mastra/commit/3c19dcef8e73062a80627a4927eae3ec11145afd), [`aca2869`](https://github.com/mastra-ai/mastra/commit/aca2869b2031982f3c4a2f52525c9be7cf123ef8), [`a58483c`](https://github.com/mastra-ai/mastra/commit/a58483cff1a9d41fce7c931843f48cb0ac450f64), [`a58483c`](https://github.com/mastra-ai/mastra/commit/a58483cff1a9d41fce7c931843f48cb0ac450f64), [`e6f8450`](https://github.com/mastra-ai/mastra/commit/e6f845074d478527026b18d85031b23353e1d0a4), [`895e9df`](https://github.com/mastra-ai/mastra/commit/895e9dfc17d6f34299eca64e317ded9e5f5e5ef8), [`e66b2ba`](https://github.com/mastra-ai/mastra/commit/e66b2ba100db63eaeab6e21e1ea34b113f2ec781), [`3e8727e`](https://github.com/mastra-ai/mastra/commit/3e8727e11ec1a5d733acedb5c872896394be18c1)]:
  - @mastra/core@1.62.0

## 0.7.0-alpha.1

### Patch Changes

- Starting a sandbox now reports whether it created a fresh sandbox or reconnected to an existing one, so an `onStart` handler can run first-time setup only when it's actually needed: ([#21984](https://github.com/mastra-ai/mastra/pull/21984))

  ```typescript
  new E2BSandbox({
    id: 'session-1',
    onStart: async ({ outcome }) => {
      if (outcome === 'created') await cloneRepo();
    },
  });
  ```

- Updated dependencies [[`4ff3ee2`](https://github.com/mastra-ai/mastra/commit/4ff3ee2bff7ed07528b4817f8f49639031c72a4d), [`c24754c`](https://github.com/mastra-ai/mastra/commit/c24754c1fb6fe144e5051e536e98c8a18b0214ac), [`45dd6ee`](https://github.com/mastra-ai/mastra/commit/45dd6ee089bd7df0d0c98a10098e483fd388e04a), [`32d3583`](https://github.com/mastra-ai/mastra/commit/32d358332cb8ac2306b83b73cf3536e74dbd435e), [`aca2869`](https://github.com/mastra-ai/mastra/commit/aca2869b2031982f3c4a2f52525c9be7cf123ef8)]:
  - @mastra/core@1.62.0-alpha.11

## 0.7.0-alpha.0

### Minor Changes

- Honor the sandbox runtime environment (`setEnv()`/`getEnv()` from `@mastra/core`) in every workspace sandbox provider. Environment variables set after construction now reach subsequent commands on all providers: ([#22250](https://github.com/mastra-ai/mastra/pull/22250))

  - Process-manager-routed providers (E2B, Blaxel, Cloudflare, Daytona, Docker, Modal, Vercel microVM spawns) inherit the merge from the core spawn wrapper; their duplicated per-manager env plumbing is removed.
  - Providers with their own exec transports (AgentCore, Apple Container, Railway, Vercel microVM and serverless `executeCommand`, Platform's private-network, WebSocket lease, and E2B lease paths) now merge `getEnv()` under per-call env.

  Constructor `env` continues to behave as before: it seeds the sandbox runtime environment, and providers that bake env into the VM or container at creation time (Docker, Modal, Railway, Apple Container, Vercel, Platform) still do so. Per-call `env` on `executeCommand` still takes precedence for that command only.

  Removed exported types (minor bump for these two packages): `BlaxelProcessManagerOptions` from `@mastra/blaxel` and `RailwayProcessManagerOptions` from `@mastra/railway`. Both existed only to pass `env` into a process manager constructed by hand; the core spawn wrapper now owns that merge, so the option and its type are gone.

### Patch Changes

- Updated dependencies [[`aa3a85d`](https://github.com/mastra-ai/mastra/commit/aa3a85daf094c683bb97efdf4b6a696d2e474af5), [`d29d06f`](https://github.com/mastra-ai/mastra/commit/d29d06fe00bbd35b4571150ea04c59d2ed783c71), [`e6516df`](https://github.com/mastra-ai/mastra/commit/e6516dfcdae4f4ac0e7971d84359a81385ee602f), [`0b2a3d1`](https://github.com/mastra-ai/mastra/commit/0b2a3d1783875c5b97b7b36ab3d03d7360e0dde7), [`6bb5d71`](https://github.com/mastra-ai/mastra/commit/6bb5d7193fe9166b219f0fccae17db7a5ae86e65), [`57de7d6`](https://github.com/mastra-ai/mastra/commit/57de7d644ba7146edb4e9e6111ec4fa98c3a59e9), [`e8e299c`](https://github.com/mastra-ai/mastra/commit/e8e299cc6abdfc39947e2fec25803493015d3882), [`edfc548`](https://github.com/mastra-ai/mastra/commit/edfc548886bc7bae17b681f8b6b41a47eb32bcd2), [`a8a4871`](https://github.com/mastra-ai/mastra/commit/a8a4871215f51da95c47129602157ce5372f634a), [`5165cdc`](https://github.com/mastra-ai/mastra/commit/5165cdcdcf50e144bb8113278535196cc9b07065), [`6bb5d71`](https://github.com/mastra-ai/mastra/commit/6bb5d7193fe9166b219f0fccae17db7a5ae86e65), [`9ee8120`](https://github.com/mastra-ai/mastra/commit/9ee8120ce17f76b9f617489e05a283353742690a), [`d975e92`](https://github.com/mastra-ai/mastra/commit/d975e924d4936f46c386bd3dee39c671720289f6), [`1cfa878`](https://github.com/mastra-ai/mastra/commit/1cfa8784d8da0dfaa0317e5048bc48b6084a5ea5), [`c118318`](https://github.com/mastra-ai/mastra/commit/c1183181c9804303db4b511c2e2648f8b714712b), [`fc07c64`](https://github.com/mastra-ai/mastra/commit/fc07c6465043e08e99193a6751a01c56ffc2e7a1), [`542dee2`](https://github.com/mastra-ai/mastra/commit/542dee254167f974ff8cbbbfc0ce10f9a2616a7b), [`a58483c`](https://github.com/mastra-ai/mastra/commit/a58483cff1a9d41fce7c931843f48cb0ac450f64), [`a58483c`](https://github.com/mastra-ai/mastra/commit/a58483cff1a9d41fce7c931843f48cb0ac450f64), [`895e9df`](https://github.com/mastra-ai/mastra/commit/895e9dfc17d6f34299eca64e317ded9e5f5e5ef8)]:
  - @mastra/core@1.62.0-alpha.8

## 0.6.0

### Minor Changes

- Added `ProcessHandle.closeStdin()` to signal end-of-file to background processes. Local and Docker sandboxes support closing stdin, while providers without an available stdin-close API return a provider-specific unsupported-operation error. Providers signal the unsupported case with the new `UnsupportedStdinCloseError`, and the base class supplies that behavior by default so existing `ProcessHandle` subclasses keep compiling. Calling `handle.writer.end()` also closes stdin, and finishes without an error when the provider cannot close stdin. ([#21606](https://github.com/mastra-ai/mastra/pull/21606))

### Patch Changes

- Added support for booting new Railway sandboxes from a fallback checkpoint while keeping future snapshots isolated to the sandbox's own checkpoint. ([#21803](https://github.com/mastra-ai/mastra/pull/21803))

  ```typescript
  const sandbox = new RailwaySandbox({
    checkpointName: 'session-42',
    seedCheckpointName: 'repo-base',
  });
  ```

- Declared checkpoint support (`supportsCheckpoints`) so checkpoint-based features like warm base checkpoints and boot-from-checkpoint know snapshots are real. ([#21798](https://github.com/mastra-ai/mastra/pull/21798))

  ```ts
  // Gate checkpoint-dependent work on the provider's capability flag.
  if (sandbox.supportsCheckpoints) {
    await sandbox.snapshot(); // persists a checkpoint that can seed a later boot
  }
  ```

- Updated dependencies [[`587f6ef`](https://github.com/mastra-ai/mastra/commit/587f6efcfc25880b93760a8607d1cd381ec612fe), [`7e096f0`](https://github.com/mastra-ai/mastra/commit/7e096f02f0dddbf09b85d306458351245ed2f886), [`d7e6745`](https://github.com/mastra-ai/mastra/commit/d7e67456954863c55440ea9c49bc6ceb9949972d), [`6223446`](https://github.com/mastra-ai/mastra/commit/6223446ddce6166e96e0ba5e00d628b615dee8ca), [`15101bb`](https://github.com/mastra-ai/mastra/commit/15101bb53c0d934f31af6b8813b88191e382a5e5), [`4e7a421`](https://github.com/mastra-ai/mastra/commit/4e7a421dce8a48742f785d1e93ad2f43a572b282), [`c2c3deb`](https://github.com/mastra-ai/mastra/commit/c2c3debcf670c7082d0a5e553aa99818a864698c), [`d8308a2`](https://github.com/mastra-ai/mastra/commit/d8308a2be3c07e777393d1017a381dcae3890d30), [`b0a2a07`](https://github.com/mastra-ai/mastra/commit/b0a2a07800d42bd9823292e7db832374ed084c9c), [`74e5bd3`](https://github.com/mastra-ai/mastra/commit/74e5bd315b8b3a1e04cb6cf480bb0f5fc4951dc8), [`242e324`](https://github.com/mastra-ai/mastra/commit/242e3241e73cbd5c9bb86a31ebb49ca0256488d4), [`217e967`](https://github.com/mastra-ai/mastra/commit/217e9672d8b3160eb729d8e9f0044949e88da239), [`d774e89`](https://github.com/mastra-ai/mastra/commit/d774e8930c781df8c9effe3763e6b501c099b6cc), [`9c27a53`](https://github.com/mastra-ai/mastra/commit/9c27a53cd9d3de4f3f025bc387d94ce371c33f95), [`8f0a332`](https://github.com/mastra-ai/mastra/commit/8f0a3321bf180368d76fe7b36aa1a8f60f00b6de), [`0b4f108`](https://github.com/mastra-ai/mastra/commit/0b4f1089aa8d92e67c2a8e99726822c5ee410784), [`9acb50f`](https://github.com/mastra-ai/mastra/commit/9acb50f71cec9c362f06820033f90ae6b1f8282f), [`46e9e3f`](https://github.com/mastra-ai/mastra/commit/46e9e3f73babe1bc70080a596cf2ac0b9da48519), [`3f9a190`](https://github.com/mastra-ai/mastra/commit/3f9a19057c027155867b9317294ee4ca7bd0581a), [`dff25a1`](https://github.com/mastra-ai/mastra/commit/dff25a1103fa72ee082a9b6f805ebeb5ce400753), [`6db7a5d`](https://github.com/mastra-ai/mastra/commit/6db7a5dd3dd2b6f7ef75dcd804fcffef5fa83963), [`217e967`](https://github.com/mastra-ai/mastra/commit/217e9672d8b3160eb729d8e9f0044949e88da239), [`583e235`](https://github.com/mastra-ai/mastra/commit/583e23519c13af16c1746f9c49722d011216611b), [`b098de9`](https://github.com/mastra-ai/mastra/commit/b098de9d7cb9f672e0883a5c716465a3a689693d), [`e8808e3`](https://github.com/mastra-ai/mastra/commit/e8808e3d8eb585a2565be53e56a7e0e1477352a4), [`a77f8d4`](https://github.com/mastra-ai/mastra/commit/a77f8d4740d2178a74c41e4bf678b4fcd8fa0bb2), [`7f78585`](https://github.com/mastra-ai/mastra/commit/7f785857e401570e2ffb316911f126ed363aa537), [`33374ba`](https://github.com/mastra-ai/mastra/commit/33374ba359e4fb13eaa918ae925fe167a3c55414), [`940bf5c`](https://github.com/mastra-ai/mastra/commit/940bf5ccf04f2c9ebd8a1390431733222a03b1cd), [`c549e2f`](https://github.com/mastra-ai/mastra/commit/c549e2f40edc1cac5d9e74e82f90da22b48df084), [`58c43d3`](https://github.com/mastra-ai/mastra/commit/58c43d3f7cb2eeaeb8ac733ae71dde822348e588), [`ef6e295`](https://github.com/mastra-ai/mastra/commit/ef6e295b59bc25a5b61b633a89c97bcfce9fb465), [`208e1b3`](https://github.com/mastra-ai/mastra/commit/208e1b39f30f4b386e494394e9d71d96f0f90241), [`c938d34`](https://github.com/mastra-ai/mastra/commit/c938d34739936c8ecbabd67ad6a4a4396f41c4c6), [`88ddc7c`](https://github.com/mastra-ai/mastra/commit/88ddc7ce01d40175f13a3228b789a906779680bd), [`f2a4afd`](https://github.com/mastra-ai/mastra/commit/f2a4afd7e37e809669001ed17724b341a5c1f45e), [`d438148`](https://github.com/mastra-ai/mastra/commit/d438148e222c1e2fb3c652725ce75680962ebec4), [`ba05fe0`](https://github.com/mastra-ai/mastra/commit/ba05fe0738f70cb686777546e968237d09269142), [`40d358e`](https://github.com/mastra-ai/mastra/commit/40d358e29d55543803e64b49241122f598ffabc7), [`d26a8d4`](https://github.com/mastra-ai/mastra/commit/d26a8d4281f28414715b333c85bedaf70d0b2890), [`e80cd7e`](https://github.com/mastra-ai/mastra/commit/e80cd7e7683e7d732e1cc6784bcac1d2640d2ce3), [`ccbbcd9`](https://github.com/mastra-ai/mastra/commit/ccbbcd974eedff4367a54ed0e24c9ee742ab2f61), [`1d9a0ea`](https://github.com/mastra-ai/mastra/commit/1d9a0ea4a9901baee6cd56737243bd6d1f631ac0), [`677cdc6`](https://github.com/mastra-ai/mastra/commit/677cdc6af564dec29a13464d12b7ab2a4efc22e9), [`c549e2f`](https://github.com/mastra-ai/mastra/commit/c549e2f40edc1cac5d9e74e82f90da22b48df084), [`a7dd322`](https://github.com/mastra-ai/mastra/commit/a7dd32247d95afc539f483ca37f4594af0387f59), [`3f5c6f7`](https://github.com/mastra-ai/mastra/commit/3f5c6f728ea35da344248de9aa070f12849f3aa0), [`a318490`](https://github.com/mastra-ai/mastra/commit/a318490e17da32f338d50929c770d901a9b3dd72), [`b860493`](https://github.com/mastra-ai/mastra/commit/b86049391100e665d579f700c8a2034c036defc3), [`d4be8c1`](https://github.com/mastra-ai/mastra/commit/d4be8c1739d22d621e3f78790e1dd5eb5ecc3589), [`a5d2eb1`](https://github.com/mastra-ai/mastra/commit/a5d2eb10347eade1ae2816d88f466c25186c54a5), [`3667679`](https://github.com/mastra-ai/mastra/commit/3667679db057edfb086846d13369fdda4902ad65), [`49696e8`](https://github.com/mastra-ai/mastra/commit/49696e8e42f870674a0a58f5abcd22cc54dd2864), [`2ef2f23`](https://github.com/mastra-ai/mastra/commit/2ef2f230a7aed342e7dc3b2000cd42e4c43e08a7), [`763e0c6`](https://github.com/mastra-ai/mastra/commit/763e0c61e04d76ad9a9efd301aa57525ca0cbea9), [`20504b2`](https://github.com/mastra-ai/mastra/commit/20504b2ecebd0e077acda3d457ab57480a98ed3e), [`77e6b1b`](https://github.com/mastra-ai/mastra/commit/77e6b1bc4c46ce94fe501023fb4393c812ec6be3), [`c5f964d`](https://github.com/mastra-ai/mastra/commit/c5f964d3f77064e978f8066ec506eed77ba5c63c), [`23e0be2`](https://github.com/mastra-ai/mastra/commit/23e0be261381e49534b4ff3101c60ee64a946cbf), [`7fc8806`](https://github.com/mastra-ai/mastra/commit/7fc880627d3cbf995d31ea0e8b807bf15417e651), [`0e02eac`](https://github.com/mastra-ai/mastra/commit/0e02eacdb2e30e1697a41910b41163742a181dc1), [`4df174c`](https://github.com/mastra-ai/mastra/commit/4df174c32bddf093a82f273070b8380aef7c9e90), [`f7c25b5`](https://github.com/mastra-ai/mastra/commit/f7c25b5106ddfb48e591f98df7a51e0f2dd01dba), [`7aad631`](https://github.com/mastra-ai/mastra/commit/7aad631b43bc10db77d5b8c66b200d7a49d18bf2), [`512100a`](https://github.com/mastra-ai/mastra/commit/512100a7d8b7e9c920f2590c6b3612f5de0d3cff), [`e81744c`](https://github.com/mastra-ai/mastra/commit/e81744cd13c46619c142dc521dc0baac47607a84), [`f8f653f`](https://github.com/mastra-ai/mastra/commit/f8f653f10980d01a73706cc3c8689ca5e40ce808), [`dc09cc1`](https://github.com/mastra-ai/mastra/commit/dc09cc1083d861cde192c1cd235324dc75b8c731), [`9ef432b`](https://github.com/mastra-ai/mastra/commit/9ef432b6faa534b57b0d182a610e13dd9a7123ff), [`36b4649`](https://github.com/mastra-ai/mastra/commit/36b4649045a3a380cbab8ceca866db4086223aff), [`b9cf308`](https://github.com/mastra-ai/mastra/commit/b9cf30846f97f99ac1906ee8a68f4f2d117b0378), [`2e1d098`](https://github.com/mastra-ai/mastra/commit/2e1d0984e325fd319d32ea182f596b3170be3847), [`377eb81`](https://github.com/mastra-ai/mastra/commit/377eb81ce43b964e3a6b541df172da74a8ff3716), [`1794a79`](https://github.com/mastra-ai/mastra/commit/1794a79178c418004a7261b1ad9114066f7ef01d), [`0cdc5dc`](https://github.com/mastra-ai/mastra/commit/0cdc5dc69024957815da4f51acc4119eb4f447d7), [`5740ec6`](https://github.com/mastra-ai/mastra/commit/5740ec60c760ffdfbfaa59d603d03b847c864e05)]:
  - @mastra/core@1.60.0

## 0.6.0-alpha.2

### Patch Changes

- Added support for booting new Railway sandboxes from a fallback checkpoint while keeping future snapshots isolated to the sandbox's own checkpoint. ([#21803](https://github.com/mastra-ai/mastra/pull/21803))

  ```typescript
  const sandbox = new RailwaySandbox({
    checkpointName: 'session-42',
    seedCheckpointName: 'repo-base',
  });
  ```

- Updated dependencies [[`58c43d3`](https://github.com/mastra-ai/mastra/commit/58c43d3f7cb2eeaeb8ac733ae71dde822348e588)]:
  - @mastra/core@1.60.0-alpha.14

## 0.6.0-alpha.1

### Patch Changes

- Declared checkpoint support (`supportsCheckpoints`) so checkpoint-based features like warm base checkpoints and boot-from-checkpoint know snapshots are real. ([#21798](https://github.com/mastra-ai/mastra/pull/21798))

  ```ts
  // Gate checkpoint-dependent work on the provider's capability flag.
  if (sandbox.supportsCheckpoints) {
    await sandbox.snapshot(); // persists a checkpoint that can seed a later boot
  }
  ```

- Updated dependencies [[`c549e2f`](https://github.com/mastra-ai/mastra/commit/c549e2f40edc1cac5d9e74e82f90da22b48df084), [`c549e2f`](https://github.com/mastra-ai/mastra/commit/c549e2f40edc1cac5d9e74e82f90da22b48df084), [`2ef2f23`](https://github.com/mastra-ai/mastra/commit/2ef2f230a7aed342e7dc3b2000cd42e4c43e08a7), [`5740ec6`](https://github.com/mastra-ai/mastra/commit/5740ec60c760ffdfbfaa59d603d03b847c864e05)]:
  - @mastra/core@1.60.0-alpha.13

## 0.6.0-alpha.0

### Minor Changes

- Added `ProcessHandle.closeStdin()` to signal end-of-file to background processes. Local and Docker sandboxes support closing stdin, while providers without an available stdin-close API return a provider-specific unsupported-operation error. Providers signal the unsupported case with the new `UnsupportedStdinCloseError`, and the base class supplies that behavior by default so existing `ProcessHandle` subclasses keep compiling. Calling `handle.writer.end()` also closes stdin, and finishes without an error when the provider cannot close stdin. ([#21606](https://github.com/mastra-ai/mastra/pull/21606))

### Patch Changes

- Updated dependencies [[`4e7a421`](https://github.com/mastra-ai/mastra/commit/4e7a421dce8a48742f785d1e93ad2f43a572b282), [`242e324`](https://github.com/mastra-ai/mastra/commit/242e3241e73cbd5c9bb86a31ebb49ca0256488d4), [`217e967`](https://github.com/mastra-ai/mastra/commit/217e9672d8b3160eb729d8e9f0044949e88da239), [`d774e89`](https://github.com/mastra-ai/mastra/commit/d774e8930c781df8c9effe3763e6b501c099b6cc), [`9c27a53`](https://github.com/mastra-ai/mastra/commit/9c27a53cd9d3de4f3f025bc387d94ce371c33f95), [`dff25a1`](https://github.com/mastra-ai/mastra/commit/dff25a1103fa72ee082a9b6f805ebeb5ce400753), [`217e967`](https://github.com/mastra-ai/mastra/commit/217e9672d8b3160eb729d8e9f0044949e88da239), [`7f78585`](https://github.com/mastra-ai/mastra/commit/7f785857e401570e2ffb316911f126ed363aa537), [`f2a4afd`](https://github.com/mastra-ai/mastra/commit/f2a4afd7e37e809669001ed17724b341a5c1f45e), [`d438148`](https://github.com/mastra-ai/mastra/commit/d438148e222c1e2fb3c652725ce75680962ebec4), [`ba05fe0`](https://github.com/mastra-ai/mastra/commit/ba05fe0738f70cb686777546e968237d09269142), [`d26a8d4`](https://github.com/mastra-ai/mastra/commit/d26a8d4281f28414715b333c85bedaf70d0b2890), [`677cdc6`](https://github.com/mastra-ai/mastra/commit/677cdc6af564dec29a13464d12b7ab2a4efc22e9), [`a318490`](https://github.com/mastra-ai/mastra/commit/a318490e17da32f338d50929c770d901a9b3dd72), [`763e0c6`](https://github.com/mastra-ai/mastra/commit/763e0c61e04d76ad9a9efd301aa57525ca0cbea9), [`23e0be2`](https://github.com/mastra-ai/mastra/commit/23e0be261381e49534b4ff3101c60ee64a946cbf), [`7fc8806`](https://github.com/mastra-ai/mastra/commit/7fc880627d3cbf995d31ea0e8b807bf15417e651), [`0e02eac`](https://github.com/mastra-ai/mastra/commit/0e02eacdb2e30e1697a41910b41163742a181dc1), [`4df174c`](https://github.com/mastra-ai/mastra/commit/4df174c32bddf093a82f273070b8380aef7c9e90), [`f7c25b5`](https://github.com/mastra-ai/mastra/commit/f7c25b5106ddfb48e591f98df7a51e0f2dd01dba), [`dc09cc1`](https://github.com/mastra-ai/mastra/commit/dc09cc1083d861cde192c1cd235324dc75b8c731), [`36b4649`](https://github.com/mastra-ai/mastra/commit/36b4649045a3a380cbab8ceca866db4086223aff), [`377eb81`](https://github.com/mastra-ai/mastra/commit/377eb81ce43b964e3a6b541df172da74a8ff3716)]:
  - @mastra/core@1.60.0-alpha.8

## 0.5.0

### Minor Changes

- Added `RailwaySandbox.snapshot()` to capture the configured recovery checkpoint. ([#21221](https://github.com/mastra-ai/mastra/pull/21221))

  ```ts
  await sandbox.snapshot();
  ```

### Patch Changes

- Widen `RailwaySandbox.captureCheckpoint()` return type to a discriminated object so callers get the checkpoint name inline instead of having to reach back into the sandbox for it. ([#20877](https://github.com/mastra-ai/mastra/pull/20877))

  Before:

  ```ts
  const outcome = await sandbox.captureCheckpoint(); // 'captured' | 'skipped' | 'coalesced'
  ```

  After:

  ```ts
  const result = await sandbox.captureCheckpoint();
  switch (result.status) {
    case 'captured':
    case 'coalesced':
      await persistBinding({ sessionId, checkpointName: result.checkpointName });
      break;
    case 'skipped':
      // result.reason: 'no-checkpoint-name-configured' | 'sandbox-not-running'
      break;
  }
  ```

  Both `captured` and `coalesced` now carry `checkpointName` — they both represent a successful capture the caller can persist against. `skipped` carries a machine-readable `reason` so the set stays extensible without another breaking return-shape change.

  This is a breaking change to the `captureCheckpoint()` return type introduced in the previous release. The method has no other callers in the OSS packages.

- Refresh Railway sandbox checkpoints 3 minutes before idle destroy instead of 10 seconds, and expose an on-demand `captureCheckpoint()` method ([#20875](https://github.com/mastra-ai/mastra/pull/20875))

  **Wider safety-net margin**

  Extends the pre-reap refresh margin from 10s to 180s so a Cloud Run cold start or scale event during the refresh window doesn't lose the race with Railway's idle destroy. Callers running with an idle timeout shorter than 3 minutes will now see the refresh fire at the 1-second floor almost immediately after start.

  **Public `captureCheckpoint()`**

  Adds a public, on-demand checkpoint capture to `RailwaySandbox` so callers can refresh the recovery checkpoint at semantic moments (turn end, session idle, pre-teardown) instead of waiting for the idle-timer safety net. Concurrent captures coalesce with any in-flight timer-driven refresh, so a single Railway checkpoint quota is consumed per capture window. Returns `'captured' | 'skipped' | 'coalesced'` for observability.

  ```ts
  const sandbox = new RailwaySandbox({ token, checkpointName: 'my-project' });
  await sandbox.start();
  // ... run some work ...
  const outcome = await sandbox.captureCheckpoint(); // 'captured'
  ```

- Improved Railway sandbox recovery and checkpoint management: ([#20739](https://github.com/mastra-ai/mastra/pull/20739))

  - A configured `sandboxId` reconnects when the sandbox is running, or creates a replacement when it is missing or stopped.
  - Use `captureCheckpoint()` to save a recovery point on demand. Saved checkpoints provide the baseline filesystem for new sandboxes; `stop()` captures one before teardown and `destroy()` removes it.
  - `start()` no longer resolves `template`. The option is still accepted and copied by `clone()`, but has no effect: callers receive neither a custom base image nor an error.

- Updated dependencies [[`e7109ee`](https://github.com/mastra-ai/mastra/commit/e7109ee6f731bacc79c885906f3c7dca8d8f013a), [`b8ce7ec`](https://github.com/mastra-ai/mastra/commit/b8ce7ec96e39343c6c2f36d12d68a9ad816c09f7), [`2e4624e`](https://github.com/mastra-ai/mastra/commit/2e4624edb6917e61249cb60ee377735e7af7e4a9), [`45a9147`](https://github.com/mastra-ai/mastra/commit/45a914741f578754d79d8b7de7b4e4f304d8e14a), [`a3a3624`](https://github.com/mastra-ai/mastra/commit/a3a3624f646b98e409424d8defccbd334da9e8b8), [`6246914`](https://github.com/mastra-ai/mastra/commit/62469146636911f3cbbe0880bd011c6a897a59a7), [`6445eba`](https://github.com/mastra-ai/mastra/commit/6445eba6020abac681aba1cc9289f446cb400cbe), [`86b7b77`](https://github.com/mastra-ai/mastra/commit/86b7b777980d30f66e1fd134a37d2af4c22e54cc), [`1c75e32`](https://github.com/mastra-ai/mastra/commit/1c75e32f7fc0b9fb6f548b4407feaec8a1440212), [`296dc9a`](https://github.com/mastra-ai/mastra/commit/296dc9af29f3616e786c7825ec32e0df92d754c5), [`f59032a`](https://github.com/mastra-ai/mastra/commit/f59032a73699443555a08a479e7ac578975784f2), [`cdd5c33`](https://github.com/mastra-ai/mastra/commit/cdd5c33ac6c7118a9f139e6dc0e14e6a8ae31658), [`3f73c07`](https://github.com/mastra-ai/mastra/commit/3f73c076727e8c36b4fff7a1b40290fb68957fa8), [`772c0c8`](https://github.com/mastra-ai/mastra/commit/772c0c897cec383258de2e6178147f8014767c7b), [`d7cf7fa`](https://github.com/mastra-ai/mastra/commit/d7cf7fafc1ae1b50bd8462dd0e6c671a8606db93), [`7c1ebb1`](https://github.com/mastra-ai/mastra/commit/7c1ebb15690c4b3f0eabb19077cf8af573311e57), [`0f9a448`](https://github.com/mastra-ai/mastra/commit/0f9a448502157e59f7b76f24360ad497168f5ef8), [`578bf2e`](https://github.com/mastra-ai/mastra/commit/578bf2e6a88e9d5b8bf502204e15a95dfbb679ae), [`c47165c`](https://github.com/mastra-ai/mastra/commit/c47165c983c87594c6952f1fd2fa51a90205034c), [`289f4ce`](https://github.com/mastra-ai/mastra/commit/289f4ce16e3293370440172132c52ee787cbc09f), [`df31eb0`](https://github.com/mastra-ai/mastra/commit/df31eb0c7087d782a0d9346e467f9a4af4b0eef6), [`9571e3a`](https://github.com/mastra-ai/mastra/commit/9571e3a06ed2c5220196460bf82a2129255c3a8b), [`4f16ff8`](https://github.com/mastra-ai/mastra/commit/4f16ff824bf2f9b0ddc93f210477c10c8a4fb1ab), [`b4c89b4`](https://github.com/mastra-ai/mastra/commit/b4c89b4371b0c86da57403ad1a3b3ef0681f3128), [`e6534fa`](https://github.com/mastra-ai/mastra/commit/e6534fab031216f6cb48c4c9907cbfdce9d60bc6), [`210cb7a`](https://github.com/mastra-ai/mastra/commit/210cb7a167998c7bbf72cb3b93e6eb0563330239), [`06b2d87`](https://github.com/mastra-ai/mastra/commit/06b2d87e63bcdd0ed59215c6789692b9b12de376), [`1c67d85`](https://github.com/mastra-ai/mastra/commit/1c67d85e9da8285662f4dbbf47e0378c3fee0747), [`ac01d63`](https://github.com/mastra-ai/mastra/commit/ac01d6355974aec73fdb8781449ed12bac582094), [`80a3324`](https://github.com/mastra-ai/mastra/commit/80a33245d3110204de6f56d61211523ffe338692), [`e44e8f3`](https://github.com/mastra-ai/mastra/commit/e44e8f370b66c339ddcaba946d33da6d3c3f06cd), [`d9d2881`](https://github.com/mastra-ai/mastra/commit/d9d2881ede6dd6c023d144215fc812062aed0890), [`a810a05`](https://github.com/mastra-ai/mastra/commit/a810a058f62ad407cfc1701e0be36ae91145d7cf), [`ba24be6`](https://github.com/mastra-ai/mastra/commit/ba24be662439c331ab23a600041f93803c89eca8), [`842b5fe`](https://github.com/mastra-ai/mastra/commit/842b5fe22b6a7fa811bd14e48eb9af523ac989f2), [`990611b`](https://github.com/mastra-ai/mastra/commit/990611ba76eb876d86c9c594371ae5f02f94b432), [`80bdf3a`](https://github.com/mastra-ai/mastra/commit/80bdf3ae16ade6ff63bde0cb16fa2df8ab7dd4dd), [`c967a5e`](https://github.com/mastra-ai/mastra/commit/c967a5eec150c5dc5418c4a4388982d1fb7ad27c), [`dc4a25d`](https://github.com/mastra-ai/mastra/commit/dc4a25d41af4e2fe97a816070eaec6aa963ab53b), [`9ba1247`](https://github.com/mastra-ai/mastra/commit/9ba12470c77f1c03642d720ce67e517e878f666e), [`fd96298`](https://github.com/mastra-ai/mastra/commit/fd96298a8367622f4ebfcaa97b5b6c1fbbd14564), [`66bbfb5`](https://github.com/mastra-ai/mastra/commit/66bbfb5f05b473d39f88c0e4a481ccac41634f3a), [`dc4a25d`](https://github.com/mastra-ai/mastra/commit/dc4a25d41af4e2fe97a816070eaec6aa963ab53b), [`f8da216`](https://github.com/mastra-ai/mastra/commit/f8da21633e7eb0e31c9ce0fc30567870d19416d3), [`4a09a9c`](https://github.com/mastra-ai/mastra/commit/4a09a9c0474ef643558fcb5f0edc542b82f1cab0), [`5f798b3`](https://github.com/mastra-ai/mastra/commit/5f798b3362e9bdf4d690f85245606e146eef60b9), [`6a84954`](https://github.com/mastra-ai/mastra/commit/6a84954a2667f85b6d59da652dab1bbff007ccb0), [`1e83a47`](https://github.com/mastra-ai/mastra/commit/1e83a4734ab61ba5926af6793e3569a78b72ed37), [`52d8ef0`](https://github.com/mastra-ai/mastra/commit/52d8ef03801f1deb7ee48532fc4190dd4a33916c), [`cdd5c33`](https://github.com/mastra-ai/mastra/commit/cdd5c33ac6c7118a9f139e6dc0e14e6a8ae31658), [`7fdcaa6`](https://github.com/mastra-ai/mastra/commit/7fdcaa66105d64290f9b14432a12ec99f39c4d3a), [`d6c56f9`](https://github.com/mastra-ai/mastra/commit/d6c56f951db3213330b98b0abafa9778c8770e58), [`e08e789`](https://github.com/mastra-ai/mastra/commit/e08e789c1bf4cd2fe46363f7a4728536ceccc9bd), [`bf936e2`](https://github.com/mastra-ai/mastra/commit/bf936e2c89b2ff0dad5695b873ddc009ba96d41e), [`7fb580a`](https://github.com/mastra-ai/mastra/commit/7fb580ac73fbcacf2ff00872a3395f73ae1b9fa5), [`ed5d606`](https://github.com/mastra-ai/mastra/commit/ed5d606739c5e3fbdfa9f272df7809aa5ab43b1d), [`f53d5bd`](https://github.com/mastra-ai/mastra/commit/f53d5bd4885b29e4ac29a428a6044088ea8d6aa3), [`32980a3`](https://github.com/mastra-ai/mastra/commit/32980a3e2413d0274ac244d32c37d910edc13f00), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437), [`82e3365`](https://github.com/mastra-ai/mastra/commit/82e3365ef7c9bf7bee2e7a7029035ea262d68895), [`6104347`](https://github.com/mastra-ai/mastra/commit/61043473ba6bfd0a25156824e853e13165562e6c), [`35cc901`](https://github.com/mastra-ai/mastra/commit/35cc90102cf834a84827acaf9eee0b6d6d1e2a3b), [`a8b4cf0`](https://github.com/mastra-ai/mastra/commit/a8b4cf02823cffebc4751a53337dfacf097c1ae1), [`9571e3a`](https://github.com/mastra-ai/mastra/commit/9571e3a06ed2c5220196460bf82a2129255c3a8b), [`333785c`](https://github.com/mastra-ai/mastra/commit/333785c93cbb01e42c60167e995457c28897ddbf), [`bda2235`](https://github.com/mastra-ai/mastra/commit/bda22353ee28f2df0eaea555f7cae1549f979c0b), [`efd5c81`](https://github.com/mastra-ai/mastra/commit/efd5c81cc25fde3c2ddd86fc1178deb4ec176e19), [`1b482c2`](https://github.com/mastra-ai/mastra/commit/1b482c2d89244dd758c41e5f927a2b44041388d2), [`45bfb88`](https://github.com/mastra-ai/mastra/commit/45bfb88fd52f1dd3be20e2a38905777c96499c90), [`ff28284`](https://github.com/mastra-ai/mastra/commit/ff2828416f14daff9d956e6a352fdaa23c950979), [`4bcdfaf`](https://github.com/mastra-ai/mastra/commit/4bcdfaf0eac3199d7cb171b0a19a92c9c341eea4), [`e3b9307`](https://github.com/mastra-ai/mastra/commit/e3b9307098daefbfae2a52ae2ef51bc9fc701190), [`d6834c5`](https://github.com/mastra-ai/mastra/commit/d6834c5a7866b16734d23900163c2414ed70d791), [`f33264f`](https://github.com/mastra-ai/mastra/commit/f33264f517ae603279afd5c4251e2b40f6dd3618), [`689f2c4`](https://github.com/mastra-ai/mastra/commit/689f2c4b6c0835fe455702b01d21daa8abcd9331), [`fcd0667`](https://github.com/mastra-ai/mastra/commit/fcd0667a4e378be35c9a1b1eb19cce78fbfd7282), [`cfd0d9e`](https://github.com/mastra-ai/mastra/commit/cfd0d9ec77ec3c69dd96f79cdb579e03d79f22ce), [`acc3513`](https://github.com/mastra-ai/mastra/commit/acc3513b19f79bf0a7ec2998694580edca54086c), [`1670533`](https://github.com/mastra-ai/mastra/commit/1670533986f6bacf567746245348125e3a106448), [`a7eb4a1`](https://github.com/mastra-ai/mastra/commit/a7eb4a11450f6170274ed5141bffe821d4fdd5a6), [`0976933`](https://github.com/mastra-ai/mastra/commit/0976933142333ec78451feef265b68bcb45aa5e7), [`242b945`](https://github.com/mastra-ai/mastra/commit/242b94558777bfbdeb42cbfea84afff0b6ad0633), [`c52d346`](https://github.com/mastra-ai/mastra/commit/c52d3462ec831a5d95926ecd3d3373f5928ad2e5), [`af4636a`](https://github.com/mastra-ai/mastra/commit/af4636a74463275d71c1d13a38f7d2b738f128bf), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437), [`2eabc09`](https://github.com/mastra-ai/mastra/commit/2eabc097d86d52fbd0123da36a7c874154cc384f), [`0023e79`](https://github.com/mastra-ai/mastra/commit/0023e7919431078280abd11c89d1edeae35fcc69), [`c2ad51e`](https://github.com/mastra-ai/mastra/commit/c2ad51e2467f901eecba8c9f4a45e22a50bd7c18), [`25ca73d`](https://github.com/mastra-ai/mastra/commit/25ca73d25dee7ce9f0ca72939e3a505c4db7257e), [`2f9ef3f`](https://github.com/mastra-ai/mastra/commit/2f9ef3f4ca06fc2dcdd5088c26b7f4da6a016791), [`e7eefcb`](https://github.com/mastra-ai/mastra/commit/e7eefcb162cda7c493e8c3bf43050ead0efbcb2c), [`fea5cae`](https://github.com/mastra-ai/mastra/commit/fea5caedc7e2cfea51784a15e015952692027abf), [`4d7aca2`](https://github.com/mastra-ai/mastra/commit/4d7aca2fe75f225c83d1502d63079568e6ec163f), [`e1cead1`](https://github.com/mastra-ai/mastra/commit/e1cead17b5f3653cf00d2f90cc19b113119c02ba), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437), [`d9d93b2`](https://github.com/mastra-ai/mastra/commit/d9d93b25e4a65ad5fa153fa35be7ed149c8d587f), [`c4ec889`](https://github.com/mastra-ai/mastra/commit/c4ec889561c0264c43f66d04d587bee4ce35e792), [`4b59f78`](https://github.com/mastra-ai/mastra/commit/4b59f786cbc9a7d1ef07a07517dbd4b96865e99d), [`eeae63e`](https://github.com/mastra-ai/mastra/commit/eeae63e7fbe8e1f237adc69bca6e2ac13c5ca907), [`3dc97ea`](https://github.com/mastra-ai/mastra/commit/3dc97ea415fad353b48a13095fad1835933cc12a), [`94e7ae9`](https://github.com/mastra-ai/mastra/commit/94e7ae970b37c888cd1244ef013292639a2fe6d1), [`e6a2860`](https://github.com/mastra-ai/mastra/commit/e6a2860649cc51f87d32d78b766ae2126446ba07), [`7010c5d`](https://github.com/mastra-ai/mastra/commit/7010c5d15728bf9c5dfe4fb6b1bf80ce23bf143a), [`bab06b1`](https://github.com/mastra-ai/mastra/commit/bab06b18923873a584bdfc71a6b4ec7fb4727fb7), [`3d01cd3`](https://github.com/mastra-ai/mastra/commit/3d01cd387321b6f9c5cac31d487c84bf51b19c78), [`7bf3086`](https://github.com/mastra-ai/mastra/commit/7bf308663f0115ca74ad20554ade740f06640859), [`4c186a0`](https://github.com/mastra-ai/mastra/commit/4c186a017275f45e6ed4c09de0f89550e2d09e8c), [`b0fa077`](https://github.com/mastra-ai/mastra/commit/b0fa077bcbc9b08551846fe372a0d3d15b71ed72), [`0282e16`](https://github.com/mastra-ai/mastra/commit/0282e16115538c8e9b248b90f0748eb01cb5dc98), [`a8dd139`](https://github.com/mastra-ai/mastra/commit/a8dd1391a9fe9a6632c25809ef236980afa9a020), [`6a667b4`](https://github.com/mastra-ai/mastra/commit/6a667b4b7cd6a93fe41fcdd357b08c5a8c09b9ab), [`9be8878`](https://github.com/mastra-ai/mastra/commit/9be8878dcf0388e84fc4873e0eec27bd49b881a4), [`e5786be`](https://github.com/mastra-ai/mastra/commit/e5786be02bb903073082bd9d6da880ebaacc343f), [`2440e09`](https://github.com/mastra-ai/mastra/commit/2440e096ea6c2def1ccc1eb2d0f3f5b88c4af940), [`2093fbd`](https://github.com/mastra-ai/mastra/commit/2093fbd53bb744bae19ec89f6d73db9a66fbe8a7), [`a59049b`](https://github.com/mastra-ai/mastra/commit/a59049b1652a13efff66ac826326b5ed9a550342), [`7bd85ea`](https://github.com/mastra-ai/mastra/commit/7bd85ea7588b71c25ce9f4019c88f8539be5dcbc), [`83fa004`](https://github.com/mastra-ai/mastra/commit/83fa0044bfda8b703a83883dbd8bef204844d13f), [`a463cdf`](https://github.com/mastra-ai/mastra/commit/a463cdf1c95c3059e70f0bff27959e8558bb899d), [`e7a5da4`](https://github.com/mastra-ai/mastra/commit/e7a5da4ef8e4dd452d2f232961b4e682a85ffe43), [`7b4393d`](https://github.com/mastra-ai/mastra/commit/7b4393d557411fdcf07b0e30e5acaf7cc85154ae), [`0ea6b80`](https://github.com/mastra-ai/mastra/commit/0ea6b8001408ce02b56e8be0536b0fd8cbaf8ad2)]:
  - @mastra/core@1.58.0

## 0.5.0-alpha.2

### Minor Changes

- Added `RailwaySandbox.snapshot()` to capture the configured recovery checkpoint. ([#21221](https://github.com/mastra-ai/mastra/pull/21221))

  ```ts
  await sandbox.snapshot();
  ```

### Patch Changes

- Updated dependencies [[`9571e3a`](https://github.com/mastra-ai/mastra/commit/9571e3a06ed2c5220196460bf82a2129255c3a8b), [`d6c56f9`](https://github.com/mastra-ai/mastra/commit/d6c56f951db3213330b98b0abafa9778c8770e58), [`9571e3a`](https://github.com/mastra-ai/mastra/commit/9571e3a06ed2c5220196460bf82a2129255c3a8b), [`acc3513`](https://github.com/mastra-ai/mastra/commit/acc3513b19f79bf0a7ec2998694580edca54086c), [`94e7ae9`](https://github.com/mastra-ai/mastra/commit/94e7ae970b37c888cd1244ef013292639a2fe6d1), [`6a667b4`](https://github.com/mastra-ai/mastra/commit/6a667b4b7cd6a93fe41fcdd357b08c5a8c09b9ab), [`2440e09`](https://github.com/mastra-ai/mastra/commit/2440e096ea6c2def1ccc1eb2d0f3f5b88c4af940), [`a59049b`](https://github.com/mastra-ai/mastra/commit/a59049b1652a13efff66ac826326b5ed9a550342)]:
  - @mastra/core@1.58.0-alpha.13

## 0.4.1-alpha.1

### Patch Changes

- Improved Railway sandbox recovery and checkpoint management: ([#20739](https://github.com/mastra-ai/mastra/pull/20739))

  - A configured `sandboxId` reconnects when the sandbox is running, or creates a replacement when it is missing or stopped.
  - Use `captureCheckpoint()` to save a recovery point on demand. Saved checkpoints provide the baseline filesystem for new sandboxes; `stop()` captures one before teardown and `destroy()` removes it.
  - `start()` no longer resolves `template`. The option is still accepted and copied by `clone()`, but has no effect: callers receive neither a custom base image nor an error.

- Updated dependencies [[`b4c89b4`](https://github.com/mastra-ai/mastra/commit/b4c89b4371b0c86da57403ad1a3b3ef0681f3128), [`e44e8f3`](https://github.com/mastra-ai/mastra/commit/e44e8f370b66c339ddcaba946d33da6d3c3f06cd), [`c967a5e`](https://github.com/mastra-ai/mastra/commit/c967a5eec150c5dc5418c4a4388982d1fb7ad27c), [`f53d5bd`](https://github.com/mastra-ai/mastra/commit/f53d5bd4885b29e4ac29a428a6044088ea8d6aa3), [`bda2235`](https://github.com/mastra-ai/mastra/commit/bda22353ee28f2df0eaea555f7cae1549f979c0b), [`a7eb4a1`](https://github.com/mastra-ai/mastra/commit/a7eb4a11450f6170274ed5141bffe821d4fdd5a6), [`2f9ef3f`](https://github.com/mastra-ai/mastra/commit/2f9ef3f4ca06fc2dcdd5088c26b7f4da6a016791), [`e7eefcb`](https://github.com/mastra-ai/mastra/commit/e7eefcb162cda7c493e8c3bf43050ead0efbcb2c), [`4d7aca2`](https://github.com/mastra-ai/mastra/commit/4d7aca2fe75f225c83d1502d63079568e6ec163f), [`c4ec889`](https://github.com/mastra-ai/mastra/commit/c4ec889561c0264c43f66d04d587bee4ce35e792), [`9be8878`](https://github.com/mastra-ai/mastra/commit/9be8878dcf0388e84fc4873e0eec27bd49b881a4)]:
  - @mastra/core@1.58.0-alpha.2

## 0.4.1-alpha.0

### Patch Changes

- Widen `RailwaySandbox.captureCheckpoint()` return type to a discriminated object so callers get the checkpoint name inline instead of having to reach back into the sandbox for it. ([#20877](https://github.com/mastra-ai/mastra/pull/20877))

  Before:

  ```ts
  const outcome = await sandbox.captureCheckpoint(); // 'captured' | 'skipped' | 'coalesced'
  ```

  After:

  ```ts
  const result = await sandbox.captureCheckpoint();
  switch (result.status) {
    case 'captured':
    case 'coalesced':
      await persistBinding({ sessionId, checkpointName: result.checkpointName });
      break;
    case 'skipped':
      // result.reason: 'no-checkpoint-name-configured' | 'sandbox-not-running'
      break;
  }
  ```

  Both `captured` and `coalesced` now carry `checkpointName` — they both represent a successful capture the caller can persist against. `skipped` carries a machine-readable `reason` so the set stays extensible without another breaking return-shape change.

  This is a breaking change to the `captureCheckpoint()` return type introduced in the previous release. The method has no other callers in the OSS packages.

- Refresh Railway sandbox checkpoints 3 minutes before idle destroy instead of 10 seconds, and expose an on-demand `captureCheckpoint()` method ([#20875](https://github.com/mastra-ai/mastra/pull/20875))

  **Wider safety-net margin**

  Extends the pre-reap refresh margin from 10s to 180s so a Cloud Run cold start or scale event during the refresh window doesn't lose the race with Railway's idle destroy. Callers running with an idle timeout shorter than 3 minutes will now see the refresh fire at the 1-second floor almost immediately after start.

  **Public `captureCheckpoint()`**

  Adds a public, on-demand checkpoint capture to `RailwaySandbox` so callers can refresh the recovery checkpoint at semantic moments (turn end, session idle, pre-teardown) instead of waiting for the idle-timer safety net. Concurrent captures coalesce with any in-flight timer-driven refresh, so a single Railway checkpoint quota is consumed per capture window. Returns `'captured' | 'skipped' | 'coalesced'` for observability.

  ```ts
  const sandbox = new RailwaySandbox({ token, checkpointName: 'my-project' });
  await sandbox.start();
  // ... run some work ...
  const outcome = await sandbox.captureCheckpoint(); // 'captured'
  ```

- Updated dependencies [[`e7109ee`](https://github.com/mastra-ai/mastra/commit/e7109ee6f731bacc79c885906f3c7dca8d8f013a), [`772c0c8`](https://github.com/mastra-ai/mastra/commit/772c0c897cec383258de2e6178147f8014767c7b), [`578bf2e`](https://github.com/mastra-ai/mastra/commit/578bf2e6a88e9d5b8bf502204e15a95dfbb679ae), [`06b2d87`](https://github.com/mastra-ai/mastra/commit/06b2d87e63bcdd0ed59215c6789692b9b12de376), [`ac01d63`](https://github.com/mastra-ai/mastra/commit/ac01d6355974aec73fdb8781449ed12bac582094), [`a810a05`](https://github.com/mastra-ai/mastra/commit/a810a058f62ad407cfc1701e0be36ae91145d7cf), [`f8da216`](https://github.com/mastra-ai/mastra/commit/f8da21633e7eb0e31c9ce0fc30567870d19416d3), [`6104347`](https://github.com/mastra-ai/mastra/commit/61043473ba6bfd0a25156824e853e13165562e6c), [`45bfb88`](https://github.com/mastra-ai/mastra/commit/45bfb88fd52f1dd3be20e2a38905777c96499c90), [`e3b9307`](https://github.com/mastra-ai/mastra/commit/e3b9307098daefbfae2a52ae2ef51bc9fc701190), [`d6834c5`](https://github.com/mastra-ai/mastra/commit/d6834c5a7866b16734d23900163c2414ed70d791), [`c52d346`](https://github.com/mastra-ai/mastra/commit/c52d3462ec831a5d95926ecd3d3373f5928ad2e5), [`0023e79`](https://github.com/mastra-ai/mastra/commit/0023e7919431078280abd11c89d1edeae35fcc69), [`c2ad51e`](https://github.com/mastra-ai/mastra/commit/c2ad51e2467f901eecba8c9f4a45e22a50bd7c18), [`3dc97ea`](https://github.com/mastra-ai/mastra/commit/3dc97ea415fad353b48a13095fad1835933cc12a), [`3d01cd3`](https://github.com/mastra-ai/mastra/commit/3d01cd387321b6f9c5cac31d487c84bf51b19c78), [`7bf3086`](https://github.com/mastra-ai/mastra/commit/7bf308663f0115ca74ad20554ade740f06640859), [`a8dd139`](https://github.com/mastra-ai/mastra/commit/a8dd1391a9fe9a6632c25809ef236980afa9a020), [`e5786be`](https://github.com/mastra-ai/mastra/commit/e5786be02bb903073082bd9d6da880ebaacc343f), [`2093fbd`](https://github.com/mastra-ai/mastra/commit/2093fbd53bb744bae19ec89f6d73db9a66fbe8a7), [`e7a5da4`](https://github.com/mastra-ai/mastra/commit/e7a5da4ef8e4dd452d2f232961b4e682a85ffe43), [`7b4393d`](https://github.com/mastra-ai/mastra/commit/7b4393d557411fdcf07b0e30e5acaf7cc85154ae)]:
  - @mastra/core@1.58.0-alpha.1

## 0.4.0

### Minor Changes

- Added `clone()` support to the sandbox providers. `clone()` constructs an unstarted sibling sandbox that inherits the template's configuration (credentials, image, resources) with per-instance overrides for `id` and `env`, so one configured sandbox can act as a template for a fleet of sandbox clones (for example, one per project). ([#19616](https://github.com/mastra-ai/mastra/pull/19616))

  ```ts
  const template = new E2BSandbox({ apiKey, template: 'base' });

  const projectSandbox = template.clone({
    id: 'mc-project-42',
    env: { GITHUB_TOKEN: token },
    idleTimeoutMinutes: 30,
  });
  await projectSandbox.start();
  ```

  `idleTimeoutMinutes` is a best-effort hint that maps to each provider's native lifetime knob (Railway `idleTimeoutMinutes`, E2B/Modal/Vercel timeout in milliseconds, Daytona `autoStopInterval`, Blaxel TTL duration). Docker and Apple Container ignore it since they have no provider-side idle teardown.

### Patch Changes

- Allowed derived Railway sandboxes to override the checkpoint name used for checkpoint-backed creation and refresh. ([#19907](https://github.com/mastra-ai/mastra/pull/19907))

- Updated dependencies [[`ec857fc`](https://github.com/mastra-ai/mastra/commit/ec857fc79c264b53b38e16478c789b7177f2ad59), [`d7385ad`](https://github.com/mastra-ai/mastra/commit/d7385ad9e88f9e4f33d15c0ec0bfebedde0cbc2e), [`41a5392`](https://github.com/mastra-ai/mastra/commit/41a5392d9f6c5e18d6b227f0fc0ddf49c50774e9), [`3d6e539`](https://github.com/mastra-ai/mastra/commit/3d6e539272eb2ea0407034605ee1906b3be06b39), [`1426af2`](https://github.com/mastra-ai/mastra/commit/1426af24975879c000d13ac75673f630fcc970c1), [`a40adeb`](https://github.com/mastra-ai/mastra/commit/a40adeb222b961a56a58af56a106106525721b74), [`8a0d145`](https://github.com/mastra-ai/mastra/commit/8a0d145aadbdf7278665aceaaec364b35dd9bd94), [`bd2f1d2`](https://github.com/mastra-ai/mastra/commit/bd2f1d274d05e60e2366f005ea0d94d5cea0d5ff), [`e1f2fae`](https://github.com/mastra-ai/mastra/commit/e1f2faebaf048c3d4c2e2c01d293767c195d5794), [`63aa799`](https://github.com/mastra-ai/mastra/commit/63aa799c6b44eacc7806cda6846b7c5bbee06b37), [`b7e79c3`](https://github.com/mastra-ai/mastra/commit/b7e79c3c02ac5cd415db34ba0975ceafc1464333), [`675fbff`](https://github.com/mastra-ai/mastra/commit/675fbff84d3274391b33e852f76083c38a5514e5), [`da009e1`](https://github.com/mastra-ai/mastra/commit/da009e1aacd89ed94b8d1b2af09c9d4fe7c4db49), [`3b77e77`](https://github.com/mastra-ai/mastra/commit/3b77e7704936522e4769d29de1b5ea6901f302bd), [`c7d30cd`](https://github.com/mastra-ai/mastra/commit/c7d30cd86009c407df91105591f03cd6e3d2854d), [`21a0eb8`](https://github.com/mastra-ai/mastra/commit/21a0eb86746ba0b703acea360d4f84c6a5a493f2), [`8b20926`](https://github.com/mastra-ai/mastra/commit/8b20926cd59e2ba3d66458e062fa0e6e2ada3e68), [`975295d`](https://github.com/mastra-ai/mastra/commit/975295d418552f0d46a59edfef4c3ee555f9930a), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`6b1bf3b`](https://github.com/mastra-ai/mastra/commit/6b1bf3b9494bd51aa8f654c68c9355d6046fa2a1), [`35c2181`](https://github.com/mastra-ai/mastra/commit/35c2181e6a50e47c90ba36260db7c9723d54696f), [`0a2c22c`](https://github.com/mastra-ai/mastra/commit/0a2c22c902604439ec490319e14c17f331e0c84c), [`4cfdd64`](https://github.com/mastra-ai/mastra/commit/4cfdd645794feaea0c4ea711e70ecdfbef0c5b8e), [`b75d749`](https://github.com/mastra-ai/mastra/commit/b75d749621ff5d17e86bcb4ee809d301fb4f7cf3), [`821648b`](https://github.com/mastra-ai/mastra/commit/821648bf2871ef840100c7bacbecf676010bd12a), [`de86fd7`](https://github.com/mastra-ai/mastra/commit/de86fd7119f0438381d1a642e3d258143c0b9c29), [`2745031`](https://github.com/mastra-ai/mastra/commit/2745031d1d4a4978f037092da371428c32e2842a), [`b4b7ea8`](https://github.com/mastra-ai/mastra/commit/b4b7ea8733f033fc441ea47ed03f6afb17ec2248), [`3a8024c`](https://github.com/mastra-ai/mastra/commit/3a8024ce615f8aa89479c0d71fe61d10bb0040be), [`35865a5`](https://github.com/mastra-ai/mastra/commit/35865a53e194aa9634d6a70a97010e7a6b9d58b1), [`74faf8b`](https://github.com/mastra-ai/mastra/commit/74faf8bd9c1018f2492653c06b1e25fc8300e9e6), [`ef03fbc`](https://github.com/mastra-ai/mastra/commit/ef03fbcc556bcbc04c9b3d06fab88771ecaa043c), [`675fbff`](https://github.com/mastra-ai/mastra/commit/675fbff84d3274391b33e852f76083c38a5514e5), [`70687f7`](https://github.com/mastra-ai/mastra/commit/70687f7e495a322a02070b4a67cb0c77a5ca91ec), [`1fadac4`](https://github.com/mastra-ai/mastra/commit/1fadac44537caeefe81f9f775ae2f2f3d94e9069), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`76b7181`](https://github.com/mastra-ai/mastra/commit/76b71810366e6d90b9d3973149d1c7ba3659ffb9), [`792ec9a`](https://github.com/mastra-ai/mastra/commit/792ec9a0869bab8274cf5e0ed2840738737a1607), [`712b864`](https://github.com/mastra-ai/mastra/commit/712b864aa1ed12b14c54390ec17b69de163c37f7), [`85e4fb5`](https://github.com/mastra-ai/mastra/commit/85e4fb50087a81c74df3a762f53b56373db0b912), [`0c0e8d7`](https://github.com/mastra-ai/mastra/commit/0c0e8d7becd4d1445c656b78d5d845f606c1ff9d), [`a7bbe77`](https://github.com/mastra-ai/mastra/commit/a7bbe773577f60bc4761b534ef7ec6b476332dad), [`72e437c`](https://github.com/mastra-ai/mastra/commit/72e437c515942c80b9def5b026e0bdee61b469d9), [`8f7a5de`](https://github.com/mastra-ai/mastra/commit/8f7a5dedc246cdc938bb65516703cf9b27b03756), [`a7bbe77`](https://github.com/mastra-ai/mastra/commit/a7bbe773577f60bc4761b534ef7ec6b476332dad), [`11f6cd9`](https://github.com/mastra-ai/mastra/commit/11f6cd96fe42582403416608beb212cc1a2cc79e), [`ef03c0c`](https://github.com/mastra-ai/mastra/commit/ef03c0cfc62367a458e4cc56462e2148b35681c5), [`4fb4d88`](https://github.com/mastra-ai/mastra/commit/4fb4d881bc107acee13890ad4d78661016c510ed), [`4e68363`](https://github.com/mastra-ai/mastra/commit/4e683634f94ebd062d26a3bb6093a8dfc7263d37), [`c328769`](https://github.com/mastra-ai/mastra/commit/c3287698ff8ef98dba86d415faa566fa3e5f4d56), [`9f7c67a`](https://github.com/mastra-ai/mastra/commit/9f7c67abeeb52c41c51a9b5edee60b62afe7cd8d), [`3b65e68`](https://github.com/mastra-ai/mastra/commit/3b65e68d7f1c771c7a70eea42d83fefdd28cad88), [`4eba27a`](https://github.com/mastra-ai/mastra/commit/4eba27adcf60f991df0e62f94b3e75b4e67f3b4b), [`c701be3`](https://github.com/mastra-ai/mastra/commit/c701be32d7d9aa94a66da8c6cc38dcac6856f464), [`db650ce`](https://github.com/mastra-ai/mastra/commit/db650ce490348914e85b93651d83acdf8f2a4c31), [`232fcbc`](https://github.com/mastra-ai/mastra/commit/232fcbc14fce625dd672ba043329c0b732c62be2), [`6354eeb`](https://github.com/mastra-ai/mastra/commit/6354eeb32efa9f5f68f51dda394e90e2ee76f1fb), [`a8799bb`](https://github.com/mastra-ai/mastra/commit/a8799bb8e44f4a60d01e4e2acd3448ff80bf14f8), [`3d6e539`](https://github.com/mastra-ai/mastra/commit/3d6e539272eb2ea0407034605ee1906b3be06b39), [`e3868e2`](https://github.com/mastra-ai/mastra/commit/e3868e22babfffd0133771669ca724501c2dd58e), [`9251370`](https://github.com/mastra-ai/mastra/commit/9251370ad413af464aa22d7566338bec5613e8de), [`3491666`](https://github.com/mastra-ai/mastra/commit/34916663c4fdd43b48c21f4ab2d5fb6dcccc94f9), [`c0bec73`](https://github.com/mastra-ai/mastra/commit/c0bec732c93d1a22ae5e51ed66cf8cacca8bd6a6)]:
  - @mastra/core@1.52.0

## 0.4.0-alpha.1

### Patch Changes

- Allowed derived Railway sandboxes to override the checkpoint name used for checkpoint-backed creation and refresh. ([#19907](https://github.com/mastra-ai/mastra/pull/19907))

- Updated dependencies [[`c7d30cd`](https://github.com/mastra-ai/mastra/commit/c7d30cd86009c407df91105591f03cd6e3d2854d), [`ef03fbc`](https://github.com/mastra-ai/mastra/commit/ef03fbcc556bcbc04c9b3d06fab88771ecaa043c), [`a7bbe77`](https://github.com/mastra-ai/mastra/commit/a7bbe773577f60bc4761b534ef7ec6b476332dad), [`a7bbe77`](https://github.com/mastra-ai/mastra/commit/a7bbe773577f60bc4761b534ef7ec6b476332dad), [`4e68363`](https://github.com/mastra-ai/mastra/commit/4e683634f94ebd062d26a3bb6093a8dfc7263d37), [`9251370`](https://github.com/mastra-ai/mastra/commit/9251370ad413af464aa22d7566338bec5613e8de)]:
  - @mastra/core@1.52.0-alpha.11

## 0.4.0-alpha.0

### Minor Changes

- Added `clone()` support to the sandbox providers. `clone()` constructs an unstarted sibling sandbox that inherits the template's configuration (credentials, image, resources) with per-instance overrides for `id` and `env`, so one configured sandbox can act as a template for a fleet of sandbox clones (for example, one per project). ([#19616](https://github.com/mastra-ai/mastra/pull/19616))

  ```ts
  const template = new E2BSandbox({ apiKey, template: 'base' });

  const projectSandbox = template.clone({
    id: 'mc-project-42',
    env: { GITHUB_TOKEN: token },
    idleTimeoutMinutes: 30,
  });
  await projectSandbox.start();
  ```

  `idleTimeoutMinutes` is a best-effort hint that maps to each provider's native lifetime knob (Railway `idleTimeoutMinutes`, E2B/Modal/Vercel timeout in milliseconds, Daytona `autoStopInterval`, Blaxel TTL duration). Docker and Apple Container ignore it since they have no provider-side idle teardown.

### Patch Changes

- Updated dependencies [[`ec857fc`](https://github.com/mastra-ai/mastra/commit/ec857fc79c264b53b38e16478c789b7177f2ad59), [`e1f2fae`](https://github.com/mastra-ai/mastra/commit/e1f2faebaf048c3d4c2e2c01d293767c195d5794), [`63aa799`](https://github.com/mastra-ai/mastra/commit/63aa799c6b44eacc7806cda6846b7c5bbee06b37), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`76b7181`](https://github.com/mastra-ai/mastra/commit/76b71810366e6d90b9d3973149d1c7ba3659ffb9), [`0c0e8d7`](https://github.com/mastra-ai/mastra/commit/0c0e8d7becd4d1445c656b78d5d845f606c1ff9d), [`9f7c67a`](https://github.com/mastra-ai/mastra/commit/9f7c67abeeb52c41c51a9b5edee60b62afe7cd8d), [`3b65e68`](https://github.com/mastra-ai/mastra/commit/3b65e68d7f1c771c7a70eea42d83fefdd28cad88), [`e3868e2`](https://github.com/mastra-ai/mastra/commit/e3868e22babfffd0133771669ca724501c2dd58e)]:
  - @mastra/core@1.52.0-alpha.5

## 0.3.1

### Patch Changes

- dependencies updates: ([#19054](https://github.com/mastra-ai/mastra/pull/19054))
  - Updated dependency [`railway@^3.5.5` ↗︎](https://www.npmjs.com/package/railway/v/3.5.5) (from `^3.4.1`, in `dependencies`)
- Updated dependencies [[`bd6d240`](https://github.com/mastra-ai/mastra/commit/bd6d2402db93dddaef0721667e7e8a030e7c6e16), [`0111486`](https://github.com/mastra-ai/mastra/commit/01114867612593eef5cfa2fda6a1194dfedda841), [`96a3749`](https://github.com/mastra-ai/mastra/commit/96a37492235f5b8076b3e3177d83ed5a5e44a640), [`fe1bda0`](https://github.com/mastra-ai/mastra/commit/fe1bda06f6af92a694a51712db747cda1e7185f0), [`25e7c12`](https://github.com/mastra-ai/mastra/commit/25e7c126a770069ae7fb7ecf1d2adb40e017b009), [`1ce5121`](https://github.com/mastra-ai/mastra/commit/1ce512155d122bb21f47d98383e82ffbf84b39e8), [`fb8aea3`](https://github.com/mastra-ai/mastra/commit/fb8aea384291e77311be3a64ee1717320d5c3c73), [`4adc391`](https://github.com/mastra-ai/mastra/commit/4adc3911075249c352bb4832d2471922826344de), [`a5c6337`](https://github.com/mastra-ai/mastra/commit/a5c6337d23c7686c81a32ce62f550f610543a240), [`3cfc47a`](https://github.com/mastra-ai/mastra/commit/3cfc47a6b89940aadd0f46fb01ae9624a73a865d), [`2bb7817`](https://github.com/mastra-ai/mastra/commit/2bb78176112fde628483de2830528f7eee911e56), [`51d9870`](https://github.com/mastra-ai/mastra/commit/51d987032c689c2855374d0f244f5d654da809d1), [`5cab274`](https://github.com/mastra-ai/mastra/commit/5cab2744250e22d12fefa7b32637dce224233cee), [`7fa27d3`](https://github.com/mastra-ai/mastra/commit/7fa27d3b6f5ed68cd34e454a4d3ad9c482a0cfbc), [`8b97958`](https://github.com/mastra-ai/mastra/commit/8b979589f9aa59ba67cac565949475f2ffeb4ac3), [`8410541`](https://github.com/mastra-ai/mastra/commit/84105412c60ecd3bb33a9838146f59c4b588228f), [`a58dcbb`](https://github.com/mastra-ai/mastra/commit/a58dcbb546d7e1d65ebdc1f39e55f0908fcd9391), [`aa38805`](https://github.com/mastra-ai/mastra/commit/aa38805b878b827403be785eb90688d7172f5a40), [`153bd3b`](https://github.com/mastra-ai/mastra/commit/153bd3b396bdfed6b74cf43de12db8fd2d83c04a), [`45a8e65`](https://github.com/mastra-ai/mastra/commit/45a8e65e1556d1362cb3f25187023c36de26661d), [`e955965`](https://github.com/mastra-ai/mastra/commit/e955965dce575a903e37cf054d28ea99aa48785e), [`2d22570`](https://github.com/mastra-ai/mastra/commit/2d22570c7dfdd02123d0ecc529efb05ccba2d9fc), [`07bb863`](https://github.com/mastra-ai/mastra/commit/07bb8631919c6f7cf377dccd45b096e0f17fbed0), [`c8ed116`](https://github.com/mastra-ai/mastra/commit/c8ed11699f62bcac70102ab4ec84d80d20541da6), [`01b338c`](https://github.com/mastra-ai/mastra/commit/01b338c56271f0219606710e3e8b26dee27ac6c2), [`a99eae8`](https://github.com/mastra-ai/mastra/commit/a99eae8908e500c1b2d12f9d277be616b98617a5), [`860ef7e`](https://github.com/mastra-ai/mastra/commit/860ef7e77d92b63469cbe5857aa1e626197e43e9), [`17e818c`](https://github.com/mastra-ai/mastra/commit/17e818c51a958ba90641b1a959dc38faf8c034e9), [`edce8d2`](https://github.com/mastra-ai/mastra/commit/edce8d2769f19e27a05737c627af2d765472a4f8), [`8a586ec`](https://github.com/mastra-ai/mastra/commit/8a586eca9a4914f31dff6140d0d45ac375b00669), [`4451dfe`](https://github.com/mastra-ai/mastra/commit/4451dfe857428e7abcc0261a507a2e186dae6d47), [`8b7361d`](https://github.com/mastra-ai/mastra/commit/8b7361d35de68b80d05d30a74e0c69e7218fd612), [`1d39058`](https://github.com/mastra-ai/mastra/commit/1d39058e548efd691799985d5c8af2737f1c3bd2), [`3927473`](https://github.com/mastra-ai/mastra/commit/392747323ddb10c643d12be7b9ae913159dfaeed), [`dce50dc`](https://github.com/mastra-ai/mastra/commit/dce50dc9a1c1fcd0f427bb5f6250ec74910cb04b), [`fd13f8e`](https://github.com/mastra-ai/mastra/commit/fd13f8e21990f9904c3eedba3a626bb4a929cdb8), [`634caff`](https://github.com/mastra-ai/mastra/commit/634caff29a9200ad058b67d53f96d9e5832fb8a2), [`f703f87`](https://github.com/mastra-ai/mastra/commit/f703f878de072d51fda557f9c50867d8252bef05), [`3e26c87`](https://github.com/mastra-ai/mastra/commit/3e26c87de0c5bc2583b795ce6ca5889b6b161acb), [`33f2b88`](https://github.com/mastra-ai/mastra/commit/33f2b88842c09a567f906fac4cb61cd5277ced59), [`177010f`](https://github.com/mastra-ai/mastra/commit/177010ff096d2e4b28d89803be5b1a4cad2a0d6b), [`0ad646f`](https://github.com/mastra-ai/mastra/commit/0ad646f71a530f2454664299e5e01bfd13fa12e5), [`b486abf`](https://github.com/mastra-ai/mastra/commit/b486abfa2a7528c6f527e4015c819ea9fa54aaad), [`54a51e0`](https://github.com/mastra-ai/mastra/commit/54a51e0a484fe1ebad3fb1f7ef5282a075709eb7), [`c43f3a9`](https://github.com/mastra-ai/mastra/commit/c43f3a9d1efde99b38789364ba4d0ba670f430e3), [`a5008f2`](https://github.com/mastra-ai/mastra/commit/a5008f22ae710ad9402ea9f2547d8c02f74d384b), [`e2d5f37`](https://github.com/mastra-ai/mastra/commit/e2d5f373bd289be534d5f8694d34465010533df6), [`4ce0163`](https://github.com/mastra-ai/mastra/commit/4ce0163dc86e675a86809685c8ce6c49f1aeb87e), [`4378341`](https://github.com/mastra-ai/mastra/commit/43783412df5ea3dd35f5b1f6e4851e79c346fc89)]:
  - @mastra/core@1.51.0

## 0.3.1-alpha.0

### Patch Changes

- dependencies updates: ([#19054](https://github.com/mastra-ai/mastra/pull/19054))
  - Updated dependency [`railway@^3.5.5` ↗︎](https://www.npmjs.com/package/railway/v/3.5.5) (from `^3.4.1`, in `dependencies`)
- Updated dependencies [[`bd6d240`](https://github.com/mastra-ai/mastra/commit/bd6d2402db93dddaef0721667e7e8a030e7c6e16), [`0111486`](https://github.com/mastra-ai/mastra/commit/01114867612593eef5cfa2fda6a1194dfedda841), [`96a3749`](https://github.com/mastra-ai/mastra/commit/96a37492235f5b8076b3e3177d83ed5a5e44a640), [`3e26c87`](https://github.com/mastra-ai/mastra/commit/3e26c87de0c5bc2583b795ce6ca5889b6b161acb), [`a5008f2`](https://github.com/mastra-ai/mastra/commit/a5008f22ae710ad9402ea9f2547d8c02f74d384b)]:
  - @mastra/core@1.51.0-alpha.8

## 0.3.0

### Minor Changes

- Added checkpoint-backed restart and reconnect support to `RailwaySandbox`. Pass `checkpointName` to save the sandbox filesystem before idle teardown and restore it when a sandbox must be recreated. ([#18725](https://github.com/mastra-ai/mastra/pull/18725))

  ```ts
  const sandbox = new RailwaySandbox({
    checkpointName: 'mastra-workspace-cache',
    idleTimeoutMinutes: 30,
  });
  ```

  Added `restart()` and automatic retry for unavailable Railway sandboxes during command execution. Fixed checkpoint refresh scheduling, restart checkpoint flushing, teardown cleanup, and retry classification so checkpoint state is preserved without replaying commands after ambiguous transport failures.

### Patch Changes

- Updated dependencies [[`700619b`](https://github.com/mastra-ai/mastra/commit/700619b61d572e592cbaaf758121d168844ca4d2), [`0f69865`](https://github.com/mastra-ai/mastra/commit/0f69865aced225d98eac812e22699dc445ee18cb), [`9250acd`](https://github.com/mastra-ai/mastra/commit/9250acd1357f0f1f33d0dcca16f9655084c58eca), [`0c3d4bc`](https://github.com/mastra-ai/mastra/commit/0c3d4bcae13ea3699d379403e6f350d5cf4efe9f), [`cc440a3`](https://github.com/mastra-ai/mastra/commit/cc440a39400d8ce06655462b26c1666a1b3d4320), [`6a61846`](https://github.com/mastra-ai/mastra/commit/6a61846eeda29fb714549b70f1bee2bf6b141c44), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`17369b2`](https://github.com/mastra-ai/mastra/commit/17369b25250561e9ed994ae509be1d15bfb33bcb), [`c64c2a8`](https://github.com/mastra-ai/mastra/commit/c64c2a8503a50252f9ca6b8e8c54cadee31b92a2), [`bcae929`](https://github.com/mastra-ai/mastra/commit/bcae929945cbf265bd9f327cc715ecafa072b5b9), [`ea6327b`](https://github.com/mastra-ai/mastra/commit/ea6327ba2d63ca647804bc97b347e03a58617162), [`3439fa8`](https://github.com/mastra-ai/mastra/commit/3439fa836ecfcaa257b40c20b30ac2a8be22e9ea), [`85107f2`](https://github.com/mastra-ai/mastra/commit/85107f2758b527147fccbedff962961927c2d3b8), [`b33822e`](https://github.com/mastra-ai/mastra/commit/b33822e8d470884954b02f7b0745407ee4ef74b1), [`06e2680`](https://github.com/mastra-ai/mastra/commit/06e26806b51d2cbd858afdc66daa2b86ff3ba64a), [`06ff9e0`](https://github.com/mastra-ai/mastra/commit/06ff9e0befd1d642ab87ff749285ee4091205c7e), [`d5c11e3`](https://github.com/mastra-ai/mastra/commit/d5c11e3ba5045969caa7272a7bd1fd141c93ab6c), [`7f5e1ff`](https://github.com/mastra-ai/mastra/commit/7f5e1ff695a92f672bb3976363925d1e9136b54a), [`ff80671`](https://github.com/mastra-ai/mastra/commit/ff8067185e208b27198b4e5b71803013175c3643), [`b8375c1`](https://github.com/mastra-ai/mastra/commit/b8375c1f8fe905df8ae2ae9a893bb365f17aec4e), [`dab1257`](https://github.com/mastra-ai/mastra/commit/dab1257b64e4ed576dc5038bb7a3f7072338bc9f), [`1240f05`](https://github.com/mastra-ai/mastra/commit/1240f051c8e5371f1c014448bf37b1a1b9a05e47), [`705ff39`](https://github.com/mastra-ai/mastra/commit/705ff3969e57214ff2fdaf3815d751dd558886ed), [`e6fbd5b`](https://github.com/mastra-ai/mastra/commit/e6fbd5bfdc28e92c0c0433f29aa1bc152d3430f6), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`6f2026c`](https://github.com/mastra-ai/mastra/commit/6f2026cdf114ff1e21e49133ca774ec7d5085059), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`003f35d`](https://github.com/mastra-ai/mastra/commit/003f35d19e07b23b4bacc591c8bc0c59b42124ae), [`f890eda`](https://github.com/mastra-ai/mastra/commit/f890eda2c8a2ae83d9b30bc6d85842f93b6c266b), [`1340fb7`](https://github.com/mastra-ai/mastra/commit/1340fb76262a3ca062130aa71859f07257a0a5a4)]:
  - @mastra/core@1.49.0

## 0.3.0-alpha.0

### Minor Changes

- Added checkpoint-backed restart and reconnect support to `RailwaySandbox`. Pass `checkpointName` to save the sandbox filesystem before idle teardown and restore it when a sandbox must be recreated. ([#18725](https://github.com/mastra-ai/mastra/pull/18725))

  ```ts
  const sandbox = new RailwaySandbox({
    checkpointName: 'mastra-workspace-cache',
    idleTimeoutMinutes: 30,
  });
  ```

  Added `restart()` and automatic retry for unavailable Railway sandboxes during command execution. Fixed checkpoint refresh scheduling, restart checkpoint flushing, teardown cleanup, and retry classification so checkpoint state is preserved without replaying commands after ambiguous transport failures.

### Patch Changes

- Updated dependencies [[`1340fb7`](https://github.com/mastra-ai/mastra/commit/1340fb76262a3ca062130aa71859f07257a0a5a4)]:
  - @mastra/core@1.49.0-alpha.2

## 0.2.1

### Patch Changes

- Fixed Railway sandbox templates so they are built once during sandbox creation. ([#18605](https://github.com/mastra-ai/mastra/pull/18605))

- Updated dependencies [[`b9a2961`](https://github.com/mastra-ai/mastra/commit/b9a2961c1be81e3639c0879e58588c26dd0ae866), [`b33c77d`](https://github.com/mastra-ai/mastra/commit/b33c77d5293f14a794f3ec38dc947a6676de2764), [`1274eb3`](https://github.com/mastra-ai/mastra/commit/1274eb3a9508f579ceb3187fbce34408222d4b71), [`cdd5f93`](https://github.com/mastra-ai/mastra/commit/cdd5f939cefa67390629704dce92563ccbf492b2), [`1274eb3`](https://github.com/mastra-ai/mastra/commit/1274eb3a9508f579ceb3187fbce34408222d4b71), [`0ac14ce`](https://github.com/mastra-ai/mastra/commit/0ac14cea48e1b0a7857782153c78f7242fdf7e1a), [`9566d27`](https://github.com/mastra-ai/mastra/commit/9566d27ead3d95bdbe5a69e5a082a68222829cf2), [`8be63b0`](https://github.com/mastra-ai/mastra/commit/8be63b015fb8d72cea1220f05e7dc3bb997cc249), [`1009f77`](https://github.com/mastra-ai/mastra/commit/1009f772aa40016b49267c8566d0c29f6a16aa3c), [`1b8728a`](https://github.com/mastra-ai/mastra/commit/1b8728a57fd844205a452b0b4216d20ff60c784a), [`23c31de`](https://github.com/mastra-ai/mastra/commit/23c31de96ed8153402dcf092ac84b27a0c3638c1), [`0368766`](https://github.com/mastra-ai/mastra/commit/0368766744c7ea3df4d6059e2cc15f7bdf55f5a6), [`6f578ac`](https://github.com/mastra-ai/mastra/commit/6f578acba84930b406b2a0700b17cfdfaf5aae56), [`345eecc`](https://github.com/mastra-ai/mastra/commit/345eecce6ba519b5d987f0e10b5de4c8e5734580), [`1917c53`](https://github.com/mastra-ai/mastra/commit/1917c53b19dac43926f29c496893b0686462dca4), [`c01012f`](https://github.com/mastra-ai/mastra/commit/c01012f50368d29eb3fc3764df42d48291973d23), [`705ba98`](https://github.com/mastra-ai/mastra/commit/705ba98726d388a596e896225f237907ca6807a9), [`95857bc`](https://github.com/mastra-ai/mastra/commit/95857bcd6669da7193f503e803f0d72a2bd66be6), [`e62c108`](https://github.com/mastra-ai/mastra/commit/e62c108409dfd6a6cac0a48ec39c5cc81d24fd52), [`2866f04`](https://github.com/mastra-ai/mastra/commit/2866f04953edb78c1637fa45cc53abe24122edcb), [`ee14cae`](https://github.com/mastra-ai/mastra/commit/ee14cae244805783bde518a6142de28b744b169c), [`e84e791`](https://github.com/mastra-ai/mastra/commit/e84e79174031d7bc8793ca6c805eb38b06e7cfb1), [`c2f0b7f`](https://github.com/mastra-ai/mastra/commit/c2f0b7f1370f4428d165f51f0d1d9a48331cc257), [`213feb8`](https://github.com/mastra-ai/mastra/commit/213feb87bfdd1d8ec00ea660e218f9bcfcb34e7b), [`58e287b`](https://github.com/mastra-ai/mastra/commit/58e287b1edaf978b13745a1795989cad3826e82b), [`e420b3c`](https://github.com/mastra-ai/mastra/commit/e420b3c3ffc98bbc5b791897ea390bb47af99696), [`be875ed`](https://github.com/mastra-ai/mastra/commit/be875ed43f856742ce58529f531b5ea0ae6911f3), [`9eefdc0`](https://github.com/mastra-ai/mastra/commit/9eefdc0ac03f989718c6d835334940a977938895), [`bfbbb01`](https://github.com/mastra-ai/mastra/commit/bfbbb01bd845ba54cdc0c678c277d08a7cb847e4), [`7d112ca`](https://github.com/mastra-ai/mastra/commit/7d112ca17078479b2659b88ba1c85b936cfc111c)]:
  - @mastra/core@1.48.0

## 0.2.1-alpha.0

### Patch Changes

- Fixed Railway sandbox templates so they are built once during sandbox creation. ([#18605](https://github.com/mastra-ai/mastra/pull/18605))

- Updated dependencies [[`cdd5f93`](https://github.com/mastra-ai/mastra/commit/cdd5f939cefa67390629704dce92563ccbf492b2), [`1b8728a`](https://github.com/mastra-ai/mastra/commit/1b8728a57fd844205a452b0b4216d20ff60c784a), [`213feb8`](https://github.com/mastra-ai/mastra/commit/213feb87bfdd1d8ec00ea660e218f9bcfcb34e7b)]:
  - @mastra/core@1.48.0-alpha.3

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

- dependencies updates: ([#17861](https://github.com/mastra-ai/mastra/pull/17861))
  - Updated dependency [`railway@^3.3.1` ↗︎](https://www.npmjs.com/package/railway/v/3.3.1) (from `^3.1.1`, in `dependencies`)

- Improved process execution by using Railway SDK's native `cwd` and `env` exec options. ([#17902](https://github.com/mastra-ai/mastra/pull/17902))
  Commands now run with the configured working directory and environment variables without client-side shell wrapping.
- Updated dependencies [[`de66bb0`](https://github.com/mastra-ai/mastra/commit/de66bb040570444c702ce4d8e1e228a5de2949cb), [`67bf8e2`](https://github.com/mastra-ai/mastra/commit/67bf8e206dfe583954d96015cf0d09f7ac50e45f), [`8216d05`](https://github.com/mastra-ai/mastra/commit/8216d0528d866eb9a07f5d4c87ea3bb1e1139b45), [`d18b23c`](https://github.com/mastra-ai/mastra/commit/d18b23c5e29dfc381e73e3c51fcf6c779afd1823), [`5eb94eb`](https://github.com/mastra-ai/mastra/commit/5eb94ebcf66d4e28c9e26d5821ac93379bab20a0), [`1fa3e12`](https://github.com/mastra-ai/mastra/commit/1fa3e123582b63cfe49de4ee52dc6a065e8d956a), [`f9ee2ac`](https://github.com/mastra-ai/mastra/commit/f9ee2ac661af584e61bc063ac208c9035cd752ef), [`c853d53`](https://github.com/mastra-ai/mastra/commit/c853d535d2df84ab89db1adb4c28900c54c9a2d2), [`d8df1f8`](https://github.com/mastra-ai/mastra/commit/d8df1f8e947e1966c9d4e54713df56d0d0d65226), [`9192ddb`](https://github.com/mastra-ai/mastra/commit/9192ddbced8949113b30de444cbe763f075b59f5), [`ae96523`](https://github.com/mastra-ai/mastra/commit/ae965231f562d9766b0c90c49a69fc68acaa031c), [`17d5a92`](https://github.com/mastra-ai/mastra/commit/17d5a9211aa293b4d4418de3de70dc0394d58101), [`5573693`](https://github.com/mastra-ai/mastra/commit/5573693b589822250e20dfe6cf66e9ff3bc96da8), [`ec4da8a`](https://github.com/mastra-ai/mastra/commit/ec4da8a09e0d2ab452c6ee2c786042ea826b77e5), [`adc44e1`](https://github.com/mastra-ai/mastra/commit/adc44e13c7e570b91e86b20ea7556e61d819db31), [`ed346c0`](https://github.com/mastra-ai/mastra/commit/ed346c0bee2d8496690a4e538bfba1e46894660f), [`c9ce1b2`](https://github.com/mastra-ai/mastra/commit/c9ce1b28d10871110648f9d7b6d76e880b9fa999), [`3ef01fd`](https://github.com/mastra-ai/mastra/commit/3ef01fd130b53d5bd4f828beb174e516a2eb1158), [`245a9a3`](https://github.com/mastra-ai/mastra/commit/245a9a315705fce17ddd980f78a92504b6615c4a), [`dc0b611`](https://github.com/mastra-ai/mastra/commit/dc0b6119b769bd00ee2c5df9259fb376fe63077a), [`38b5de8`](https://github.com/mastra-ai/mastra/commit/38b5de8e5d1d41a69522addf53d96f4b3a1d5bf0), [`dc0b611`](https://github.com/mastra-ai/mastra/commit/dc0b6119b769bd00ee2c5df9259fb376fe63077a), [`dd6a66e`](https://github.com/mastra-ai/mastra/commit/dd6a66ea0b32e0dea8059aec6b35d151e2c87dc4), [`d785c59`](https://github.com/mastra-ai/mastra/commit/d785c593b67fcb4cdc4fab9fdbde5f3b7665efc0), [`1fa3e12`](https://github.com/mastra-ai/mastra/commit/1fa3e123582b63cfe49de4ee52dc6a065e8d956a), [`8b984f4`](https://github.com/mastra-ai/mastra/commit/8b984f4361c202270ceb69257185c4756c9a7c56), [`bf08402`](https://github.com/mastra-ai/mastra/commit/bf084022374fa5d06ca70ed67a86dd64e379071b), [`81fe587`](https://github.com/mastra-ai/mastra/commit/81fe587275035715c1720ddf3fee0505cf053036), [`1fa3e12`](https://github.com/mastra-ai/mastra/commit/1fa3e123582b63cfe49de4ee52dc6a065e8d956a), [`403c438`](https://github.com/mastra-ai/mastra/commit/403c438e417278989ce247233d2c465b8d902cdd), [`f8ba195`](https://github.com/mastra-ai/mastra/commit/f8ba1954e27ee2b20586cc6cd9cf13c002c232f2)]:
  - @mastra/core@1.43.0

## 0.1.0

### Minor Changes

- Add `@mastra/railway`, a sandbox provider for [Railway Sandboxes](https://docs.railway.com/sandboxes). ([#17784](https://github.com/mastra-ai/mastra/pull/17784))

  Provisions ephemeral, isolated Linux VMs on Railway through the Railway
  TypeScript SDK and exposes them as a Mastra `WorkspaceSandbox`. Supports command
  execution with streaming output and timeouts, background process management,
  configurable idle timeout, `ISOLATED`/`PRIVATE` network isolation, custom base
  images via the Railway template builder, forking a running sandbox into a new
  one, and reattaching to an existing sandbox by ID. Also exports
  `railwaySandboxProvider` for registration with `MastraEditor`.

  ```typescript
  import { Workspace } from '@mastra/core/workspace';
  import { RailwaySandbox } from '@mastra/railway';

  const workspace = new Workspace({
    sandbox: new RailwaySandbox({
      idleTimeoutMinutes: 30,
      networkIsolation: 'PRIVATE',
    }),
  });
  ```

### Patch Changes

- Updated dependencies [[`d468acb`](https://github.com/mastra-ai/mastra/commit/d468acb07aec1bb19a2cb0ada8042b05b46746b2), [`575f815`](https://github.com/mastra-ai/mastra/commit/575f815c5c3567b71c0b83cbb7fa98c8253a9d9c), [`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`053735a`](https://github.com/mastra-ai/mastra/commit/053735a75c2c18e23ce34d9468007efa4a45f4c4), [`306909a`](https://github.com/mastra-ai/mastra/commit/306909a693de77d709b38706e2673c9547d24a28), [`5191af8`](https://github.com/mastra-ai/mastra/commit/5191af80c799eea25357c545fc05d91b3883531d), [`43bd3d4`](https://github.com/mastra-ai/mastra/commit/43bd3d421987463fdf35386a45199c49499ed069), [`e6fa79e`](https://github.com/mastra-ai/mastra/commit/e6fa79ec72a2ddffdd25e85270398951e9d552a4), [`904bcdf`](https://github.com/mastra-ai/mastra/commit/904bcdf7b8004aa7be823f9f70ca63580e47e470), [`7f5ee1d`](https://github.com/mastra-ai/mastra/commit/7f5ee1dca46daee8d2817f2ebe49e6335da81956), [`1e9aab5`](https://github.com/mastra-ai/mastra/commit/1e9aab50ff11e6e88fde4d7cbf512c44a9fe8d61), [`2bccba4`](https://github.com/mastra-ai/mastra/commit/2bccba4c03cadc815c2d54cbf4dd43a922140a8d), [`bf8eb6d`](https://github.com/mastra-ai/mastra/commit/bf8eb6d0ec213a403eb9265a594ad283c44ab3dc), [`e9be4e7`](https://github.com/mastra-ai/mastra/commit/e9be4e747ec3d8b65548bff92f9377db06105376), [`493a328`](https://github.com/mastra-ai/mastra/commit/493a328f4346a1deeb9f1e2e44c8f2a3a4d7591b), [`d53cfc2`](https://github.com/mastra-ai/mastra/commit/d53cfc2c7f8d78343a4aa84ec4e129ba25f3325e), [`65799d4`](https://github.com/mastra-ai/mastra/commit/65799d4d549e5ebb9c848fbe3f51ac090f64becf), [`c268c89`](https://github.com/mastra-ai/mastra/commit/c268c89f4c63a93ee474d3cffdf3ea60bf00d4f2), [`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`014e00f`](https://github.com/mastra-ai/mastra/commit/014e00f2b3a597a016b72f9901c6ab27d491f822), [`029a414`](https://github.com/mastra-ai/mastra/commit/029a4141719793bd3e898a39eb5a0466a55f5f3a), [`d468acb`](https://github.com/mastra-ai/mastra/commit/d468acb07aec1bb19a2cb0ada8042b05b46746b2), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`d371ac1`](https://github.com/mastra-ai/mastra/commit/d371ac1d9820afaaf7cfdbc380a475946a994d8f), [`2bccba4`](https://github.com/mastra-ai/mastra/commit/2bccba4c03cadc815c2d54cbf4dd43a922140a8d), [`0c72f03`](https://github.com/mastra-ai/mastra/commit/0c72f032abb13254df5a7856d64be2f207b8006d), [`cf182b7`](https://github.com/mastra-ai/mastra/commit/cf182b7fb495767946d9840ef29f19cfa906f31f), [`3b45ea9`](https://github.com/mastra-ai/mastra/commit/3b45ea95015557a6cb9d70dc5252af54ab1b78ac), [`a049c2a`](https://github.com/mastra-ai/mastra/commit/a049c2a9dfb41d0ee2e7a28874a88cd64fd5669f), [`f084be1`](https://github.com/mastra-ai/mastra/commit/f084be1fcbe33ad7480913e44d6130c421c0976f), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`2a96528`](https://github.com/mastra-ai/mastra/commit/2a9652848dfa3c5a2426f952e9d93554c26fd90f), [`f2ab060`](https://github.com/mastra-ai/mastra/commit/f2ab060162bea81505fda553e2cee29c1979fd04), [`5d302c8`](https://github.com/mastra-ai/mastra/commit/5d302c8eda1a6ac74eab5e442c4f64db6cc97a06), [`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`a952852`](https://github.com/mastra-ai/mastra/commit/a952852c971a21fb646cd907c75fcf4443cdc963), [`2656d9c`](https://github.com/mastra-ai/mastra/commit/2656d9c2976d4f3354253bfbbbf9b88a1b2bbf34), [`63e3fe1`](https://github.com/mastra-ai/mastra/commit/63e3fe13cc1ea96f91d7c68aea92f400faf9e4da), [`1d4ce8d`](https://github.com/mastra-ai/mastra/commit/1d4ce8daaa54511f325c1b609d31b8e54009d677), [`8c68372`](https://github.com/mastra-ai/mastra/commit/8c68372e85fe0b066ec12c58bd29ffb93e54c552)]:
  - @mastra/core@1.42.0

## 0.1.0-alpha.0

### Minor Changes

- Add `@mastra/railway`, a sandbox provider for [Railway Sandboxes](https://docs.railway.com/sandboxes). ([#17784](https://github.com/mastra-ai/mastra/pull/17784))

  Provisions ephemeral, isolated Linux VMs on Railway through the Railway
  TypeScript SDK and exposes them as a Mastra `WorkspaceSandbox`. Supports command
  execution with streaming output and timeouts, background process management,
  configurable idle timeout, `ISOLATED`/`PRIVATE` network isolation, custom base
  images via the Railway template builder, forking a running sandbox into a new
  one, and reattaching to an existing sandbox by ID. Also exports
  `railwaySandboxProvider` for registration with `MastraEditor`.

  ```typescript
  import { Workspace } from '@mastra/core/workspace';
  import { RailwaySandbox } from '@mastra/railway';

  const workspace = new Workspace({
    sandbox: new RailwaySandbox({
      idleTimeoutMinutes: 30,
      networkIsolation: 'PRIVATE',
    }),
  });
  ```

### Patch Changes

- Updated dependencies [[`575f815`](https://github.com/mastra-ai/mastra/commit/575f815c5c3567b71c0b83cbb7fa98c8253a9d9c), [`306909a`](https://github.com/mastra-ai/mastra/commit/306909a693de77d709b38706e2673c9547d24a28), [`5191af8`](https://github.com/mastra-ai/mastra/commit/5191af80c799eea25357c545fc05d91b3883531d), [`43bd3d4`](https://github.com/mastra-ai/mastra/commit/43bd3d421987463fdf35386a45199c49499ed069), [`e6fa79e`](https://github.com/mastra-ai/mastra/commit/e6fa79ec72a2ddffdd25e85270398951e9d552a4), [`904bcdf`](https://github.com/mastra-ai/mastra/commit/904bcdf7b8004aa7be823f9f70ca63580e47e470), [`7f5ee1d`](https://github.com/mastra-ai/mastra/commit/7f5ee1dca46daee8d2817f2ebe49e6335da81956), [`1e9aab5`](https://github.com/mastra-ai/mastra/commit/1e9aab50ff11e6e88fde4d7cbf512c44a9fe8d61), [`bf8eb6d`](https://github.com/mastra-ai/mastra/commit/bf8eb6d0ec213a403eb9265a594ad283c44ab3dc), [`493a328`](https://github.com/mastra-ai/mastra/commit/493a328f4346a1deeb9f1e2e44c8f2a3a4d7591b), [`029a414`](https://github.com/mastra-ai/mastra/commit/029a4141719793bd3e898a39eb5a0466a55f5f3a), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`d371ac1`](https://github.com/mastra-ai/mastra/commit/d371ac1d9820afaaf7cfdbc380a475946a994d8f), [`cf182b7`](https://github.com/mastra-ai/mastra/commit/cf182b7fb495767946d9840ef29f19cfa906f31f), [`a049c2a`](https://github.com/mastra-ai/mastra/commit/a049c2a9dfb41d0ee2e7a28874a88cd64fd5669f), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`2a96528`](https://github.com/mastra-ai/mastra/commit/2a9652848dfa3c5a2426f952e9d93554c26fd90f), [`2656d9c`](https://github.com/mastra-ai/mastra/commit/2656d9c2976d4f3354253bfbbbf9b88a1b2bbf34), [`63e3fe1`](https://github.com/mastra-ai/mastra/commit/63e3fe13cc1ea96f91d7c68aea92f400faf9e4da), [`1d4ce8d`](https://github.com/mastra-ai/mastra/commit/1d4ce8daaa54511f325c1b609d31b8e54009d677), [`8c68372`](https://github.com/mastra-ai/mastra/commit/8c68372e85fe0b066ec12c58bd29ffb93e54c552)]:
  - @mastra/core@1.42.0-alpha.4
