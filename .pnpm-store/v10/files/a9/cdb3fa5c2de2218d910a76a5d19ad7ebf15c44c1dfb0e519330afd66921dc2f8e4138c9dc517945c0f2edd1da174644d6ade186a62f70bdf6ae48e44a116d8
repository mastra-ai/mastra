// This is a modified version of the graph-getting in bolt
import Range from "semver/classes/range";
import pc from "picocolors";
import { Packages, Package } from "@manypkg/get-packages";
import { PackageJSON } from "@changesets/types";

const DEPENDENCY_TYPES = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

const getAllDependencies = (
  config: PackageJSON,
  ignoreDevDependencies: boolean
) => {
  const allDependencies = new Map<string, string>();

  for (const type of DEPENDENCY_TYPES) {
    const deps = config[type];
    if (!deps) continue;

    for (const name of Object.keys(deps)) {
      const depRange = deps[name];
      if (
        type === "devDependencies" &&
        (ignoreDevDependencies ||
          depRange.startsWith("link:") ||
          depRange.startsWith("file:"))
      ) {
        continue;
      }

      allDependencies.set(name, depRange);
    }
  }

  return allDependencies;
};

const isProtocolRange = (range: string) => range.indexOf(":") !== -1;

const getValidRange = (potentialRange: string) => {
  if (isProtocolRange(potentialRange)) {
    return null;
  }

  try {
    return new Range(potentialRange);
  } catch {
    return null;
  }
};

export default function getDependencyGraph(
  packages: Packages,
  {
    ignoreDevDependencies = false,
    bumpVersionsWithWorkspaceProtocolOnly = false,
  }: {
    ignoreDevDependencies?: boolean;
    bumpVersionsWithWorkspaceProtocolOnly?: boolean;
  } = {}
): {
  graph: Map<string, { pkg: Package; dependencies: Array<string> }>;
  valid: boolean;
} {
  const graph = new Map<
    string,
    { pkg: Package; dependencies: Array<string> }
  >();
  let valid = true;

  const packagesByName: { [key: string]: Package } = {
    [packages.root.packageJson.name]: packages.root,
  };

  const queue = [packages.root];

  for (const pkg of packages.packages) {
    queue.push(pkg);
    packagesByName[pkg.packageJson.name] = pkg;
  }

  for (const pkg of queue) {
    const { name } = pkg.packageJson;
    const dependencies = [];
    const allDependencies = getAllDependencies(
      pkg.packageJson,
      ignoreDevDependencies
    );

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

      if ((range && !range.test(expected)) || isProtocolRange(depRange)) {
        valid = false;
        console.error(
          `Package ${pc.cyan(
            `"${name}"`
          )} must depend on the current version of ${pc.cyan(
            `"${depName}"`
          )}: ${pc.green(`"${expected}"`)} vs ${pc.red(`"${depRange}"`)}`
        );
        continue;
      }

      // `depRange` could have been a tag and if a tag has been used there might have been a reason for that
      // we should not count this as a local monorepro dependant
      if (!range) {
        continue;
      }

      dependencies.push(depName);
    }

    graph.set(name, { pkg, dependencies });
  }
  return { graph, valid };
}
