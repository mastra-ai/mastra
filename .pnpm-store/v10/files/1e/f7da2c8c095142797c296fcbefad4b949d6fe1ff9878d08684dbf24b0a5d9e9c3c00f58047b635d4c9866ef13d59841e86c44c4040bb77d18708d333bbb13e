# @manypkg/get-packages

> A simple utility to get the packages from a monorepo, whether they're using Yarn, Bolt, Lerna, pnpm or Rush

This library exports `getPackages` and `getPackagesSync`. It is intended mostly for use of developers building tools that want to support different kinds of monorepos as an easy way to write tools without having to write tool-specific code. It supports Yarn, Bolt, Lerna, pnpm, Rush and single-package repos(where the only package is the the same as the root package). This library uses `@manypkg/find-root` to search up from the directory that's passed to `getPackages` or `getPackagesSync` to find the project root.

```typescript
import { getPackages, getPackagesSync } from "@manypkg/get-packages";

const { tool, packages, rootPackage, rootDir } = await getPackages(process.cwd());
const { tool, packages, rootPackage, rootDir } = getPackagesSync(process.cwd());

// From @manypkg/tools

interface Tool {
    readonly type: string;
    isMonorepoRoot(directory: string): Promise<boolean>;
    isMonorepoRootSync(directory: string): boolean;
    getPackages(directory: string): Promise<Packages>;
    getPackagesSync(directory: string): Packages;
}

interface Package {
    packageJson: PackageJSON;
    dir: string;
    relativeDir: string;
}

interface Packages {
  tool: Tool;
  packages: Package[];
  rootPackage?: Package;
  rootDir: string;
}
```
