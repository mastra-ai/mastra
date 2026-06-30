---
'@mastra/vercel': minor
---

**Breaking change:** Renamed the Vercel sandbox exports to make the MicroVM and serverless implementations explicit. `VercelSandbox` now refers to the MicroVM-backed Vercel Sandbox product. The serverless implementation is now exported as `VercelServerlessSandbox`.

- If you have been using `VercelSandbox` in your code, you should update your imports to use `VercelServerlessSandbox` instead.

    ```diff
    -import { VercelSandbox } from '@mastra/vercel';
    -import type { VercelSandboxOptions } from '@mastra/vercel';
    +import { VercelServerlessSandbox } from '@mastra/vercel';
    +import type { VercelServerlessSandboxOptions } from '@mastra/vercel';

    -const sandbox = new VercelSandbox({
    +const sandbox = new VercelServerlessSandbox({
      token: process.env.VERCEL_TOKEN,
    });

    -const options: VercelSandboxOptions = {
    +const options: VercelServerlessSandboxOptions = {
      token: process.env.VERCEL_TOKEN,
    };
    ```

- If you have been using `VercelMicroVMSandbox` in your code, you should update your imports to use `VercelSandbox` instead.

    ```diff
    -import { VercelMicroVMSandbox } from '@mastra/vercel';
    +import { VercelSandbox } from '@mastra/vercel';
    -import type { VercelMicroVMSandboxOptions } from '@mastra/vercel';
    +import type { VercelSandboxOptions } from '@mastra/vercel';

    -const sandbox = new VercelMicroVMSandbox();
    +const sandbox = new VercelSandbox();

    -const options: VercelMicroVMSandboxOptions = {
    +const options: VercelSandboxOptions = {
      runtime: 'node24',
    };
    ```

- Provider descriptors are also split by runtime:

    ```ts
    import { vercelSandboxProvider, vercelServerlessSandboxProvider } from '@mastra/vercel';
    ```

    Use `vercelSandboxProvider` for MicroVM-backed Vercel Sandbox instances and `vercelServerlessSandboxProvider` for Vercel Functions-backed serverless instances.
