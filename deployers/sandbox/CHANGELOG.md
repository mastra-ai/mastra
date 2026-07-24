# @mastra/deployer-sandbox

## 0.1.2-alpha.1

### Patch Changes

- Updated dependencies [[`c8d8a01`](https://github.com/mastra-ai/mastra/commit/c8d8a010ee2efe2b7bf4d07707382c34c87b14e4), [`371cf60`](https://github.com/mastra-ai/mastra/commit/371cf6075cef88ac6919a08d59a82e485397364a), [`263d2ca`](https://github.com/mastra-ai/mastra/commit/263d2cac80ba3b03b9c0f008db6f1f1b9eb0278c)]:
  - @mastra/core@1.53.0-alpha.1
  - @mastra/deployer@1.53.0-alpha.1

## 0.1.2-alpha.0

### Patch Changes

- Updated dependencies [[`df6a9ce`](https://github.com/mastra-ai/mastra/commit/df6a9ce87214f7aadb2edfe62f67605fe998a0a4)]:
  - @mastra/core@1.52.2-alpha.0
  - @mastra/deployer@1.52.2-alpha.0

## 0.1.1

### Patch Changes

- Updated dependencies [[`55adddf`](https://github.com/mastra-ai/mastra/commit/55adddfda2a170b00c112bf37d677e8ce5b65d5a)]:
  - @mastra/core@1.52.1
  - @mastra/deployer@1.52.1

## 0.1.1-alpha.0

### Patch Changes

- Updated dependencies [[`55adddf`](https://github.com/mastra-ai/mastra/commit/55adddfda2a170b00c112bf37d677e8ce5b65d5a)]:
  - @mastra/core@1.52.1-alpha.0
  - @mastra/deployer@1.52.1-alpha.0

## 0.1.0

### Minor Changes

- New package: deploy a full Mastra server (including Studio) into any workspace sandbox that supports networking, and get a live public URL in seconds. Works with `@mastra/vercel`, `@mastra/e2b`, and `@mastra/daytona` sandboxes. Built for ephemeral environments: instant previews, PR/CI smoke deploys, agent-built app verification, and multi-tenant untrusted instances. ([#19577](https://github.com/mastra-ai/mastra/pull/19577))

  **Deploy from your Mastra config**

  ```typescript
  import { Mastra } from '@mastra/core/mastra';
  import { SandboxDeployer } from '@mastra/deployer-sandbox';
  import { VercelSandbox } from '@mastra/vercel';

  export const mastra = new Mastra({
    deployer: new SandboxDeployer({
      sandbox: new VercelSandbox({ sandboxName: 'my-preview', ports: [4111] }),
    }),
  });
  ```

  Then run `mastra build` — it bundles the project and deploys it into the sandbox in one step. Redeploys reuse the same sandbox and skip dependency installs when the install inputs (`package.json`, bundled lockfiles, and the install command) are unchanged.

  **Manage the deployment**

  The sandbox name is the identity — `getDeployment()` retrieves the deployment from any process or codebase, without importing the Mastra project:

  ```typescript
  import { getDeployment } from '@mastra/deployer-sandbox/client';
  import { VercelSandbox } from '@mastra/vercel';

  const dep = await getDeployment({
    sandbox: new VercelSandbox({ sandboxName: 'my-preview', ports: [4111] }),
  }); // never wakes a stopped sandbox
  await dep.stop(); // snapshot-stop (resumable)
  await dep.destroy(); // permanent delete
  ```

  **Deploy programmatically (CI / agents)**

  ```typescript
  import { deployToSandbox } from '@mastra/deployer-sandbox';
  import { VercelSandbox } from '@mastra/vercel';

  const sandbox = new VercelSandbox({ sandboxName: 'ci-preview', ports: [4111] });
  const deployment = await deployToSandbox({ sandbox, dir: '.mastra/output' });
  console.info(deployment.url);
  ```

  **Resolve and route at runtime**

  The server-only `@mastra/deployer-sandbox/client` export includes `getDeployment()` to resolve the current URL and manage the deployment (`stop()`, `destroy()`, `logs()`, with optional wake-on-demand), plus `createSandboxHandler()` and `createSandboxProxy()` helpers to serve a sandbox behind a stable URL on your own domain.

### Patch Changes

- Updated dependencies [[`ec857fc`](https://github.com/mastra-ai/mastra/commit/ec857fc79c264b53b38e16478c789b7177f2ad59), [`d7385ad`](https://github.com/mastra-ai/mastra/commit/d7385ad9e88f9e4f33d15c0ec0bfebedde0cbc2e), [`41a5392`](https://github.com/mastra-ai/mastra/commit/41a5392d9f6c5e18d6b227f0fc0ddf49c50774e9), [`3b77e77`](https://github.com/mastra-ai/mastra/commit/3b77e7704936522e4769d29de1b5ea6901f302bd), [`3d6e539`](https://github.com/mastra-ai/mastra/commit/3d6e539272eb2ea0407034605ee1906b3be06b39), [`1426af2`](https://github.com/mastra-ai/mastra/commit/1426af24975879c000d13ac75673f630fcc970c1), [`a40adeb`](https://github.com/mastra-ai/mastra/commit/a40adeb222b961a56a58af56a106106525721b74), [`8a0d145`](https://github.com/mastra-ai/mastra/commit/8a0d145aadbdf7278665aceaaec364b35dd9bd94), [`bd2f1d2`](https://github.com/mastra-ai/mastra/commit/bd2f1d274d05e60e2366f005ea0d94d5cea0d5ff), [`e1f2fae`](https://github.com/mastra-ai/mastra/commit/e1f2faebaf048c3d4c2e2c01d293767c195d5794), [`63aa799`](https://github.com/mastra-ai/mastra/commit/63aa799c6b44eacc7806cda6846b7c5bbee06b37), [`b7e79c3`](https://github.com/mastra-ai/mastra/commit/b7e79c3c02ac5cd415db34ba0975ceafc1464333), [`675fbff`](https://github.com/mastra-ai/mastra/commit/675fbff84d3274391b33e852f76083c38a5514e5), [`da009e1`](https://github.com/mastra-ai/mastra/commit/da009e1aacd89ed94b8d1b2af09c9d4fe7c4db49), [`3b77e77`](https://github.com/mastra-ai/mastra/commit/3b77e7704936522e4769d29de1b5ea6901f302bd), [`c7d30cd`](https://github.com/mastra-ai/mastra/commit/c7d30cd86009c407df91105591f03cd6e3d2854d), [`21a0eb8`](https://github.com/mastra-ai/mastra/commit/21a0eb86746ba0b703acea360d4f84c6a5a493f2), [`8b20926`](https://github.com/mastra-ai/mastra/commit/8b20926cd59e2ba3d66458e062fa0e6e2ada3e68), [`975295d`](https://github.com/mastra-ai/mastra/commit/975295d418552f0d46a59edfef4c3ee555f9930a), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`6b1bf3b`](https://github.com/mastra-ai/mastra/commit/6b1bf3b9494bd51aa8f654c68c9355d6046fa2a1), [`35c2181`](https://github.com/mastra-ai/mastra/commit/35c2181e6a50e47c90ba36260db7c9723d54696f), [`0a2c22c`](https://github.com/mastra-ai/mastra/commit/0a2c22c902604439ec490319e14c17f331e0c84c), [`4cfdd64`](https://github.com/mastra-ai/mastra/commit/4cfdd645794feaea0c4ea711e70ecdfbef0c5b8e), [`0a50de7`](https://github.com/mastra-ai/mastra/commit/0a50de7024816171701e81ac3b69434cf5a302ea), [`b75d749`](https://github.com/mastra-ai/mastra/commit/b75d749621ff5d17e86bcb4ee809d301fb4f7cf3), [`821648b`](https://github.com/mastra-ai/mastra/commit/821648bf2871ef840100c7bacbecf676010bd12a), [`de86fd7`](https://github.com/mastra-ai/mastra/commit/de86fd7119f0438381d1a642e3d258143c0b9c29), [`2745031`](https://github.com/mastra-ai/mastra/commit/2745031d1d4a4978f037092da371428c32e2842a), [`b4b7ea8`](https://github.com/mastra-ai/mastra/commit/b4b7ea8733f033fc441ea47ed03f6afb17ec2248), [`3a8024c`](https://github.com/mastra-ai/mastra/commit/3a8024ce615f8aa89479c0d71fe61d10bb0040be), [`35865a5`](https://github.com/mastra-ai/mastra/commit/35865a53e194aa9634d6a70a97010e7a6b9d58b1), [`74faf8b`](https://github.com/mastra-ai/mastra/commit/74faf8bd9c1018f2492653c06b1e25fc8300e9e6), [`ef03fbc`](https://github.com/mastra-ai/mastra/commit/ef03fbcc556bcbc04c9b3d06fab88771ecaa043c), [`675fbff`](https://github.com/mastra-ai/mastra/commit/675fbff84d3274391b33e852f76083c38a5514e5), [`70687f7`](https://github.com/mastra-ai/mastra/commit/70687f7e495a322a02070b4a67cb0c77a5ca91ec), [`1fadac4`](https://github.com/mastra-ai/mastra/commit/1fadac44537caeefe81f9f775ae2f2f3d94e9069), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`76b7181`](https://github.com/mastra-ai/mastra/commit/76b71810366e6d90b9d3973149d1c7ba3659ffb9), [`792ec9a`](https://github.com/mastra-ai/mastra/commit/792ec9a0869bab8274cf5e0ed2840738737a1607), [`712b864`](https://github.com/mastra-ai/mastra/commit/712b864aa1ed12b14c54390ec17b69de163c37f7), [`85e4fb5`](https://github.com/mastra-ai/mastra/commit/85e4fb50087a81c74df3a762f53b56373db0b912), [`0c0e8d7`](https://github.com/mastra-ai/mastra/commit/0c0e8d7becd4d1445c656b78d5d845f606c1ff9d), [`53df41b`](https://github.com/mastra-ai/mastra/commit/53df41ba8b00438ebe5daee1b04613aa4239a5b2), [`a7bbe77`](https://github.com/mastra-ai/mastra/commit/a7bbe773577f60bc4761b534ef7ec6b476332dad), [`72e437c`](https://github.com/mastra-ai/mastra/commit/72e437c515942c80b9def5b026e0bdee61b469d9), [`8f7a5de`](https://github.com/mastra-ai/mastra/commit/8f7a5dedc246cdc938bb65516703cf9b27b03756), [`a7bbe77`](https://github.com/mastra-ai/mastra/commit/a7bbe773577f60bc4761b534ef7ec6b476332dad), [`11f6cd9`](https://github.com/mastra-ai/mastra/commit/11f6cd96fe42582403416608beb212cc1a2cc79e), [`ef03c0c`](https://github.com/mastra-ai/mastra/commit/ef03c0cfc62367a458e4cc56462e2148b35681c5), [`4fb4d88`](https://github.com/mastra-ai/mastra/commit/4fb4d881bc107acee13890ad4d78661016c510ed), [`eac4537`](https://github.com/mastra-ai/mastra/commit/eac453795531df0d5fe3729d80e93a91f8c1bc91), [`4e68363`](https://github.com/mastra-ai/mastra/commit/4e683634f94ebd062d26a3bb6093a8dfc7263d37), [`c328769`](https://github.com/mastra-ai/mastra/commit/c3287698ff8ef98dba86d415faa566fa3e5f4d56), [`9f7c67a`](https://github.com/mastra-ai/mastra/commit/9f7c67abeeb52c41c51a9b5edee60b62afe7cd8d), [`3b65e68`](https://github.com/mastra-ai/mastra/commit/3b65e68d7f1c771c7a70eea42d83fefdd28cad88), [`4eba27a`](https://github.com/mastra-ai/mastra/commit/4eba27adcf60f991df0e62f94b3e75b4e67f3b4b), [`c701be3`](https://github.com/mastra-ai/mastra/commit/c701be32d7d9aa94a66da8c6cc38dcac6856f464), [`b4b7ea8`](https://github.com/mastra-ai/mastra/commit/b4b7ea8733f033fc441ea47ed03f6afb17ec2248), [`db650ce`](https://github.com/mastra-ai/mastra/commit/db650ce490348914e85b93651d83acdf8f2a4c31), [`232fcbc`](https://github.com/mastra-ai/mastra/commit/232fcbc14fce625dd672ba043329c0b732c62be2), [`6354eeb`](https://github.com/mastra-ai/mastra/commit/6354eeb32efa9f5f68f51dda394e90e2ee76f1fb), [`a8799bb`](https://github.com/mastra-ai/mastra/commit/a8799bb8e44f4a60d01e4e2acd3448ff80bf14f8), [`3d6e539`](https://github.com/mastra-ai/mastra/commit/3d6e539272eb2ea0407034605ee1906b3be06b39), [`e3868e2`](https://github.com/mastra-ai/mastra/commit/e3868e22babfffd0133771669ca724501c2dd58e), [`9251370`](https://github.com/mastra-ai/mastra/commit/9251370ad413af464aa22d7566338bec5613e8de), [`3491666`](https://github.com/mastra-ai/mastra/commit/34916663c4fdd43b48c21f4ab2d5fb6dcccc94f9), [`c0bec73`](https://github.com/mastra-ai/mastra/commit/c0bec732c93d1a22ae5e51ed66cf8cacca8bd6a6)]:
  - @mastra/core@1.52.0
  - @mastra/deployer@1.52.0

## 0.1.0-alpha.0

### Minor Changes

- New package: deploy a full Mastra server (including Studio) into any workspace sandbox that supports networking, and get a live public URL in seconds. Works with `@mastra/vercel`, `@mastra/e2b`, and `@mastra/daytona` sandboxes. Built for ephemeral environments: instant previews, PR/CI smoke deploys, agent-built app verification, and multi-tenant untrusted instances. ([#19577](https://github.com/mastra-ai/mastra/pull/19577))

  **Deploy from your Mastra config**

  ```typescript
  import { Mastra } from '@mastra/core/mastra';
  import { SandboxDeployer } from '@mastra/deployer-sandbox';
  import { VercelSandbox } from '@mastra/vercel';

  export const mastra = new Mastra({
    deployer: new SandboxDeployer({
      sandbox: new VercelSandbox({ sandboxName: 'my-preview', ports: [4111] }),
    }),
  });
  ```

  Then run `mastra build` — it bundles the project and deploys it into the sandbox in one step. Redeploys reuse the same sandbox and skip dependency installs when the install inputs (`package.json`, bundled lockfiles, and the install command) are unchanged.

  **Manage the deployment**

  The sandbox name is the identity — `getDeployment()` retrieves the deployment from any process or codebase, without importing the Mastra project:

  ```typescript
  import { getDeployment } from '@mastra/deployer-sandbox/client';
  import { VercelSandbox } from '@mastra/vercel';

  const dep = await getDeployment({
    sandbox: new VercelSandbox({ sandboxName: 'my-preview', ports: [4111] }),
  }); // never wakes a stopped sandbox
  await dep.stop(); // snapshot-stop (resumable)
  await dep.destroy(); // permanent delete
  ```

  **Deploy programmatically (CI / agents)**

  ```typescript
  import { deployToSandbox } from '@mastra/deployer-sandbox';
  import { VercelSandbox } from '@mastra/vercel';

  const sandbox = new VercelSandbox({ sandboxName: 'ci-preview', ports: [4111] });
  const deployment = await deployToSandbox({ sandbox, dir: '.mastra/output' });
  console.info(deployment.url);
  ```

  **Resolve and route at runtime**

  The server-only `@mastra/deployer-sandbox/client` export includes `getDeployment()` to resolve the current URL and manage the deployment (`stop()`, `destroy()`, `logs()`, with optional wake-on-demand), plus `createSandboxHandler()` and `createSandboxProxy()` helpers to serve a sandbox behind a stable URL on your own domain.

### Patch Changes

- Updated dependencies [[`ec857fc`](https://github.com/mastra-ai/mastra/commit/ec857fc79c264b53b38e16478c789b7177f2ad59), [`e1f2fae`](https://github.com/mastra-ai/mastra/commit/e1f2faebaf048c3d4c2e2c01d293767c195d5794), [`63aa799`](https://github.com/mastra-ai/mastra/commit/63aa799c6b44eacc7806cda6846b7c5bbee06b37), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`76b7181`](https://github.com/mastra-ai/mastra/commit/76b71810366e6d90b9d3973149d1c7ba3659ffb9), [`0c0e8d7`](https://github.com/mastra-ai/mastra/commit/0c0e8d7becd4d1445c656b78d5d845f606c1ff9d), [`9f7c67a`](https://github.com/mastra-ai/mastra/commit/9f7c67abeeb52c41c51a9b5edee60b62afe7cd8d), [`3b65e68`](https://github.com/mastra-ai/mastra/commit/3b65e68d7f1c771c7a70eea42d83fefdd28cad88), [`e3868e2`](https://github.com/mastra-ai/mastra/commit/e3868e22babfffd0133771669ca724501c2dd58e)]:
  - @mastra/core@1.52.0-alpha.5
  - @mastra/deployer@1.52.0-alpha.5
