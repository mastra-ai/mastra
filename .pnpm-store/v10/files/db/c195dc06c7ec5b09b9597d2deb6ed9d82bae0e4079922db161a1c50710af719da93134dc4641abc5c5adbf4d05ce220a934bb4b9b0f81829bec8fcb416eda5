import { Package } from "@manypkg/get-packages";
import { PackageGroup } from "@changesets/types";

export function shouldSkipPackage(
  { packageJson }: Package,
  {
    ignore,
    allowPrivatePackages,
  }: {
    ignore: PackageGroup;
    allowPrivatePackages: boolean;
  }
) {
  if (ignore.includes(packageJson.name)) {
    return true;
  }

  if (packageJson.private && !allowPrivatePackages) {
    return true;
  }

  return !packageJson.version;
}
