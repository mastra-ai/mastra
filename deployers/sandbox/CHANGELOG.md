# @mastra/deployer-sandbox

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
