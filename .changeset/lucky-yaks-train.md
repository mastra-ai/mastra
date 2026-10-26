---
'@mastra/core': patch
---

The `deployer` option on `Mastra` now accepts any object that implements the `IDeployer` interface (exported from `@mastra/core/deployer`), not only subclasses of `MastraDeployer`. `getDeployer()` now returns `IDeployer | undefined`.

This keeps deployers from `@mastra/deployer` (such as `VercelDeployer`) assignable to `Mastra` even when they are built on a separate copy of the base classes.

```ts
// Before: deployer had to be typed as MastraDeployer
const deployer: MastraDeployer | undefined = mastra.getDeployer();

// After
import type { IDeployer } from '@mastra/core/deployer';
const deployer: IDeployer | undefined = mastra.getDeployer();
```
