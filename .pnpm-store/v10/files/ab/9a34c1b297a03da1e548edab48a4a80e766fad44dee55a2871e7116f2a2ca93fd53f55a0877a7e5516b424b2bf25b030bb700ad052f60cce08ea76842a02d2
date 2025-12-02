'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var Range = require('semver/classes/range');
var pc = require('picocolors');

function _interopDefault (e) { return e && e.__esModule ? e : { 'default': e }; }

var Range__default = /*#__PURE__*/_interopDefault(Range);
var pc__default = /*#__PURE__*/_interopDefault(pc);

// This is a modified version of the graph-getting in bolt
const DEPENDENCY_TYPES = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];

const getAllDependencies = (config, ignoreDevDependencies) => {
  const allDependencies = new Map();

  for (const type of DEPENDENCY_TYPES) {
    const deps = config[type];
    if (!deps) continue;

    for (const name of Object.keys(deps)) {
      const depRange = deps[name];

      if (type === "devDependencies" && (ignoreDevDependencies || depRange.startsWith("link:") || depRange.startsWith("file:"))) {
        continue;
      }

      allDependencies.set(name, depRange);
    }
  }

  return allDependencies;
};

const isProtocolRange = range => range.indexOf(":") !== -1;

const getValidRange = potentialRange => {
  if (isProtocolRange(potentialRange)) {
    return null;
  }

  try {
    return new Range__default["default"](potentialRange);
  } catch (_unused) {
    return null;
  }
};

function getDependencyGraph(packages, {
  ignoreDevDependencies = false,
  bumpVersionsWithWorkspaceProtocolOnly = false
} = {}) {
  const graph = new Map();
  let valid = true;
  const packagesByName = {
    [packages.root.packageJson.name]: packages.root
  };
  const queue = [packages.root];

  for (const pkg of packages.packages) {
    queue.push(pkg);
    packagesByName[pkg.packageJson.name] = pkg;
  }

  for (const pkg of queue) {
    const {
      name
    } = pkg.packageJson;
    const dependencies = [];
    const allDependencies = getAllDependencies(pkg.packageJson, ignoreDevDependencies);

    for (let [depName, depRange] of allDependencies) {
      const match = packagesByName[depName];
      if (!match) continue;
      const expected = match.packageJson.version;
      const usesWorkspaceRange = depRange.startsWith("workspace:");

      if (usesWorkspaceRange) {
        depRange = depRange.replace(/^workspace:/, "");

        if (depRange === "*" || depRange === "^" || depRange === "~") {
          dependencies.push(depName);
          continue;
        }
      } else if (bumpVersionsWithWorkspaceProtocolOnly) {
        continue;
      }

      const range = getValidRange(depRange);

      if (range && !range.test(expected) || isProtocolRange(depRange)) {
        valid = false;
        console.error(`Package ${pc__default["default"].cyan(`"${name}"`)} must depend on the current version of ${pc__default["default"].cyan(`"${depName}"`)}: ${pc__default["default"].green(`"${expected}"`)} vs ${pc__default["default"].red(`"${depRange}"`)}`);
        continue;
      } // `depRange` could have been a tag and if a tag has been used there might have been a reason for that
      // we should not count this as a local monorepro dependant


      if (!range) {
        continue;
      }

      dependencies.push(depName);
    }

    graph.set(name, {
      pkg,
      dependencies
    });
  }

  return {
    graph,
    valid
  };
}

function getDependentsGraph(packages, opts) {
  const graph = new Map();
  const {
    graph: dependencyGraph
  } = getDependencyGraph(packages, opts);
  const dependentsLookup = {
    [packages.root.packageJson.name]: {
      pkg: packages.root,
      dependents: []
    }
  };
  packages.packages.forEach(pkg => {
    dependentsLookup[pkg.packageJson.name] = {
      pkg,
      dependents: []
    };
  });
  packages.packages.forEach(pkg => {
    const dependent = pkg.packageJson.name;
    const valFromDependencyGraph = dependencyGraph.get(dependent);

    if (valFromDependencyGraph) {
      const dependencies = valFromDependencyGraph.dependencies;
      dependencies.forEach(dependency => {
        dependentsLookup[dependency].dependents.push(dependent);
      });
    }
  });
  Object.keys(dependentsLookup).forEach(key => {
    graph.set(key, dependentsLookup[key]);
  });
  const simplifiedDependentsGraph = new Map();
  graph.forEach((pkgInfo, pkgName) => {
    simplifiedDependentsGraph.set(pkgName, pkgInfo.dependents);
  });
  return simplifiedDependentsGraph;
}

exports.getDependentsGraph = getDependentsGraph;
