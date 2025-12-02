import jju from "jju";
import { F_OK } from "node:constants";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

import {
  InvalidMonorepoError,
  type Package,
  type PackageJSON,
  type Packages,
  type Tool,
} from "./Tool.ts";
import { readJson, readJsonSync } from "./utils.ts";

interface RushJson {
  projects: RushProject[];
}

interface RushProject {
  packageName: string;
  projectFolder: string;
}

export const RushTool: Tool = {
  type: "rush",

  async isMonorepoRoot(directory: string): Promise<boolean> {
    try {
      await fsp.access(path.join(directory, "rush.json"), F_OK);
      return true;
    } catch (err) {
      if (err && (err as { code: string }).code === "ENOENT") {
        return false;
      }
      throw err;
    }
  },

  isMonorepoRootSync(directory: string): boolean {
    try {
      fs.accessSync(path.join(directory, "rush.json"), F_OK);
      return true;
    } catch (err) {
      if (err && (err as { code: string }).code === "ENOENT") {
        return false;
      }
      throw err;
    }
  },

  async getPackages(directory: string): Promise<Packages> {
    const rootDir = path.resolve(directory);

    try {
      const rushText: string = await fsp.readFile(
        path.join(rootDir, "rush.json"),
        "utf8"
      );

      // Rush configuration files are full of inline and block-scope comment blocks (JSONC),
      // so we use a parser that can handle that.
      const rushJson: RushJson = jju.parse(rushText);

      const directories = rushJson.projects.map((project) =>
        path.resolve(rootDir, project.projectFolder)
      );
      const packages: Package[] = await Promise.all(
        directories.map(async (dir: string) => {
          return {
            dir,
            relativeDir: path.relative(directory, dir),
            packageJson: await readJson(dir, "package.json"),
          };
        })
      );

      // Rush does not have a root package
      return {
        tool: RushTool,
        packages,
        rootDir,
      };
    } catch (err) {
      if (err && (err as { code: string }).code === "ENOENT") {
        throw new InvalidMonorepoError(
          `Directory ${rootDir} is not a valid ${RushTool.type} monorepo root: missing rush.json`
        );
      }
      throw err;
    }
  },

  getPackagesSync(directory: string): Packages {
    const rootDir = path.resolve(directory);

    try {
      const rushText: string = fs.readFileSync(
        path.join(rootDir, "rush.json"),
        "utf8"
      );

      // Rush configuration files are full of inline and block-scope comment blocks (JSONC),
      // so we use a parser that can handle that.
      const rushJson: RushJson = jju.parse(rushText);

      const directories = rushJson.projects.map((project) =>
        path.resolve(rootDir, project.projectFolder)
      );
      const packages: Package[] = directories.map((dir: string) => {
        const packageJson: PackageJSON = readJsonSync(dir, "package.json");
        return {
          dir,
          relativeDir: path.relative(directory, dir),
          packageJson,
        };
      });

      // Rush does not have a root package
      return {
        tool: RushTool,
        packages,
        rootDir,
      };
    } catch (err) {
      if (err && (err as { code: string }).code === "ENOENT") {
        throw new InvalidMonorepoError(
          `Directory ${rootDir} is not a valid ${RushTool.type} monorepo root: missing rush.json`
        );
      }
      throw err;
    }
  },
};
