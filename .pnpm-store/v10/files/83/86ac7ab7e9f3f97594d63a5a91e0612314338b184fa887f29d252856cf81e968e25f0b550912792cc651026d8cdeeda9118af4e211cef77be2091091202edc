
import path from "path";
import { findRoot, findRootSync, FindRootOptions } from "@manypkg/find-root";
import { Packages, MonorepoRoot, Tool } from "@manypkg/tools";

export type { Tool, Package, Packages } from "@manypkg/tools";

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

/**
 * Configuration options for `getPackages` and `getPackagesSync` functions.
 */
export interface GetPackagesOptions extends FindRootOptions {}

/**
 * Given a starting folder, search that folder and its parents until a supported monorepo
 * is found, and return the collection of packages and a corresponding monorepo `Tool`
 * object.
 *
 * By default, all predefined `Tool` implementations are included in the search -- the
 * caller can provide a list of desired tools to restrict the types of monorepos discovered,
 * or to provide a custom tool implementation.
 */
export async function getPackages(
  dir: string,
  options?: GetPackagesOptions
): Promise<Packages> {
  const monorepoRoot: MonorepoRoot = await findRoot(dir, options);
  const packages: Packages = await monorepoRoot.tool.getPackages(monorepoRoot.rootDir);

  validatePackages(packages);

  return packages;
}

/**
 * A synchronous version of {@link getPackages}.
 */
export function getPackagesSync(
  dir: string,
  options?: GetPackagesOptions
): Packages {
  const monorepoRoot: MonorepoRoot = findRootSync(dir, options);
  const packages: Packages = monorepoRoot.tool.getPackagesSync(monorepoRoot.rootDir);

  validatePackages(packages);

  return packages;
}

function validatePackages(packages: Packages) {
  const pkgJsonsMissingNameField: string[] = [];

  for (const pkg of packages.packages) {
    if (!pkg.packageJson.name) {
      pkgJsonsMissingNameField.push(path.join(pkg.relativeDir, "package.json"));
    }
  }

  if (pkgJsonsMissingNameField.length > 0) {
    pkgJsonsMissingNameField.sort();
    throw new PackageJsonMissingNameError(pkgJsonsMissingNameField);
  }
}
