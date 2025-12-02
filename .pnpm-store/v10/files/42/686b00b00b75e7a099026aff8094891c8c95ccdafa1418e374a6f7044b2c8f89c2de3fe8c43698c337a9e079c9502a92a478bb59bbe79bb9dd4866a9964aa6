'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var path = require('path');
var findRoot = require('@manypkg/find-root');

function _interopDefault (e) { return e && e.__esModule ? e : { 'default': e }; }

var path__default = /*#__PURE__*/_interopDefault(path);

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
  const monorepoRoot = await findRoot.findRoot(dir, options);
  const packages = await monorepoRoot.tool.getPackages(monorepoRoot.rootDir);
  validatePackages(packages);
  return packages;
}

/**
 * A synchronous version of {@link getPackages}.
 */
function getPackagesSync(dir, options) {
  const monorepoRoot = findRoot.findRootSync(dir, options);
  const packages = monorepoRoot.tool.getPackagesSync(monorepoRoot.rootDir);
  validatePackages(packages);
  return packages;
}
function validatePackages(packages) {
  const pkgJsonsMissingNameField = [];
  for (const pkg of packages.packages) {
    if (!pkg.packageJson.name) {
      pkgJsonsMissingNameField.push(path__default["default"].join(pkg.relativeDir, "package.json"));
    }
  }
  if (pkgJsonsMissingNameField.length > 0) {
    pkgJsonsMissingNameField.sort();
    throw new PackageJsonMissingNameError(pkgJsonsMissingNameField);
  }
}

exports.PackageJsonMissingNameError = PackageJsonMissingNameError;
exports.getPackages = getPackages;
exports.getPackagesSync = getPackagesSync;
