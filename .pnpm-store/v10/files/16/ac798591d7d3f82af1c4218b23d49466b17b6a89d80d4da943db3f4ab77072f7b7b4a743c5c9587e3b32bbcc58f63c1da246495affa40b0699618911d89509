import * as path from 'node:path';
import path__default from 'node:path';
import * as fs from 'node:fs';
import fs__default from 'node:fs';
import * as fsp from 'node:fs/promises';
import fsp__default from 'node:fs/promises';
import { F_OK } from 'node:constants';
import { glob, globSync } from 'tinyglobby';
import yaml from 'js-yaml';
import jju from 'jju';

/**
 * A package.json access type.
 */

/**
 * An in-memory representation of a package.json file.
 */

/**
 * An individual package json structure, along with the directory it lives in,
 * relative to the root of the current monorepo.
 */

/**
 * A collection of packages, along with the monorepo tool used to load them,
 * and (if supported by the tool) the associated "root" package.
 */

/**
 * An object representing the root of a specific monorepo, with the root
 * directory and associated monorepo tool.
 *
 * Note that this type is currently not used by Tool definitions directly,
 * but it is the suggested way to pass around a reference to a monorepo root
 * directory and associated tool.
 */

/**
 * Monorepo tools may throw this error if a caller attempts to get the package
 * collection from a directory that is not a valid monorepo root.
 */
class InvalidMonorepoError extends Error {}

/**
 * A monorepo tool is a specific implementation of monorepos, whether provided built-in
 * by a package manager or via some other wrapper.
 *
 * Each tool defines a common interface for detecting whether a directory is
 * a valid instance of this type of monorepo, how to retrieve the packages, etc.
 */

const readJson = async (directory, file) => JSON.parse(await fsp__default.readFile(path__default.join(directory, file), "utf-8"));
const readJsonSync = (directory, file) => JSON.parse(fs__default.readFileSync(path__default.join(directory, file), "utf-8"));

/**
 * This internal method takes a list of one or more directory globs and the absolute path
 * to the root directory, and returns a list of all matching relative directories that
 * contain a `package.json` file.
 */
async function expandPackageGlobs(packageGlobs, directory) {
  const relativeDirectories = await glob(packageGlobs, {
    cwd: directory,
    onlyDirectories: true,
    ignore: ["**/node_modules"],
    expandDirectories: false
  });
  const directories = relativeDirectories.map(p => path__default.resolve(directory, p)).sort();
  const discoveredPackages = await Promise.all(directories.map(dir => fsp__default.readFile(path__default.join(dir, "package.json"), "utf-8").catch(err => {
    if (err && err.code === "ENOENT") {
      return undefined;
    }
    throw err;
  }).then(result => {
    if (result) {
      return {
        dir: path__default.resolve(dir),
        relativeDir: path__default.relative(directory, dir),
        packageJson: JSON.parse(result)
      };
    }
  })));
  return discoveredPackages.filter(pkg => pkg);
}

/**
 * A synchronous version of {@link expandPackagesGlobs}.
 */
function expandPackageGlobsSync(packageGlobs, directory) {
  const relativeDirectories = globSync(packageGlobs, {
    cwd: directory,
    onlyDirectories: true,
    ignore: ["**/node_modules"],
    expandDirectories: false
  });
  const directories = relativeDirectories.map(p => path__default.resolve(directory, p)).sort();
  const discoveredPackages = directories.map(dir => {
    try {
      const packageJson = readJsonSync(dir, "package.json");
      return {
        dir: path__default.resolve(dir),
        relativeDir: path__default.relative(directory, dir),
        packageJson
      };
    } catch (err) {
      if (err && err.code === "ENOENT") {
        return undefined;
      }
      throw err;
    }
  });
  return discoveredPackages.filter(pkg => pkg);
}

async function hasBunLockFile(directory) {
  try {
    await Promise.any([fsp.access(path.join(directory, "bun.lockb"), F_OK), fsp.access(path.join(directory, "bun.lock"), F_OK)]);
    return true;
  } catch (err) {
    return false;
  }
}
function hasBunLockFileSync(directory) {
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
const BunTool = {
  type: "bun",
  async isMonorepoRoot(directory) {
    try {
      const [pkgJson, hasLockFile] = await Promise.all([readJson(directory, "package.json"), hasBunLockFile(directory)]);
      if (pkgJson.workspaces && hasLockFile) {
        if (Array.isArray(pkgJson.workspaces)) {
          return true;
        }
      }
    } catch (err) {
      if (err && err.code === "ENOENT") {
        return false;
      }
      throw err;
    }
    return false;
  },
  isMonorepoRootSync(directory) {
    try {
      const hasLockFile = hasBunLockFileSync(directory);
      if (!hasLockFile) {
        return false;
      }
      const pkgJson = readJsonSync(directory, "package.json");
      if (pkgJson.workspaces) {
        if (Array.isArray(pkgJson.workspaces)) {
          return true;
        }
      }
    } catch (err) {
      if (err && err.code === "ENOENT") {
        return false;
      }
      throw err;
    }
    return false;
  },
  async getPackages(directory) {
    const rootDir = path.resolve(directory);
    try {
      const pkgJson = await readJson(rootDir, "package.json");
      const packageGlobs = pkgJson.workspaces || [];
      return {
        tool: BunTool,
        packages: await expandPackageGlobs(packageGlobs, rootDir),
        rootPackage: {
          dir: rootDir,
          relativeDir: ".",
          packageJson: pkgJson
        },
        rootDir
      };
    } catch (err) {
      if (err && err.code === "ENOENT") {
        throw new InvalidMonorepoError(`Directory ${rootDir} is not a valid ${BunTool.type} monorepo root`);
      }
      throw err;
    }
  },
  getPackagesSync(directory) {
    const rootDir = path.resolve(directory);
    try {
      const pkgJson = readJsonSync(rootDir, "package.json");
      const packageGlobs = pkgJson.workspaces || [];
      return {
        tool: BunTool,
        packages: expandPackageGlobsSync(packageGlobs, rootDir),
        rootPackage: {
          dir: rootDir,
          relativeDir: ".",
          packageJson: pkgJson
        },
        rootDir
      };
    } catch (err) {
      if (err && err.code === "ENOENT") {
        throw new InvalidMonorepoError(`Directory ${rootDir} is not a valid ${BunTool.type} monorepo root`);
      }
      throw err;
    }
  }
};

const LernaTool = {
  type: "lerna",
  async isMonorepoRoot(directory) {
    try {
      const lernaJson = await readJson(directory, "lerna.json");
      if (lernaJson.useWorkspaces !== true) {
        return true;
      }
    } catch (err) {
      if (err && err.code === "ENOENT") {
        return false;
      }
      throw err;
    }
    return false;
  },
  isMonorepoRootSync(directory) {
    try {
      const lernaJson = readJsonSync(directory, "lerna.json");
      if (lernaJson.useWorkspaces !== true) {
        return true;
      }
    } catch (err) {
      if (err && err.code === "ENOENT") {
        return false;
      }
      throw err;
    }
    return false;
  },
  async getPackages(directory) {
    const rootDir = path__default.resolve(directory);
    try {
      const lernaJson = await readJson(rootDir, "lerna.json");
      const pkgJson = await readJson(rootDir, "package.json");
      const packageGlobs = lernaJson.packages || ["packages/*"];
      return {
        tool: LernaTool,
        packages: await expandPackageGlobs(packageGlobs, rootDir),
        rootPackage: {
          dir: rootDir,
          relativeDir: ".",
          packageJson: pkgJson
        },
        rootDir
      };
    } catch (err) {
      if (err && err.code === "ENOENT") {
        throw new InvalidMonorepoError(`Directory ${rootDir} is not a valid ${LernaTool.type} monorepo root: missing lerna.json and/or package.json`);
      }
      throw err;
    }
  },
  getPackagesSync(directory) {
    const rootDir = path__default.resolve(directory);
    try {
      const lernaJson = readJsonSync(rootDir, "lerna.json");
      const pkgJson = readJsonSync(rootDir, "package.json");
      const packageGlobs = lernaJson.packages || ["packages/*"];
      return {
        tool: LernaTool,
        packages: expandPackageGlobsSync(packageGlobs, rootDir),
        rootPackage: {
          dir: rootDir,
          relativeDir: ".",
          packageJson: pkgJson
        },
        rootDir
      };
    } catch (err) {
      if (err && err.code === "ENOENT") {
        throw new InvalidMonorepoError(`Directory ${rootDir} is not a valid ${LernaTool.type} monorepo root: missing lerna.json and/or package.json`);
      }
      throw err;
    }
  }
};

const NpmTool = {
  type: "npm",
  async isMonorepoRoot(directory) {
    try {
      const [pkgJson] = await Promise.all([readJson(directory, "package.json"), fsp__default.access(path__default.join(directory, "package-lock.json"), F_OK)]);
      if (pkgJson.workspaces) {
        if (Array.isArray(pkgJson.workspaces)) {
          return true;
        }
      }
    } catch (err) {
      if (err && err.code === "ENOENT") {
        return false;
      }
      throw err;
    }
    return false;
  },
  isMonorepoRootSync(directory) {
    try {
      fs__default.accessSync(path__default.join(directory, "package-lock.json"), F_OK);
      const pkgJson = readJsonSync(directory, "package.json");
      if (pkgJson.workspaces) {
        if (Array.isArray(pkgJson.workspaces)) {
          return true;
        }
      }
    } catch (err) {
      if (err && err.code === "ENOENT") {
        return false;
      }
      throw err;
    }
    return false;
  },
  async getPackages(directory) {
    const rootDir = path__default.resolve(directory);
    try {
      const pkgJson = await readJson(rootDir, "package.json");
      const packageGlobs = pkgJson.workspaces;
      return {
        tool: NpmTool,
        packages: await expandPackageGlobs(packageGlobs, rootDir),
        rootPackage: {
          dir: rootDir,
          relativeDir: ".",
          packageJson: pkgJson
        },
        rootDir
      };
    } catch (err) {
      if (err && err.code === "ENOENT") {
        throw new InvalidMonorepoError(`Directory ${rootDir} is not a valid ${NpmTool.type} monorepo root`);
      }
      throw err;
    }
  },
  getPackagesSync(directory) {
    const rootDir = path__default.resolve(directory);
    try {
      const pkgJson = readJsonSync(rootDir, "package.json");
      const packageGlobs = pkgJson.workspaces;
      return {
        tool: NpmTool,
        packages: expandPackageGlobsSync(packageGlobs, rootDir),
        rootPackage: {
          dir: rootDir,
          relativeDir: ".",
          packageJson: pkgJson
        },
        rootDir
      };
    } catch (err) {
      if (err && err.code === "ENOENT") {
        throw new InvalidMonorepoError(`Directory ${rootDir} is not a valid ${NpmTool.type} monorepo root`);
      }
      throw err;
    }
  }
};

async function readYamlFile(path) {
  return fsp__default.readFile(path, "utf8").then(data => yaml.load(data));
}
function readYamlFileSync(path) {
  return yaml.load(fs__default.readFileSync(path, "utf8"));
}
const PnpmTool = {
  type: "pnpm",
  async isMonorepoRoot(directory) {
    try {
      const manifest = await readYamlFile(path__default.join(directory, "pnpm-workspace.yaml"));
      if (manifest.packages) {
        return true;
      }
    } catch (err) {
      if (err && err.code === "ENOENT") {
        return false;
      }
      throw err;
    }
    return false;
  },
  isMonorepoRootSync(directory) {
    try {
      const manifest = readYamlFileSync(path__default.join(directory, "pnpm-workspace.yaml"));
      if (manifest.packages) {
        return true;
      }
    } catch (err) {
      if (err && err.code === "ENOENT") {
        return false;
      }
      throw err;
    }
    return false;
  },
  async getPackages(directory) {
    const rootDir = path__default.resolve(directory);
    try {
      const manifest = await readYamlFile(path__default.join(rootDir, "pnpm-workspace.yaml"));
      const pkgJson = await readJson(rootDir, "package.json");
      const packageGlobs = manifest.packages;
      return {
        tool: PnpmTool,
        packages: await expandPackageGlobs(packageGlobs, rootDir),
        rootPackage: {
          dir: rootDir,
          relativeDir: ".",
          packageJson: pkgJson
        },
        rootDir
      };
    } catch (err) {
      if (err && err.code === "ENOENT") {
        throw new InvalidMonorepoError(`Directory ${rootDir} is not a valid ${PnpmTool.type} monorepo root: missing pnpm-workspace.yaml and/or package.json`);
      }
      throw err;
    }
  },
  getPackagesSync(directory) {
    const rootDir = path__default.resolve(directory);
    try {
      const manifest = readYamlFileSync(path__default.join(rootDir, "pnpm-workspace.yaml"));
      const pkgJson = readJsonSync(rootDir, "package.json");
      const packageGlobs = manifest.packages;
      return {
        tool: PnpmTool,
        packages: expandPackageGlobsSync(packageGlobs, rootDir),
        rootPackage: {
          dir: rootDir,
          relativeDir: ".",
          packageJson: pkgJson
        },
        rootDir: rootDir
      };
    } catch (err) {
      if (err && err.code === "ENOENT") {
        throw new InvalidMonorepoError(`Directory ${rootDir} is not a valid ${PnpmTool.type} monorepo root: missing pnpm-workspace.yaml and/or package.json`);
      }
      throw err;
    }
  }
};

const RootTool = {
  type: "root",
  async isMonorepoRoot(_directory) {
    // The single package tool is never the root of a monorepo.
    return false;
  },
  isMonorepoRootSync(_directory) {
    // The single package tool is never the root of a monorepo.
    return false;
  },
  async getPackages(directory) {
    const rootDir = path__default.resolve(directory);
    try {
      const pkgJson = await readJson(rootDir, "package.json");
      const pkg = {
        dir: rootDir,
        relativeDir: ".",
        packageJson: pkgJson
      };
      return {
        tool: RootTool,
        packages: [pkg],
        rootPackage: pkg,
        rootDir: rootDir
      };
    } catch (err) {
      if (err && err.code === "ENOENT") {
        throw new InvalidMonorepoError(`Directory ${rootDir} is not a valid ${RootTool.type} monorepo root`);
      }
      throw err;
    }
  },
  getPackagesSync(directory) {
    const rootDir = path__default.resolve(directory);
    try {
      const pkgJson = readJsonSync(rootDir, "package.json");
      const pkg = {
        dir: rootDir,
        relativeDir: ".",
        packageJson: pkgJson
      };
      return {
        tool: RootTool,
        packages: [pkg],
        rootPackage: pkg,
        rootDir: rootDir
      };
    } catch (err) {
      if (err && err.code === "ENOENT") {
        throw new InvalidMonorepoError(`Directory ${rootDir} is not a valid ${RootTool.type} monorepo root`);
      }
      throw err;
    }
  }
};

const RushTool = {
  type: "rush",
  async isMonorepoRoot(directory) {
    try {
      await fsp__default.access(path__default.join(directory, "rush.json"), F_OK);
      return true;
    } catch (err) {
      if (err && err.code === "ENOENT") {
        return false;
      }
      throw err;
    }
  },
  isMonorepoRootSync(directory) {
    try {
      fs__default.accessSync(path__default.join(directory, "rush.json"), F_OK);
      return true;
    } catch (err) {
      if (err && err.code === "ENOENT") {
        return false;
      }
      throw err;
    }
  },
  async getPackages(directory) {
    const rootDir = path__default.resolve(directory);
    try {
      const rushText = await fsp__default.readFile(path__default.join(rootDir, "rush.json"), "utf8");

      // Rush configuration files are full of inline and block-scope comment blocks (JSONC),
      // so we use a parser that can handle that.
      const rushJson = jju.parse(rushText);
      const directories = rushJson.projects.map(project => path__default.resolve(rootDir, project.projectFolder));
      const packages = await Promise.all(directories.map(async dir => {
        return {
          dir,
          relativeDir: path__default.relative(directory, dir),
          packageJson: await readJson(dir, "package.json")
        };
      }));

      // Rush does not have a root package
      return {
        tool: RushTool,
        packages,
        rootDir
      };
    } catch (err) {
      if (err && err.code === "ENOENT") {
        throw new InvalidMonorepoError(`Directory ${rootDir} is not a valid ${RushTool.type} monorepo root: missing rush.json`);
      }
      throw err;
    }
  },
  getPackagesSync(directory) {
    const rootDir = path__default.resolve(directory);
    try {
      const rushText = fs__default.readFileSync(path__default.join(rootDir, "rush.json"), "utf8");

      // Rush configuration files are full of inline and block-scope comment blocks (JSONC),
      // so we use a parser that can handle that.
      const rushJson = jju.parse(rushText);
      const directories = rushJson.projects.map(project => path__default.resolve(rootDir, project.projectFolder));
      const packages = directories.map(dir => {
        const packageJson = readJsonSync(dir, "package.json");
        return {
          dir,
          relativeDir: path__default.relative(directory, dir),
          packageJson
        };
      });

      // Rush does not have a root package
      return {
        tool: RushTool,
        packages,
        rootDir
      };
    } catch (err) {
      if (err && err.code === "ENOENT") {
        throw new InvalidMonorepoError(`Directory ${rootDir} is not a valid ${RushTool.type} monorepo root: missing rush.json`);
      }
      throw err;
    }
  }
};

const YarnTool = {
  type: "yarn",
  async isMonorepoRoot(directory) {
    try {
      const [pkgJson] = await Promise.all([readJson(directory, "package.json"), fsp__default.access(path__default.join(directory, "yarn.lock"), F_OK)]);
      if (pkgJson.workspaces) {
        if (Array.isArray(pkgJson.workspaces) || Array.isArray(pkgJson.workspaces.packages)) {
          return true;
        }
      }
    } catch (err) {
      if (err && err.code === "ENOENT") {
        return false;
      }
      throw err;
    }
    return false;
  },
  isMonorepoRootSync(directory) {
    try {
      fs__default.accessSync(path__default.join(directory, "yarn.lock"), F_OK);
      const pkgJson = readJsonSync(directory, "package.json");
      if (pkgJson.workspaces) {
        if (Array.isArray(pkgJson.workspaces) || Array.isArray(pkgJson.workspaces.packages)) {
          return true;
        }
      }
    } catch (err) {
      if (err && err.code === "ENOENT") {
        return false;
      }
      throw err;
    }
    return false;
  },
  async getPackages(directory) {
    const rootDir = path__default.resolve(directory);
    try {
      const pkgJson = await readJson(rootDir, "package.json");
      const packageGlobs = Array.isArray(pkgJson.workspaces) ? pkgJson.workspaces : pkgJson.workspaces.packages;
      return {
        tool: YarnTool,
        packages: await expandPackageGlobs(packageGlobs, rootDir),
        rootPackage: {
          dir: rootDir,
          relativeDir: ".",
          packageJson: pkgJson
        },
        rootDir
      };
    } catch (err) {
      if (err && err.code === "ENOENT") {
        throw new InvalidMonorepoError(`Directory ${rootDir} is not a valid ${YarnTool.type} monorepo root`);
      }
      throw err;
    }
  },
  getPackagesSync(directory) {
    const rootDir = path__default.resolve(directory);
    try {
      const pkgJson = readJsonSync(rootDir, "package.json");
      const packageGlobs = Array.isArray(pkgJson.workspaces) ? pkgJson.workspaces : pkgJson.workspaces.packages;
      return {
        tool: YarnTool,
        packages: expandPackageGlobsSync(packageGlobs, rootDir),
        rootPackage: {
          dir: rootDir,
          relativeDir: ".",
          packageJson: pkgJson
        },
        rootDir
      };
    } catch (err) {
      if (err && err.code === "ENOENT") {
        throw new InvalidMonorepoError(`Directory ${rootDir} is not a valid ${YarnTool.type} monorepo root`);
      }
      throw err;
    }
  }
};

export { BunTool, InvalidMonorepoError, LernaTool, NpmTool, PnpmTool, RootTool, RushTool, YarnTool };
