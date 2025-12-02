import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { F_OK } from "node:constants";

import {
  InvalidMonorepoError,
  type PackageJSON,
  type Packages,
  type Tool,
} from "./Tool.ts";
import {
  expandPackageGlobs,
  expandPackageGlobsSync,
} from "./expandPackageGlobs.ts";
import { readJson, readJsonSync } from "./utils.ts";

interface NpmPackageJSON extends PackageJSON {
  workspaces?: string[];
}

export const NpmTool: Tool = {
  type: "npm",

  async isMonorepoRoot(directory: string): Promise<boolean> {
    try {
      const [pkgJson] = await Promise.all([
        readJson(directory, "package.json") as Promise<NpmPackageJSON>,
        fsp.access(path.join(directory, "package-lock.json"), F_OK),
      ]);
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

  isMonorepoRootSync(directory: string): boolean {
    try {
      fs.accessSync(path.join(directory, "package-lock.json"), F_OK);
      const pkgJson = readJsonSync(directory, "package.json") as NpmPackageJSON;
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
      )) as NpmPackageJSON;
      const packageGlobs: string[] = pkgJson.workspaces!;

      return {
        tool: NpmTool,
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
          `Directory ${rootDir} is not a valid ${NpmTool.type} monorepo root`
        );
      }
      throw err;
    }
  },

  getPackagesSync(directory: string): Packages {
    const rootDir = path.resolve(directory);

    try {
      const pkgJson = readJsonSync(rootDir, "package.json") as NpmPackageJSON;
      const packageGlobs: string[] = pkgJson.workspaces!;

      return {
        tool: NpmTool,
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
          `Directory ${rootDir} is not a valid ${NpmTool.type} monorepo root`
        );
      }
      throw err;
    }
  },
};
