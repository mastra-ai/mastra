'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var errors = require('@changesets/errors');
var getDependentsGraph = require('@changesets/get-dependents-graph');
var shouldSkipPackage = require('@changesets/should-skip-package');
var semverParse = require('semver/functions/parse');
var semverGt = require('semver/functions/gt');
var semverSatisfies = require('semver/functions/satisfies');
var semverInc = require('semver/functions/inc');

function _interopDefault (e) { return e && e.__esModule ? e : { 'default': e }; }

var semverParse__default = /*#__PURE__*/_interopDefault(semverParse);
var semverGt__default = /*#__PURE__*/_interopDefault(semverGt);
var semverSatisfies__default = /*#__PURE__*/_interopDefault(semverSatisfies);
var semverInc__default = /*#__PURE__*/_interopDefault(semverInc);

function _toPrimitive(t, r) {
  if ("object" != typeof t || !t) return t;
  var e = t[Symbol.toPrimitive];
  if (void 0 !== e) {
    var i = e.call(t, r || "default");
    if ("object" != typeof i) return i;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return ("string" === r ? String : Number)(t);
}

function _toPropertyKey(t) {
  var i = _toPrimitive(t, "string");
  return "symbol" == typeof i ? i : i + "";
}

function _defineProperty(e, r, t) {
  return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
    value: t,
    enumerable: !0,
    configurable: !0,
    writable: !0
  }) : e[r] = t, e;
}

function ownKeys(e, r) {
  var t = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var o = Object.getOwnPropertySymbols(e);
    r && (o = o.filter(function (r) {
      return Object.getOwnPropertyDescriptor(e, r).enumerable;
    })), t.push.apply(t, o);
  }
  return t;
}
function _objectSpread2(e) {
  for (var r = 1; r < arguments.length; r++) {
    var t = null != arguments[r] ? arguments[r] : {};
    r % 2 ? ownKeys(Object(t), !0).forEach(function (r) {
      _defineProperty(e, r, t[r]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) {
      Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r));
    });
  }
  return e;
}

function getHighestReleaseType(releases) {
  if (releases.length === 0) {
    throw new Error(`Large internal Changesets error when calculating highest release type in the set of releases. Please contact the maintainers`);
  }
  let highestReleaseType = "none";
  for (let release of releases) {
    switch (release.type) {
      case "major":
        return "major";
      case "minor":
        highestReleaseType = "minor";
        break;
      case "patch":
        if (highestReleaseType === "none") {
          highestReleaseType = "patch";
        }
        break;
    }
  }
  return highestReleaseType;
}
function getCurrentHighestVersion(packageGroup, packagesByName) {
  let highestVersion;
  for (let pkgName of packageGroup) {
    let pkg = packagesByName.get(pkgName);
    if (!pkg) {
      console.error(`FATAL ERROR IN CHANGESETS! We were unable to version for package group: ${pkgName} in package group: ${packageGroup.toString()}`);
      throw new Error(`fatal: could not resolve linked packages`);
    }
    if (highestVersion === undefined || semverGt__default["default"](pkg.packageJson.version, highestVersion)) {
      highestVersion = pkg.packageJson.version;
    }
  }
  return highestVersion;
}

/*
  WARNING:
  Important note for understanding how this package works:

  We are doing some kind of wacky things with manipulating the objects within the
  releases array, despite the fact that this was passed to us as an argument. We are
  aware that this is generally bad practice, but have decided to to this here as
  we control the entire flow of releases.

  We could solve this by inlining this function, or by returning a deep-cloned then
  modified array, but we decided both of those are worse than this solution.
*/
function applyLinks(releases, packagesByName, linked) {
  let updated = false;

  // We do this for each set of linked packages
  for (let linkedPackages of linked) {
    // First we filter down to all the relevant releases for one set of linked packages
    let releasingLinkedPackages = [...releases.values()].filter(release => linkedPackages.includes(release.name) && release.type !== "none");

    // If we proceed any further we do extra work with calculating highestVersion for things that might
    // not need one, as they only have workspace based packages
    if (releasingLinkedPackages.length === 0) continue;
    let highestReleaseType = getHighestReleaseType(releasingLinkedPackages);
    let highestVersion = getCurrentHighestVersion(linkedPackages, packagesByName);

    // Finally, we update the packages so all of them are on the highest version
    for (let linkedPackage of releasingLinkedPackages) {
      if (linkedPackage.type !== highestReleaseType) {
        updated = true;
        linkedPackage.type = highestReleaseType;
      }
      if (linkedPackage.oldVersion !== highestVersion) {
        updated = true;
        linkedPackage.oldVersion = highestVersion;
      }
    }
  }
  return updated;
}

function incrementVersion(release, preInfo) {
  if (release.type === "none") {
    return release.oldVersion;
  }
  let version = semverInc__default["default"](release.oldVersion, release.type);
  if (preInfo !== undefined && preInfo.state.mode !== "exit") {
    let preVersion = preInfo.preVersions.get(release.name);
    if (preVersion === undefined) {
      throw new errors.InternalError(`preVersion for ${release.name} does not exist when preState is defined`);
    }
    // why are we adding this ourselves rather than passing 'pre' + versionType to semver.inc?
    // because semver.inc with prereleases is confusing and this seems easier
    version += `-${preInfo.state.tag}.${preVersion}`;
  }
  return version;
}

/*
  WARNING:
  Important note for understanding how this package works:

  We are doing some kind of wacky things with manipulating the objects within the
  releases array, despite the fact that this was passed to us as an argument. We are
  aware that this is generally bad practice, but have decided to to this here as
  we control the entire flow of releases.

  We could solve this by inlining this function, or by returning a deep-cloned then
  modified array, but we decided both of those are worse than this solution.
*/
function determineDependents({
  releases,
  packagesByName,
  dependencyGraph,
  preInfo,
  config
}) {
  let updated = false;
  // NOTE this is intended to be called recursively
  let pkgsToSearch = [...releases.values()];
  while (pkgsToSearch.length > 0) {
    // nextRelease is our dependency, think of it as "avatar"
    const nextRelease = pkgsToSearch.shift();
    if (!nextRelease) continue;
    // pkgDependents will be a list of packages that depend on nextRelease ie. ['avatar-group', 'comment']
    const pkgDependents = dependencyGraph.get(nextRelease.name);
    if (!pkgDependents) {
      throw new Error(`Error in determining dependents - could not find package in repository: ${nextRelease.name}`);
    }
    pkgDependents.map(dependent => {
      let type;
      const dependentPackage = packagesByName.get(dependent);
      if (!dependentPackage) throw new Error("Dependency map is incorrect");
      if (shouldSkipPackage.shouldSkipPackage(dependentPackage, {
        ignore: config.ignore,
        allowPrivatePackages: config.privatePackages.version
      })) {
        type = "none";
      } else {
        const dependencyVersionRanges = getDependencyVersionRanges(dependentPackage.packageJson, nextRelease);
        for (const {
          depType,
          versionRange
        } of dependencyVersionRanges) {
          if (nextRelease.type === "none") {
            continue;
          } else if (shouldBumpMajor({
            dependent,
            depType,
            versionRange,
            releases,
            nextRelease,
            preInfo,
            onlyUpdatePeerDependentsWhenOutOfRange: config.___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH.onlyUpdatePeerDependentsWhenOutOfRange
          })) {
            type = "major";
          } else if ((!releases.has(dependent) || releases.get(dependent).type === "none") && (config.___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH.updateInternalDependents === "always" || !semverSatisfies__default["default"](incrementVersion(nextRelease, preInfo), versionRange))) {
            switch (depType) {
              case "dependencies":
              case "optionalDependencies":
              case "peerDependencies":
                if (type !== "major" && type !== "minor") {
                  type = "patch";
                }
                break;
              case "devDependencies":
                {
                  // We don't need a version bump if the package is only in the devDependencies of the dependent package
                  if (type !== "major" && type !== "minor" && type !== "patch") {
                    type = "none";
                  }
                }
            }
          }
        }
      }
      if (releases.has(dependent) && releases.get(dependent).type === type) {
        type = undefined;
      }
      return {
        name: dependent,
        type,
        pkgJSON: dependentPackage.packageJson
      };
    }).filter(dependentItem => !!dependentItem.type).forEach(({
      name,
      type,
      pkgJSON
    }) => {
      // At this point, we know if we are making a change
      updated = true;
      const existing = releases.get(name);
      // For things that are being given a major bump, we check if we have already
      // added them here. If we have, we update the existing item instead of pushing it on to search.
      // It is safe to not add it to pkgsToSearch because it should have already been searched at the
      // largest possible bump type.

      if (existing && type === "major" && existing.type !== "major") {
        existing.type = "major";
        pkgsToSearch.push(existing);
      } else {
        let newDependent = {
          name,
          type,
          oldVersion: pkgJSON.version,
          changesets: []
        };
        pkgsToSearch.push(newDependent);
        releases.set(name, newDependent);
      }
    });
  }
  return updated;
}

/*
  Returns an array of objects in the shape { depType: DependencyType, versionRange: string }
  The array can contain more than one elements in case a dependency appears in multiple
  dependency lists. For example, a package that is both a peerDepenency and a devDependency.
*/
function getDependencyVersionRanges(dependentPkgJSON, dependencyRelease) {
  const DEPENDENCY_TYPES = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
  const dependencyVersionRanges = [];
  for (const type of DEPENDENCY_TYPES) {
    var _dependentPkgJSON$typ;
    let versionRange = (_dependentPkgJSON$typ = dependentPkgJSON[type]) === null || _dependentPkgJSON$typ === void 0 ? void 0 : _dependentPkgJSON$typ[dependencyRelease.name];
    if (!versionRange) continue;
    if (versionRange.startsWith("workspace:")) {
      versionRange = versionRange.replace(/^workspace:/, "");
      switch (versionRange) {
        case "*":
          // workspace:* actually means the current exact version, and not a wildcard similar to a reguler * range
          versionRange = dependencyRelease.oldVersion;
          break;
        case "^":
        case "~":
          versionRange = `${versionRange}${dependencyRelease.oldVersion}`;
          break;
        // default: keep the stripped range as is
      }
    }
    dependencyVersionRanges.push({
      depType: type,
      versionRange
    });
  }
  return dependencyVersionRanges;
}
function shouldBumpMajor({
  dependent,
  depType,
  versionRange,
  releases,
  nextRelease,
  preInfo,
  onlyUpdatePeerDependentsWhenOutOfRange
}) {
  // we check if it is a peerDependency because if it is, our dependent bump type might need to be major.
  return depType === "peerDependencies" && nextRelease.type !== "none" && nextRelease.type !== "patch" && (
  // 1. If onlyUpdatePeerDependentsWhenOutOfRange set to true, bump major if the version is leaving the range.
  // 2. If onlyUpdatePeerDependentsWhenOutOfRange set to false, bump major regardless whether or not the version is leaving the range.
  !onlyUpdatePeerDependentsWhenOutOfRange || !semverSatisfies__default["default"](incrementVersion(nextRelease, preInfo), versionRange)) && (
  // bump major only if the dependent doesn't already has a major release.
  !releases.has(dependent) || releases.has(dependent) && releases.get(dependent).type !== "major");
}

// This function takes in changesets and returns one release per
function flattenReleases(changesets, packagesByName, config) {
  let releases = new Map();
  changesets.forEach(changeset => {
    changeset.releases
    // Filter out skipped packages because they should not trigger a release
    // If their dependencies need updates, they will be added to releases by `determineDependents()` with release type `none`
    .filter(({
      name
    }) => !shouldSkipPackage.shouldSkipPackage(packagesByName.get(name), {
      ignore: config.ignore,
      allowPrivatePackages: config.privatePackages.version
    })).forEach(({
      name,
      type
    }) => {
      let release = releases.get(name);
      let pkg = packagesByName.get(name);
      if (!pkg) {
        throw new Error(`"${changeset.id}" changeset mentions a release for a package "${name}" but such a package could not be found.`);
      }
      if (!release) {
        release = {
          name,
          type,
          oldVersion: pkg.packageJson.version,
          changesets: [changeset.id]
        };
      } else {
        if (type === "major" || (release.type === "patch" || release.type === "none") && (type === "minor" || type === "patch")) {
          release.type = type;
        }
        // Check whether the bumpType will change
        // If the bumpType has changed recalc newVersion
        // push new changeset to releases
        release.changesets.push(changeset.id);
      }
      releases.set(name, release);
    });
  });
  return releases;
}

function matchFixedConstraint(releases, packagesByName, config) {
  let updated = false;
  for (let fixedPackages of config.fixed) {
    let releasingFixedPackages = [...releases.values()].filter(release => fixedPackages.includes(release.name) && release.type !== "none");
    if (releasingFixedPackages.length === 0) continue;
    let highestReleaseType = getHighestReleaseType(releasingFixedPackages);
    let highestVersion = getCurrentHighestVersion(fixedPackages, packagesByName);

    // Finally, we update the packages so all of them are on the highest version
    for (let pkgName of fixedPackages) {
      if (shouldSkipPackage.shouldSkipPackage(packagesByName.get(pkgName), {
        ignore: config.ignore,
        allowPrivatePackages: config.privatePackages.version
      })) {
        continue;
      }
      let release = releases.get(pkgName);
      if (!release) {
        updated = true;
        releases.set(pkgName, {
          name: pkgName,
          type: highestReleaseType,
          oldVersion: highestVersion,
          changesets: []
        });
        continue;
      }
      if (release.type !== highestReleaseType) {
        updated = true;
        release.type = highestReleaseType;
      }
      if (release.oldVersion !== highestVersion) {
        updated = true;
        release.oldVersion = highestVersion;
      }
    }
  }
  return updated;
}

function getPreVersion(version) {
  let parsed = semverParse__default["default"](version);
  let preVersion = parsed.prerelease[1] === undefined ? -1 : parsed.prerelease[1];
  if (typeof preVersion !== "number") {
    throw new errors.InternalError("preVersion is not a number");
  }
  preVersion++;
  return preVersion;
}
function getSnapshotSuffix(template, snapshotParameters) {
  let snapshotRefDate = new Date();
  const placeholderValues = {
    commit: snapshotParameters.commit,
    tag: snapshotParameters.tag,
    timestamp: snapshotRefDate.getTime().toString(),
    datetime: snapshotRefDate.toISOString().replace(/\.\d{3}Z$/, "").replace(/[^\d]/g, "")
  };

  // We need a special handling because we need to handle a case where `--snapshot` is used without any template,
  // and the resulting version needs to be composed without a tag.
  if (!template) {
    return [placeholderValues.tag, placeholderValues.datetime].filter(Boolean).join("-");
  }
  const placeholders = Object.keys(placeholderValues);
  if (!template.includes(`{tag}`) && placeholderValues.tag !== undefined) {
    throw new Error(`Failed to compose snapshot version: "{tag}" placeholder is missing, but the snapshot parameter is defined (value: '${placeholderValues.tag}')`);
  }
  return placeholders.reduce((prev, key) => {
    return prev.replace(new RegExp(`\\{${key}\\}`, "g"), () => {
      const value = placeholderValues[key];
      if (value === undefined) {
        throw new Error(`Failed to compose snapshot version: "{${key}}" placeholder is used without having a value defined!`);
      }
      return value;
    });
  }, template);
}
function getSnapshotVersion(release, preInfo, useCalculatedVersion, snapshotSuffix) {
  if (release.type === "none") {
    return release.oldVersion;
  }

  /**
   * Using version as 0.0.0 so that it does not hinder with other version release
   * For example;
   * if user has a regular pre-release at 1.0.0-beta.0 and then you had a snapshot pre-release at 1.0.0-canary-git-hash
   * and a consumer is using the range ^1.0.0-beta, most people would expect that range to resolve to 1.0.0-beta.0
   * but it'll actually resolve to 1.0.0-canary-hash. Using 0.0.0 solves this problem because it won't conflict with other versions.
   *
   * You can set `snapshot.useCalculatedVersion` flag to true to use calculated versions if you don't care about the above problem.
   */
  const baseVersion = useCalculatedVersion ? incrementVersion(release, preInfo) : `0.0.0`;
  return `${baseVersion}-${snapshotSuffix}`;
}
function getNewVersion(release, preInfo) {
  if (release.type === "none") {
    return release.oldVersion;
  }
  return incrementVersion(release, preInfo);
}
function assembleReleasePlan(changesets, packages, config,
// intentionally not using an optional parameter here so the result of `readPreState` has to be passed in here
preState,
// snapshot: undefined            ->  not using snaphot
// snapshot: { tag: undefined }   ->  --snapshot (empty tag)
// snapshot: { tag: "canary" }    ->  --snapshot canary
snapshot) {
  // TODO: remove `refined*` in the next major version of this package
  // just use `config` and `snapshot` parameters directly, typed as: `config: Config, snapshot?: SnapshotReleaseParameters`
  const refinedConfig = config.snapshot ? config : _objectSpread2(_objectSpread2({}, config), {}, {
    snapshot: {
      prereleaseTemplate: null,
      useCalculatedVersion: config.___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH.useCalculatedVersionForSnapshots
    }
  });
  const refinedSnapshot = typeof snapshot === "string" ? {
    tag: snapshot
  } : typeof snapshot === "boolean" ? {
    tag: undefined
  } : snapshot;
  let packagesByName = new Map(packages.packages.map(x => [x.packageJson.name, x]));
  const relevantChangesets = getRelevantChangesets(changesets, packagesByName, refinedConfig, preState);
  const preInfo = getPreInfo(changesets, packagesByName, refinedConfig, preState);

  // releases is, at this point a list of all packages we are going to releases,
  // flattened down to one release per package, having a reference back to their
  // changesets, and with a calculated new versions
  let releases = flattenReleases(relevantChangesets, packagesByName, refinedConfig);
  let dependencyGraph = getDependentsGraph.getDependentsGraph(packages, {
    bumpVersionsWithWorkspaceProtocolOnly: refinedConfig.bumpVersionsWithWorkspaceProtocolOnly
  });
  let releasesValidated = false;
  while (releasesValidated === false) {
    // The map passed in to determineDependents will be mutated
    let dependentAdded = determineDependents({
      releases,
      packagesByName,
      dependencyGraph,
      preInfo,
      config: refinedConfig
    });

    // `releases` might get mutated here
    let fixedConstraintUpdated = matchFixedConstraint(releases, packagesByName, refinedConfig);
    let linksUpdated = applyLinks(releases, packagesByName, refinedConfig.linked);
    releasesValidated = !linksUpdated && !dependentAdded && !fixedConstraintUpdated;
  }
  if ((preInfo === null || preInfo === void 0 ? void 0 : preInfo.state.mode) === "exit") {
    for (let pkg of packages.packages) {
      // If a package had a prerelease, but didn't trigger a version bump in the regular release,
      // we want to give it a patch release.
      // Detailed explanation at https://github.com/changesets/changesets/pull/382#discussion_r434434182
      if (preInfo.preVersions.get(pkg.packageJson.name) !== 0) {
        const existingRelease = releases.get(pkg.packageJson.name);
        if (!existingRelease) {
          releases.set(pkg.packageJson.name, {
            name: pkg.packageJson.name,
            type: "patch",
            oldVersion: pkg.packageJson.version,
            changesets: []
          });
        } else if (existingRelease.type === "none" && !shouldSkipPackage.shouldSkipPackage(pkg, {
          ignore: refinedConfig.ignore,
          allowPrivatePackages: refinedConfig.privatePackages.version
        })) {
          existingRelease.type = "patch";
        }
      }
    }
  }

  // Caching the snapshot version here and use this if it is snapshot release
  const snapshotSuffix = refinedSnapshot && getSnapshotSuffix(refinedConfig.snapshot.prereleaseTemplate, refinedSnapshot);
  return {
    changesets: relevantChangesets,
    releases: [...releases.values()].map(incompleteRelease => {
      return _objectSpread2(_objectSpread2({}, incompleteRelease), {}, {
        newVersion: snapshotSuffix ? getSnapshotVersion(incompleteRelease, preInfo, refinedConfig.snapshot.useCalculatedVersion, snapshotSuffix) : getNewVersion(incompleteRelease, preInfo)
      });
    }),
    preState: preInfo === null || preInfo === void 0 ? void 0 : preInfo.state
  };
}
function getRelevantChangesets(changesets, packagesByName, config, preState) {
  for (const changeset of changesets) {
    // Using the following 2 arrays to decide whether a changeset
    // contains both skipped and not skipped packages
    const skippedPackages = [];
    const notSkippedPackages = [];
    for (const release of changeset.releases) {
      const packageByName = packagesByName.get(release.name);
      if (!packageByName) {
        throw new Error(`Found changeset ${changeset.id} for package ${release.name} which is not in the workspace`);
      }
      if (shouldSkipPackage.shouldSkipPackage(packageByName, {
        ignore: config.ignore,
        allowPrivatePackages: config.privatePackages.version
      })) {
        skippedPackages.push(release.name);
      } else {
        notSkippedPackages.push(release.name);
      }
    }
    if (skippedPackages.length > 0 && notSkippedPackages.length > 0) {
      throw new Error(`Found mixed changeset ${changeset.id}\n` + `Found ignored packages: ${skippedPackages.join(" ")}\n` + `Found not ignored packages: ${notSkippedPackages.join(" ")}\n` + "Mixed changesets that contain both ignored and not ignored packages are not allowed");
    }
  }
  if (preState && preState.mode !== "exit") {
    let usedChangesetIds = new Set(preState.changesets);
    return changesets.filter(changeset => !usedChangesetIds.has(changeset.id));
  }
  return changesets;
}
function getHighestPreVersion(packageGroup, packagesByName) {
  let highestPreVersion = 0;
  for (let pkg of packageGroup) {
    highestPreVersion = Math.max(getPreVersion(packagesByName.get(pkg).packageJson.version), highestPreVersion);
  }
  return highestPreVersion;
}
function getPreInfo(changesets, packagesByName, config, preState) {
  if (preState === undefined) {
    return;
  }
  let updatedPreState = _objectSpread2(_objectSpread2({}, preState), {}, {
    changesets: changesets.map(changeset => changeset.id),
    initialVersions: _objectSpread2({}, preState.initialVersions)
  });
  for (const [, pkg] of packagesByName) {
    if (updatedPreState.initialVersions[pkg.packageJson.name] === undefined) {
      updatedPreState.initialVersions[pkg.packageJson.name] = pkg.packageJson.version;
    }
  }
  // Populate preVersion
  // preVersion is the map between package name and its next pre version number.
  let preVersions = new Map();
  for (const [, pkg] of packagesByName) {
    if (shouldSkipPackage.shouldSkipPackage(pkg, {
      ignore: config.ignore,
      allowPrivatePackages: config.privatePackages.version
    })) {
      continue;
    }
    preVersions.set(pkg.packageJson.name, getPreVersion(pkg.packageJson.version));
  }
  for (let fixedGroup of config.fixed) {
    let highestPreVersion = getHighestPreVersion(fixedGroup, packagesByName);
    for (let fixedPackage of fixedGroup) {
      preVersions.set(fixedPackage, highestPreVersion);
    }
  }
  for (let linkedGroup of config.linked) {
    let highestPreVersion = getHighestPreVersion(linkedGroup, packagesByName);
    for (let linkedPackage of linkedGroup) {
      preVersions.set(linkedPackage, highestPreVersion);
    }
  }
  return {
    state: updatedPreState,
    preVersions
  };
}

exports["default"] = assembleReleasePlan;
