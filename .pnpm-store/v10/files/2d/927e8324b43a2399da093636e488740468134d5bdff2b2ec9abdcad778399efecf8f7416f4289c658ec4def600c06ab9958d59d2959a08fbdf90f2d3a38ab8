// This is a modified version of the package-getting in bolt
// It supports yarn workspaces as well, and can fall back through
// several options

import fs from "fs-extra";
import path from "path";
import globby, { sync as globbySync } from "globby";
import readYamlFile, { sync as readYamlFileSync } from "read-yaml-file";
import { PackageJSON } from "@changesets/types";
import { findRoot, findRootSync } from "@manypkg/find-root";

export type Tool = "yarn" | "bolt" | "pnpm" | "lerna" | "root";

export type Package = { packageJson: PackageJSON; dir: string };

export type Packages = {
  tool: Tool;
  packages: Package[];
  root: Package;
};

export class PackageJsonMissingNameError extends Error {
  directories: string[];
  constructor(directories: string[]) {
    super(
      `The following package.jsons are missing the "name" field:\n${directories.join(
        "\n"
      )}`
    );
    this.directories = directories;
  }
}

export async function getPackages(dir: string): Promise<Packages> {
  const cwd = await findRoot(dir);
  const pkg = await fs.readJson(path.join(cwd, "package.json"));

  let tool:
    | {
        type: Tool;
        packageGlobs: string[];
      }
    | undefined;

  if (pkg.workspaces) {
    if (Array.isArray(pkg.workspaces)) {
      tool = {
        type: "yarn",
        packageGlobs: pkg.workspaces
      };
    } else if (pkg.workspaces.packages) {
      tool = {
        type: "yarn",
        packageGlobs: pkg.workspaces.packages
      };
    }
  } else if (pkg.bolt && pkg.bolt.workspaces) {
    tool = {
      type: "bolt",
      packageGlobs: pkg.bolt.workspaces
    };
  } else {
    try {
      const manifest = await readYamlFile<{ packages?: string[] }>(
        path.join(cwd, "pnpm-workspace.yaml")
      );
      if (manifest && manifest.packages) {
        tool = {
          type: "pnpm",
          packageGlobs: manifest.packages
        };
      }
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }

    if (!tool) {
      try {
        const lernaJson = await fs.readJson(
          path.join(cwd, "lerna.json")
        );
        if (lernaJson) {
          tool = {
            type: "lerna",
            packageGlobs: lernaJson.packages || ["packages/*"],
          }
        }
      } catch (err) {
        if (err.code !== "ENOENT") {
          throw err;
        }
      }
    }
  }

  if (!tool) {
    const root = {
      dir: cwd,
      packageJson: pkg
    };
    if (!pkg.name) {
      throw new PackageJsonMissingNameError(["package.json"]);
    }
    return {
      tool: "root",
      root,
      packages: [root]
    };
  }

  const relativeDirectories = await globby(tool.packageGlobs, {
    cwd,
    onlyDirectories: true,
    expandDirectories: false,
    ignore: ["**/node_modules"]
  });
  const directories = relativeDirectories.map(p => path.resolve(cwd, p))

  let pkgJsonsMissingNameField: Array<string> = [];

  const results = (
    await Promise.all(
      directories.sort().map(dir =>
        fs
          .readJson(path.join(dir, "package.json"))
          .then(packageJson => {
            if (!packageJson.name) {
              pkgJsonsMissingNameField.push(
                path.relative(cwd, path.join(dir, "package.json"))
              );
            }
            return { packageJson, dir };
          })
          .catch(err => {
            if (err.code === "ENOENT") {
              return null;
            }
            throw err;
          })
      )
    )
  ).filter(x => x);
  if (pkgJsonsMissingNameField.length !== 0) {
    pkgJsonsMissingNameField.sort();
    throw new PackageJsonMissingNameError(pkgJsonsMissingNameField);
  }
  return {
    tool: tool.type,
    root: {
      dir: cwd,
      packageJson: pkg
    },
    packages: results as Package[]
  };
}

export function getPackagesSync(dir: string): Packages {
  const cwd = findRootSync(dir);
  const pkg = fs.readJsonSync(path.join(cwd, "package.json"));

  let tool:
    | {
        type: Tool;
        packageGlobs: string[];
      }
    | undefined;

  if (pkg.workspaces) {
    if (Array.isArray(pkg.workspaces)) {
      tool = {
        type: "yarn",
        packageGlobs: pkg.workspaces
      };
    } else if (pkg.workspaces.packages) {
      tool = {
        type: "yarn",
        packageGlobs: pkg.workspaces.packages
      };
    }
  } else if (pkg.bolt && pkg.bolt.workspaces) {
    tool = {
      type: "bolt",
      packageGlobs: pkg.bolt.workspaces
    };
  } else {
    try {
      const manifest = readYamlFileSync<{ packages?: string[] }>(
        path.join(cwd, "pnpm-workspace.yaml")
      );
      if (manifest && manifest.packages) {
        tool = {
          type: "pnpm",
          packageGlobs: manifest.packages
        };
      }
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }

    if (!tool) {
      try {
        const lernaJson = fs.readJsonSync(
          path.join(cwd, "lerna.json")
        );
        if (lernaJson) {
          tool = {
            type: "lerna",
            packageGlobs: lernaJson.packages || ["packages/*"],
          }
        }
      } catch (err) {
        if (err.code !== "ENOENT") {
          throw err;
        }
      }
    }
  }

  if (!tool) {
    const root = {
      dir: cwd,
      packageJson: pkg
    };
    if (!pkg.name) {
      throw new PackageJsonMissingNameError(["package.json"]);
    }
    return {
      tool: "root",
      root,
      packages: [root]
    };
  }
  const relativeDirectories = globbySync(tool.packageGlobs, {
    cwd,
    onlyDirectories: true,
    expandDirectories: false,
    ignore: ["**/node_modules"]
  });
  const directories = relativeDirectories.map(p => path.resolve(cwd, p))

  let pkgJsonsMissingNameField: Array<string> = [];

  const results = directories
    .sort()
    .map(dir => {
      try {
        const packageJson = fs.readJsonSync(path.join(dir, "package.json"));
        if (!packageJson.name) {
          pkgJsonsMissingNameField.push(
            path.relative(cwd, path.join(dir, "package.json"))
          );
        }
        return { packageJson, dir };
      } catch (err) {
        if (err.code === "ENOENT") return null;
        throw err;
      }
    })
    .filter(x => x);

  if (pkgJsonsMissingNameField.length !== 0) {
    pkgJsonsMissingNameField.sort();
    throw new PackageJsonMissingNameError(pkgJsonsMissingNameField);
  }

  return {
    tool: tool.type,
    root: {
      dir: cwd,
      packageJson: pkg
    },
    packages: results as Package[]
  };
}
