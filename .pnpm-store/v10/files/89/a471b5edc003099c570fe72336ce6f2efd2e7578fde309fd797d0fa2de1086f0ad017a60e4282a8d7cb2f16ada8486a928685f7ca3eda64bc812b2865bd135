import * as path from "node:path";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import { F_OK } from "node:constants";

import {
  type Tool,
  type PackageJSON,
  type Packages,
  InvalidMonorepoError,
} from "./Tool.ts";
import {
  expandPackageGlobs,
  expandPackageGlobsSync,
} from "./expandPackageGlobs.ts";
import { readJson, readJsonSync } from "./utils.ts";

interface BunPackageJSON extends PackageJSON {
  workspaces?: string[];
}

async function hasBunLockFile(directory: string): Promise<boolean> {
  try {
    await Promise.any([
      fsp.access(path.join(directory, "bun.lockb"), F_OK),
      fsp.access(path.join(directory, "bun.lock"), F_OK),
    ]);
    return true;
  } catch (err) {
    return false;
  }
}

function hasBunLockFileSync(directory: string): boolean {
  try {
    fs.accessSync(path.join(directory, "bun.lockb"), F_OK);
    return true;
  } catch (err) {
    try {
      fs.accessSync(path.join(directory, "bun.lock"), F_OK);
      return true;
    } catch (err) {
      return false;
    }
  }
}

export const BunTool: Tool = {
  type: "bun",

  async isMonorepoRoot(directory: string): Promise<boolean> {
    try {
      const [pkgJson, hasLockFile] = await Promise.all([
        readJson(directory, "package.json") as Promise<BunPackageJSON>,
        hasBunLockFile(directory),
      ]);
      if (pkgJson.workspaces && hasLockFile) {
        if (Array.isArray(pkgJson.workspaces)) {
          return true;
        }
      }
    } catch (err) {
      if (err && (err as { code: string }).code === "ENOENT") {
        return false;
      }
      throw err;
    }
    return false;
  },

  isMonorepoRootSync(directory: string): boolean {
    try {
      const hasLockFile = hasBunLockFileSync(directory);
      if (!hasLockFile) {
        return false;
      }
      const pkgJson = readJsonSync(directory, "package.json") as BunPackageJSON;
      if (pkgJson.workspaces) {
        if (Array.isArray(pkgJson.workspaces)) {
          return true;
        }
      }
    } catch (err) {
      if (err && (err as { code: string }).code === "ENOENT") {
        return false;
      }
      throw err;
    }
    return false;
  },

  async getPackages(directory: string): Promise<Packages> {
    const rootDir = path.resolve(directory);

    try {
      const pkgJson = (await readJson(
        rootDir,
        "package.json"
      )) as BunPackageJSON;
      const packageGlobs: string[] = pkgJson.workspaces || [];

      return {
        tool: BunTool,
        packages: await expandPackageGlobs(packageGlobs, rootDir),
        rootPackage: {
          dir: rootDir,
          relativeDir: ".",
          packageJson: pkgJson,
        },
        rootDir,
      };
    } catch (err) {
      if (err && (err as { code: string }).code === "ENOENT") {
        throw new InvalidMonorepoError(
          `Directory ${rootDir} is not a valid ${BunTool.type} monorepo root`
        );
      }
      throw err;
    }
  },

  getPackagesSync(directory: string): Packages {
    const rootDir = path.resolve(directory);

    try {
      const pkgJson = readJsonSync(rootDir, "package.json") as BunPackageJSON;
      const packageGlobs: string[] = pkgJson.workspaces || [];

      return {
        tool: BunTool,
        packages: expandPackageGlobsSync(packageGlobs, rootDir),
        rootPackage: {
          dir: rootDir,
          relativeDir: ".",
          packageJson: pkgJson,
        },
        rootDir,
      };
    } catch (err) {
      if (err && (err as { code: string }).code === "ENOENT") {
        throw new InvalidMonorepoError(
          `Directory ${rootDir} is not a valid ${BunTool.type} monorepo root`
        );
      }
      throw err;
    }
  },
};
