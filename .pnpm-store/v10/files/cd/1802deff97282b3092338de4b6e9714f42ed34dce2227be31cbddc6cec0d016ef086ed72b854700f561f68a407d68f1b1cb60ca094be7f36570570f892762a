import { InternalError } from "@changesets/errors";
import { getDependentsGraph } from "@changesets/get-dependents-graph";
import { shouldSkipPackage } from "@changesets/should-skip-package";
import {
  Config,
  NewChangeset,
  PackageGroup,
  PreState,
  ReleasePlan,
} from "@changesets/types";
import { Package, Packages } from "@manypkg/get-packages";
import semverParse from "semver/functions/parse";
import applyLinks from "./apply-links";
import determineDependents from "./determine-dependents";
import flattenReleases from "./flatten-releases";
import { incrementVersion } from "./increment";
import matchFixedConstraint from "./match-fixed-constraint";
import { InternalRelease, PreInfo } from "./types";

type SnapshotReleaseParameters = {
  tag?: string | undefined;
  commit?: string | undefined;
};

function getPreVersion(version: string) {
  let parsed = semverParse(version)!;
  let preVersion =
    parsed.prerelease[1] === undefined ? -1 : parsed.prerelease[1];
  if (typeof preVersion !== "number") {
    throw new InternalError("preVersion is not a number");
  }
  preVersion++;
  return preVersion;
}

function getSnapshotSuffix(
  template: Config["snapshot"]["prereleaseTemplate"],
  snapshotParameters: SnapshotReleaseParameters
): string {
  let snapshotRefDate = new Date();

  const placeholderValues = {
    commit: snapshotParameters.commit,
    tag: snapshotParameters.tag,
    timestamp: snapshotRefDate.getTime().toString(),
    datetime: snapshotRefDate
      .toISOString()
      .replace(/\.\d{3}Z$/, "")
      .replace(/[^\d]/g, ""),
  };

  // We need a special handling because we need to handle a case where `--snapshot` is used without any template,
  // and the resulting version needs to be composed without a tag.
  if (!template) {
    return [placeholderValues.tag, placeholderValues.datetime]
      .filter(Boolean)
      .join("-");
  }

  const placeholders = Object.keys(placeholderValues) as Array<
    keyof typeof placeholderValues
  >;

  if (!template.includes(`{tag}`) && placeholderValues.tag !== undefined) {
    throw new Error(
      `Failed to compose snapshot version: "{tag}" placeholder is missing, but the snapshot parameter is defined (value: '${placeholderValues.tag}')`
    );
  }

  return placeholders.reduce((prev, key) => {
    return prev.replace(new RegExp(`\\{${key}\\}`, "g"), () => {
      const value = placeholderValues[key];
      if (value === undefined) {
        throw new Error(
          `Failed to compose snapshot version: "{${key}}" placeholder is used without having a value defined!`
        );
      }

      return value;
    });
  }, template);
}

function getSnapshotVersion(
  release: InternalRelease,
  preInfo: PreInfo | undefined,
  useCalculatedVersion: boolean,
  snapshotSuffix: string
): string {
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
  const baseVersion = useCalculatedVersion
    ? incrementVersion(release, preInfo)
    : `0.0.0`;

  return `${baseVersion}-${snapshotSuffix}`;
}

function getNewVersion(
  release: InternalRelease,
  preInfo: PreInfo | undefined
): string {
  if (release.type === "none") {
    return release.oldVersion;
  }

  return incrementVersion(release, preInfo);
}

type OptionalProp<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

function assembleReleasePlan(
  changesets: NewChangeset[],
  packages: Packages,
  config: OptionalProp<Config, "snapshot">,
  // intentionally not using an optional parameter here so the result of `readPreState` has to be passed in here
  preState: PreState | undefined,
  // snapshot: undefined            ->  not using snaphot
  // snapshot: { tag: undefined }   ->  --snapshot (empty tag)
  // snapshot: { tag: "canary" }    ->  --snapshot canary
  snapshot?: SnapshotReleaseParameters | string | boolean
): ReleasePlan {
  // TODO: remove `refined*` in the next major version of this package
  // just use `config` and `snapshot` parameters directly, typed as: `config: Config, snapshot?: SnapshotReleaseParameters`
  const refinedConfig: Config = config.snapshot
    ? (config as Config)
    : {
        ...config,
        snapshot: {
          prereleaseTemplate: null,
          useCalculatedVersion: (
            config.___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH as any
          ).useCalculatedVersionForSnapshots,
        },
      };
  const refinedSnapshot: SnapshotReleaseParameters | undefined =
    typeof snapshot === "string"
      ? { tag: snapshot }
      : typeof snapshot === "boolean"
      ? { tag: undefined }
      : snapshot;

  let packagesByName = new Map(
    packages.packages.map((x) => [x.packageJson.name, x])
  );

  const relevantChangesets = getRelevantChangesets(
    changesets,
    packagesByName,
    refinedConfig,
    preState
  );

  const preInfo = getPreInfo(
    changesets,
    packagesByName,
    refinedConfig,
    preState
  );

  // releases is, at this point a list of all packages we are going to releases,
  // flattened down to one release per package, having a reference back to their
  // changesets, and with a calculated new versions
  let releases = flattenReleases(
    relevantChangesets,
    packagesByName,
    refinedConfig
  );

  let dependencyGraph = getDependentsGraph(packages, {
    bumpVersionsWithWorkspaceProtocolOnly:
      refinedConfig.bumpVersionsWithWorkspaceProtocolOnly,
  });

  let releasesValidated = false;
  while (releasesValidated === false) {
    // The map passed in to determineDependents will be mutated
    let dependentAdded = determineDependents({
      releases,
      packagesByName,
      dependencyGraph,
      preInfo,
      config: refinedConfig,
    });

    // `releases` might get mutated here
    let fixedConstraintUpdated = matchFixedConstraint(
      releases,
      packagesByName,
      refinedConfig
    );
    let linksUpdated = applyLinks(
      releases,
      packagesByName,
      refinedConfig.linked
    );

    releasesValidated =
      !linksUpdated && !dependentAdded && !fixedConstraintUpdated;
  }

  if (preInfo?.state.mode === "exit") {
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
            changesets: [],
          });
        } else if (
          existingRelease.type === "none" &&
          !shouldSkipPackage(pkg, {
            ignore: refinedConfig.ignore,
            allowPrivatePackages: refinedConfig.privatePackages.version,
          })
        ) {
          existingRelease.type = "patch";
        }
      }
    }
  }

  // Caching the snapshot version here and use this if it is snapshot release
  const snapshotSuffix =
    refinedSnapshot &&
    getSnapshotSuffix(
      refinedConfig.snapshot.prereleaseTemplate,
      refinedSnapshot
    );

  return {
    changesets: relevantChangesets,
    releases: [...releases.values()].map((incompleteRelease) => {
      return {
        ...incompleteRelease,
        newVersion: snapshotSuffix
          ? getSnapshotVersion(
              incompleteRelease,
              preInfo,
              refinedConfig.snapshot.useCalculatedVersion,
              snapshotSuffix
            )
          : getNewVersion(incompleteRelease, preInfo),
      };
    }),
    preState: preInfo?.state,
  };
}

function getRelevantChangesets(
  changesets: NewChangeset[],
  packagesByName: Map<string, Package>,
  config: Config,
  preState: PreState | undefined
): NewChangeset[] {
  for (const changeset of changesets) {
    // Using the following 2 arrays to decide whether a changeset
    // contains both skipped and not skipped packages
    const skippedPackages = [];
    const notSkippedPackages = [];
    for (const release of changeset.releases) {
      const packageByName = packagesByName.get(release.name);

      if (!packageByName) {
        throw new Error(
          `Found changeset ${changeset.id} for package ${release.name} which is not in the workspace`
        );
      }

      if (
        shouldSkipPackage(packageByName, {
          ignore: config.ignore,
          allowPrivatePackages: config.privatePackages.version,
        })
      ) {
        skippedPackages.push(release.name);
      } else {
        notSkippedPackages.push(release.name);
      }
    }

    if (skippedPackages.length > 0 && notSkippedPackages.length > 0) {
      throw new Error(
        `Found mixed changeset ${changeset.id}\n` +
          `Found ignored packages: ${skippedPackages.join(" ")}\n` +
          `Found not ignored packages: ${notSkippedPackages.join(" ")}\n` +
          "Mixed changesets that contain both ignored and not ignored packages are not allowed"
      );
    }
  }

  if (preState && preState.mode !== "exit") {
    let usedChangesetIds = new Set(preState.changesets);
    return changesets.filter(
      (changeset) => !usedChangesetIds.has(changeset.id)
    );
  }

  return changesets;
}

function getHighestPreVersion(
  packageGroup: PackageGroup,
  packagesByName: Map<string, Package>
): number {
  let highestPreVersion = 0;
  for (let pkg of packageGroup) {
    highestPreVersion = Math.max(
      getPreVersion(packagesByName.get(pkg)!.packageJson.version),
      highestPreVersion
    );
  }
  return highestPreVersion;
}

function getPreInfo(
  changesets: NewChangeset[],
  packagesByName: Map<string, Package>,
  config: Config,
  preState: PreState | undefined
): PreInfo | undefined {
  if (preState === undefined) {
    return;
  }

  let updatedPreState = {
    ...preState,
    changesets: changesets.map((changeset) => changeset.id),
    initialVersions: {
      ...preState.initialVersions,
    },
  };

  for (const [, pkg] of packagesByName) {
    if (updatedPreState.initialVersions[pkg.packageJson.name] === undefined) {
      updatedPreState.initialVersions[pkg.packageJson.name] =
        pkg.packageJson.version;
    }
  }
  // Populate preVersion
  // preVersion is the map between package name and its next pre version number.
  let preVersions = new Map<string, number>();
  for (const [, pkg] of packagesByName) {
    if (
      shouldSkipPackage(pkg, {
        ignore: config.ignore,
        allowPrivatePackages: config.privatePackages.version,
      })
    ) {
      continue;
    }
    preVersions.set(
      pkg.packageJson.name,
      getPreVersion(pkg.packageJson.version)
    );
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
    preVersions,
  };
}

export default assembleReleasePlan;
