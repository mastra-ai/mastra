'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var path = require('path');
var fs = require('fs');
var fsp = require('fs/promises');
var tools = require('@manypkg/tools');

function _interopDefault (e) { return e && e.__esModule ? e : { 'default': e }; }

var path__default = /*#__PURE__*/_interopDefault(path);
var fs__default = /*#__PURE__*/_interopDefault(fs);
var fsp__default = /*#__PURE__*/_interopDefault(fsp);

/**
 * A default ordering for monorepo tool checks.
 *
 * This ordering is designed to check the most typical package.json-based
 * monorepo implementations first, with tools based on custom file schemas
 * checked last.
 */
const DEFAULT_TOOLS = [tools.YarnTool, tools.PnpmTool, tools.LernaTool, tools.RushTool, tools.BoltTool, tools.RootTool];
const isNoEntryError = err => !!err && typeof err === "object" && "code" in err && err.code === "ENOENT";
class NoPkgJsonFound extends Error {
  constructor(directory) {
    super(`No package.json could be found upwards from directory ${directory}`);
    this.directory = directory;
  }
}
class NoMatchingMonorepoFound extends Error {
  constructor(directory) {
    super(`No monorepo matching the list of supported monorepos could be found upwards from directory ${directory}`);
    this.directory = directory;
  }
}

/**
 * Configuration options for `findRoot` and `findRootSync` functions.
 */

/**
 * Given a starting folder, search that folder and its parents until a supported monorepo
 * is found, and return a `MonorepoRoot` object with the discovered directory and a
 * corresponding monorepo `Tool` object.
 *
 * By default, all predefined `Tool` implementations are included in the search -- the
 * caller can provide a list of desired tools to restrict the types of monorepos discovered,
 * or to provide a custom tool implementation.
 */
async function findRoot(cwd, options = {}) {
  let monorepoRoot;
  const tools$1 = options.tools || DEFAULT_TOOLS;
  await findUp(async directory => {
    return Promise.all(tools$1.map(async tool => {
      if (await tool.isMonorepoRoot(directory)) {
        return {
          tool: tool,
          rootDir: directory
        };
      }
    })).then(x => x.find(value => value)).then(result => {
      if (result) {
        monorepoRoot = result;
        return directory;
      }
    });
  }, cwd);
  if (monorepoRoot) {
    return monorepoRoot;
  }
  if (!tools$1.includes(tools.RootTool)) {
    throw new NoMatchingMonorepoFound(cwd);
  }

  // If there is no monorepo root, but we can find a single package json file, we will
  // return a "RootTool" repo, which is the special case where we just have a root package
  // with no monorepo implementation (i.e.: a normal package folder).
  let rootDir = await findUp(async directory => {
    try {
      await fsp__default["default"].access(path__default["default"].join(directory, "package.json"));
      return directory;
    } catch (err) {
      if (!isNoEntryError(err)) {
        throw err;
      }
    }
  }, cwd);
  if (!rootDir) {
    throw new NoPkgJsonFound(cwd);
  }
  return {
    tool: tools.RootTool,
    rootDir
  };
}

/**
 * A synchronous version of {@link findRoot}.
 */
function findRootSync(cwd, options = {}) {
  let monorepoRoot;
  const tools$1 = options.tools || DEFAULT_TOOLS;
  findUpSync(directory => {
    for (const tool of tools$1) {
      if (tool.isMonorepoRootSync(directory)) {
        monorepoRoot = {
          tool: tool,
          rootDir: directory
        };
        return directory;
      }
    }
  }, cwd);
  if (monorepoRoot) {
    return monorepoRoot;
  }
  if (!tools$1.includes(tools.RootTool)) {
    throw new NoMatchingMonorepoFound(cwd);
  }

  // If there is no monorepo root, but we can find a single package json file, we will
  // return a "RootTool" repo, which is the special case where we just have a root package
  // with no monorepo implementation (i.e.: a normal package folder).
  const rootDir = findUpSync(directory => {
    const exists = fs__default["default"].existsSync(path__default["default"].join(directory, "package.json"));
    return exists ? directory : undefined;
  }, cwd);
  if (!rootDir) {
    throw new NoPkgJsonFound(cwd);
  }
  return {
    tool: tools.RootTool,
    rootDir
  };
}
async function findUp(matcher, cwd) {
  let directory = path__default["default"].resolve(cwd);
  const {
    root
  } = path__default["default"].parse(directory);
  while (directory && directory !== root) {
    const filePath = await matcher(directory);
    if (filePath) {
      return path__default["default"].resolve(directory, filePath);
    }
    directory = path__default["default"].dirname(directory);
  }
}
function findUpSync(matcher, cwd) {
  let directory = path__default["default"].resolve(cwd);
  const {
    root
  } = path__default["default"].parse(directory);
  while (directory && directory !== root) {
    const filePath = matcher(directory);
    if (filePath) {
      return path__default["default"].resolve(directory, filePath);
    }
    directory = path__default["default"].dirname(directory);
  }
}

exports.NoMatchingMonorepoFound = NoMatchingMonorepoFound;
exports.NoPkgJsonFound = NoPkgJsonFound;
exports.findRoot = findRoot;
exports.findRootSync = findRootSync;
