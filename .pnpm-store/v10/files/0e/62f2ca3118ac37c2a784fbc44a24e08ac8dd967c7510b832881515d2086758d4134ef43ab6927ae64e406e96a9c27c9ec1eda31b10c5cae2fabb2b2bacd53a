import { shouldSkipPackage } from "@changesets/should-skip-package";
import {
  Config,
  DependencyType,
  PackageJSON,
  VersionType,
} from "@changesets/types";
import { Package } from "@manypkg/get-packages";
import semverSatisfies from "semver/functions/satisfies";
import { incrementVersion } from "./increment";
import { InternalRelease, PreInfo } from "./types";

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
export default function determineDependents({
  releases,
  packagesByName,
  dependencyGraph,
  preInfo,
  config,
}: {
  releases: Map<string, InternalRelease>;
  packagesByName: Map<string, Package>;
  dependencyGraph: Map<string, string[]>;
  preInfo: PreInfo | undefined;
  config: Config;
}): boolean {
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
      throw new Error(
        `Error in determining dependents - could not find package in repository: ${nextRelease.name}`
      );
    }
    pkgDependents
      .map((dependent) => {
        let type: VersionType | undefined;

        const dependentPackage = packagesByName.get(dependent);
        if (!dependentPackage) throw new Error("Dependency map is incorrect");

        if (
          shouldSkipPackage(dependentPackage, {
            ignore: config.ignore,
            allowPrivatePackages: config.privatePackages.version,
          })
        ) {
          type = "none";
        } else {
          const dependencyVersionRanges = getDependencyVersionRanges(
            dependentPackage.packageJson,
            nextRelease
          );

          for (const { depType, versionRange } of dependencyVersionRanges) {
            if (nextRelease.type === "none") {
              continue;
            } else if (
              shouldBumpMajor({
                dependent,
                depType,
                versionRange,
                releases,
                nextRelease,
                preInfo,
                onlyUpdatePeerDependentsWhenOutOfRange:
                  config.___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH
                    .onlyUpdatePeerDependentsWhenOutOfRange,
              })
            ) {
              type = "major";
            } else if (
              (!releases.has(dependent) ||
                releases.get(dependent)!.type === "none") &&
              (config.___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH
                .updateInternalDependents === "always" ||
                !semverSatisfies(
                  incrementVersion(nextRelease, preInfo),
                  versionRange
                ))
            ) {
              switch (depType) {
                case "dependencies":
                case "optionalDependencies":
                case "peerDependencies":
                  if (type !== "major" && type !== "minor") {
                    type = "patch";
                  }
                  break;
                case "devDependencies": {
                  // We don't need a version bump if the package is only in the devDependencies of the dependent package
                  if (
                    type !== "major" &&
                    type !== "minor" &&
                    type !== "patch"
                  ) {
                    type = "none";
                  }
                }
              }
            }
          }
        }
        if (releases.has(dependent) && releases.get(dependent)!.type === type) {
          type = undefined;
        }
        return {
          name: dependent,
          type,
          pkgJSON: dependentPackage.packageJson,
        };
      })
      .filter(
        (
          dependentItem
        ): dependentItem is typeof dependentItem & { type: VersionType } =>
          !!dependentItem.type
      )
      .forEach(({ name, type, pkgJSON }) => {
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
          let newDependent: InternalRelease = {
            name,
            type,
            oldVersion: pkgJSON.version,
            changesets: [],
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
function getDependencyVersionRanges(
  dependentPkgJSON: PackageJSON,
  dependencyRelease: InternalRelease
): {
  depType: DependencyType;
  versionRange: string;
}[] {
  const DEPENDENCY_TYPES = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ] as const;
  const dependencyVersionRanges: {
    depType: DependencyType;
    versionRange: string;
  }[] = [];
  for (const type of DEPENDENCY_TYPES) {
    let versionRange = dependentPkgJSON[type]?.[dependencyRelease.name];
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
      versionRange,
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
  onlyUpdatePeerDependentsWhenOutOfRange,
}: {
  dependent: string;
  depType: DependencyType;
  versionRange: string;
  releases: Map<string, InternalRelease>;
  nextRelease: InternalRelease;
  preInfo: PreInfo | undefined;
  onlyUpdatePeerDependentsWhenOutOfRange: boolean;
}) {
  // we check if it is a peerDependency because if it is, our dependent bump type might need to be major.
  return (
    depType === "peerDependencies" &&
    nextRelease.type !== "none" &&
    nextRelease.type !== "patch" &&
    // 1. If onlyUpdatePeerDependentsWhenOutOfRange set to true, bump major if the version is leaving the range.
    // 2. If onlyUpdatePeerDependentsWhenOutOfRange set to false, bump major regardless whether or not the version is leaving the range.
    (!onlyUpdatePeerDependentsWhenOutOfRange ||
      !semverSatisfies(incrementVersion(nextRelease, preInfo), versionRange)) &&
    // bump major only if the dependent doesn't already has a major release.
    (!releases.has(dependent) ||
      (releases.has(dependent) && releases.get(dependent)!.type !== "major"))
  );
}
