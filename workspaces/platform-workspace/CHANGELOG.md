# @mastra/platform

## 1.5.1-alpha.0

### Patch Changes

- Repository templates now pin to the last default-branch head resolved for the same clone URL when the lookup fails, instead of dropping the repo steps and booting the base image. ([#22947](https://github.com/mastra-ai/mastra/pull/22947))

- Updated dependencies [[`b72c747`](https://github.com/mastra-ai/mastra/commit/b72c747a1a698c829c7c1d42e75f72c6d1808dde), [`89f2486`](https://github.com/mastra-ai/mastra/commit/89f2486028ce25c5db19d1f361d5f65cd3ff93e5), [`1778103`](https://github.com/mastra-ai/mastra/commit/17781034204a151a1ff910e9d11d21effe22a9e0), [`2801d26`](https://github.com/mastra-ai/mastra/commit/2801d26b69bbe8929d302abd09619a68b4cc0d98), [`ffc6440`](https://github.com/mastra-ai/mastra/commit/ffc6440d13b9392b3cf1ff309d3b9cde4a791038), [`f31c3fa`](https://github.com/mastra-ai/mastra/commit/f31c3fae16a0710f9e52dba9bccc0018f9da2ac1), [`9d647e2`](https://github.com/mastra-ai/mastra/commit/9d647e25b51cd246ef974d9cad6b05dfdd37126e)]:
  - @mastra/core@1.65.0-alpha.1

## 1.5.0

### Minor Changes

- Added reusable sandbox templates to Platform workspaces. Build templates through `PlatformSandbox` with the portable `Template()` API; Platform content-addresses each serialized definition for reuse. Public repositories can be warmed lazily with `createRepoTemplate()`. Use `cpuCount()` and `memoryMB()` to size E2B template builds and sandboxes created from the exact or a resource-matched stale build; `createRepoTemplate()` accepts the same sizing as plain options. Railway ignores these resource methods. ([#22065](https://github.com/mastra-ai/mastra/pull/22065))

  ```ts
  const sandbox = new PlatformSandbox({
    environmentId,
    template: Template().cpuCount(4).memoryMB(8192).runCmd('pnpm install'),
  });

  // createRepoTemplate takes the whole sandbox context: a session with no
  // repository gets undefined back and boots the provider default.
  const repoSandbox = new PlatformSandbox({
    environmentId,
    template: createRepoTemplate({
      getRepositoryAccess: async () => ({ cloneUrl: 'https://github.com/mastra-ai/mastra.git' }),
      setupCommand: 'pnpm install --frozen-lockfile',
      memoryMB: 2048,
    }),
  });
  ```

  Template environment values are serialized by default. Pass `{ ephemeral: true }` to `setEnvs()` for short-lived build credentials that must stay outside the definition, identity, persistent record, and runtime environment. `Template.build()` can eagerly start or reuse the provider build without provisioning a sandbox. Railway includes transient values in its provider cache input, so rotating one may trigger another Railway build while the Platform template ID remains stable.

  `PlatformSandbox.start()` never blocks on a template build. When the exact template is not yet ready, Platform boots the sandbox on the best available fallback (an E2B prior member of the same family with matching effective resources if one exists, otherwise the provider base template) and builds the exact template in the background. A provider-base fallback may use provider-default resources. The sandbox surfaces `templatePending` for observability; reconcile filesystem state in your own runtime setup (for example, an `onStart` hook that runs `git fetch && git checkout <sha>`).

  `Template().withFamily(key)` attaches a caller-supplied family key that groups successive builds of the "same thing" (e.g. the same repository+workdir across commits) so an E2B definition can warm-start on a resource-matched prior member of the same family. Railway doesn't use family fallback. `createRepoTemplate()` populates the key automatically as `repo:<cloneUrl>:<workdir>`.

- Changed Platform sandboxes to use E2B by default. Set sandboxProvider or SANDBOX_PROVIDER to railway to opt into Railway. ([#22065](https://github.com/mastra-ai/mastra/pull/22065))

- `createRepoTemplate` accepts `buildEnv`: environment variables for the build steps only (for example, remote cache credentials). They never enter the template definition or identity. Template fallback warnings now redact credentials. ([#22698](https://github.com/mastra-ai/mastra/pull/22698))

- `createRepoTemplate` now runs each command (clone, fetch, checkout, and each setup command) as its own cached build step, and `setupCommand` accepts an array. A new `workingDirectory` option sets the cwd for the build and for sandboxes created from the template; the repository is cloned to `<workingDirectory>/<repo>`. When omitted, the clone lands in the base image's working directory instead of `$HOME`. ([#22698](https://github.com/mastra-ai/mastra/pull/22698))

  ```ts
  createRepoTemplate({
    getRepositoryAccess,
    setupCommand: ['pnpm i', 'pnpm build'],
    workingDirectory: '/workspace',
  });
  ```

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

- Removed the automatic sandbox snapshot Factory took after every agent turn. ([#22846](https://github.com/mastra-ai/mastra/pull/22846))

  `PlatformSandbox.destroy()` on E2B now only kills the sandbox instead of first asking the platform to delete a recovery checkpoint.

- Repo templates now write `.mastra-sandbox/setup` beside the checkout as their last build step. It contains `sha256:<digest of the setup commands>`, so a sandbox booted from the template can tell that this setup already ran. ([#22837](https://github.com/mastra-ai/mastra/pull/22837))

- Repository templates now clone with `--depth=1 --single-branch`, so template builds transfer less history. ([#22840](https://github.com/mastra-ai/mastra/pull/22840))

- Fixed repo templates silently degrading to a repo-less template on hosts without a `git` binary (deployed Mastra servers), which made every session cold-clone at runtime. GitHub (github.com) clone URLs now resolve the default-branch head through the GitHub REST API; other hosts keep using `git ls-remote`. ([#22833](https://github.com/mastra-ai/mastra/pull/22833))

- Remove `CHANGELOG.md` from distributed npm files resulting in reduced package size ([#22737](https://github.com/mastra-ai/mastra/pull/22737))

- Updated dependencies [[`3910c77`](https://github.com/mastra-ai/mastra/commit/3910c77413a3058ab270c6dbc74a59bc3cdf67ea), [`decd47d`](https://github.com/mastra-ai/mastra/commit/decd47d0db2a891a6832e226557145b6658b0b19), [`c1d3422`](https://github.com/mastra-ai/mastra/commit/c1d3422e8052a4282e8547df914b6231e5345f01), [`285ce1c`](https://github.com/mastra-ai/mastra/commit/285ce1c1399341a37e76233aa94dbf9f1a41bd5d), [`e983f74`](https://github.com/mastra-ai/mastra/commit/e983f749873189f767f509eb33d1a3596c0f1c74), [`4596348`](https://github.com/mastra-ai/mastra/commit/45963483f4cd2810f0646469916f74266a3dd607), [`7686114`](https://github.com/mastra-ai/mastra/commit/7686114e3802f4cea414377eaf10999524d670fa), [`ea56b1f`](https://github.com/mastra-ai/mastra/commit/ea56b1fa6e0f99673d2f8a5b7dacc8d351507ff7), [`50469b2`](https://github.com/mastra-ai/mastra/commit/50469b2d085fc8550579ca4b741eb359d1705abc), [`5b5e3cc`](https://github.com/mastra-ai/mastra/commit/5b5e3cc006950b0ff9720c5be8396d4c95e8a6ac), [`809e882`](https://github.com/mastra-ai/mastra/commit/809e882ee9c154ac642eaed396163df706db6ae4), [`cedc25d`](https://github.com/mastra-ai/mastra/commit/cedc25d8c2dec005d8b10b6ce2d36feef1162ff0), [`1255235`](https://github.com/mastra-ai/mastra/commit/125523539237c39f84d126d16476093336089c0d), [`2e87ffb`](https://github.com/mastra-ai/mastra/commit/2e87ffbb454cc88bd8a8c022d1e46325e7907482), [`a499422`](https://github.com/mastra-ai/mastra/commit/a499422cd7eccca184cac7b7a684a6199784aa82), [`cf58c86`](https://github.com/mastra-ai/mastra/commit/cf58c86cb48ccc72677bdaa422e43f102683184c), [`a3606a0`](https://github.com/mastra-ai/mastra/commit/a3606a09f3deaeef17caf04b9c6a0d7cd6b80fe6), [`4095752`](https://github.com/mastra-ai/mastra/commit/40957529233d202446ebecab1f59c76e99910230), [`74b21fd`](https://github.com/mastra-ai/mastra/commit/74b21fd9bbe88e770d9acf4e00e01c8bbb7c9e61), [`045c3c7`](https://github.com/mastra-ai/mastra/commit/045c3c78f2129fea5d4467bb26cff2b49788b3d0), [`a3606a0`](https://github.com/mastra-ai/mastra/commit/a3606a09f3deaeef17caf04b9c6a0d7cd6b80fe6), [`449d112`](https://github.com/mastra-ai/mastra/commit/449d1120cc1f9c43a71308a9fd8b178cfb11355f), [`e8aca33`](https://github.com/mastra-ai/mastra/commit/e8aca339dc92c0b60baad3d948a7c48ec9ae106f), [`c5c9ffc`](https://github.com/mastra-ai/mastra/commit/c5c9ffc3b36bdc7b17d6f911be81e28ba02acfad), [`9d3073c`](https://github.com/mastra-ai/mastra/commit/9d3073c230dbff45d58c259d676b2b137afd2ff5), [`19b71cf`](https://github.com/mastra-ai/mastra/commit/19b71cf1de8afe6f69a3171d8a5a28086790e49b), [`2a0ca02`](https://github.com/mastra-ai/mastra/commit/2a0ca021d95e23f1d1c0b5fe858b0b56f71fe0ba), [`ff539f6`](https://github.com/mastra-ai/mastra/commit/ff539f6dc21137fbeb3f0867f07069cbce45c15f), [`9fdb3bc`](https://github.com/mastra-ai/mastra/commit/9fdb3bc0f9bfab5269b4f3045595e62323da5d3a), [`d53a056`](https://github.com/mastra-ai/mastra/commit/d53a05614893e8d1bbfdab50b42c19435e6bd065), [`420052f`](https://github.com/mastra-ai/mastra/commit/420052fcac3fc672be17fe655667dfbdbd35a2cc), [`28ce924`](https://github.com/mastra-ai/mastra/commit/28ce924276eeca492e6a360e5482ed20c2785ef6)]:
  - @mastra/core@1.64.0

## 1.5.0-alpha.6

### Patch Changes

- Removed the automatic sandbox snapshot Factory took after every agent turn. ([#22846](https://github.com/mastra-ai/mastra/pull/22846))

  `PlatformSandbox.destroy()` on E2B now only kills the sandbox instead of first asking the platform to delete a recovery checkpoint.

- Repository templates now clone with `--depth=1 --single-branch`, so template builds transfer less history. ([#22840](https://github.com/mastra-ai/mastra/pull/22840))

- Updated dependencies [[`7686114`](https://github.com/mastra-ai/mastra/commit/7686114e3802f4cea414377eaf10999524d670fa), [`50469b2`](https://github.com/mastra-ai/mastra/commit/50469b2d085fc8550579ca4b741eb359d1705abc), [`809e882`](https://github.com/mastra-ai/mastra/commit/809e882ee9c154ac642eaed396163df706db6ae4), [`74b21fd`](https://github.com/mastra-ai/mastra/commit/74b21fd9bbe88e770d9acf4e00e01c8bbb7c9e61), [`c5c9ffc`](https://github.com/mastra-ai/mastra/commit/c5c9ffc3b36bdc7b17d6f911be81e28ba02acfad)]:
  - @mastra/core@1.64.0-alpha.9

## 1.5.0-alpha.5

### Patch Changes

- Update README to include accurate, up-to-date information ([#22858](https://github.com/mastra-ai/mastra/pull/22858))

- Updated dependencies [[`e983f74`](https://github.com/mastra-ai/mastra/commit/e983f749873189f767f509eb33d1a3596c0f1c74), [`cedc25d`](https://github.com/mastra-ai/mastra/commit/cedc25d8c2dec005d8b10b6ce2d36feef1162ff0), [`9fdb3bc`](https://github.com/mastra-ai/mastra/commit/9fdb3bc0f9bfab5269b4f3045595e62323da5d3a)]:
  - @mastra/core@1.64.0-alpha.7

## 1.5.0-alpha.4

### Patch Changes

- Repo templates now write `.mastra-sandbox/setup` beside the checkout as their last build step. It contains `sha256:<digest of the setup commands>`, so a sandbox booted from the template can tell that this setup already ran. ([#22837](https://github.com/mastra-ai/mastra/pull/22837))

- Updated dependencies [[`c1d3422`](https://github.com/mastra-ai/mastra/commit/c1d3422e8052a4282e8547df914b6231e5345f01), [`4596348`](https://github.com/mastra-ai/mastra/commit/45963483f4cd2810f0646469916f74266a3dd607), [`e8aca33`](https://github.com/mastra-ai/mastra/commit/e8aca339dc92c0b60baad3d948a7c48ec9ae106f), [`19b71cf`](https://github.com/mastra-ai/mastra/commit/19b71cf1de8afe6f69a3171d8a5a28086790e49b)]:
  - @mastra/core@1.64.0-alpha.6

## 1.5.0-alpha.3

### Patch Changes

- Fixed repo templates silently degrading to a repo-less template on hosts without a `git` binary (deployed Mastra servers), which made every session cold-clone at runtime. GitHub (github.com) clone URLs now resolve the default-branch head through the GitHub REST API; other hosts keep using `git ls-remote`. ([#22833](https://github.com/mastra-ai/mastra/pull/22833))

- Updated dependencies [[`decd47d`](https://github.com/mastra-ai/mastra/commit/decd47d0db2a891a6832e226557145b6658b0b19), [`285ce1c`](https://github.com/mastra-ai/mastra/commit/285ce1c1399341a37e76233aa94dbf9f1a41bd5d), [`5b5e3cc`](https://github.com/mastra-ai/mastra/commit/5b5e3cc006950b0ff9720c5be8396d4c95e8a6ac), [`045c3c7`](https://github.com/mastra-ai/mastra/commit/045c3c78f2129fea5d4467bb26cff2b49788b3d0), [`d53a056`](https://github.com/mastra-ai/mastra/commit/d53a05614893e8d1bbfdab50b42c19435e6bd065)]:
  - @mastra/core@1.64.0-alpha.5

## 1.5.0-alpha.2

### Minor Changes

- `createRepoTemplate` accepts `buildEnv`: environment variables for the build steps only (for example, remote cache credentials). They never enter the template definition or identity. Template fallback warnings now redact credentials. ([#22698](https://github.com/mastra-ai/mastra/pull/22698))

- `createRepoTemplate` now runs each command (clone, fetch, checkout, and each setup command) as its own cached build step, and `setupCommand` accepts an array. A new `workingDirectory` option sets the cwd for the build and for sandboxes created from the template; the repository is cloned to `<workingDirectory>/<repo>`. When omitted, the clone lands in the base image's working directory instead of `$HOME`. ([#22698](https://github.com/mastra-ai/mastra/pull/22698))

  ```ts
  createRepoTemplate({
    getRepositoryAccess,
    setupCommand: ['pnpm i', 'pnpm build'],
    workingDirectory: '/workspace',
  });
  ```

### Patch Changes

- Updated dependencies [[`a499422`](https://github.com/mastra-ai/mastra/commit/a499422cd7eccca184cac7b7a684a6199784aa82), [`9d3073c`](https://github.com/mastra-ai/mastra/commit/9d3073c230dbff45d58c259d676b2b137afd2ff5)]:
  - @mastra/core@1.64.0-alpha.4

## 1.5.0-alpha.1

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

## 1.5.0-alpha.0

### Minor Changes

- Added reusable sandbox templates to Platform workspaces. Build templates through `PlatformSandbox` with the portable `Template()` API; Platform content-addresses each serialized definition for reuse. Public repositories can be warmed lazily with `createRepoTemplate()`. Use `cpuCount()` and `memoryMB()` to size E2B template builds and sandboxes created from the exact or a resource-matched stale build; `createRepoTemplate()` accepts the same sizing as plain options. Railway ignores these resource methods. ([#22065](https://github.com/mastra-ai/mastra/pull/22065))

  ```ts
  const sandbox = new PlatformSandbox({
    environmentId,
    template: Template().cpuCount(4).memoryMB(8192).runCmd('pnpm install'),
  });

  // createRepoTemplate takes the whole sandbox context: a session with no
  // repository gets undefined back and boots the provider default.
  const repoSandbox = new PlatformSandbox({
    environmentId,
    template: createRepoTemplate({
      getRepositoryAccess: async () => ({ cloneUrl: 'https://github.com/mastra-ai/mastra.git' }),
      setupCommand: 'pnpm install --frozen-lockfile',
      memoryMB: 2048,
    }),
  });
  ```

  Template environment values are serialized by default. Pass `{ ephemeral: true }` to `setEnvs()` for short-lived build credentials that must stay outside the definition, identity, persistent record, and runtime environment. `Template.build()` can eagerly start or reuse the provider build without provisioning a sandbox. Railway includes transient values in its provider cache input, so rotating one may trigger another Railway build while the Platform template ID remains stable.

  `PlatformSandbox.start()` never blocks on a template build. When the exact template is not yet ready, Platform boots the sandbox on the best available fallback (an E2B prior member of the same family with matching effective resources if one exists, otherwise the provider base template) and builds the exact template in the background. A provider-base fallback may use provider-default resources. The sandbox surfaces `templatePending` for observability; reconcile filesystem state in your own runtime setup (for example, an `onStart` hook that runs `git fetch && git checkout <sha>`).

  `Template().withFamily(key)` attaches a caller-supplied family key that groups successive builds of the "same thing" (e.g. the same repository+workdir across commits) so an E2B definition can warm-start on a resource-matched prior member of the same family. Railway doesn't use family fallback. `createRepoTemplate()` populates the key automatically as `repo:<cloneUrl>:<workdir>`.

- Changed Platform sandboxes to use E2B by default. Set sandboxProvider or SANDBOX_PROVIDER to railway to opt into Railway. ([#22065](https://github.com/mastra-ai/mastra/pull/22065))

### Patch Changes

- Updated dependencies [[`3910c77`](https://github.com/mastra-ai/mastra/commit/3910c77413a3058ab270c6dbc74a59bc3cdf67ea)]:
  - @mastra/core@1.63.3-alpha.0

## 1.4.1

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

- Honor the sandbox runtime environment (`setEnv()`/`getEnv()` from `@mastra/core`) in every workspace sandbox provider. Environment variables set after construction now reach subsequent commands on all providers: ([#22250](https://github.com/mastra-ai/mastra/pull/22250))

  - Process-manager-routed providers (E2B, Blaxel, Cloudflare, Daytona, Docker, Modal, Vercel microVM spawns) inherit the merge from the core spawn wrapper; their duplicated per-manager env plumbing is removed.
  - Providers with their own exec transports (AgentCore, Apple Container, Railway, Vercel microVM and serverless `executeCommand`, Platform's private-network, WebSocket lease, and E2B lease paths) now merge `getEnv()` under per-call env.

  Constructor `env` continues to behave as before: it seeds the sandbox runtime environment, and providers that bake env into the VM or container at creation time (Docker, Modal, Railway, Apple Container, Vercel, Platform) still do so. Per-call `env` on `executeCommand` still takes precedence for that command only.

  Removed exported types (minor bump for these two packages): `BlaxelProcessManagerOptions` from `@mastra/blaxel` and `RailwayProcessManagerOptions` from `@mastra/railway`. Both existed only to pass `env` into a process manager constructed by hand; the core spawn wrapper now owns that merge, so the option and its type are gone.

- Updated dependencies [[`79f04a7`](https://github.com/mastra-ai/mastra/commit/79f04a7f6c6829da541139f638f2f1d267916e08), [`65edab1`](https://github.com/mastra-ai/mastra/commit/65edab1c233d17b8f163bad12fca410d0e6f16b1), [`1e47b75`](https://github.com/mastra-ai/mastra/commit/1e47b7520cab4cfaa8daed52f17e2e6d14ff7539), [`ab20a38`](https://github.com/mastra-ai/mastra/commit/ab20a38d0275f8d85e0f3833bd87ef487bcc609f), [`fd4d5fe`](https://github.com/mastra-ai/mastra/commit/fd4d5fe4f943699b85db5e74404f190d5a6b8c2a), [`ae8790c`](https://github.com/mastra-ai/mastra/commit/ae8790c4bfaa088d2ab279d1dcc06f326b9fd109), [`2c85f42`](https://github.com/mastra-ai/mastra/commit/2c85f428e04ccd63ea31a7ec80b5b327afdad555), [`11bbeb9`](https://github.com/mastra-ai/mastra/commit/11bbeb9b108ef2264e05acefc6dafb9cbb342921), [`48ef1f1`](https://github.com/mastra-ai/mastra/commit/48ef1f1d24eedafbb07f64e659a81b52b67b8bf6), [`aa3a85d`](https://github.com/mastra-ai/mastra/commit/aa3a85daf094c683bb97efdf4b6a696d2e474af5), [`d29d06f`](https://github.com/mastra-ai/mastra/commit/d29d06fe00bbd35b4571150ea04c59d2ed783c71), [`e6516df`](https://github.com/mastra-ai/mastra/commit/e6516dfcdae4f4ac0e7971d84359a81385ee602f), [`1a485f3`](https://github.com/mastra-ai/mastra/commit/1a485f3538f5ec64d58bd8b5e1e99de0c695c87b), [`0d37487`](https://github.com/mastra-ai/mastra/commit/0d37487d9f349388a3f1cef6a536cf9dcc4b6273), [`8661d7d`](https://github.com/mastra-ai/mastra/commit/8661d7d7179f0a024456aabdd8679bcecd09ac28), [`dbbfeb8`](https://github.com/mastra-ai/mastra/commit/dbbfeb85ec949dc9ebc0755e1ad262e4f5eba8db), [`575e343`](https://github.com/mastra-ai/mastra/commit/575e343900451021d96110916497d334af7bc252), [`0b2a3d1`](https://github.com/mastra-ai/mastra/commit/0b2a3d1783875c5b97b7b36ab3d03d7360e0dde7), [`6bb5d71`](https://github.com/mastra-ai/mastra/commit/6bb5d7193fe9166b219f0fccae17db7a5ae86e65), [`3cc9d00`](https://github.com/mastra-ai/mastra/commit/3cc9d00b2b4333e0377a5e9df5eff92c17ce7630), [`cacb839`](https://github.com/mastra-ai/mastra/commit/cacb8392d9e74189b56d857290b0615f98a2683d), [`57de7d6`](https://github.com/mastra-ai/mastra/commit/57de7d644ba7146edb4e9e6111ec4fa98c3a59e9), [`c8e4cea`](https://github.com/mastra-ai/mastra/commit/c8e4ceac9a390d78c8327dff3cdb2861dd71957f), [`ed01e9a`](https://github.com/mastra-ai/mastra/commit/ed01e9a807514a904374bf687a7b8f18750f6f78), [`b47b26e`](https://github.com/mastra-ai/mastra/commit/b47b26e6fe95cb8a3482be2c5e52de157fe59d0b), [`0d37487`](https://github.com/mastra-ai/mastra/commit/0d37487d9f349388a3f1cef6a536cf9dcc4b6273), [`733a537`](https://github.com/mastra-ai/mastra/commit/733a537489a858b5880b2e98809334fba895a221), [`e8e299c`](https://github.com/mastra-ai/mastra/commit/e8e299cc6abdfc39947e2fec25803493015d3882), [`edfc548`](https://github.com/mastra-ai/mastra/commit/edfc548886bc7bae17b681f8b6b41a47eb32bcd2), [`b05f486`](https://github.com/mastra-ai/mastra/commit/b05f48612984d5fe2447ea2d6cdd5c604d285b97), [`a8a4871`](https://github.com/mastra-ai/mastra/commit/a8a4871215f51da95c47129602157ce5372f634a), [`eb9ecaa`](https://github.com/mastra-ai/mastra/commit/eb9ecaa89c36e889749e3b825cfc507ce7f7980b), [`4ff3ee2`](https://github.com/mastra-ai/mastra/commit/4ff3ee2bff7ed07528b4817f8f49639031c72a4d), [`9207dfa`](https://github.com/mastra-ai/mastra/commit/9207dfab8062e5fc68b751684797ff86fe0b4e70), [`5165cdc`](https://github.com/mastra-ai/mastra/commit/5165cdcdcf50e144bb8113278535196cc9b07065), [`e737014`](https://github.com/mastra-ai/mastra/commit/e737014e0fc7035759762bb5b48baef1d6c0f6a7), [`6bb5d71`](https://github.com/mastra-ai/mastra/commit/6bb5d7193fe9166b219f0fccae17db7a5ae86e65), [`f591643`](https://github.com/mastra-ai/mastra/commit/f591643becdf0be9bddce6ba1748e64bc30d77f1), [`63796ba`](https://github.com/mastra-ai/mastra/commit/63796ba0fda60253be17535e68f6bbbf1e6ffa09), [`b1ad324`](https://github.com/mastra-ai/mastra/commit/b1ad324d657f3544b0701332aef7eb10e9a36258), [`61c566d`](https://github.com/mastra-ai/mastra/commit/61c566dd2f2cde2b23ed8f139924e530d4202214), [`c24754c`](https://github.com/mastra-ai/mastra/commit/c24754c1fb6fe144e5051e536e98c8a18b0214ac), [`12c61d2`](https://github.com/mastra-ai/mastra/commit/12c61d280c8cb208bc3c8dbcbe5dcc60cf9d1cd0), [`c46eb09`](https://github.com/mastra-ai/mastra/commit/c46eb09ce4987509af57a0ac582c61241a6dd2f1), [`9ee8120`](https://github.com/mastra-ai/mastra/commit/9ee8120ce17f76b9f617489e05a283353742690a), [`d975e92`](https://github.com/mastra-ai/mastra/commit/d975e924d4936f46c386bd3dee39c671720289f6), [`45dd6ee`](https://github.com/mastra-ai/mastra/commit/45dd6ee089bd7df0d0c98a10098e483fd388e04a), [`4e9a228`](https://github.com/mastra-ai/mastra/commit/4e9a2283d5fd6ed1b70a2751eb3dc2cbf82ada20), [`d6ce34a`](https://github.com/mastra-ai/mastra/commit/d6ce34aeceb06ddf3d595a1eed5cc74f481a46a1), [`f95f468`](https://github.com/mastra-ai/mastra/commit/f95f468cf1e7c2b924a13826494f98b8f2ccd581), [`30ed33e`](https://github.com/mastra-ai/mastra/commit/30ed33ee14084a26019aba15fceadda6d6ddefaf), [`04a815f`](https://github.com/mastra-ai/mastra/commit/04a815fc8971d29e97fcdcc5008a1eb472fc00ff), [`1cfa878`](https://github.com/mastra-ai/mastra/commit/1cfa8784d8da0dfaa0317e5048bc48b6084a5ea5), [`9a12ef3`](https://github.com/mastra-ai/mastra/commit/9a12ef3fccf3f4186db0f294f4ee1f02cf4d8db2), [`32d3583`](https://github.com/mastra-ai/mastra/commit/32d358332cb8ac2306b83b73cf3536e74dbd435e), [`7960688`](https://github.com/mastra-ai/mastra/commit/7960688828e04eaf3106e34f7758fa580257eef6), [`91ad69d`](https://github.com/mastra-ai/mastra/commit/91ad69d64994c89199b0c55399e64ed91c61df2f), [`8dc408d`](https://github.com/mastra-ai/mastra/commit/8dc408d34438f9e13297f792c11a5cfd6cf952e1), [`c92def1`](https://github.com/mastra-ai/mastra/commit/c92def10a13c822972c96f0a4ca6ffc1f4258aed), [`63041eb`](https://github.com/mastra-ai/mastra/commit/63041eb4c50b520a0a80e03d4cd6ea99f67715a0), [`c118318`](https://github.com/mastra-ai/mastra/commit/c1183181c9804303db4b511c2e2648f8b714712b), [`c5eaec5`](https://github.com/mastra-ai/mastra/commit/c5eaec5a860d80d0e3805e67db0414b87ac8cbed), [`fc07c64`](https://github.com/mastra-ai/mastra/commit/fc07c6465043e08e99193a6751a01c56ffc2e7a1), [`cced745`](https://github.com/mastra-ai/mastra/commit/cced745a056ec2225c5bc702e32d848847aa8b65), [`542dee2`](https://github.com/mastra-ai/mastra/commit/542dee254167f974ff8cbbbfc0ce10f9a2616a7b), [`3c19dce`](https://github.com/mastra-ai/mastra/commit/3c19dcef8e73062a80627a4927eae3ec11145afd), [`aca2869`](https://github.com/mastra-ai/mastra/commit/aca2869b2031982f3c4a2f52525c9be7cf123ef8), [`a58483c`](https://github.com/mastra-ai/mastra/commit/a58483cff1a9d41fce7c931843f48cb0ac450f64), [`a58483c`](https://github.com/mastra-ai/mastra/commit/a58483cff1a9d41fce7c931843f48cb0ac450f64), [`e6f8450`](https://github.com/mastra-ai/mastra/commit/e6f845074d478527026b18d85031b23353e1d0a4), [`895e9df`](https://github.com/mastra-ai/mastra/commit/895e9dfc17d6f34299eca64e317ded9e5f5e5ef8), [`e66b2ba`](https://github.com/mastra-ai/mastra/commit/e66b2ba100db63eaeab6e21e1ea34b113f2ec781), [`3e8727e`](https://github.com/mastra-ai/mastra/commit/3e8727e11ec1a5d733acedb5c872896394be18c1)]:
  - @mastra/core@1.62.0

## 1.4.1-alpha.1

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

## 1.4.1-alpha.0

### Patch Changes

- Honor the sandbox runtime environment (`setEnv()`/`getEnv()` from `@mastra/core`) in every workspace sandbox provider. Environment variables set after construction now reach subsequent commands on all providers: ([#22250](https://github.com/mastra-ai/mastra/pull/22250))

  - Process-manager-routed providers (E2B, Blaxel, Cloudflare, Daytona, Docker, Modal, Vercel microVM spawns) inherit the merge from the core spawn wrapper; their duplicated per-manager env plumbing is removed.
  - Providers with their own exec transports (AgentCore, Apple Container, Railway, Vercel microVM and serverless `executeCommand`, Platform's private-network, WebSocket lease, and E2B lease paths) now merge `getEnv()` under per-call env.

  Constructor `env` continues to behave as before: it seeds the sandbox runtime environment, and providers that bake env into the VM or container at creation time (Docker, Modal, Railway, Apple Container, Vercel, Platform) still do so. Per-call `env` on `executeCommand` still takes precedence for that command only.

  Removed exported types (minor bump for these two packages): `BlaxelProcessManagerOptions` from `@mastra/blaxel` and `RailwayProcessManagerOptions` from `@mastra/railway`. Both existed only to pass `env` into a process manager constructed by hand; the core spawn wrapper now owns that merge, so the option and its type are gone.

- Updated dependencies [[`aa3a85d`](https://github.com/mastra-ai/mastra/commit/aa3a85daf094c683bb97efdf4b6a696d2e474af5), [`d29d06f`](https://github.com/mastra-ai/mastra/commit/d29d06fe00bbd35b4571150ea04c59d2ed783c71), [`e6516df`](https://github.com/mastra-ai/mastra/commit/e6516dfcdae4f4ac0e7971d84359a81385ee602f), [`0b2a3d1`](https://github.com/mastra-ai/mastra/commit/0b2a3d1783875c5b97b7b36ab3d03d7360e0dde7), [`6bb5d71`](https://github.com/mastra-ai/mastra/commit/6bb5d7193fe9166b219f0fccae17db7a5ae86e65), [`57de7d6`](https://github.com/mastra-ai/mastra/commit/57de7d644ba7146edb4e9e6111ec4fa98c3a59e9), [`e8e299c`](https://github.com/mastra-ai/mastra/commit/e8e299cc6abdfc39947e2fec25803493015d3882), [`edfc548`](https://github.com/mastra-ai/mastra/commit/edfc548886bc7bae17b681f8b6b41a47eb32bcd2), [`a8a4871`](https://github.com/mastra-ai/mastra/commit/a8a4871215f51da95c47129602157ce5372f634a), [`5165cdc`](https://github.com/mastra-ai/mastra/commit/5165cdcdcf50e144bb8113278535196cc9b07065), [`6bb5d71`](https://github.com/mastra-ai/mastra/commit/6bb5d7193fe9166b219f0fccae17db7a5ae86e65), [`9ee8120`](https://github.com/mastra-ai/mastra/commit/9ee8120ce17f76b9f617489e05a283353742690a), [`d975e92`](https://github.com/mastra-ai/mastra/commit/d975e924d4936f46c386bd3dee39c671720289f6), [`1cfa878`](https://github.com/mastra-ai/mastra/commit/1cfa8784d8da0dfaa0317e5048bc48b6084a5ea5), [`c118318`](https://github.com/mastra-ai/mastra/commit/c1183181c9804303db4b511c2e2648f8b714712b), [`fc07c64`](https://github.com/mastra-ai/mastra/commit/fc07c6465043e08e99193a6751a01c56ffc2e7a1), [`542dee2`](https://github.com/mastra-ai/mastra/commit/542dee254167f974ff8cbbbfc0ce10f9a2616a7b), [`a58483c`](https://github.com/mastra-ai/mastra/commit/a58483cff1a9d41fce7c931843f48cb0ac450f64), [`a58483c`](https://github.com/mastra-ai/mastra/commit/a58483cff1a9d41fce7c931843f48cb0ac450f64), [`895e9df`](https://github.com/mastra-ai/mastra/commit/895e9dfc17d6f34299eca64e317ded9e5f5e5ef8)]:
  - @mastra/core@1.62.0-alpha.8

## 1.4.0

### Minor Changes

- Added provider-selectable Platform Workspace routing through `SANDBOX_PROVIDER`, with direct E2B command execution and snapshot restore support. ([#21991](https://github.com/mastra-ai/mastra/pull/21991))

  Set `SANDBOX_PROVIDER=e2b` before constructing `PlatformSandbox` or `PlatformFilesystem` to use provider-prefixed E2B routes. Set it to `railway` for provider-prefixed Railway routes, or leave it unset to preserve the legacy `/v1/projects/...` Railway API.

### Patch Changes

- Updated dependencies [[`88d14ca`](https://github.com/mastra-ai/mastra/commit/88d14cac008582a618fecc3d5c7fd3bdf4f6ddc3), [`480e491`](https://github.com/mastra-ai/mastra/commit/480e491588bd6a7a1c9ee4407590ad625dd33952), [`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`acc3471`](https://github.com/mastra-ai/mastra/commit/acc3471de5f3fde8027ee4e355af292b2bc1bc30), [`b6a771e`](https://github.com/mastra-ai/mastra/commit/b6a771ef23d203ddb348efca8065eff65def8191), [`84a5b69`](https://github.com/mastra-ai/mastra/commit/84a5b699f84d6bae0a34efe5a970d891090b9f41), [`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`3bb88dd`](https://github.com/mastra-ai/mastra/commit/3bb88ddf07fb98f3cd16d3bff94e51cd3b45d011), [`d23e75d`](https://github.com/mastra-ai/mastra/commit/d23e75d57cc7cf5b9bfdbee896bf5a6a2484fed7), [`c8faa4e`](https://github.com/mastra-ai/mastra/commit/c8faa4e1cfebaec56b65e754e90b9fe46d153359), [`d378d75`](https://github.com/mastra-ai/mastra/commit/d378d7511f71309ed61a8f6b93cd0361dc6cb70f), [`84a5b69`](https://github.com/mastra-ai/mastra/commit/84a5b699f84d6bae0a34efe5a970d891090b9f41), [`26d4016`](https://github.com/mastra-ai/mastra/commit/26d40160ff7f7d8bf95fee2039a52cbc83863533), [`7c60df5`](https://github.com/mastra-ai/mastra/commit/7c60df5c7872343fbac5c3e5b1175c8076a5abfd), [`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`84a5b69`](https://github.com/mastra-ai/mastra/commit/84a5b699f84d6bae0a34efe5a970d891090b9f41), [`f2031a4`](https://github.com/mastra-ai/mastra/commit/f2031a47445e8f67a89ba1309036816f97ab7a65), [`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`cad4208`](https://github.com/mastra-ai/mastra/commit/cad42082e6aa1776168a94914f523334be45d929), [`8e529d4`](https://github.com/mastra-ai/mastra/commit/8e529d4ac754efef04b225841349e0da9edf89a6), [`57c5103`](https://github.com/mastra-ai/mastra/commit/57c51035a2a36e3df3c4f32f46bb789a66ed5946), [`038b7b4`](https://github.com/mastra-ai/mastra/commit/038b7b405cb4ac25ab3f3031334111b1f87ac112), [`4132d61`](https://github.com/mastra-ai/mastra/commit/4132d61f8367077120ee9e6420d3224dffd93c93), [`d378d75`](https://github.com/mastra-ai/mastra/commit/d378d7511f71309ed61a8f6b93cd0361dc6cb70f)]:
  - @mastra/core@1.61.0

## 1.4.0-alpha.0

### Minor Changes

- Added provider-selectable Platform Workspace routing through `SANDBOX_PROVIDER`, with direct E2B command execution and snapshot restore support. ([#21991](https://github.com/mastra-ai/mastra/pull/21991))

  Set `SANDBOX_PROVIDER=e2b` before constructing `PlatformSandbox` or `PlatformFilesystem` to use provider-prefixed E2B routes. Set it to `railway` for provider-prefixed Railway routes, or leave it unset to preserve the legacy `/v1/projects/...` Railway API.

## 1.3.0

### Minor Changes

- Added `ProcessHandle.closeStdin()` to signal end-of-file to background processes. Local and Docker sandboxes support closing stdin, while providers without an available stdin-close API return a provider-specific unsupported-operation error. Providers signal the unsupported case with the new `UnsupportedStdinCloseError`, and the base class supplies that behavior by default so existing `ProcessHandle` subclasses keep compiling. Calling `handle.writer.end()` also closes stdin, and finishes without an error when the provider cannot close stdin. ([#21606](https://github.com/mastra-ai/mastra/pull/21606))

### Patch Changes

- PlatformSandbox restarts use the current sandbox connection after the previous sandbox is deleted or the platform does not return an instance URL, so later commands do not hit a stale sidecar. ([#21798](https://github.com/mastra-ai/mastra/pull/21798))

- Added fallback checkpoint forwarding for Platform sandboxes so the workspace proxy can seed fresh sessions without changing their primary recovery key. ([#21803](https://github.com/mastra-ai/mastra/pull/21803))

  ```typescript
  const sandbox = new PlatformSandbox({
    id: 'session-42',
    seedCheckpointName: 'repo-base',
  });
  ```

- PlatformSandbox now restarts a timed-out sidecar health probe on the next command instead of falling back to the slower lease-based exec path for the sandbox's lifetime. If the in-sandbox sidecar was just slow to boot, later commands recover the fast private-network transport automatically. ([#21798](https://github.com/mastra-ai/mastra/pull/21798))

- Declared checkpoint support (`supportsCheckpoints`) so checkpoint-based features like warm base checkpoints and boot-from-checkpoint know snapshots are real. ([#21798](https://github.com/mastra-ai/mastra/pull/21798))

  ```ts
  // Gate checkpoint-dependent work on the provider's capability flag.
  if (sandbox.supportsCheckpoints) {
    await sandbox.snapshot(); // persists a checkpoint that can seed a later boot
  }
  ```

- Updated dependencies [[`587f6ef`](https://github.com/mastra-ai/mastra/commit/587f6efcfc25880b93760a8607d1cd381ec612fe), [`7e096f0`](https://github.com/mastra-ai/mastra/commit/7e096f02f0dddbf09b85d306458351245ed2f886), [`d7e6745`](https://github.com/mastra-ai/mastra/commit/d7e67456954863c55440ea9c49bc6ceb9949972d), [`6223446`](https://github.com/mastra-ai/mastra/commit/6223446ddce6166e96e0ba5e00d628b615dee8ca), [`15101bb`](https://github.com/mastra-ai/mastra/commit/15101bb53c0d934f31af6b8813b88191e382a5e5), [`4e7a421`](https://github.com/mastra-ai/mastra/commit/4e7a421dce8a48742f785d1e93ad2f43a572b282), [`c2c3deb`](https://github.com/mastra-ai/mastra/commit/c2c3debcf670c7082d0a5e553aa99818a864698c), [`d8308a2`](https://github.com/mastra-ai/mastra/commit/d8308a2be3c07e777393d1017a381dcae3890d30), [`b0a2a07`](https://github.com/mastra-ai/mastra/commit/b0a2a07800d42bd9823292e7db832374ed084c9c), [`74e5bd3`](https://github.com/mastra-ai/mastra/commit/74e5bd315b8b3a1e04cb6cf480bb0f5fc4951dc8), [`242e324`](https://github.com/mastra-ai/mastra/commit/242e3241e73cbd5c9bb86a31ebb49ca0256488d4), [`217e967`](https://github.com/mastra-ai/mastra/commit/217e9672d8b3160eb729d8e9f0044949e88da239), [`d774e89`](https://github.com/mastra-ai/mastra/commit/d774e8930c781df8c9effe3763e6b501c099b6cc), [`9c27a53`](https://github.com/mastra-ai/mastra/commit/9c27a53cd9d3de4f3f025bc387d94ce371c33f95), [`8f0a332`](https://github.com/mastra-ai/mastra/commit/8f0a3321bf180368d76fe7b36aa1a8f60f00b6de), [`0b4f108`](https://github.com/mastra-ai/mastra/commit/0b4f1089aa8d92e67c2a8e99726822c5ee410784), [`9acb50f`](https://github.com/mastra-ai/mastra/commit/9acb50f71cec9c362f06820033f90ae6b1f8282f), [`46e9e3f`](https://github.com/mastra-ai/mastra/commit/46e9e3f73babe1bc70080a596cf2ac0b9da48519), [`3f9a190`](https://github.com/mastra-ai/mastra/commit/3f9a19057c027155867b9317294ee4ca7bd0581a), [`dff25a1`](https://github.com/mastra-ai/mastra/commit/dff25a1103fa72ee082a9b6f805ebeb5ce400753), [`6db7a5d`](https://github.com/mastra-ai/mastra/commit/6db7a5dd3dd2b6f7ef75dcd804fcffef5fa83963), [`217e967`](https://github.com/mastra-ai/mastra/commit/217e9672d8b3160eb729d8e9f0044949e88da239), [`583e235`](https://github.com/mastra-ai/mastra/commit/583e23519c13af16c1746f9c49722d011216611b), [`b098de9`](https://github.com/mastra-ai/mastra/commit/b098de9d7cb9f672e0883a5c716465a3a689693d), [`e8808e3`](https://github.com/mastra-ai/mastra/commit/e8808e3d8eb585a2565be53e56a7e0e1477352a4), [`a77f8d4`](https://github.com/mastra-ai/mastra/commit/a77f8d4740d2178a74c41e4bf678b4fcd8fa0bb2), [`7f78585`](https://github.com/mastra-ai/mastra/commit/7f785857e401570e2ffb316911f126ed363aa537), [`33374ba`](https://github.com/mastra-ai/mastra/commit/33374ba359e4fb13eaa918ae925fe167a3c55414), [`940bf5c`](https://github.com/mastra-ai/mastra/commit/940bf5ccf04f2c9ebd8a1390431733222a03b1cd), [`c549e2f`](https://github.com/mastra-ai/mastra/commit/c549e2f40edc1cac5d9e74e82f90da22b48df084), [`58c43d3`](https://github.com/mastra-ai/mastra/commit/58c43d3f7cb2eeaeb8ac733ae71dde822348e588), [`ef6e295`](https://github.com/mastra-ai/mastra/commit/ef6e295b59bc25a5b61b633a89c97bcfce9fb465), [`208e1b3`](https://github.com/mastra-ai/mastra/commit/208e1b39f30f4b386e494394e9d71d96f0f90241), [`c938d34`](https://github.com/mastra-ai/mastra/commit/c938d34739936c8ecbabd67ad6a4a4396f41c4c6), [`88ddc7c`](https://github.com/mastra-ai/mastra/commit/88ddc7ce01d40175f13a3228b789a906779680bd), [`f2a4afd`](https://github.com/mastra-ai/mastra/commit/f2a4afd7e37e809669001ed17724b341a5c1f45e), [`d438148`](https://github.com/mastra-ai/mastra/commit/d438148e222c1e2fb3c652725ce75680962ebec4), [`ba05fe0`](https://github.com/mastra-ai/mastra/commit/ba05fe0738f70cb686777546e968237d09269142), [`40d358e`](https://github.com/mastra-ai/mastra/commit/40d358e29d55543803e64b49241122f598ffabc7), [`d26a8d4`](https://github.com/mastra-ai/mastra/commit/d26a8d4281f28414715b333c85bedaf70d0b2890), [`e80cd7e`](https://github.com/mastra-ai/mastra/commit/e80cd7e7683e7d732e1cc6784bcac1d2640d2ce3), [`ccbbcd9`](https://github.com/mastra-ai/mastra/commit/ccbbcd974eedff4367a54ed0e24c9ee742ab2f61), [`1d9a0ea`](https://github.com/mastra-ai/mastra/commit/1d9a0ea4a9901baee6cd56737243bd6d1f631ac0), [`677cdc6`](https://github.com/mastra-ai/mastra/commit/677cdc6af564dec29a13464d12b7ab2a4efc22e9), [`c549e2f`](https://github.com/mastra-ai/mastra/commit/c549e2f40edc1cac5d9e74e82f90da22b48df084), [`a7dd322`](https://github.com/mastra-ai/mastra/commit/a7dd32247d95afc539f483ca37f4594af0387f59), [`3f5c6f7`](https://github.com/mastra-ai/mastra/commit/3f5c6f728ea35da344248de9aa070f12849f3aa0), [`a318490`](https://github.com/mastra-ai/mastra/commit/a318490e17da32f338d50929c770d901a9b3dd72), [`b860493`](https://github.com/mastra-ai/mastra/commit/b86049391100e665d579f700c8a2034c036defc3), [`d4be8c1`](https://github.com/mastra-ai/mastra/commit/d4be8c1739d22d621e3f78790e1dd5eb5ecc3589), [`a5d2eb1`](https://github.com/mastra-ai/mastra/commit/a5d2eb10347eade1ae2816d88f466c25186c54a5), [`3667679`](https://github.com/mastra-ai/mastra/commit/3667679db057edfb086846d13369fdda4902ad65), [`49696e8`](https://github.com/mastra-ai/mastra/commit/49696e8e42f870674a0a58f5abcd22cc54dd2864), [`2ef2f23`](https://github.com/mastra-ai/mastra/commit/2ef2f230a7aed342e7dc3b2000cd42e4c43e08a7), [`763e0c6`](https://github.com/mastra-ai/mastra/commit/763e0c61e04d76ad9a9efd301aa57525ca0cbea9), [`20504b2`](https://github.com/mastra-ai/mastra/commit/20504b2ecebd0e077acda3d457ab57480a98ed3e), [`77e6b1b`](https://github.com/mastra-ai/mastra/commit/77e6b1bc4c46ce94fe501023fb4393c812ec6be3), [`c5f964d`](https://github.com/mastra-ai/mastra/commit/c5f964d3f77064e978f8066ec506eed77ba5c63c), [`23e0be2`](https://github.com/mastra-ai/mastra/commit/23e0be261381e49534b4ff3101c60ee64a946cbf), [`7fc8806`](https://github.com/mastra-ai/mastra/commit/7fc880627d3cbf995d31ea0e8b807bf15417e651), [`0e02eac`](https://github.com/mastra-ai/mastra/commit/0e02eacdb2e30e1697a41910b41163742a181dc1), [`4df174c`](https://github.com/mastra-ai/mastra/commit/4df174c32bddf093a82f273070b8380aef7c9e90), [`f7c25b5`](https://github.com/mastra-ai/mastra/commit/f7c25b5106ddfb48e591f98df7a51e0f2dd01dba), [`7aad631`](https://github.com/mastra-ai/mastra/commit/7aad631b43bc10db77d5b8c66b200d7a49d18bf2), [`512100a`](https://github.com/mastra-ai/mastra/commit/512100a7d8b7e9c920f2590c6b3612f5de0d3cff), [`e81744c`](https://github.com/mastra-ai/mastra/commit/e81744cd13c46619c142dc521dc0baac47607a84), [`f8f653f`](https://github.com/mastra-ai/mastra/commit/f8f653f10980d01a73706cc3c8689ca5e40ce808), [`dc09cc1`](https://github.com/mastra-ai/mastra/commit/dc09cc1083d861cde192c1cd235324dc75b8c731), [`9ef432b`](https://github.com/mastra-ai/mastra/commit/9ef432b6faa534b57b0d182a610e13dd9a7123ff), [`36b4649`](https://github.com/mastra-ai/mastra/commit/36b4649045a3a380cbab8ceca866db4086223aff), [`b9cf308`](https://github.com/mastra-ai/mastra/commit/b9cf30846f97f99ac1906ee8a68f4f2d117b0378), [`2e1d098`](https://github.com/mastra-ai/mastra/commit/2e1d0984e325fd319d32ea182f596b3170be3847), [`377eb81`](https://github.com/mastra-ai/mastra/commit/377eb81ce43b964e3a6b541df172da74a8ff3716), [`1794a79`](https://github.com/mastra-ai/mastra/commit/1794a79178c418004a7261b1ad9114066f7ef01d), [`0cdc5dc`](https://github.com/mastra-ai/mastra/commit/0cdc5dc69024957815da4f51acc4119eb4f447d7), [`5740ec6`](https://github.com/mastra-ai/mastra/commit/5740ec60c760ffdfbfaa59d603d03b847c864e05)]:
  - @mastra/core@1.60.0

## 1.3.0-alpha.2

### Patch Changes

- Added fallback checkpoint forwarding for Platform sandboxes so the workspace proxy can seed fresh sessions without changing their primary recovery key. ([#21803](https://github.com/mastra-ai/mastra/pull/21803))

  ```typescript
  const sandbox = new PlatformSandbox({
    id: 'session-42',
    seedCheckpointName: 'repo-base',
  });
  ```

- Updated dependencies [[`58c43d3`](https://github.com/mastra-ai/mastra/commit/58c43d3f7cb2eeaeb8ac733ae71dde822348e588)]:
  - @mastra/core@1.60.0-alpha.14

## 1.3.0-alpha.1

### Patch Changes

- PlatformSandbox restarts use the current sandbox connection after the previous sandbox is deleted or the platform does not return an instance URL, so later commands do not hit a stale sidecar. ([#21798](https://github.com/mastra-ai/mastra/pull/21798))

- PlatformSandbox now restarts a timed-out sidecar health probe on the next command instead of falling back to the slower lease-based exec path for the sandbox's lifetime. If the in-sandbox sidecar was just slow to boot, later commands recover the fast private-network transport automatically. ([#21798](https://github.com/mastra-ai/mastra/pull/21798))

- Declared checkpoint support (`supportsCheckpoints`) so checkpoint-based features like warm base checkpoints and boot-from-checkpoint know snapshots are real. ([#21798](https://github.com/mastra-ai/mastra/pull/21798))

  ```ts
  // Gate checkpoint-dependent work on the provider's capability flag.
  if (sandbox.supportsCheckpoints) {
    await sandbox.snapshot(); // persists a checkpoint that can seed a later boot
  }
  ```

- Updated dependencies [[`c549e2f`](https://github.com/mastra-ai/mastra/commit/c549e2f40edc1cac5d9e74e82f90da22b48df084), [`c549e2f`](https://github.com/mastra-ai/mastra/commit/c549e2f40edc1cac5d9e74e82f90da22b48df084), [`2ef2f23`](https://github.com/mastra-ai/mastra/commit/2ef2f230a7aed342e7dc3b2000cd42e4c43e08a7), [`5740ec6`](https://github.com/mastra-ai/mastra/commit/5740ec60c760ffdfbfaa59d603d03b847c864e05)]:
  - @mastra/core@1.60.0-alpha.13

## 1.3.0-alpha.0

### Minor Changes

- Added `ProcessHandle.closeStdin()` to signal end-of-file to background processes. Local and Docker sandboxes support closing stdin, while providers without an available stdin-close API return a provider-specific unsupported-operation error. Providers signal the unsupported case with the new `UnsupportedStdinCloseError`, and the base class supplies that behavior by default so existing `ProcessHandle` subclasses keep compiling. Calling `handle.writer.end()` also closes stdin, and finishes without an error when the provider cannot close stdin. ([#21606](https://github.com/mastra-ai/mastra/pull/21606))

### Patch Changes

- Updated dependencies [[`4e7a421`](https://github.com/mastra-ai/mastra/commit/4e7a421dce8a48742f785d1e93ad2f43a572b282), [`242e324`](https://github.com/mastra-ai/mastra/commit/242e3241e73cbd5c9bb86a31ebb49ca0256488d4), [`217e967`](https://github.com/mastra-ai/mastra/commit/217e9672d8b3160eb729d8e9f0044949e88da239), [`d774e89`](https://github.com/mastra-ai/mastra/commit/d774e8930c781df8c9effe3763e6b501c099b6cc), [`9c27a53`](https://github.com/mastra-ai/mastra/commit/9c27a53cd9d3de4f3f025bc387d94ce371c33f95), [`dff25a1`](https://github.com/mastra-ai/mastra/commit/dff25a1103fa72ee082a9b6f805ebeb5ce400753), [`217e967`](https://github.com/mastra-ai/mastra/commit/217e9672d8b3160eb729d8e9f0044949e88da239), [`7f78585`](https://github.com/mastra-ai/mastra/commit/7f785857e401570e2ffb316911f126ed363aa537), [`f2a4afd`](https://github.com/mastra-ai/mastra/commit/f2a4afd7e37e809669001ed17724b341a5c1f45e), [`d438148`](https://github.com/mastra-ai/mastra/commit/d438148e222c1e2fb3c652725ce75680962ebec4), [`ba05fe0`](https://github.com/mastra-ai/mastra/commit/ba05fe0738f70cb686777546e968237d09269142), [`d26a8d4`](https://github.com/mastra-ai/mastra/commit/d26a8d4281f28414715b333c85bedaf70d0b2890), [`677cdc6`](https://github.com/mastra-ai/mastra/commit/677cdc6af564dec29a13464d12b7ab2a4efc22e9), [`a318490`](https://github.com/mastra-ai/mastra/commit/a318490e17da32f338d50929c770d901a9b3dd72), [`763e0c6`](https://github.com/mastra-ai/mastra/commit/763e0c61e04d76ad9a9efd301aa57525ca0cbea9), [`23e0be2`](https://github.com/mastra-ai/mastra/commit/23e0be261381e49534b4ff3101c60ee64a946cbf), [`7fc8806`](https://github.com/mastra-ai/mastra/commit/7fc880627d3cbf995d31ea0e8b807bf15417e651), [`0e02eac`](https://github.com/mastra-ai/mastra/commit/0e02eacdb2e30e1697a41910b41163742a181dc1), [`4df174c`](https://github.com/mastra-ai/mastra/commit/4df174c32bddf093a82f273070b8380aef7c9e90), [`f7c25b5`](https://github.com/mastra-ai/mastra/commit/f7c25b5106ddfb48e591f98df7a51e0f2dd01dba), [`dc09cc1`](https://github.com/mastra-ai/mastra/commit/dc09cc1083d861cde192c1cd235324dc75b8c731), [`36b4649`](https://github.com/mastra-ai/mastra/commit/36b4649045a3a380cbab8ceca866db4086223aff), [`377eb81`](https://github.com/mastra-ai/mastra/commit/377eb81ce43b964e3a6b541df172da74a8ff3716)]:
  - @mastra/core@1.60.0-alpha.8

## 1.2.1

### Patch Changes

- Send opaque acting-user subjects with Platform sandbox requests, including Factory creation and reattachment flows. ([#20754](https://github.com/mastra-ai/mastra/pull/20754))

  ```typescript
  import { PlatformSandbox } from '@mastra/platform-workspace';

  const sandbox = new PlatformSandbox({
    environmentId: 'env_abc',
    actingUserId: auth.user.id,
  });
  ```

- Updated dependencies [[`088e41e`](https://github.com/mastra-ai/mastra/commit/088e41e434ed05f2c674b254f1034ec46a57a7be), [`aa3e7be`](https://github.com/mastra-ai/mastra/commit/aa3e7be30f8addb0278ea74429f4df054517a287), [`d118873`](https://github.com/mastra-ai/mastra/commit/d118873cfd5074b1f814a1c169a97ca7a3a29174), [`b2f0013`](https://github.com/mastra-ai/mastra/commit/b2f0013375588d40c03c13e843b99c0ff8872ca5), [`3b541ae`](https://github.com/mastra-ai/mastra/commit/3b541ae5d410c52b80a7e381d84d021cddb9a449), [`79dd7c2`](https://github.com/mastra-ai/mastra/commit/79dd7c261ee6be1fafedd4651959394db21d2cba), [`90822db`](https://github.com/mastra-ai/mastra/commit/90822dba08fb2169c518e4a6d7f127c098eb46b8), [`898bba4`](https://github.com/mastra-ai/mastra/commit/898bba46d4806dd255a44e5dc3a3d5827eaefdfe), [`b9a28ec`](https://github.com/mastra-ai/mastra/commit/b9a28ecf7acdc0cb7a543d5b660f9fbee301df9a), [`f9aab1c`](https://github.com/mastra-ai/mastra/commit/f9aab1cfc3fda03238a7fd7bd8b794e07497878c), [`3700208`](https://github.com/mastra-ai/mastra/commit/37002080c7838267803a7e579a7d58b908d62f36), [`e31421b`](https://github.com/mastra-ai/mastra/commit/e31421bc9c11c03c6e74f447ecb5820000e2b9d7), [`8b7131e`](https://github.com/mastra-ai/mastra/commit/8b7131eb0407f58f5205e68fb27b81f026488f28), [`161258b`](https://github.com/mastra-ai/mastra/commit/161258b3473a6d0fce00a43cab59d119a49a232f), [`aece0e7`](https://github.com/mastra-ai/mastra/commit/aece0e7cb124ae1eb1230689b887f5554b9a0bf0), [`ae79e34`](https://github.com/mastra-ai/mastra/commit/ae79e34c0bd8674fc24c7524217bfc4a051c6136), [`59d8898`](https://github.com/mastra-ai/mastra/commit/59d8898c8cb48b342fe5bcb5eee803cc8cc95060), [`a6c4399`](https://github.com/mastra-ai/mastra/commit/a6c4399763590b3dae21a2c81826e89a3b1deee4), [`a40f915`](https://github.com/mastra-ai/mastra/commit/a40f9157690d89ef13ce825cc88e30be581de5d4), [`8ea8038`](https://github.com/mastra-ai/mastra/commit/8ea80386fde53d26e2c0b2060c53bc9bd9be10f3), [`be31796`](https://github.com/mastra-ai/mastra/commit/be3179624ad5f77cff5fa342cd08046bf7605283), [`79c4f82`](https://github.com/mastra-ai/mastra/commit/79c4f8295f568752eeadf8a9b50010a7d9ec06ae), [`7dafa4f`](https://github.com/mastra-ai/mastra/commit/7dafa4f670fb16ec8ff07349645a00ca12bc5794)]:
  - @mastra/core@1.59.0

## 1.2.1-alpha.0

### Patch Changes

- Send opaque acting-user subjects with Platform sandbox requests, including Factory creation and reattachment flows. ([#20754](https://github.com/mastra-ai/mastra/pull/20754))

  ```typescript
  import { PlatformSandbox } from '@mastra/platform-workspace';

  const sandbox = new PlatformSandbox({
    environmentId: 'env_abc',
    actingUserId: auth.user.id,
  });
  ```

- Updated dependencies [[`79dd7c2`](https://github.com/mastra-ai/mastra/commit/79dd7c261ee6be1fafedd4651959394db21d2cba), [`b9a28ec`](https://github.com/mastra-ai/mastra/commit/b9a28ecf7acdc0cb7a543d5b660f9fbee301df9a), [`be31796`](https://github.com/mastra-ai/mastra/commit/be3179624ad5f77cff5fa342cd08046bf7605283)]:
  - @mastra/core@1.59.0-alpha.4

## 1.2.0

### Minor Changes

- Added startup observability to `PlatformSandbox`. New optional `sessionId` and `threadId` options let you correlate all sandbox startup activity with the session that triggered it, and the sandbox now logs how long startup took and whether it became reachable. ([#21189](https://github.com/mastra-ai/mastra/pull/21189))

  ```ts
  import { PlatformSandbox } from '@mastra/platform-workspace';

  const sandbox = new PlatformSandbox({
    projectId: 'proj_123',
    environmentId: 'env_123',
    sessionId: 'session_abc', // correlate startup logs with your session
    threadId: 'thread_xyz', // optional finer-grained correlation
  });
  ```

- Added `PlatformSandbox.snapshot()` to capture the configured recovery checkpoint. ([#21221](https://github.com/mastra-ai/mastra/pull/21221))

  ```ts
  await sandbox.snapshot();
  ```

- Split `PlatformSandbox.stop()` from `PlatformSandbox.destroy()` so the two lifecycle exits mirror `@mastra/railway` `RailwaySandbox` ([#20956](https://github.com/mastra-ai/mastra/pull/20956))

  **Before:** `stop()` was an alias for `destroy()`, and `destroy()` only released the sandbox VM — the on-provider recovery checkpoint was never actively deleted. There was no way to end a hosted sandbox while preserving its checkpoint for a later resume, and destroyed sandboxes accumulated stray checkpoints until the upstream provider's own GC.

  **After:**

  - **`stop()`** — releases the VM but **preserves the recovery checkpoint**. Any in-flight capture is awaited first so the preserved checkpoint reflects the caller's latest state. Corresponds to `DELETE /v1/projects/:pid/sandbox/:sandboxId` on workspace-proxy, which by contract does not touch the checkpoint.
  - **`destroy()`** — releases the VM **and deletes the recovery checkpoint**. Cancels any in-flight capture (no reason to burn a capture on state we're releasing), asks the proxy to delete the checkpoint via `DELETE /v1/projects/:pid/sandbox/:sandboxId/checkpoint`, then releases the VM. Both remote operations are best-effort — an already-absent checkpoint or a transient checkpoint-delete failure does not block the VM teardown, since a half-torn-down sandbox is worse than a lingering checkpoint alone.

  Callers constructed without a recovery `id` skip the checkpoint DELETE and behave identically to `stop()`, because they have no on-provider checkpoint to release.

  This restores the "providers move in lockstep" invariant that broke after `@mastra/railway` gained its own `stop()`/`destroy()` split.

  **Requires** a matching workspace-proxy release that exposes `DELETE /v1/projects/:pid/sandbox/:sandboxId/checkpoint`. Callers on older workspace-proxy versions will see the checkpoint DELETE 404 and fall through to the VM DELETE — same net effect as the pre-split behavior.

### Patch Changes

- Add public `captureCheckpoint()` method to `PlatformSandbox` — mirrors `@mastra/railway`'s `RailwaySandbox.captureCheckpoint()` so callers (e.g. a factory-side scheduler) can capture the recovery checkpoint on demand at semantic moments (turn end, session-idle, pre-teardown) without having to know which provider is underneath. ([#20882](https://github.com/mastra-ai/mastra/pull/20882))

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

  - POSTs to `/v1/projects/:projectId/sandbox/:sandboxId/checkpoint` with the caller-supplied recovery key (the `id` the sandbox was constructed with) as the body, matching the shape the workspace-proxy expects.
  - Coalesces concurrent callers on the same instance onto a single upstream request, so N simultaneous turn-end fires do not each round-trip the proxy.
  - Returns `{ status: 'skipped', reason: 'no-checkpoint-name-configured' }` when the sandbox was constructed without a caller-supplied `id` (an auto-generated random id is never a meaningful recovery key), and `{ status: 'skipped', reason: 'sandbox-not-running' }` when the sandbox has not been started yet.
  - Normalizes upstream "sandbox destroyed" outcomes (a 410 from the proxy, or the proxy's own `skipped` status) to `{ status: 'skipped', reason: 'sandbox-not-running' }` — the discriminant matches the pre-flight case so callers branch uniformly, and the sandbox's local state is cleared as a side effect so the next `start()` provisions fresh instead of reattaching to a dead id.
  - Transport failures other than 410 (5xx, 429) propagate as `PlatformApiError` for the caller to handle.

- Fixed Platform Sandbox startup so commands use a reliable connection while a new sandbox is starting. ([#21028](https://github.com/mastra-ai/mastra/pull/21028))

- Coalesce concurrent `PlatformSandbox.start()` callers onto a single in-flight attempt ([#20960](https://github.com/mastra-ai/mastra/pull/20960))

  Two callers hitting `start()` on the same instance before the first one resolves used to both race to `POST /v1/projects/:pid/sandbox` (or `GET /sandbox/:id` on the reattach path), burning N proxy provisions and leaving `N-1` stray sandboxes behind. Fleet-level coalescing on the caller side masked most of this, but the underlying invariant "providers move in lockstep" was false — `@mastra/railway` `RailwaySandbox` has always had `_startInFlight` coalescing.

  `start()` now publishes a single shared promise via `??=` **before** the first `await`, so a second caller entering `start()` while the first is mid-round-trip joins the existing promise instead of racing past the null check. The slot is cleared in `.finally()` on both success and failure paths so a failed attempt isn't a permanent latch — the next call starts fresh. Failures propagate to every joined caller.

  Bug fix; no public API surface change. Callers already awaiting `start()` see the same success/failure semantics; the only observable difference is one upstream call instead of N.

- Improved `PlatformSandbox.getInfo()` to return cached sandbox information when the sandbox is known to be directly reachable, removing a redundant network round-trip on every workspace status poll. When no cached address is available, `getInfo()` behaves exactly as before. ([#20855](https://github.com/mastra-ai/mastra/pull/20855))

- Updated dependencies [[`e7109ee`](https://github.com/mastra-ai/mastra/commit/e7109ee6f731bacc79c885906f3c7dca8d8f013a), [`b8ce7ec`](https://github.com/mastra-ai/mastra/commit/b8ce7ec96e39343c6c2f36d12d68a9ad816c09f7), [`2e4624e`](https://github.com/mastra-ai/mastra/commit/2e4624edb6917e61249cb60ee377735e7af7e4a9), [`45a9147`](https://github.com/mastra-ai/mastra/commit/45a914741f578754d79d8b7de7b4e4f304d8e14a), [`a3a3624`](https://github.com/mastra-ai/mastra/commit/a3a3624f646b98e409424d8defccbd334da9e8b8), [`6246914`](https://github.com/mastra-ai/mastra/commit/62469146636911f3cbbe0880bd011c6a897a59a7), [`6445eba`](https://github.com/mastra-ai/mastra/commit/6445eba6020abac681aba1cc9289f446cb400cbe), [`86b7b77`](https://github.com/mastra-ai/mastra/commit/86b7b777980d30f66e1fd134a37d2af4c22e54cc), [`1c75e32`](https://github.com/mastra-ai/mastra/commit/1c75e32f7fc0b9fb6f548b4407feaec8a1440212), [`296dc9a`](https://github.com/mastra-ai/mastra/commit/296dc9af29f3616e786c7825ec32e0df92d754c5), [`f59032a`](https://github.com/mastra-ai/mastra/commit/f59032a73699443555a08a479e7ac578975784f2), [`cdd5c33`](https://github.com/mastra-ai/mastra/commit/cdd5c33ac6c7118a9f139e6dc0e14e6a8ae31658), [`3f73c07`](https://github.com/mastra-ai/mastra/commit/3f73c076727e8c36b4fff7a1b40290fb68957fa8), [`772c0c8`](https://github.com/mastra-ai/mastra/commit/772c0c897cec383258de2e6178147f8014767c7b), [`d7cf7fa`](https://github.com/mastra-ai/mastra/commit/d7cf7fafc1ae1b50bd8462dd0e6c671a8606db93), [`7c1ebb1`](https://github.com/mastra-ai/mastra/commit/7c1ebb15690c4b3f0eabb19077cf8af573311e57), [`0f9a448`](https://github.com/mastra-ai/mastra/commit/0f9a448502157e59f7b76f24360ad497168f5ef8), [`578bf2e`](https://github.com/mastra-ai/mastra/commit/578bf2e6a88e9d5b8bf502204e15a95dfbb679ae), [`c47165c`](https://github.com/mastra-ai/mastra/commit/c47165c983c87594c6952f1fd2fa51a90205034c), [`289f4ce`](https://github.com/mastra-ai/mastra/commit/289f4ce16e3293370440172132c52ee787cbc09f), [`df31eb0`](https://github.com/mastra-ai/mastra/commit/df31eb0c7087d782a0d9346e467f9a4af4b0eef6), [`9571e3a`](https://github.com/mastra-ai/mastra/commit/9571e3a06ed2c5220196460bf82a2129255c3a8b), [`4f16ff8`](https://github.com/mastra-ai/mastra/commit/4f16ff824bf2f9b0ddc93f210477c10c8a4fb1ab), [`b4c89b4`](https://github.com/mastra-ai/mastra/commit/b4c89b4371b0c86da57403ad1a3b3ef0681f3128), [`e6534fa`](https://github.com/mastra-ai/mastra/commit/e6534fab031216f6cb48c4c9907cbfdce9d60bc6), [`210cb7a`](https://github.com/mastra-ai/mastra/commit/210cb7a167998c7bbf72cb3b93e6eb0563330239), [`06b2d87`](https://github.com/mastra-ai/mastra/commit/06b2d87e63bcdd0ed59215c6789692b9b12de376), [`1c67d85`](https://github.com/mastra-ai/mastra/commit/1c67d85e9da8285662f4dbbf47e0378c3fee0747), [`ac01d63`](https://github.com/mastra-ai/mastra/commit/ac01d6355974aec73fdb8781449ed12bac582094), [`80a3324`](https://github.com/mastra-ai/mastra/commit/80a33245d3110204de6f56d61211523ffe338692), [`e44e8f3`](https://github.com/mastra-ai/mastra/commit/e44e8f370b66c339ddcaba946d33da6d3c3f06cd), [`d9d2881`](https://github.com/mastra-ai/mastra/commit/d9d2881ede6dd6c023d144215fc812062aed0890), [`a810a05`](https://github.com/mastra-ai/mastra/commit/a810a058f62ad407cfc1701e0be36ae91145d7cf), [`ba24be6`](https://github.com/mastra-ai/mastra/commit/ba24be662439c331ab23a600041f93803c89eca8), [`842b5fe`](https://github.com/mastra-ai/mastra/commit/842b5fe22b6a7fa811bd14e48eb9af523ac989f2), [`990611b`](https://github.com/mastra-ai/mastra/commit/990611ba76eb876d86c9c594371ae5f02f94b432), [`80bdf3a`](https://github.com/mastra-ai/mastra/commit/80bdf3ae16ade6ff63bde0cb16fa2df8ab7dd4dd), [`c967a5e`](https://github.com/mastra-ai/mastra/commit/c967a5eec150c5dc5418c4a4388982d1fb7ad27c), [`dc4a25d`](https://github.com/mastra-ai/mastra/commit/dc4a25d41af4e2fe97a816070eaec6aa963ab53b), [`9ba1247`](https://github.com/mastra-ai/mastra/commit/9ba12470c77f1c03642d720ce67e517e878f666e), [`fd96298`](https://github.com/mastra-ai/mastra/commit/fd96298a8367622f4ebfcaa97b5b6c1fbbd14564), [`66bbfb5`](https://github.com/mastra-ai/mastra/commit/66bbfb5f05b473d39f88c0e4a481ccac41634f3a), [`dc4a25d`](https://github.com/mastra-ai/mastra/commit/dc4a25d41af4e2fe97a816070eaec6aa963ab53b), [`f8da216`](https://github.com/mastra-ai/mastra/commit/f8da21633e7eb0e31c9ce0fc30567870d19416d3), [`4a09a9c`](https://github.com/mastra-ai/mastra/commit/4a09a9c0474ef643558fcb5f0edc542b82f1cab0), [`5f798b3`](https://github.com/mastra-ai/mastra/commit/5f798b3362e9bdf4d690f85245606e146eef60b9), [`6a84954`](https://github.com/mastra-ai/mastra/commit/6a84954a2667f85b6d59da652dab1bbff007ccb0), [`1e83a47`](https://github.com/mastra-ai/mastra/commit/1e83a4734ab61ba5926af6793e3569a78b72ed37), [`52d8ef0`](https://github.com/mastra-ai/mastra/commit/52d8ef03801f1deb7ee48532fc4190dd4a33916c), [`cdd5c33`](https://github.com/mastra-ai/mastra/commit/cdd5c33ac6c7118a9f139e6dc0e14e6a8ae31658), [`7fdcaa6`](https://github.com/mastra-ai/mastra/commit/7fdcaa66105d64290f9b14432a12ec99f39c4d3a), [`d6c56f9`](https://github.com/mastra-ai/mastra/commit/d6c56f951db3213330b98b0abafa9778c8770e58), [`e08e789`](https://github.com/mastra-ai/mastra/commit/e08e789c1bf4cd2fe46363f7a4728536ceccc9bd), [`bf936e2`](https://github.com/mastra-ai/mastra/commit/bf936e2c89b2ff0dad5695b873ddc009ba96d41e), [`7fb580a`](https://github.com/mastra-ai/mastra/commit/7fb580ac73fbcacf2ff00872a3395f73ae1b9fa5), [`ed5d606`](https://github.com/mastra-ai/mastra/commit/ed5d606739c5e3fbdfa9f272df7809aa5ab43b1d), [`f53d5bd`](https://github.com/mastra-ai/mastra/commit/f53d5bd4885b29e4ac29a428a6044088ea8d6aa3), [`32980a3`](https://github.com/mastra-ai/mastra/commit/32980a3e2413d0274ac244d32c37d910edc13f00), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437), [`82e3365`](https://github.com/mastra-ai/mastra/commit/82e3365ef7c9bf7bee2e7a7029035ea262d68895), [`6104347`](https://github.com/mastra-ai/mastra/commit/61043473ba6bfd0a25156824e853e13165562e6c), [`35cc901`](https://github.com/mastra-ai/mastra/commit/35cc90102cf834a84827acaf9eee0b6d6d1e2a3b), [`a8b4cf0`](https://github.com/mastra-ai/mastra/commit/a8b4cf02823cffebc4751a53337dfacf097c1ae1), [`9571e3a`](https://github.com/mastra-ai/mastra/commit/9571e3a06ed2c5220196460bf82a2129255c3a8b), [`333785c`](https://github.com/mastra-ai/mastra/commit/333785c93cbb01e42c60167e995457c28897ddbf), [`bda2235`](https://github.com/mastra-ai/mastra/commit/bda22353ee28f2df0eaea555f7cae1549f979c0b), [`efd5c81`](https://github.com/mastra-ai/mastra/commit/efd5c81cc25fde3c2ddd86fc1178deb4ec176e19), [`1b482c2`](https://github.com/mastra-ai/mastra/commit/1b482c2d89244dd758c41e5f927a2b44041388d2), [`45bfb88`](https://github.com/mastra-ai/mastra/commit/45bfb88fd52f1dd3be20e2a38905777c96499c90), [`ff28284`](https://github.com/mastra-ai/mastra/commit/ff2828416f14daff9d956e6a352fdaa23c950979), [`4bcdfaf`](https://github.com/mastra-ai/mastra/commit/4bcdfaf0eac3199d7cb171b0a19a92c9c341eea4), [`e3b9307`](https://github.com/mastra-ai/mastra/commit/e3b9307098daefbfae2a52ae2ef51bc9fc701190), [`d6834c5`](https://github.com/mastra-ai/mastra/commit/d6834c5a7866b16734d23900163c2414ed70d791), [`f33264f`](https://github.com/mastra-ai/mastra/commit/f33264f517ae603279afd5c4251e2b40f6dd3618), [`689f2c4`](https://github.com/mastra-ai/mastra/commit/689f2c4b6c0835fe455702b01d21daa8abcd9331), [`fcd0667`](https://github.com/mastra-ai/mastra/commit/fcd0667a4e378be35c9a1b1eb19cce78fbfd7282), [`cfd0d9e`](https://github.com/mastra-ai/mastra/commit/cfd0d9ec77ec3c69dd96f79cdb579e03d79f22ce), [`acc3513`](https://github.com/mastra-ai/mastra/commit/acc3513b19f79bf0a7ec2998694580edca54086c), [`1670533`](https://github.com/mastra-ai/mastra/commit/1670533986f6bacf567746245348125e3a106448), [`a7eb4a1`](https://github.com/mastra-ai/mastra/commit/a7eb4a11450f6170274ed5141bffe821d4fdd5a6), [`0976933`](https://github.com/mastra-ai/mastra/commit/0976933142333ec78451feef265b68bcb45aa5e7), [`242b945`](https://github.com/mastra-ai/mastra/commit/242b94558777bfbdeb42cbfea84afff0b6ad0633), [`c52d346`](https://github.com/mastra-ai/mastra/commit/c52d3462ec831a5d95926ecd3d3373f5928ad2e5), [`af4636a`](https://github.com/mastra-ai/mastra/commit/af4636a74463275d71c1d13a38f7d2b738f128bf), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437), [`2eabc09`](https://github.com/mastra-ai/mastra/commit/2eabc097d86d52fbd0123da36a7c874154cc384f), [`0023e79`](https://github.com/mastra-ai/mastra/commit/0023e7919431078280abd11c89d1edeae35fcc69), [`c2ad51e`](https://github.com/mastra-ai/mastra/commit/c2ad51e2467f901eecba8c9f4a45e22a50bd7c18), [`25ca73d`](https://github.com/mastra-ai/mastra/commit/25ca73d25dee7ce9f0ca72939e3a505c4db7257e), [`2f9ef3f`](https://github.com/mastra-ai/mastra/commit/2f9ef3f4ca06fc2dcdd5088c26b7f4da6a016791), [`e7eefcb`](https://github.com/mastra-ai/mastra/commit/e7eefcb162cda7c493e8c3bf43050ead0efbcb2c), [`fea5cae`](https://github.com/mastra-ai/mastra/commit/fea5caedc7e2cfea51784a15e015952692027abf), [`4d7aca2`](https://github.com/mastra-ai/mastra/commit/4d7aca2fe75f225c83d1502d63079568e6ec163f), [`e1cead1`](https://github.com/mastra-ai/mastra/commit/e1cead17b5f3653cf00d2f90cc19b113119c02ba), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437), [`d9d93b2`](https://github.com/mastra-ai/mastra/commit/d9d93b25e4a65ad5fa153fa35be7ed149c8d587f), [`c4ec889`](https://github.com/mastra-ai/mastra/commit/c4ec889561c0264c43f66d04d587bee4ce35e792), [`4b59f78`](https://github.com/mastra-ai/mastra/commit/4b59f786cbc9a7d1ef07a07517dbd4b96865e99d), [`eeae63e`](https://github.com/mastra-ai/mastra/commit/eeae63e7fbe8e1f237adc69bca6e2ac13c5ca907), [`3dc97ea`](https://github.com/mastra-ai/mastra/commit/3dc97ea415fad353b48a13095fad1835933cc12a), [`94e7ae9`](https://github.com/mastra-ai/mastra/commit/94e7ae970b37c888cd1244ef013292639a2fe6d1), [`e6a2860`](https://github.com/mastra-ai/mastra/commit/e6a2860649cc51f87d32d78b766ae2126446ba07), [`7010c5d`](https://github.com/mastra-ai/mastra/commit/7010c5d15728bf9c5dfe4fb6b1bf80ce23bf143a), [`bab06b1`](https://github.com/mastra-ai/mastra/commit/bab06b18923873a584bdfc71a6b4ec7fb4727fb7), [`3d01cd3`](https://github.com/mastra-ai/mastra/commit/3d01cd387321b6f9c5cac31d487c84bf51b19c78), [`7bf3086`](https://github.com/mastra-ai/mastra/commit/7bf308663f0115ca74ad20554ade740f06640859), [`4c186a0`](https://github.com/mastra-ai/mastra/commit/4c186a017275f45e6ed4c09de0f89550e2d09e8c), [`b0fa077`](https://github.com/mastra-ai/mastra/commit/b0fa077bcbc9b08551846fe372a0d3d15b71ed72), [`0282e16`](https://github.com/mastra-ai/mastra/commit/0282e16115538c8e9b248b90f0748eb01cb5dc98), [`a8dd139`](https://github.com/mastra-ai/mastra/commit/a8dd1391a9fe9a6632c25809ef236980afa9a020), [`6a667b4`](https://github.com/mastra-ai/mastra/commit/6a667b4b7cd6a93fe41fcdd357b08c5a8c09b9ab), [`9be8878`](https://github.com/mastra-ai/mastra/commit/9be8878dcf0388e84fc4873e0eec27bd49b881a4), [`e5786be`](https://github.com/mastra-ai/mastra/commit/e5786be02bb903073082bd9d6da880ebaacc343f), [`2440e09`](https://github.com/mastra-ai/mastra/commit/2440e096ea6c2def1ccc1eb2d0f3f5b88c4af940), [`2093fbd`](https://github.com/mastra-ai/mastra/commit/2093fbd53bb744bae19ec89f6d73db9a66fbe8a7), [`a59049b`](https://github.com/mastra-ai/mastra/commit/a59049b1652a13efff66ac826326b5ed9a550342), [`7bd85ea`](https://github.com/mastra-ai/mastra/commit/7bd85ea7588b71c25ce9f4019c88f8539be5dcbc), [`83fa004`](https://github.com/mastra-ai/mastra/commit/83fa0044bfda8b703a83883dbd8bef204844d13f), [`a463cdf`](https://github.com/mastra-ai/mastra/commit/a463cdf1c95c3059e70f0bff27959e8558bb899d), [`e7a5da4`](https://github.com/mastra-ai/mastra/commit/e7a5da4ef8e4dd452d2f232961b4e682a85ffe43), [`7b4393d`](https://github.com/mastra-ai/mastra/commit/7b4393d557411fdcf07b0e30e5acaf7cc85154ae), [`0ea6b80`](https://github.com/mastra-ai/mastra/commit/0ea6b8001408ce02b56e8be0536b0fd8cbaf8ad2)]:
  - @mastra/core@1.58.0

## 1.2.0-alpha.2

### Minor Changes

- Added startup observability to `PlatformSandbox`. New optional `sessionId` and `threadId` options let you correlate all sandbox startup activity with the session that triggered it, and the sandbox now logs how long startup took and whether it became reachable. ([#21189](https://github.com/mastra-ai/mastra/pull/21189))

  ```ts
  import { PlatformSandbox } from '@mastra/platform-workspace';

  const sandbox = new PlatformSandbox({
    projectId: 'proj_123',
    environmentId: 'env_123',
    sessionId: 'session_abc', // correlate startup logs with your session
    threadId: 'thread_xyz', // optional finer-grained correlation
  });
  ```

- Added `PlatformSandbox.snapshot()` to capture the configured recovery checkpoint. ([#21221](https://github.com/mastra-ai/mastra/pull/21221))

  ```ts
  await sandbox.snapshot();
  ```

### Patch Changes

- Fixed Platform Sandbox startup so commands use a reliable connection while a new sandbox is starting. ([#21028](https://github.com/mastra-ai/mastra/pull/21028))

- Updated dependencies [[`9571e3a`](https://github.com/mastra-ai/mastra/commit/9571e3a06ed2c5220196460bf82a2129255c3a8b), [`d6c56f9`](https://github.com/mastra-ai/mastra/commit/d6c56f951db3213330b98b0abafa9778c8770e58), [`9571e3a`](https://github.com/mastra-ai/mastra/commit/9571e3a06ed2c5220196460bf82a2129255c3a8b), [`acc3513`](https://github.com/mastra-ai/mastra/commit/acc3513b19f79bf0a7ec2998694580edca54086c), [`94e7ae9`](https://github.com/mastra-ai/mastra/commit/94e7ae970b37c888cd1244ef013292639a2fe6d1), [`6a667b4`](https://github.com/mastra-ai/mastra/commit/6a667b4b7cd6a93fe41fcdd357b08c5a8c09b9ab), [`2440e09`](https://github.com/mastra-ai/mastra/commit/2440e096ea6c2def1ccc1eb2d0f3f5b88c4af940), [`a59049b`](https://github.com/mastra-ai/mastra/commit/a59049b1652a13efff66ac826326b5ed9a550342)]:
  - @mastra/core@1.58.0-alpha.13

## 1.2.0-alpha.1

### Minor Changes

- Split `PlatformSandbox.stop()` from `PlatformSandbox.destroy()` so the two lifecycle exits mirror `@mastra/railway` `RailwaySandbox` ([#20956](https://github.com/mastra-ai/mastra/pull/20956))

  **Before:** `stop()` was an alias for `destroy()`, and `destroy()` only released the sandbox VM — the on-provider recovery checkpoint was never actively deleted. There was no way to end a hosted sandbox while preserving its checkpoint for a later resume, and destroyed sandboxes accumulated stray checkpoints until the upstream provider's own GC.

  **After:**

  - **`stop()`** — releases the VM but **preserves the recovery checkpoint**. Any in-flight capture is awaited first so the preserved checkpoint reflects the caller's latest state. Corresponds to `DELETE /v1/projects/:pid/sandbox/:sandboxId` on workspace-proxy, which by contract does not touch the checkpoint.
  - **`destroy()`** — releases the VM **and deletes the recovery checkpoint**. Cancels any in-flight capture (no reason to burn a capture on state we're releasing), asks the proxy to delete the checkpoint via `DELETE /v1/projects/:pid/sandbox/:sandboxId/checkpoint`, then releases the VM. Both remote operations are best-effort — an already-absent checkpoint or a transient checkpoint-delete failure does not block the VM teardown, since a half-torn-down sandbox is worse than a lingering checkpoint alone.

  Callers constructed without a recovery `id` skip the checkpoint DELETE and behave identically to `stop()`, because they have no on-provider checkpoint to release.

  This restores the "providers move in lockstep" invariant that broke after `@mastra/railway` gained its own `stop()`/`destroy()` split.

  **Requires** a matching workspace-proxy release that exposes `DELETE /v1/projects/:pid/sandbox/:sandboxId/checkpoint`. Callers on older workspace-proxy versions will see the checkpoint DELETE 404 and fall through to the VM DELETE — same net effect as the pre-split behavior.

### Patch Changes

- Add public `captureCheckpoint()` method to `PlatformSandbox` — mirrors `@mastra/railway`'s `RailwaySandbox.captureCheckpoint()` so callers (e.g. a factory-side scheduler) can capture the recovery checkpoint on demand at semantic moments (turn end, session-idle, pre-teardown) without having to know which provider is underneath. ([#20882](https://github.com/mastra-ai/mastra/pull/20882))

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

  - POSTs to `/v1/projects/:projectId/sandbox/:sandboxId/checkpoint` with the caller-supplied recovery key (the `id` the sandbox was constructed with) as the body, matching the shape the workspace-proxy expects.
  - Coalesces concurrent callers on the same instance onto a single upstream request, so N simultaneous turn-end fires do not each round-trip the proxy.
  - Returns `{ status: 'skipped', reason: 'no-checkpoint-name-configured' }` when the sandbox was constructed without a caller-supplied `id` (an auto-generated random id is never a meaningful recovery key), and `{ status: 'skipped', reason: 'sandbox-not-running' }` when the sandbox has not been started yet.
  - Normalizes upstream "sandbox destroyed" outcomes (a 410 from the proxy, or the proxy's own `skipped` status) to `{ status: 'skipped', reason: 'sandbox-not-running' }` — the discriminant matches the pre-flight case so callers branch uniformly, and the sandbox's local state is cleared as a side effect so the next `start()` provisions fresh instead of reattaching to a dead id.
  - Transport failures other than 410 (5xx, 429) propagate as `PlatformApiError` for the caller to handle.

- Coalesce concurrent `PlatformSandbox.start()` callers onto a single in-flight attempt ([#20960](https://github.com/mastra-ai/mastra/pull/20960))

  Two callers hitting `start()` on the same instance before the first one resolves used to both race to `POST /v1/projects/:pid/sandbox` (or `GET /sandbox/:id` on the reattach path), burning N proxy provisions and leaving `N-1` stray sandboxes behind. Fleet-level coalescing on the caller side masked most of this, but the underlying invariant "providers move in lockstep" was false — `@mastra/railway` `RailwaySandbox` has always had `_startInFlight` coalescing.

  `start()` now publishes a single shared promise via `??=` **before** the first `await`, so a second caller entering `start()` while the first is mid-round-trip joins the existing promise instead of racing past the null check. The slot is cleared in `.finally()` on both success and failure paths so a failed attempt isn't a permanent latch — the next call starts fresh. Failures propagate to every joined caller.

  Bug fix; no public API surface change. Callers already awaiting `start()` see the same success/failure semantics; the only observable difference is one upstream call instead of N.

- Updated dependencies [[`cdd5c33`](https://github.com/mastra-ai/mastra/commit/cdd5c33ac6c7118a9f139e6dc0e14e6a8ae31658), [`d7cf7fa`](https://github.com/mastra-ai/mastra/commit/d7cf7fafc1ae1b50bd8462dd0e6c671a8606db93), [`0f9a448`](https://github.com/mastra-ai/mastra/commit/0f9a448502157e59f7b76f24360ad497168f5ef8), [`289f4ce`](https://github.com/mastra-ai/mastra/commit/289f4ce16e3293370440172132c52ee787cbc09f), [`4f16ff8`](https://github.com/mastra-ai/mastra/commit/4f16ff824bf2f9b0ddc93f210477c10c8a4fb1ab), [`1c67d85`](https://github.com/mastra-ai/mastra/commit/1c67d85e9da8285662f4dbbf47e0378c3fee0747), [`ba24be6`](https://github.com/mastra-ai/mastra/commit/ba24be662439c331ab23a600041f93803c89eca8), [`842b5fe`](https://github.com/mastra-ai/mastra/commit/842b5fe22b6a7fa811bd14e48eb9af523ac989f2), [`80bdf3a`](https://github.com/mastra-ai/mastra/commit/80bdf3ae16ade6ff63bde0cb16fa2df8ab7dd4dd), [`9ba1247`](https://github.com/mastra-ai/mastra/commit/9ba12470c77f1c03642d720ce67e517e878f666e), [`fd96298`](https://github.com/mastra-ai/mastra/commit/fd96298a8367622f4ebfcaa97b5b6c1fbbd14564), [`6a84954`](https://github.com/mastra-ai/mastra/commit/6a84954a2667f85b6d59da652dab1bbff007ccb0), [`52d8ef0`](https://github.com/mastra-ai/mastra/commit/52d8ef03801f1deb7ee48532fc4190dd4a33916c), [`cdd5c33`](https://github.com/mastra-ai/mastra/commit/cdd5c33ac6c7118a9f139e6dc0e14e6a8ae31658), [`efd5c81`](https://github.com/mastra-ai/mastra/commit/efd5c81cc25fde3c2ddd86fc1178deb4ec176e19), [`0976933`](https://github.com/mastra-ai/mastra/commit/0976933142333ec78451feef265b68bcb45aa5e7), [`242b945`](https://github.com/mastra-ai/mastra/commit/242b94558777bfbdeb42cbfea84afff0b6ad0633), [`fea5cae`](https://github.com/mastra-ai/mastra/commit/fea5caedc7e2cfea51784a15e015952692027abf), [`4b59f78`](https://github.com/mastra-ai/mastra/commit/4b59f786cbc9a7d1ef07a07517dbd4b96865e99d), [`7010c5d`](https://github.com/mastra-ai/mastra/commit/7010c5d15728bf9c5dfe4fb6b1bf80ce23bf143a)]:
  - @mastra/core@1.58.0-alpha.3

## 1.1.1-alpha.0

### Patch Changes

- Improved `PlatformSandbox.getInfo()` to return cached sandbox information when the sandbox is known to be directly reachable, removing a redundant network round-trip on every workspace status poll. When no cached address is available, `getInfo()` behaves exactly as before. ([#20855](https://github.com/mastra-ai/mastra/pull/20855))

- Updated dependencies [[`e7109ee`](https://github.com/mastra-ai/mastra/commit/e7109ee6f731bacc79c885906f3c7dca8d8f013a), [`772c0c8`](https://github.com/mastra-ai/mastra/commit/772c0c897cec383258de2e6178147f8014767c7b), [`578bf2e`](https://github.com/mastra-ai/mastra/commit/578bf2e6a88e9d5b8bf502204e15a95dfbb679ae), [`06b2d87`](https://github.com/mastra-ai/mastra/commit/06b2d87e63bcdd0ed59215c6789692b9b12de376), [`ac01d63`](https://github.com/mastra-ai/mastra/commit/ac01d6355974aec73fdb8781449ed12bac582094), [`a810a05`](https://github.com/mastra-ai/mastra/commit/a810a058f62ad407cfc1701e0be36ae91145d7cf), [`f8da216`](https://github.com/mastra-ai/mastra/commit/f8da21633e7eb0e31c9ce0fc30567870d19416d3), [`6104347`](https://github.com/mastra-ai/mastra/commit/61043473ba6bfd0a25156824e853e13165562e6c), [`45bfb88`](https://github.com/mastra-ai/mastra/commit/45bfb88fd52f1dd3be20e2a38905777c96499c90), [`e3b9307`](https://github.com/mastra-ai/mastra/commit/e3b9307098daefbfae2a52ae2ef51bc9fc701190), [`d6834c5`](https://github.com/mastra-ai/mastra/commit/d6834c5a7866b16734d23900163c2414ed70d791), [`c52d346`](https://github.com/mastra-ai/mastra/commit/c52d3462ec831a5d95926ecd3d3373f5928ad2e5), [`0023e79`](https://github.com/mastra-ai/mastra/commit/0023e7919431078280abd11c89d1edeae35fcc69), [`c2ad51e`](https://github.com/mastra-ai/mastra/commit/c2ad51e2467f901eecba8c9f4a45e22a50bd7c18), [`3dc97ea`](https://github.com/mastra-ai/mastra/commit/3dc97ea415fad353b48a13095fad1835933cc12a), [`3d01cd3`](https://github.com/mastra-ai/mastra/commit/3d01cd387321b6f9c5cac31d487c84bf51b19c78), [`7bf3086`](https://github.com/mastra-ai/mastra/commit/7bf308663f0115ca74ad20554ade740f06640859), [`a8dd139`](https://github.com/mastra-ai/mastra/commit/a8dd1391a9fe9a6632c25809ef236980afa9a020), [`e5786be`](https://github.com/mastra-ai/mastra/commit/e5786be02bb903073082bd9d6da880ebaacc343f), [`2093fbd`](https://github.com/mastra-ai/mastra/commit/2093fbd53bb744bae19ec89f6d73db9a66fbe8a7), [`e7a5da4`](https://github.com/mastra-ai/mastra/commit/e7a5da4ef8e4dd452d2f232961b4e682a85ffe43), [`7b4393d`](https://github.com/mastra-ai/mastra/commit/7b4393d557411fdcf07b0e30e5acaf7cc85154ae)]:
  - @mastra/core@1.58.0-alpha.1

## 1.1.0

### Minor Changes

- `PlatformSandbox.executeCommand` can now dial the sandbox directly over Railway's private network instead of going through the platform's public exec proxy. On paths where the direct route is available, per-exec latency drops from ~400 ms p50 to ~16 ms p50, and the exec stops touching the platform control plane. This flows through to every filesystem call (`SandboxFilesystem.readFile`, `writeFile`, `readdir`, `mkdir`, `stat`, `exists`, `copyFile`, `moveFile`, `deleteFile`), which is where most agent tool time was going. ([#20664](https://github.com/mastra-ai/mastra/pull/20664))

  Direct-path availability is a runtime property, not a configuration knob. When it's not available — no address registry wired up, the workspace-proxy hasn't discovered the sandbox address yet, or a direct dial fails — `executeCommand` transparently falls back to the existing exec-lease path with no behavior change. Timed-out execs are never retried on the fallback path (they're returned to the caller as-is), so this is safe for non-idempotent commands.

  ### Enabling the direct path

  Wire a `SandboxAddressRegistry` into `PlatformSandbox`:

  ```ts
  import { PlatformSandbox, InProcessSandboxAddressRegistry } from '@mastra/platform-workspace';

  const registry = new InProcessSandboxAddressRegistry();

  const sandbox = new PlatformSandbox({
    accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN,
    projectId: process.env.MASTRA_PLATFORM_PROJECT_ID,
    environmentId: process.env.MASTRA_PLATFORM_ENVIRONMENT_ID,
    addressRegistry: registry,
  });
  ```

  `PlatformSandbox.start()` populates the registry from the workspace-proxy's response; `executeCommand` reads it, tries the direct path first, evicts on transport failure. `destroy()` also evicts. `clone()` shares the same registry — each child sandbox looks up its own id.

  ### New public exports
  - `SandboxAddressRegistry` — the `{ get, set, delete }` interface `PlatformSandbox` sees. Callers can implement their own (e.g. shared across a worker pool) or use the default.
  - `InProcessSandboxAddressRegistry` — the default `Map`-backed implementation.
  - `PlatformSandboxOptions.addressRegistry?` — DI seam. Optional; omitted keeps pre-existing behavior.
  - `execViaPrivateNetwork`, `PrivateNetExecHttpError`, `PrivateNetExecOptions`, `PrivateNetExecResult`, `PrivateNetFetch` — standalone transport for callers that want to talk to a sandbox directly without going through `PlatformSandbox`.

### Patch Changes

- Updated dependencies [[`8d2399b`](https://github.com/mastra-ai/mastra/commit/8d2399b638f8e0945cf2cda0187dbea8dcf0b784), [`c8002da`](https://github.com/mastra-ai/mastra/commit/c8002da7775c468e2965b6ff5f82045450fa8cb9), [`92be47f`](https://github.com/mastra-ai/mastra/commit/92be47fbd26ffccec0e2131ef7c1d9e70dd5ef4a), [`89200ba`](https://github.com/mastra-ai/mastra/commit/89200bafa05444bb7949b363ce7b743e29867561), [`c950138`](https://github.com/mastra-ai/mastra/commit/c950138e72e4f317a40187e3800588731ab790ce), [`810c7e7`](https://github.com/mastra-ai/mastra/commit/810c7e74929989d8b8b5db52cd3af22cd0998af4), [`063c8b2`](https://github.com/mastra-ai/mastra/commit/063c8b2eb14e4e5ca021779bc33e8c3c031c8604), [`f9f9884`](https://github.com/mastra-ai/mastra/commit/f9f98848ee194dc71a787a709ec430b065cdc41b), [`e0904dc`](https://github.com/mastra-ai/mastra/commit/e0904dc538792e54e1806b70172e5900ac49bff4), [`9672fab`](https://github.com/mastra-ai/mastra/commit/9672fabfbcadb961a35c22a2d6722e077f7b24b9), [`f4e964c`](https://github.com/mastra-ai/mastra/commit/f4e964cad57057301d6bed5c55bcdd730175b941), [`1f7bbd7`](https://github.com/mastra-ai/mastra/commit/1f7bbd7785a8d230aad02454ecabeb4a0b2cc96f), [`e47ff36`](https://github.com/mastra-ai/mastra/commit/e47ff36945720f4ee4caa09f6e83514d7d188608), [`64d6781`](https://github.com/mastra-ai/mastra/commit/64d67814bccddd314f7e09643243821e57cb87b6), [`fb9a6ac`](https://github.com/mastra-ai/mastra/commit/fb9a6ac11c9560518742ece60b49d6b062845fd3), [`aa2cec8`](https://github.com/mastra-ai/mastra/commit/aa2cec8501f634d51c2f3ebfb3dd3aa7af8d2ca2), [`c848e65`](https://github.com/mastra-ai/mastra/commit/c848e655a64ff10331a8ceafafe7f18e70a0f092), [`2adf8eb`](https://github.com/mastra-ai/mastra/commit/2adf8eb4a70ed2b6cff2dd39281496ea0e025fac), [`0494489`](https://github.com/mastra-ai/mastra/commit/049448906e4c3d2d615bbe865b073a0d890ddb7c), [`8d1aeb8`](https://github.com/mastra-ai/mastra/commit/8d1aeb8acf7c20c4bb8e4d8e4bdc6569c83ac561), [`8264611`](https://github.com/mastra-ai/mastra/commit/8264611510e421b818bc7395dc2ae4d9c2d518b2), [`d8fa243`](https://github.com/mastra-ai/mastra/commit/d8fa2430d21113e330c4e676ac65e1235cf44f81), [`44fc98b`](https://github.com/mastra-ai/mastra/commit/44fc98b9d1242aa87a3ab44bdce9e9f12c44d8c9), [`f933ba3`](https://github.com/mastra-ai/mastra/commit/f933ba32700e1d0bf143311c1a08f88300b840b6), [`83065bf`](https://github.com/mastra-ai/mastra/commit/83065bfee9e47c3c6f09132a9034501f6cfb69cf), [`0f2ef41`](https://github.com/mastra-ai/mastra/commit/0f2ef4118da022e4f30dac4e9856cc3a8c97671c), [`01b162f`](https://github.com/mastra-ai/mastra/commit/01b162fe435295881aa7ea55f1759407ad5175ad)]:
  - @mastra/core@1.57.0

## 1.1.0-alpha.0

### Minor Changes

- `PlatformSandbox.executeCommand` can now dial the sandbox directly over Railway's private network instead of going through the platform's public exec proxy. On paths where the direct route is available, per-exec latency drops from ~400 ms p50 to ~16 ms p50, and the exec stops touching the platform control plane. This flows through to every filesystem call (`SandboxFilesystem.readFile`, `writeFile`, `readdir`, `mkdir`, `stat`, `exists`, `copyFile`, `moveFile`, `deleteFile`), which is where most agent tool time was going. ([#20664](https://github.com/mastra-ai/mastra/pull/20664))

  Direct-path availability is a runtime property, not a configuration knob. When it's not available — no address registry wired up, the workspace-proxy hasn't discovered the sandbox address yet, or a direct dial fails — `executeCommand` transparently falls back to the existing exec-lease path with no behavior change. Timed-out execs are never retried on the fallback path (they're returned to the caller as-is), so this is safe for non-idempotent commands.

  ### Enabling the direct path

  Wire a `SandboxAddressRegistry` into `PlatformSandbox`:

  ```ts
  import { PlatformSandbox, InProcessSandboxAddressRegistry } from '@mastra/platform-workspace';

  const registry = new InProcessSandboxAddressRegistry();

  const sandbox = new PlatformSandbox({
    accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN,
    projectId: process.env.MASTRA_PLATFORM_PROJECT_ID,
    environmentId: process.env.MASTRA_PLATFORM_ENVIRONMENT_ID,
    addressRegistry: registry,
  });
  ```

  `PlatformSandbox.start()` populates the registry from the workspace-proxy's response; `executeCommand` reads it, tries the direct path first, evicts on transport failure. `destroy()` also evicts. `clone()` shares the same registry — each child sandbox looks up its own id.

  ### New public exports
  - `SandboxAddressRegistry` — the `{ get, set, delete }` interface `PlatformSandbox` sees. Callers can implement their own (e.g. shared across a worker pool) or use the default.
  - `InProcessSandboxAddressRegistry` — the default `Map`-backed implementation.
  - `PlatformSandboxOptions.addressRegistry?` — DI seam. Optional; omitted keeps pre-existing behavior.
  - `execViaPrivateNetwork`, `PrivateNetExecHttpError`, `PrivateNetExecOptions`, `PrivateNetExecResult`, `PrivateNetFetch` — standalone transport for callers that want to talk to a sandbox directly without going through `PlatformSandbox`.

### Patch Changes

- Updated dependencies [[`89200ba`](https://github.com/mastra-ai/mastra/commit/89200bafa05444bb7949b363ce7b743e29867561), [`c950138`](https://github.com/mastra-ai/mastra/commit/c950138e72e4f317a40187e3800588731ab790ce), [`063c8b2`](https://github.com/mastra-ai/mastra/commit/063c8b2eb14e4e5ca021779bc33e8c3c031c8604), [`f4e964c`](https://github.com/mastra-ai/mastra/commit/f4e964cad57057301d6bed5c55bcdd730175b941), [`1f7bbd7`](https://github.com/mastra-ai/mastra/commit/1f7bbd7785a8d230aad02454ecabeb4a0b2cc96f), [`e47ff36`](https://github.com/mastra-ai/mastra/commit/e47ff36945720f4ee4caa09f6e83514d7d188608), [`fb9a6ac`](https://github.com/mastra-ai/mastra/commit/fb9a6ac11c9560518742ece60b49d6b062845fd3), [`aa2cec8`](https://github.com/mastra-ai/mastra/commit/aa2cec8501f634d51c2f3ebfb3dd3aa7af8d2ca2), [`2adf8eb`](https://github.com/mastra-ai/mastra/commit/2adf8eb4a70ed2b6cff2dd39281496ea0e025fac), [`8264611`](https://github.com/mastra-ai/mastra/commit/8264611510e421b818bc7395dc2ae4d9c2d518b2), [`44fc98b`](https://github.com/mastra-ai/mastra/commit/44fc98b9d1242aa87a3ab44bdce9e9f12c44d8c9), [`0f2ef41`](https://github.com/mastra-ai/mastra/commit/0f2ef4118da022e4f30dac4e9856cc3a8c97671c)]:
  - @mastra/core@1.57.0-alpha.1

## 1.0.0

### Major Changes

- Removed support for using `MASTRA_PLATFORM_SECRET_KEY` to authenticate workspace providers. Use the platform-injected `MASTRA_PLATFORM_ACCESS_TOKEN` or pass `accessToken` explicitly instead. ([#20695](https://github.com/mastra-ai/mastra/pull/20695))

  **Before:** Set `MASTRA_PLATFORM_SECRET_KEY`.

  **After:** Use the platform-injected `MASTRA_PLATFORM_ACCESS_TOKEN`. For local development, set `MASTRA_PLATFORM_ACCESS_TOKEN` to an organization API token, or pass it explicitly:

  ```typescript
  import { PlatformSandbox } from '@mastra/platform-workspace';

  const sandbox = new PlatformSandbox({
    accessToken: 'sk_your-api-token',
    projectId: 'project_abc',
    environmentId: 'environment_abc',
  });
  ```

### Minor Changes

- `PlatformSandbox.executeCommand` now retries a dropped connection once and continues using direct execution for later commands. Previously a single connection hiccup permanently downgraded the sandbox to a slower fallback route for the rest of its lifetime. ([#20482](https://github.com/mastra-ai/mastra/pull/20482))

  Execution failures now surface directly:

  - A destroyed sandbox throws the new `SandboxDestroyedError`. The cached sandbox is cleared, so the next call provisions a fresh one.
  - Two connection failures in a row against a live sandbox throw the new `SandboxExecTransportError`, which carries `sandboxId`, `command`, `attempts`, `opened`, `closeCode`, `closeReason`, and `wsEndpoint` for diagnostics.
  - Other platform errors previously masked by the fallback now bubble out as `PlatformApiError`.

  ```ts
  import { SandboxDestroyedError, SandboxExecTransportError } from '@mastra/platform-workspace';

  try {
    await sandbox.executeCommand('pytest');
  } catch (err) {
    if (err instanceof SandboxDestroyedError) {
      // Reprovision and retry.
    } else if (err instanceof SandboxExecTransportError) {
      // Connection failed twice; sandbox is still alive.
    }
  }
  ```

### Patch Changes

- Fixed `PlatformSandbox.clone()` silently ignoring `checkpointName`. Clones created with `clone({ checkpointName })` now reuse a matching captured checkpoint on `start()` instead of always provisioning a fresh sandbox, so repeated boots of the same session start much faster. ([#20477](https://github.com/mastra-ai/mastra/pull/20477))

  ```ts
  const child = template.clone({ checkpointName: 'mastra-recovery-session-42' });
  await child.start(); // Reuses the captured checkpoint when one is available.
  ```

  An explicit `id` still takes precedence over `checkpointName` when both are passed.

- Updated dependencies [[`4844167`](https://github.com/mastra-ai/mastra/commit/4844167cff2d5ec5004e94edd34970833040fa3f), [`c5e56ff`](https://github.com/mastra-ai/mastra/commit/c5e56ff3bcabdf062708f2d48744fec304df6792), [`594f7b2`](https://github.com/mastra-ai/mastra/commit/594f7b28f5263fb9982fd50d95c471fb971ea984), [`7f4e26d`](https://github.com/mastra-ai/mastra/commit/7f4e26dd57bd9b23c278ea21235ab823a3810a6c), [`311f943`](https://github.com/mastra-ai/mastra/commit/311f943bee60e8fdf5c84499ea50e884276c936c), [`322daa6`](https://github.com/mastra-ai/mastra/commit/322daa6d90552909204044790d850958f6745fed), [`db4e6ff`](https://github.com/mastra-ai/mastra/commit/db4e6ff744503112eb64deeaf6c2b54bf26a54c7), [`5faf93f`](https://github.com/mastra-ai/mastra/commit/5faf93f03e19daea394b9e2a923f2e4f833407f2), [`82201f7`](https://github.com/mastra-ai/mastra/commit/82201f75fae8e050a8de2df08b74875ee74c6b83), [`cadaa13`](https://github.com/mastra-ai/mastra/commit/cadaa1372e1077c8e85eb64c5499ba8803caa323), [`0c89896`](https://github.com/mastra-ai/mastra/commit/0c8989673fb7d106837098398131e570c6023b68), [`6d19a65`](https://github.com/mastra-ai/mastra/commit/6d19a6517f5da3911023d446b7e2d5dad8adb1cb), [`23b4238`](https://github.com/mastra-ai/mastra/commit/23b423844ad0bcf2a502a68dd62866d6160f9f6d), [`80ad891`](https://github.com/mastra-ai/mastra/commit/80ad891f8cd10379aa5b5af7510c763783b2ab56), [`fb18da5`](https://github.com/mastra-ai/mastra/commit/fb18da56fc35689ae370621a8f10b5b0d8606e20), [`fb18da5`](https://github.com/mastra-ai/mastra/commit/fb18da56fc35689ae370621a8f10b5b0d8606e20), [`e320a76`](https://github.com/mastra-ai/mastra/commit/e320a763feaf65c6be3cebecf746defcbde161b3), [`03b4918`](https://github.com/mastra-ai/mastra/commit/03b4918c80d188ce375334c393e131c6e94bd7eb), [`14ef73a`](https://github.com/mastra-ai/mastra/commit/14ef73a4bbd73e7808414816eb0628ce1d80b5d7), [`b582f7f`](https://github.com/mastra-ai/mastra/commit/b582f7fa2f9c1f87d19efc63d344fbe5dda2608c), [`0a6598b`](https://github.com/mastra-ai/mastra/commit/0a6598bde80bde008986ad6616bed9632b9294cb), [`06000d7`](https://github.com/mastra-ai/mastra/commit/06000d73712911572e913b8a83339270296d0a22), [`1d677d5`](https://github.com/mastra-ai/mastra/commit/1d677d5f99d7db403f7828585e8c25f299f72628), [`9e1dad8`](https://github.com/mastra-ai/mastra/commit/9e1dad8f7b1cab2bb7ade90e5b7561f24577b88a), [`2f43145`](https://github.com/mastra-ai/mastra/commit/2f4314504c03cbba280414ac81ba3197448ee6b0), [`4e35a56`](https://github.com/mastra-ai/mastra/commit/4e35a56cdf8d74a5ff6d5eda01f2c1deaf6cc7be), [`d94b8e1`](https://github.com/mastra-ai/mastra/commit/d94b8e1cee67416d518a8c30099040061bef6a1c), [`93e28ec`](https://github.com/mastra-ai/mastra/commit/93e28ecce9031c02397e0ae8406593e5c7a95883), [`729dab4`](https://github.com/mastra-ai/mastra/commit/729dab408faccfaef0cbb048e5a4338f9172847e), [`484003d`](https://github.com/mastra-ai/mastra/commit/484003d33ff59330c86b19863e4a38732d7e4155), [`3de0188`](https://github.com/mastra-ai/mastra/commit/3de0188bfaf9a9c09c95fe322b53838cf52c70b6), [`34d34d8`](https://github.com/mastra-ai/mastra/commit/34d34d8c811df512fef4dd5459f79b7821be1866), [`b582f7f`](https://github.com/mastra-ai/mastra/commit/b582f7fa2f9c1f87d19efc63d344fbe5dda2608c), [`933d291`](https://github.com/mastra-ai/mastra/commit/933d291146b789c19442ad206f94da3e4be90c64), [`a1cb98d`](https://github.com/mastra-ai/mastra/commit/a1cb98d11990b560b98482292a1f34aa1a2d9092), [`598ad82`](https://github.com/mastra-ai/mastra/commit/598ad82d41c41389a686338a1d0e50b7400e1938), [`1fd6aad`](https://github.com/mastra-ai/mastra/commit/1fd6aad1ea4a9d32f65efa832307c35e981a4c0a)]:
  - @mastra/core@1.56.0

## 1.0.0-alpha.2

### Major Changes

- Removed support for using `MASTRA_PLATFORM_SECRET_KEY` to authenticate workspace providers. Use the platform-injected `MASTRA_PLATFORM_ACCESS_TOKEN` or pass `accessToken` explicitly instead. ([#20695](https://github.com/mastra-ai/mastra/pull/20695))

  **Before:** Set `MASTRA_PLATFORM_SECRET_KEY`.

  **After:** Use the platform-injected `MASTRA_PLATFORM_ACCESS_TOKEN`. For local development, set `MASTRA_PLATFORM_ACCESS_TOKEN` to an organization API token, or pass it explicitly:

  ```typescript
  import { PlatformSandbox } from '@mastra/platform-workspace';

  const sandbox = new PlatformSandbox({
    accessToken: 'sk_your-api-token',
    projectId: 'project_abc',
    environmentId: 'environment_abc',
  });
  ```

### Patch Changes

- Updated dependencies [[`d94b8e1`](https://github.com/mastra-ai/mastra/commit/d94b8e1cee67416d518a8c30099040061bef6a1c)]:
  - @mastra/core@1.56.0-alpha.7

## 0.3.0-alpha.1

### Minor Changes

- `PlatformSandbox.executeCommand` now retries a dropped connection once and continues using direct execution for later commands. Previously a single connection hiccup permanently downgraded the sandbox to a slower fallback route for the rest of its lifetime. ([#20482](https://github.com/mastra-ai/mastra/pull/20482))

  Execution failures now surface directly:

  - A destroyed sandbox throws the new `SandboxDestroyedError`. The cached sandbox is cleared, so the next call provisions a fresh one.
  - Two connection failures in a row against a live sandbox throw the new `SandboxExecTransportError`, which carries `sandboxId`, `command`, `attempts`, `opened`, `closeCode`, `closeReason`, and `wsEndpoint` for diagnostics.
  - Other platform errors previously masked by the fallback now bubble out as `PlatformApiError`.

  ```ts
  import { SandboxDestroyedError, SandboxExecTransportError } from '@mastra/platform-workspace';

  try {
    await sandbox.executeCommand('pytest');
  } catch (err) {
    if (err instanceof SandboxDestroyedError) {
      // Reprovision and retry.
    } else if (err instanceof SandboxExecTransportError) {
      // Connection failed twice; sandbox is still alive.
    }
  }
  ```

### Patch Changes

- Updated dependencies [[`594f7b2`](https://github.com/mastra-ai/mastra/commit/594f7b28f5263fb9982fd50d95c471fb971ea984), [`311f943`](https://github.com/mastra-ai/mastra/commit/311f943bee60e8fdf5c84499ea50e884276c936c), [`0c89896`](https://github.com/mastra-ai/mastra/commit/0c8989673fb7d106837098398131e570c6023b68), [`23b4238`](https://github.com/mastra-ai/mastra/commit/23b423844ad0bcf2a502a68dd62866d6160f9f6d), [`e320a76`](https://github.com/mastra-ai/mastra/commit/e320a763feaf65c6be3cebecf746defcbde161b3), [`03b4918`](https://github.com/mastra-ai/mastra/commit/03b4918c80d188ce375334c393e131c6e94bd7eb), [`14ef73a`](https://github.com/mastra-ai/mastra/commit/14ef73a4bbd73e7808414816eb0628ce1d80b5d7), [`1d677d5`](https://github.com/mastra-ai/mastra/commit/1d677d5f99d7db403f7828585e8c25f299f72628), [`93e28ec`](https://github.com/mastra-ai/mastra/commit/93e28ecce9031c02397e0ae8406593e5c7a95883), [`729dab4`](https://github.com/mastra-ai/mastra/commit/729dab408faccfaef0cbb048e5a4338f9172847e), [`484003d`](https://github.com/mastra-ai/mastra/commit/484003d33ff59330c86b19863e4a38732d7e4155), [`933d291`](https://github.com/mastra-ai/mastra/commit/933d291146b789c19442ad206f94da3e4be90c64)]:
  - @mastra/core@1.56.0-alpha.3

## 0.2.4-alpha.0

### Patch Changes

- Fixed `PlatformSandbox.clone()` silently ignoring `checkpointName`. Clones created with `clone({ checkpointName })` now reuse a matching captured checkpoint on `start()` instead of always provisioning a fresh sandbox, so repeated boots of the same session start much faster. ([#20477](https://github.com/mastra-ai/mastra/pull/20477))

  ```ts
  const child = template.clone({ checkpointName: 'mastra-recovery-session-42' });
  await child.start(); // Reuses the captured checkpoint when one is available.
  ```

  An explicit `id` still takes precedence over `checkpointName` when both are passed.

- Updated dependencies [[`322daa6`](https://github.com/mastra-ai/mastra/commit/322daa6d90552909204044790d850958f6745fed), [`cadaa13`](https://github.com/mastra-ai/mastra/commit/cadaa1372e1077c8e85eb64c5499ba8803caa323), [`06000d7`](https://github.com/mastra-ai/mastra/commit/06000d73712911572e913b8a83339270296d0a22), [`3de0188`](https://github.com/mastra-ai/mastra/commit/3de0188bfaf9a9c09c95fe322b53838cf52c70b6)]:
  - @mastra/core@1.56.0-alpha.2

## 0.2.3

### Patch Changes

- Fix direct-exec fallback loop: when the WebSocket transport fails on a sandbox (Railway rejects the handshake, mid-stream drop, etc.), disable direct-exec permanently for that sandbox instead of re-minting a fresh lease on every subsequent exec. Also surface WebSocket close code, reason, and `opened` state in `DirectExecResult` and emit a diagnostic warning on transport failure so we can see why Railway is refusing the upgrade in production. ([#20412](https://github.com/mastra-ai/mastra/pull/20412))

- Updated dependencies [[`3f472b4`](https://github.com/mastra-ai/mastra/commit/3f472b468892a1ff14ccb43cc0343b86f7d8fd7d), [`ba369f2`](https://github.com/mastra-ai/mastra/commit/ba369f2a0aaf998da0d6aa033d26f64f96bef8ac), [`35b929b`](https://github.com/mastra-ai/mastra/commit/35b929b7abc3d20d85c7985880960ac2d04a6c86), [`55c9e24`](https://github.com/mastra-ai/mastra/commit/55c9e248c27c1d72b5bb7e94ea6b8a3999eee49f), [`dcfed93`](https://github.com/mastra-ai/mastra/commit/dcfed93e1e256c6abfa792cbb7ca836f5d0e8638), [`2876e15`](https://github.com/mastra-ai/mastra/commit/2876e15b4d2f616a3bc1ed3af57d546c268384ce), [`9b3626a`](https://github.com/mastra-ai/mastra/commit/9b3626aeb1d16fcd34b0a8e94c114ddb80a3b240), [`4696963`](https://github.com/mastra-ai/mastra/commit/469696312ac4c618bc8475b0c5ed7949b8a3455e), [`723aa54`](https://github.com/mastra-ai/mastra/commit/723aa5437106bdb708ae03c0ef6b77aa11291e73), [`07f5b4b`](https://github.com/mastra-ai/mastra/commit/07f5b4ba9d608d88865030732e580298296adf99), [`723aa54`](https://github.com/mastra-ai/mastra/commit/723aa5437106bdb708ae03c0ef6b77aa11291e73), [`723aa54`](https://github.com/mastra-ai/mastra/commit/723aa5437106bdb708ae03c0ef6b77aa11291e73), [`598080f`](https://github.com/mastra-ai/mastra/commit/598080f224edb3f0f5b801035b067fac50a56a03)]:
  - @mastra/core@1.55.0

## 0.2.3-alpha.0

### Patch Changes

- Fix direct-exec fallback loop: when the WebSocket transport fails on a sandbox (Railway rejects the handshake, mid-stream drop, etc.), disable direct-exec permanently for that sandbox instead of re-minting a fresh lease on every subsequent exec. Also surface WebSocket close code, reason, and `opened` state in `DirectExecResult` and emit a diagnostic warning on transport failure so we can see why Railway is refusing the upgrade in production. ([#20412](https://github.com/mastra-ai/mastra/pull/20412))

- Updated dependencies [[`55c9e24`](https://github.com/mastra-ai/mastra/commit/55c9e248c27c1d72b5bb7e94ea6b8a3999eee49f), [`07f5b4b`](https://github.com/mastra-ai/mastra/commit/07f5b4ba9d608d88865030732e580298296adf99)]:
  - @mastra/core@1.55.0-alpha.2

## 0.2.2

### Patch Changes

- **Added:** Direct exec data plane for `PlatformSandbox`. ([#20326](https://github.com/mastra-ai/mastra/pull/20326))

  Commands now execute against Railway's WebSocket endpoint directly using a short-lived JWT lease minted by the workspace proxy, instead of proxying every exec through the HTTP proxy. This removes the workspace proxy from the exec hot path — cutting latency for large-payload commands (e.g. `pnpm install`) and eliminating duplicated observability spans.

  The change is transparent: `executeCommand` still returns the same `CommandResult` shape. If the proxy's `/exec-lease` endpoint is unavailable (older deployments), the client automatically falls back to the legacy `POST /sandbox/:id/exec` route for the lifetime of the sandbox.

- Fixed platform sandbox reattach and made provisioning resilient to transient proxy failures: ([#20294](https://github.com/mastra-ai/mastra/pull/20294))

  - The workspace proxy assigns its own sandbox id on create (the advisory id in the request body is not honored), but `getInfo()` never exposed it, so callers persisting a reattach id (e.g. the Factory sandbox fleet, which reads `metadata.sandboxId`) stored the locally generated construction id instead. Every reattach then 404'd and each session open provisioned a brand-new sandbox and re-cloned the repository. `getInfo()` now reports the platform-assigned id in `metadata.sandboxId`, and `start()` treats a sandbox record with `destroyedAt` set as gone (falls through to a fresh provision) instead of pointing exec at a dead resource.
  - Sandbox creation retries transient workspace-proxy 5xx responses with a short backoff. Provisioning intermittently fails with proxy 500s while the provider is under load; a retry keeps a single flaky window from failing the caller's whole workflow (e.g. Factory kickoff runs). Non-transient errors (4xx) still fail immediately.

- Updated dependencies [[`ce93a3c`](https://github.com/mastra-ai/mastra/commit/ce93a3c114ea1cbfbd576f3db41d7c26c9844f5b), [`5718a22`](https://github.com/mastra-ai/mastra/commit/5718a229281dcfd36bcd1f42a242e3717e510a33), [`a211d09`](https://github.com/mastra-ai/mastra/commit/a211d09185dc65a746534914cf38b67f21ee9bac), [`0dca9d0`](https://github.com/mastra-ai/mastra/commit/0dca9d0b1356024a53b72ea6f040db528b126caa), [`6218217`](https://github.com/mastra-ai/mastra/commit/62182171b6cfca0b099f1c6a77a2e65e7639ab86), [`5807d3a`](https://github.com/mastra-ai/mastra/commit/5807d3ae1d259b8b7d6df7e5bf2b485c694af9c8), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`05db566`](https://github.com/mastra-ai/mastra/commit/05db566fcbdcbf33d0bffca0c72ec30129e2e3ca), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`5718a22`](https://github.com/mastra-ai/mastra/commit/5718a229281dcfd36bcd1f42a242e3717e510a33), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`d1b7e3a`](https://github.com/mastra-ai/mastra/commit/d1b7e3a978a309a5653eeaa490d2d6c7c53bd093), [`29c584a`](https://github.com/mastra-ai/mastra/commit/29c584a13a88831e5ed1fdeb0ff8e82eae180433), [`c093146`](https://github.com/mastra-ai/mastra/commit/c0931466404d3c521308ea119cb165bb7e695155), [`8124754`](https://github.com/mastra-ai/mastra/commit/8124754ae89fbc69f8136d1df4a91904d0f84c4e), [`d12b2e4`](https://github.com/mastra-ai/mastra/commit/d12b2e4023fd9e3d3e93a9169f5088bcee2a849c)]:
  - @mastra/core@1.54.0

## 0.2.2-alpha.0

### Patch Changes

- Fixed platform sandbox reattach and made provisioning resilient to transient proxy failures: ([#20294](https://github.com/mastra-ai/mastra/pull/20294))

  - The workspace proxy assigns its own sandbox id on create (the advisory id in the request body is not honored), but `getInfo()` never exposed it, so callers persisting a reattach id (e.g. the Factory sandbox fleet, which reads `metadata.sandboxId`) stored the locally generated construction id instead. Every reattach then 404'd and each session open provisioned a brand-new sandbox and re-cloned the repository. `getInfo()` now reports the platform-assigned id in `metadata.sandboxId`, and `start()` treats a sandbox record with `destroyedAt` set as gone (falls through to a fresh provision) instead of pointing exec at a dead resource.
  - Sandbox creation retries transient workspace-proxy 5xx responses with a short backoff. Provisioning intermittently fails with proxy 500s while the provider is under load; a retry keeps a single flaky window from failing the caller's whole workflow (e.g. Factory kickoff runs). Non-transient errors (4xx) still fail immediately.

- Updated dependencies [[`6218217`](https://github.com/mastra-ai/mastra/commit/62182171b6cfca0b099f1c6a77a2e65e7639ab86), [`d12b2e4`](https://github.com/mastra-ai/mastra/commit/d12b2e4023fd9e3d3e93a9169f5088bcee2a849c)]:
  - @mastra/core@1.54.0-alpha.4

## 0.2.1

### Patch Changes

- Fixed PlatformSandbox reattach so stale sandbox IDs are recreated before commands run. ([#20102](https://github.com/mastra-ai/mastra/pull/20102))

- Updated dependencies [[`c8d8a01`](https://github.com/mastra-ai/mastra/commit/c8d8a010ee2efe2b7bf4d07707382c34c87b14e4), [`df6a9ce`](https://github.com/mastra-ai/mastra/commit/df6a9ce87214f7aadb2edfe62f67605fe998a0a4), [`73839cb`](https://github.com/mastra-ai/mastra/commit/73839cb58322679c170627d1015669ede5f619aa), [`371cf60`](https://github.com/mastra-ai/mastra/commit/371cf6075cef88ac6919a08d59a82e485397364a), [`8e4dc79`](https://github.com/mastra-ai/mastra/commit/8e4dc793dcf035ea506f9ce79f56d2d501a4be14), [`2db93cc`](https://github.com/mastra-ai/mastra/commit/2db93ccd0b872e4de7853a93383efe0647901df8), [`094ab61`](https://github.com/mastra-ai/mastra/commit/094ab6129a1a3ecf6eeb86decac17d5faea4e02a), [`fe80944`](https://github.com/mastra-ai/mastra/commit/fe80944f3ef6681fea6eae8200fce387b7bb3c2f), [`263d2ca`](https://github.com/mastra-ai/mastra/commit/263d2cac80ba3b03b9c0f008db6f1f1b9eb0278c), [`75f843d`](https://github.com/mastra-ai/mastra/commit/75f843d09f758223e6eeb321321bdcc5c7e779d0), [`e51e166`](https://github.com/mastra-ai/mastra/commit/e51e166c52e220abc9b64554ce37359dca8544b1)]:
  - @mastra/core@1.53.0

## 0.2.1-alpha.0

### Patch Changes

- Fixed PlatformSandbox reattach so stale sandbox IDs are recreated before commands run. ([#20102](https://github.com/mastra-ai/mastra/pull/20102))

- Updated dependencies [[`df6a9ce`](https://github.com/mastra-ai/mastra/commit/df6a9ce87214f7aadb2edfe62f67605fe998a0a4)]:
  - @mastra/core@1.52.2-alpha.0

## 0.2.0

### Minor Changes

- Renamed the environment variable read by PlatformSandbox and PlatformFilesystem for platform authentication from MASTRA_PLATFORM_ACCESS_TOKEN to MASTRA_PLATFORM_SECRET_KEY. The old variable still works as a deprecated fallback. ([#19932](https://github.com/mastra-ai/mastra/pull/19932))

- Added `clone()` support to `PlatformSandbox`. `clone()` constructs an unstarted sibling sandbox that inherits the template's configuration (access token, project, environment, network isolation, timeout, instructions, env, idle timeout) with per-instance overrides for `id`, `sandboxId`, `env`, and `idleTimeoutMinutes`, so one configured sandbox can act as a template for a fleet of sandbox clones (for example, one per project). ([#19647](https://github.com/mastra-ai/mastra/pull/19647))

  ```ts
  const template = new PlatformSandbox({
    accessToken,
    projectId,
    environmentId,
  });

  const projectSandbox = template.clone({
    id: 'mc-project-42',
    env: { GITHUB_TOKEN: token },
    idleTimeoutMinutes: 30,
  });
  await projectSandbox.start();
  ```

  This brings `PlatformSandbox` up to parity with the other sandbox providers (`@mastra/railway`, `@mastra/e2b`, `@mastra/daytona`, `@mastra/modal`, `@mastra/docker`, `@mastra/blaxel`, `@mastra/apple-container`, `@mastra/vercel`) so it can be used with `MastraFactory` fleets and the MC Web factory.

### Patch Changes

- `PlatformSandbox` now includes its caller-facing `id` on the `POST /v1/projects/:projectId/sandbox` wire body when provisioning a new sandbox. The Mastra Platform treats this as an advisory recovery key so callers can opt into checkpoint-based sandbox recovery — if the platform recognizes the id from a previous session, the new sandbox boots from the most recent checkpoint instead of the base template. Unknown ids fall through to a fresh sandbox, so existing callers see no change in behavior. ([#19648](https://github.com/mastra-ai/mastra/pull/19648))

  No API changes — the value sent is the same `id` you already pass to `new PlatformSandbox({ id })` (or the auto-generated one).

- Updated dependencies [[`ec857fc`](https://github.com/mastra-ai/mastra/commit/ec857fc79c264b53b38e16478c789b7177f2ad59), [`d7385ad`](https://github.com/mastra-ai/mastra/commit/d7385ad9e88f9e4f33d15c0ec0bfebedde0cbc2e), [`41a5392`](https://github.com/mastra-ai/mastra/commit/41a5392d9f6c5e18d6b227f0fc0ddf49c50774e9), [`3d6e539`](https://github.com/mastra-ai/mastra/commit/3d6e539272eb2ea0407034605ee1906b3be06b39), [`1426af2`](https://github.com/mastra-ai/mastra/commit/1426af24975879c000d13ac75673f630fcc970c1), [`a40adeb`](https://github.com/mastra-ai/mastra/commit/a40adeb222b961a56a58af56a106106525721b74), [`8a0d145`](https://github.com/mastra-ai/mastra/commit/8a0d145aadbdf7278665aceaaec364b35dd9bd94), [`bd2f1d2`](https://github.com/mastra-ai/mastra/commit/bd2f1d274d05e60e2366f005ea0d94d5cea0d5ff), [`e1f2fae`](https://github.com/mastra-ai/mastra/commit/e1f2faebaf048c3d4c2e2c01d293767c195d5794), [`63aa799`](https://github.com/mastra-ai/mastra/commit/63aa799c6b44eacc7806cda6846b7c5bbee06b37), [`b7e79c3`](https://github.com/mastra-ai/mastra/commit/b7e79c3c02ac5cd415db34ba0975ceafc1464333), [`675fbff`](https://github.com/mastra-ai/mastra/commit/675fbff84d3274391b33e852f76083c38a5514e5), [`da009e1`](https://github.com/mastra-ai/mastra/commit/da009e1aacd89ed94b8d1b2af09c9d4fe7c4db49), [`3b77e77`](https://github.com/mastra-ai/mastra/commit/3b77e7704936522e4769d29de1b5ea6901f302bd), [`c7d30cd`](https://github.com/mastra-ai/mastra/commit/c7d30cd86009c407df91105591f03cd6e3d2854d), [`21a0eb8`](https://github.com/mastra-ai/mastra/commit/21a0eb86746ba0b703acea360d4f84c6a5a493f2), [`8b20926`](https://github.com/mastra-ai/mastra/commit/8b20926cd59e2ba3d66458e062fa0e6e2ada3e68), [`975295d`](https://github.com/mastra-ai/mastra/commit/975295d418552f0d46a59edfef4c3ee555f9930a), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`6b1bf3b`](https://github.com/mastra-ai/mastra/commit/6b1bf3b9494bd51aa8f654c68c9355d6046fa2a1), [`35c2181`](https://github.com/mastra-ai/mastra/commit/35c2181e6a50e47c90ba36260db7c9723d54696f), [`0a2c22c`](https://github.com/mastra-ai/mastra/commit/0a2c22c902604439ec490319e14c17f331e0c84c), [`4cfdd64`](https://github.com/mastra-ai/mastra/commit/4cfdd645794feaea0c4ea711e70ecdfbef0c5b8e), [`b75d749`](https://github.com/mastra-ai/mastra/commit/b75d749621ff5d17e86bcb4ee809d301fb4f7cf3), [`821648b`](https://github.com/mastra-ai/mastra/commit/821648bf2871ef840100c7bacbecf676010bd12a), [`de86fd7`](https://github.com/mastra-ai/mastra/commit/de86fd7119f0438381d1a642e3d258143c0b9c29), [`2745031`](https://github.com/mastra-ai/mastra/commit/2745031d1d4a4978f037092da371428c32e2842a), [`b4b7ea8`](https://github.com/mastra-ai/mastra/commit/b4b7ea8733f033fc441ea47ed03f6afb17ec2248), [`3a8024c`](https://github.com/mastra-ai/mastra/commit/3a8024ce615f8aa89479c0d71fe61d10bb0040be), [`35865a5`](https://github.com/mastra-ai/mastra/commit/35865a53e194aa9634d6a70a97010e7a6b9d58b1), [`74faf8b`](https://github.com/mastra-ai/mastra/commit/74faf8bd9c1018f2492653c06b1e25fc8300e9e6), [`ef03fbc`](https://github.com/mastra-ai/mastra/commit/ef03fbcc556bcbc04c9b3d06fab88771ecaa043c), [`675fbff`](https://github.com/mastra-ai/mastra/commit/675fbff84d3274391b33e852f76083c38a5514e5), [`70687f7`](https://github.com/mastra-ai/mastra/commit/70687f7e495a322a02070b4a67cb0c77a5ca91ec), [`1fadac4`](https://github.com/mastra-ai/mastra/commit/1fadac44537caeefe81f9f775ae2f2f3d94e9069), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`76b7181`](https://github.com/mastra-ai/mastra/commit/76b71810366e6d90b9d3973149d1c7ba3659ffb9), [`792ec9a`](https://github.com/mastra-ai/mastra/commit/792ec9a0869bab8274cf5e0ed2840738737a1607), [`712b864`](https://github.com/mastra-ai/mastra/commit/712b864aa1ed12b14c54390ec17b69de163c37f7), [`85e4fb5`](https://github.com/mastra-ai/mastra/commit/85e4fb50087a81c74df3a762f53b56373db0b912), [`0c0e8d7`](https://github.com/mastra-ai/mastra/commit/0c0e8d7becd4d1445c656b78d5d845f606c1ff9d), [`a7bbe77`](https://github.com/mastra-ai/mastra/commit/a7bbe773577f60bc4761b534ef7ec6b476332dad), [`72e437c`](https://github.com/mastra-ai/mastra/commit/72e437c515942c80b9def5b026e0bdee61b469d9), [`8f7a5de`](https://github.com/mastra-ai/mastra/commit/8f7a5dedc246cdc938bb65516703cf9b27b03756), [`a7bbe77`](https://github.com/mastra-ai/mastra/commit/a7bbe773577f60bc4761b534ef7ec6b476332dad), [`11f6cd9`](https://github.com/mastra-ai/mastra/commit/11f6cd96fe42582403416608beb212cc1a2cc79e), [`ef03c0c`](https://github.com/mastra-ai/mastra/commit/ef03c0cfc62367a458e4cc56462e2148b35681c5), [`4fb4d88`](https://github.com/mastra-ai/mastra/commit/4fb4d881bc107acee13890ad4d78661016c510ed), [`4e68363`](https://github.com/mastra-ai/mastra/commit/4e683634f94ebd062d26a3bb6093a8dfc7263d37), [`c328769`](https://github.com/mastra-ai/mastra/commit/c3287698ff8ef98dba86d415faa566fa3e5f4d56), [`9f7c67a`](https://github.com/mastra-ai/mastra/commit/9f7c67abeeb52c41c51a9b5edee60b62afe7cd8d), [`3b65e68`](https://github.com/mastra-ai/mastra/commit/3b65e68d7f1c771c7a70eea42d83fefdd28cad88), [`4eba27a`](https://github.com/mastra-ai/mastra/commit/4eba27adcf60f991df0e62f94b3e75b4e67f3b4b), [`c701be3`](https://github.com/mastra-ai/mastra/commit/c701be32d7d9aa94a66da8c6cc38dcac6856f464), [`db650ce`](https://github.com/mastra-ai/mastra/commit/db650ce490348914e85b93651d83acdf8f2a4c31), [`232fcbc`](https://github.com/mastra-ai/mastra/commit/232fcbc14fce625dd672ba043329c0b732c62be2), [`6354eeb`](https://github.com/mastra-ai/mastra/commit/6354eeb32efa9f5f68f51dda394e90e2ee76f1fb), [`a8799bb`](https://github.com/mastra-ai/mastra/commit/a8799bb8e44f4a60d01e4e2acd3448ff80bf14f8), [`3d6e539`](https://github.com/mastra-ai/mastra/commit/3d6e539272eb2ea0407034605ee1906b3be06b39), [`e3868e2`](https://github.com/mastra-ai/mastra/commit/e3868e22babfffd0133771669ca724501c2dd58e), [`9251370`](https://github.com/mastra-ai/mastra/commit/9251370ad413af464aa22d7566338bec5613e8de), [`3491666`](https://github.com/mastra-ai/mastra/commit/34916663c4fdd43b48c21f4ab2d5fb6dcccc94f9), [`c0bec73`](https://github.com/mastra-ai/mastra/commit/c0bec732c93d1a22ae5e51ed66cf8cacca8bd6a6)]:
  - @mastra/core@1.52.0

## 0.2.0-alpha.1

### Minor Changes

- Renamed the environment variable read by PlatformSandbox and PlatformFilesystem for platform authentication from MASTRA_PLATFORM_ACCESS_TOKEN to MASTRA_PLATFORM_SECRET_KEY. The old variable still works as a deprecated fallback. ([#19932](https://github.com/mastra-ai/mastra/pull/19932))

## 0.2.0-alpha.0

### Minor Changes

- Added `clone()` support to `PlatformSandbox`. `clone()` constructs an unstarted sibling sandbox that inherits the template's configuration (access token, project, environment, network isolation, timeout, instructions, env, idle timeout) with per-instance overrides for `id`, `sandboxId`, `env`, and `idleTimeoutMinutes`, so one configured sandbox can act as a template for a fleet of sandbox clones (for example, one per project). ([#19647](https://github.com/mastra-ai/mastra/pull/19647))

  ```ts
  const template = new PlatformSandbox({
    accessToken,
    projectId,
    environmentId,
  });

  const projectSandbox = template.clone({
    id: 'mc-project-42',
    env: { GITHUB_TOKEN: token },
    idleTimeoutMinutes: 30,
  });
  await projectSandbox.start();
  ```

  This brings `PlatformSandbox` up to parity with the other sandbox providers (`@mastra/railway`, `@mastra/e2b`, `@mastra/daytona`, `@mastra/modal`, `@mastra/docker`, `@mastra/blaxel`, `@mastra/apple-container`, `@mastra/vercel`) so it can be used with `MastraFactory` fleets and the MC Web factory.

### Patch Changes

- `PlatformSandbox` now includes its caller-facing `id` on the `POST /v1/projects/:projectId/sandbox` wire body when provisioning a new sandbox. The Mastra Platform treats this as an advisory recovery key so callers can opt into checkpoint-based sandbox recovery — if the platform recognizes the id from a previous session, the new sandbox boots from the most recent checkpoint instead of the base template. Unknown ids fall through to a fresh sandbox, so existing callers see no change in behavior. ([#19648](https://github.com/mastra-ai/mastra/pull/19648))

  No API changes — the value sent is the same `id` you already pass to `new PlatformSandbox({ id })` (or the auto-generated one).

- Updated dependencies [[`a40adeb`](https://github.com/mastra-ai/mastra/commit/a40adeb222b961a56a58af56a106106525721b74), [`821648b`](https://github.com/mastra-ai/mastra/commit/821648bf2871ef840100c7bacbecf676010bd12a), [`11f6cd9`](https://github.com/mastra-ai/mastra/commit/11f6cd96fe42582403416608beb212cc1a2cc79e)]:
  - @mastra/core@1.52.0-alpha.6

## 0.1.0

### Minor Changes

- Added Mastra Platform workspace providers for connecting agents to Platform sandboxes and bucket-backed filesystems. ([#18908](https://github.com/mastra-ai/mastra/pull/18908))

  `PlatformFilesystem` and `PlatformSandbox` extend `MastraFilesystem` / `MastraSandbox` from `@mastra/core/workspace` and speak the workspace-proxy wire format (`Authorization: Bearer sk_*`, project-scoped routes at `/v1/projects/:projectId/...`). Both accept config directly and fall back to env vars (`MASTRA_PLATFORM_ACCESS_TOKEN`, `MASTRA_PROJECT_ID`, `MASTRA_ENVIRONMENT_ID`, `MASTRA_PLATFORM_BUCKET_NAME`, `MASTRA_WORKSPACE_PROXY_URL`).

  ```ts
  import { Workspace } from '@mastra/core/workspace';
  import { PlatformFilesystem, PlatformSandbox } from '@mastra/platform-workspace';

  const workspace = new Workspace({
    filesystem: new PlatformFilesystem({ bucketName: 'dev-bucket' }),
    sandbox: new PlatformSandbox({
      environmentId: 'env_123',
      idleTimeoutMinutes: 30,
      networkIsolation: 'ISOLATED',
    }),
  });
  ```

  Also exports `platformFilesystemProvider` and `platformSandboxProvider` descriptors for hosts that register providers dynamically through the editor's `FilesystemProvider` / `SandboxProvider` registries:

  ```ts
  import { platformFilesystemProvider, platformSandboxProvider } from '@mastra/platform-workspace';

  registry.registerFilesystem(platformFilesystemProvider);
  registry.registerSandbox(platformSandboxProvider);
  ```

### Patch Changes

- Updated dependencies [[`bd6d240`](https://github.com/mastra-ai/mastra/commit/bd6d2402db93dddaef0721667e7e8a030e7c6e16), [`0111486`](https://github.com/mastra-ai/mastra/commit/01114867612593eef5cfa2fda6a1194dfedda841), [`96a3749`](https://github.com/mastra-ai/mastra/commit/96a37492235f5b8076b3e3177d83ed5a5e44a640), [`fe1bda0`](https://github.com/mastra-ai/mastra/commit/fe1bda06f6af92a694a51712db747cda1e7185f0), [`25e7c12`](https://github.com/mastra-ai/mastra/commit/25e7c126a770069ae7fb7ecf1d2adb40e017b009), [`1ce5121`](https://github.com/mastra-ai/mastra/commit/1ce512155d122bb21f47d98383e82ffbf84b39e8), [`fb8aea3`](https://github.com/mastra-ai/mastra/commit/fb8aea384291e77311be3a64ee1717320d5c3c73), [`4adc391`](https://github.com/mastra-ai/mastra/commit/4adc3911075249c352bb4832d2471922826344de), [`a5c6337`](https://github.com/mastra-ai/mastra/commit/a5c6337d23c7686c81a32ce62f550f610543a240), [`3cfc47a`](https://github.com/mastra-ai/mastra/commit/3cfc47a6b89940aadd0f46fb01ae9624a73a865d), [`2bb7817`](https://github.com/mastra-ai/mastra/commit/2bb78176112fde628483de2830528f7eee911e56), [`51d9870`](https://github.com/mastra-ai/mastra/commit/51d987032c689c2855374d0f244f5d654da809d1), [`5cab274`](https://github.com/mastra-ai/mastra/commit/5cab2744250e22d12fefa7b32637dce224233cee), [`7fa27d3`](https://github.com/mastra-ai/mastra/commit/7fa27d3b6f5ed68cd34e454a4d3ad9c482a0cfbc), [`8b97958`](https://github.com/mastra-ai/mastra/commit/8b979589f9aa59ba67cac565949475f2ffeb4ac3), [`8410541`](https://github.com/mastra-ai/mastra/commit/84105412c60ecd3bb33a9838146f59c4b588228f), [`a58dcbb`](https://github.com/mastra-ai/mastra/commit/a58dcbb546d7e1d65ebdc1f39e55f0908fcd9391), [`aa38805`](https://github.com/mastra-ai/mastra/commit/aa38805b878b827403be785eb90688d7172f5a40), [`153bd3b`](https://github.com/mastra-ai/mastra/commit/153bd3b396bdfed6b74cf43de12db8fd2d83c04a), [`45a8e65`](https://github.com/mastra-ai/mastra/commit/45a8e65e1556d1362cb3f25187023c36de26661d), [`e955965`](https://github.com/mastra-ai/mastra/commit/e955965dce575a903e37cf054d28ea99aa48785e), [`2d22570`](https://github.com/mastra-ai/mastra/commit/2d22570c7dfdd02123d0ecc529efb05ccba2d9fc), [`07bb863`](https://github.com/mastra-ai/mastra/commit/07bb8631919c6f7cf377dccd45b096e0f17fbed0), [`c8ed116`](https://github.com/mastra-ai/mastra/commit/c8ed11699f62bcac70102ab4ec84d80d20541da6), [`01b338c`](https://github.com/mastra-ai/mastra/commit/01b338c56271f0219606710e3e8b26dee27ac6c2), [`a99eae8`](https://github.com/mastra-ai/mastra/commit/a99eae8908e500c1b2d12f9d277be616b98617a5), [`860ef7e`](https://github.com/mastra-ai/mastra/commit/860ef7e77d92b63469cbe5857aa1e626197e43e9), [`17e818c`](https://github.com/mastra-ai/mastra/commit/17e818c51a958ba90641b1a959dc38faf8c034e9), [`edce8d2`](https://github.com/mastra-ai/mastra/commit/edce8d2769f19e27a05737c627af2d765472a4f8), [`8a586ec`](https://github.com/mastra-ai/mastra/commit/8a586eca9a4914f31dff6140d0d45ac375b00669), [`4451dfe`](https://github.com/mastra-ai/mastra/commit/4451dfe857428e7abcc0261a507a2e186dae6d47), [`8b7361d`](https://github.com/mastra-ai/mastra/commit/8b7361d35de68b80d05d30a74e0c69e7218fd612), [`1d39058`](https://github.com/mastra-ai/mastra/commit/1d39058e548efd691799985d5c8af2737f1c3bd2), [`3927473`](https://github.com/mastra-ai/mastra/commit/392747323ddb10c643d12be7b9ae913159dfaeed), [`dce50dc`](https://github.com/mastra-ai/mastra/commit/dce50dc9a1c1fcd0f427bb5f6250ec74910cb04b), [`fd13f8e`](https://github.com/mastra-ai/mastra/commit/fd13f8e21990f9904c3eedba3a626bb4a929cdb8), [`634caff`](https://github.com/mastra-ai/mastra/commit/634caff29a9200ad058b67d53f96d9e5832fb8a2), [`f703f87`](https://github.com/mastra-ai/mastra/commit/f703f878de072d51fda557f9c50867d8252bef05), [`3e26c87`](https://github.com/mastra-ai/mastra/commit/3e26c87de0c5bc2583b795ce6ca5889b6b161acb), [`33f2b88`](https://github.com/mastra-ai/mastra/commit/33f2b88842c09a567f906fac4cb61cd5277ced59), [`177010f`](https://github.com/mastra-ai/mastra/commit/177010ff096d2e4b28d89803be5b1a4cad2a0d6b), [`0ad646f`](https://github.com/mastra-ai/mastra/commit/0ad646f71a530f2454664299e5e01bfd13fa12e5), [`b486abf`](https://github.com/mastra-ai/mastra/commit/b486abfa2a7528c6f527e4015c819ea9fa54aaad), [`54a51e0`](https://github.com/mastra-ai/mastra/commit/54a51e0a484fe1ebad3fb1f7ef5282a075709eb7), [`c43f3a9`](https://github.com/mastra-ai/mastra/commit/c43f3a9d1efde99b38789364ba4d0ba670f430e3), [`a5008f2`](https://github.com/mastra-ai/mastra/commit/a5008f22ae710ad9402ea9f2547d8c02f74d384b), [`e2d5f37`](https://github.com/mastra-ai/mastra/commit/e2d5f373bd289be534d5f8694d34465010533df6), [`4ce0163`](https://github.com/mastra-ai/mastra/commit/4ce0163dc86e675a86809685c8ce6c49f1aeb87e), [`4378341`](https://github.com/mastra-ai/mastra/commit/43783412df5ea3dd35f5b1f6e4851e79c346fc89)]:
  - @mastra/core@1.51.0

## 0.1.0-alpha.0

### Minor Changes

- Added Mastra Platform workspace providers for connecting agents to Platform sandboxes and bucket-backed filesystems. ([#18908](https://github.com/mastra-ai/mastra/pull/18908))

  `PlatformFilesystem` and `PlatformSandbox` extend `MastraFilesystem` / `MastraSandbox` from `@mastra/core/workspace` and speak the workspace-proxy wire format (`Authorization: Bearer sk_*`, project-scoped routes at `/v1/projects/:projectId/...`). Both accept config directly and fall back to env vars (`MASTRA_PLATFORM_ACCESS_TOKEN`, `MASTRA_PROJECT_ID`, `MASTRA_ENVIRONMENT_ID`, `MASTRA_PLATFORM_BUCKET_NAME`, `MASTRA_WORKSPACE_PROXY_URL`).

  ```ts
  import { Workspace } from '@mastra/core/workspace';
  import { PlatformFilesystem, PlatformSandbox } from '@mastra/platform-workspace';

  const workspace = new Workspace({
    filesystem: new PlatformFilesystem({ bucketName: 'dev-bucket' }),
    sandbox: new PlatformSandbox({
      environmentId: 'env_123',
      idleTimeoutMinutes: 30,
      networkIsolation: 'ISOLATED',
    }),
  });
  ```

  Also exports `platformFilesystemProvider` and `platformSandboxProvider` descriptors for hosts that register providers dynamically through the editor's `FilesystemProvider` / `SandboxProvider` registries:

  ```ts
  import { platformFilesystemProvider, platformSandboxProvider } from '@mastra/platform-workspace';

  registry.registerFilesystem(platformFilesystemProvider);
  registry.registerSandbox(platformSandboxProvider);
  ```

### Patch Changes

- Updated dependencies [[`45a8e65`](https://github.com/mastra-ai/mastra/commit/45a8e65e1556d1362cb3f25187023c36de26661d), [`c8ed116`](https://github.com/mastra-ai/mastra/commit/c8ed11699f62bcac70102ab4ec84d80d20541da6), [`33f2b88`](https://github.com/mastra-ai/mastra/commit/33f2b88842c09a567f906fac4cb61cd5277ced59)]:
  - @mastra/core@1.51.0-alpha.11

## 0.0.1-alpha.0

### Patch Changes

- Initial Platform workspace providers.
