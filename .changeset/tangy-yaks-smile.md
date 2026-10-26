---
'@mastra/deployer': patch
---

The `Bundler` and `Deployer` base classes no longer extend `@mastra/core`'s `MastraBundler`/`MastraDeployer` classes at build time; they implement the `IBundler`/`IDeployer` interfaces instead. Existing deployers keep working unchanged, and `new Mastra({ deployer })` still type-checks with them.

If your code checks `deployer instanceof MastraDeployer` or types a deployer variable as `MastraDeployer`, switch to the `IDeployer` interface from `@mastra/core/deployer`:

```ts
import type { IDeployer } from '@mastra/core/deployer';

const deployer: IDeployer = new VercelDeployer();
```
