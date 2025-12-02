import path from 'node:path';
import { findRoot, DEFAULT_TOOLS, findRootSync } from '@manypkg/find-root';

class PackageJsonMissingNameError extends Error {
  constructor(directories) {
    super(`The following package.jsons are missing the "name" field:\n${directories.join("\n")}`);
    this.directories = directories;
  }
}

/**
 * Configuration options for `getPackages` and `getPackagesSync` functions.
 */

/**
 * Given a starting folder, search that folder and its parents until a supported monorepo
 * is found, and return the collection of packages and a corresponding monorepo `Tool`
 * object.
 *
 * By default, all predefined `Tool` implementations are included in the search -- the
 * caller can provide a list of desired tools to restrict the types of monorepos discovered,
 * or to provide a custom tool implementation.
 */
async function getPackages(dir, options) {
  const monorepoRoot = await findRoot(dir, options);
  const tools = options?.tools || DEFAULT_TOOLS;
  const tool = tools.find(t => t.type === monorepoRoot.tool);
  if (!tool) throw new Error(`Could not find ${monorepoRoot.tool} tool`);
  const packages = await tool.getPackages(monorepoRoot.rootDir);
  validatePackages(packages);
  return packages;
}

/**
 * A synchronous version of {@link getPackages}.
 */
function getPackagesSync(dir, options) {
  const monorepoRoot = findRootSync(dir, options);
  const tools = options?.tools || DEFAULT_TOOLS;
  const tool = tools.find(t => t.type === monorepoRoot.tool);
  if (!tool) throw new Error(`Could not find ${monorepoRoot.tool} tool`);
  const packages = tool.getPackagesSync(monorepoRoot.rootDir);
  validatePackages(packages);
  return packages;
}
function validatePackages(packages) {
  const pkgJsonsMissingNameField = [];
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

export { PackageJsonMissingNameError, getPackages, getPackagesSync };
