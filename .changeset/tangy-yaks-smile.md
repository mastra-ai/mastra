---
'@mastra/deployer': patch
---

Improved compatibility between `@mastra/deployer` deployers and `Mastra`: the `Bundler` and `Deployer` base classes no longer extend `@mastra/core`'s `MastraBundler` at build time; they implement the `IBundler`/`IDeployer` interfaces instead. Upgrade `@mastra/core` to 1.81.0 or later alongside this version of `@mastra/deployer`, so `new Mastra({ deployer })` uses the interface-based contract. The core peer range is now `>=1.81.0-0 <2.0.0-0`. `getDeployer()` from `@mastra/deployer` now resolves to `IDeployer | undefined | null`.

Checks against core's classes, such as `deployer instanceof MastraBundler` or `deployer instanceof MastraBase`, no longer match these deployers. Use the structural `IDeployer` contract instead of relying on core's class identity. If you type a deployer variable as `MastraBundler` or `MastraDeployer`, switch to `IDeployer` from `@mastra/core/deployer`:

```ts
import type { IDeployer } from '@mastra/core/deployer';
import { VercelDeployer } from '@mastra/deployer-vercel';

const deployer: IDeployer = new VercelDeployer();
```
