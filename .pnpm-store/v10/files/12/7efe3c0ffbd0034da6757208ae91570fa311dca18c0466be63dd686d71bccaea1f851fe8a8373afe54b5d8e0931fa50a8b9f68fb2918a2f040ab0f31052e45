import { Linked } from "@changesets/types";
import { Package } from "@manypkg/get-packages";
import { InternalRelease } from "./types";
import { getCurrentHighestVersion, getHighestReleaseType } from "./utils";

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
export default function applyLinks(
  releases: Map<string, InternalRelease>,
  packagesByName: Map<string, Package>,
  linked: Linked
): boolean {
  let updated = false;

  // We do this for each set of linked packages
  for (let linkedPackages of linked) {
    // First we filter down to all the relevant releases for one set of linked packages
    let releasingLinkedPackages = [...releases.values()].filter(
      (release) =>
        linkedPackages.includes(release.name) && release.type !== "none"
    );

    // If we proceed any further we do extra work with calculating highestVersion for things that might
    // not need one, as they only have workspace based packages
    if (releasingLinkedPackages.length === 0) continue;

    let highestReleaseType = getHighestReleaseType(releasingLinkedPackages);
    let highestVersion = getCurrentHighestVersion(
      linkedPackages,
      packagesByName
    );

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
