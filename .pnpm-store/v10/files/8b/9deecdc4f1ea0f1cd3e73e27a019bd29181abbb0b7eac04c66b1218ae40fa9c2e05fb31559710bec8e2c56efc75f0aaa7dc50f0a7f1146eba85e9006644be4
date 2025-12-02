import * as fs from "fs-extra";
import path from "path";
import { PreState } from "@changesets/types";
import { getPackages } from "@manypkg/get-packages";
import {
  PreExitButNotInPreModeError,
  PreEnterButInPreModeError,
} from "@changesets/errors";

export async function readPreState(cwd: string): Promise<PreState | undefined> {
  let preStatePath = path.resolve(cwd, ".changeset", "pre.json");
  // TODO: verify that the pre state isn't broken
  let preState: PreState | undefined;
  try {
    let contents = await fs.readFile(preStatePath, "utf8");
    try {
      preState = JSON.parse(contents);
    } catch (err) {
      if (err instanceof SyntaxError) {
        console.error("error parsing json:", contents);
      }
      throw err;
    }
  } catch (err) {
    if ((err as any).code !== "ENOENT") {
      throw err;
    }
  }
  return preState;
}

export async function exitPre(cwd: string) {
  let preStatePath = path.resolve(cwd, ".changeset", "pre.json");
  // TODO: verify that the pre state isn't broken
  let preState = await readPreState(cwd);

  if (preState === undefined) {
    throw new PreExitButNotInPreModeError();
  }

  await fs.outputFile(
    preStatePath,
    JSON.stringify({ ...preState, mode: "exit" }, null, 2) + "\n"
  );
}

export async function enterPre(cwd: string, tag: string) {
  let packages = await getPackages(cwd);
  let preStatePath = path.resolve(packages.root.dir, ".changeset", "pre.json");
  let preState: PreState | undefined = await readPreState(packages.root.dir);
  // can't reenter if pre mode still exists, but we should allow exited pre mode to be reentered
  if (preState?.mode === "pre") {
    throw new PreEnterButInPreModeError();
  }
  let newPreState: PreState = {
    mode: "pre",
    tag,
    initialVersions: {},
    changesets: preState?.changesets ?? [],
  };
  for (let pkg of packages.packages) {
    newPreState.initialVersions[pkg.packageJson.name] = pkg.packageJson.version;
  }
  await fs.outputFile(
    preStatePath,
    JSON.stringify(newPreState, null, 2) + "\n"
  );
}
