---
'@mastra/deployer': patch
---

Improved compatibility between `@mastra/deployer` deployers and `Mastra`: the `Bundler` and `Deployer` base classes no longer extend `@mastra/core`'s `MastraBundler`/`MastraDeployer` classes at build time; they implement the `IBundler`/`IDeployer` interfaces instead. Existing deployers keep working unchanged, and `new Mastra({ deployer })` still type-checks with them. `getDeployer()` from `@mastra/deployer` now resolves to `IDeployer | undefined | null`.

If your code checks `deployer instanceof MastraDeployer` or types a deployer variable as `MastraDeployer`, switch to the `IDeployer` interface from `@mastra/core/deployer`:

```ts
import type { IDeployer } from '@mastra/core/deployer';
import { VercelDeployer } from '@mastra/deployer-vercel';

const deployer: IDeployer = new VercelDeployer();
```
