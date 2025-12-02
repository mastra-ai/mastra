import findUp, { sync as findUpSync } from "find-up";
import path from "path";
import fs from "fs-extra";

export class NoPkgJsonFound extends Error {
  directory: string;
  constructor(directory: string) {
    super(
      `No package.json could be found upwards from the directory ${directory}`
    );
    this.directory = directory;
  }
}

async function hasWorkspacesConfiguredViaPkgJson(
  directory: string,
  firstPkgJsonDirRef: { current: string | undefined }
) {
  try {
    let pkgJson = await fs.readJson(path.join(directory, "package.json"));
    if (firstPkgJsonDirRef.current === undefined) {
      firstPkgJsonDirRef.current = directory;
    }
    if (pkgJson.workspaces || pkgJson.bolt) {
      return directory;
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw err;
    }
  }
}

async function hasWorkspacesConfiguredViaLerna(directory: string) {
  try {
    let lernaJson = await fs.readJson(path.join(directory, "lerna.json"));
    if (lernaJson.useWorkspaces !== true) {
      return directory;
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw err;
    }
  }
}

async function hasWorkspacesConfiguredViaPnpm(directory: string) {
  // @ts-ignore
  let pnpmWorkspacesFileExists = await fs.exists(
    path.join(directory, "pnpm-workspace.yaml")
  );
  if (pnpmWorkspacesFileExists) {
    return directory;
  }
}

export async function findRoot(cwd: string): Promise<string> {
  let firstPkgJsonDirRef: { current: string | undefined } = {
    current: undefined
  };
  let dir = await findUp(
    directory => {
      return Promise.all([
        hasWorkspacesConfiguredViaLerna(directory),
        hasWorkspacesConfiguredViaPkgJson(directory, firstPkgJsonDirRef),
        hasWorkspacesConfiguredViaPnpm(directory)
      ]).then(x => x.find(dir => dir));
    },
    { cwd, type: "directory" }
  );
  if (firstPkgJsonDirRef.current === undefined) {
    throw new NoPkgJsonFound(cwd);
  }
  if (dir === undefined) {
    return firstPkgJsonDirRef.current;
  }
  return dir;
}

function hasWorkspacesConfiguredViaPkgJsonSync(
  directory: string,
  firstPkgJsonDirRef: { current: string | undefined }
) {
  try {
    const pkgJson = fs.readJsonSync(path.join(directory, "package.json"));
    if (firstPkgJsonDirRef.current === undefined) {
      firstPkgJsonDirRef.current = directory;
    }
    if (pkgJson.workspaces || pkgJson.bolt) {
      return directory;
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw err;
    }
  }
}

function hasWorkspacesConfiguredViaLernaSync(directory: string) {
  try {
    let lernaJson = fs.readJsonSync(path.join(directory, "lerna.json"));
    if (lernaJson.useWorkspaces !== true) {
      return directory;
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw err;
    }
  }
}

function hasWorkspacesConfiguredViaPnpmSync(directory: string) {
  // @ts-ignore
  let pnpmWorkspacesFileExists = fs.existsSync(
    path.join(directory, "pnpm-workspace.yaml")
  );
  if (pnpmWorkspacesFileExists) {
    return directory;
  }
}

export function findRootSync(cwd: string) {
  let firstPkgJsonDirRef: { current: string | undefined } = {
    current: undefined
  };

  let dir = findUpSync(
    directory => {
      return [
        hasWorkspacesConfiguredViaLernaSync(directory),
        hasWorkspacesConfiguredViaPkgJsonSync(directory, firstPkgJsonDirRef),
        hasWorkspacesConfiguredViaPnpmSync(directory)
      ].find(dir => dir);
    },
    { cwd, type: "directory" }
  );

  if (firstPkgJsonDirRef.current === undefined) {
    throw new NoPkgJsonFound(cwd);
  }
  if (dir === undefined) {
    return firstPkgJsonDirRef.current;
  }
  return dir;
}
