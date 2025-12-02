import path from "path";

import {
  Tool,
  Package,
  PackageJSON,
  Packages,
  InvalidMonorepoError,
} from "./Tool";
import { readJson, readJsonSync } from "./utils";

export const RootTool: Tool = {
  type: "root",

  async isMonorepoRoot(directory: string): Promise<boolean> {
    // The single package tool is never the root of a monorepo.
    return false;
  },

  isMonorepoRootSync(directory: string): boolean {
    // The single package tool is never the root of a monorepo.
    return false;
  },

  async getPackages(directory: string): Promise<Packages> {
    const rootDir = path.resolve(directory);

    try {
      const pkgJson = (await readJson(rootDir, "package.json")) as PackageJSON;
      const pkg: Package = {
        dir: rootDir,
        relativeDir: ".",
        packageJson: pkgJson,
      };

      return {
        tool: RootTool,
        packages: [pkg],
        rootPackage: pkg,
        rootDir: rootDir,
      };
    } catch (err) {
      if (err && (err as { code: string }).code === "ENOENT") {
        throw new InvalidMonorepoError(
          `Directory ${rootDir} is not a valid ${RootTool.type} monorepo root`
        );
      }
      throw err;
    }
  },

  getPackagesSync(directory: string): Packages {
    const rootDir = path.resolve(directory);

    try {
      const pkgJson = readJsonSync(rootDir, "package.json") as PackageJSON;
      const pkg: Package = {
        dir: rootDir,
        relativeDir: ".",
        packageJson: pkgJson,
      };

      return {
        tool: RootTool,
        packages: [pkg],
        rootPackage: pkg,
        rootDir: rootDir,
      };
    } catch (err) {
      if (err && (err as { code: string }).code === "ENOENT") {
        throw new InvalidMonorepoError(
          `Directory ${rootDir} is not a valid ${RootTool.type} monorepo root`
        );
      }
      throw err;
    }
  },
};
