# @manypkg/get-packages

> A simple utility to get the packages from a monorepo, whether they're using Yarn, Bolt or pnpm

This library exports `getPackages` and `getPackagesSync`. It is intended mostly for use of developers building tools that want to support different kinds of monorepos as an easy way to write tools without having to write tool-specific code. It supports Yarn, Bolt, pnpm and single-package repos(where the only package is the the same as the root package). This library uses `@manypkg/find-root` to search up from the directory that's passed to `getPackages` or `getPackagesSync` to find the project root.

```typescript
import { getPackages, getPackagesSync } from "@manypkg/get-packages";

const { tool, root, packages } = await getPackages(process.cwd());
const { tool, root, packages } = getPackagesSync(process.cwd());

type Tool = "yarn" | "bolt" | "pnpm" | "root";

type Package = { packageJson: PackageJSON; dir: string };

type Packages = {
  tool: Tool;
  packages: Package[];
  root: Package;
};
```
