import spawn from "spawndamnit";
import fs from "fs";
import path from "path";
import { getPackages, Package } from "@manypkg/get-packages";
import { GitError } from "@changesets/errors";
import isSubdir from "is-subdir";
import micromatch from "micromatch";

export async function add(pathToFile: string, cwd: string) {
  const gitCmd = await spawn("git", ["add", pathToFile], { cwd });

  if (gitCmd.code !== 0) {
    console.log(pathToFile, gitCmd.stderr.toString());
  }
  return gitCmd.code === 0;
}

export async function commit(message: string, cwd: string) {
  const gitCmd = await spawn(
    "git",
    ["commit", "-m", message, "--allow-empty"],
    { cwd }
  );
  return gitCmd.code === 0;
}

export async function getAllTags(cwd: string): Promise<Set<string>> {
  const gitCmd = await spawn("git", ["tag"], { cwd });

  if (gitCmd.code !== 0) {
    throw new Error(gitCmd.stderr.toString());
  }

  const tags = gitCmd.stdout.toString().trim().split("\n");

  return new Set(tags);
}

// used to create a single tag at a time for the current head only
export async function tag(tagStr: string, cwd: string) {
  // NOTE: it's important we use the -m flag to create annotated tag otherwise 'git push --follow-tags' won't actually push
  // the tags
  const gitCmd = await spawn("git", ["tag", tagStr, "-m", tagStr], { cwd });
  return gitCmd.code === 0;
}

// Find the commit where we diverged from `ref` at using `git merge-base`
export async function getDivergedCommit(cwd: string, ref: string) {
  const cmd = await spawn("git", ["merge-base", ref, "HEAD"], { cwd });
  if (cmd.code !== 0) {
    throw new Error(
      `Failed to find where HEAD diverged from "${ref}". Does "${ref}" exist and it's synced with remote?`
    );
  }
  return cmd.stdout.toString().trim();
}

/**
 * Get the SHAs for the commits that added files, including automatically
 * extending a shallow clone if necessary to determine any commits.
 * @param gitPaths - Paths to fetch
 * @param options - `cwd` and `short`
 */
export async function getCommitsThatAddFiles(
  gitPaths: string[],
  { cwd, short = false }: { cwd: string; short?: boolean }
): Promise<(string | undefined)[]> {
  // Maps gitPath to commit SHA
  const map = new Map<string, string>();

  // Paths we haven't completed processing on yet
  let remaining = gitPaths;

  do {
    // Fetch commit information for all paths we don't have yet
    const commitInfos = await Promise.all(
      remaining.map(async (gitPath: string) => {
        const [commitSha, parentSha] = (
          await spawn(
            "git",
            [
              "log",
              "--diff-filter=A",
              "--max-count=1",
              short ? "--pretty=format:%h:%p" : "--pretty=format:%H:%p",
              gitPath,
            ],
            { cwd }
          )
        ).stdout
          .toString()
          .split(":");
        return { path: gitPath, commitSha, parentSha };
      })
    );

    // To collect commits without parents (usually because they're absent from
    // a shallow clone).
    let commitsWithMissingParents = [];

    for (const info of commitInfos) {
      if (info.commitSha) {
        if (info.parentSha) {
          // We have found the parent of the commit that added the file.
          // Therefore we know that the commit is legitimate and isn't simply the boundary of a shallow clone.
          map.set(info.path, info.commitSha);
        } else {
          commitsWithMissingParents.push(info);
        }
      } else {
        // No commit for this file, which indicates it doesn't exist.
      }
    }

    if (commitsWithMissingParents.length === 0) {
      break;
    }

    // The commits we've found may be the real commits or they may be the boundary of
    // a shallow clone.

    // Can we deepen the clone?
    if (await isRepoShallow({ cwd })) {
      // Yes.
      await deepenCloneBy({ by: 50, cwd });
      remaining = commitsWithMissingParents.map((p) => p.path);
    } else {
      // It's not a shallow clone, so all the commit SHAs we have are legitimate.
      for (const unresolved of commitsWithMissingParents) {
        map.set(unresolved.path, unresolved.commitSha);
      }
      break;
    }
  } while (true);

  return gitPaths.map((p) => map.get(p));
}

export async function isRepoShallow({ cwd }: { cwd: string }) {
  const isShallowRepoOutput = (
    await spawn("git", ["rev-parse", "--is-shallow-repository"], {
      cwd,
    })
  ).stdout
    .toString()
    .trim();

  if (isShallowRepoOutput === "--is-shallow-repository") {
    // We have an old version of Git (<2.15) which doesn't support `rev-parse --is-shallow-repository`
    // In that case, we'll test for the existence of .git/shallow.

    // Firstly, find the .git folder for the repo; note that this will be relative to the repo dir
    const gitDir = (
      await spawn("git", ["rev-parse", "--git-dir"], { cwd })
    ).stdout
      .toString()
      .trim();

    const fullGitDir = path.resolve(cwd, gitDir);

    // Check for the existence of <gitDir>/shallow
    return fs.existsSync(path.join(fullGitDir, "shallow"));
  } else {
    // We have a newer Git which supports `rev-parse --is-shallow-repository`. We'll use
    // the output of that instead of messing with .git/shallow in case that changes in the future.
    return isShallowRepoOutput === "true";
  }
}

export async function deepenCloneBy({ by, cwd }: { by: number; cwd: string }) {
  await spawn("git", ["fetch", `--deepen=${by}`], { cwd });
}
async function getRepoRoot({ cwd }: { cwd: string }) {
  const { stdout, code, stderr } = await spawn(
    "git",
    ["rev-parse", "--show-toplevel"],
    { cwd }
  );

  if (code !== 0) {
    throw new Error(stderr.toString());
  }

  return stdout.toString().trim().replace(/\n|\r/g, "");
}

export async function getChangedFilesSince({
  cwd,
  ref,
  fullPath = false,
}: {
  cwd: string;
  ref: string;
  fullPath?: boolean;
}): Promise<Array<string>> {
  const divergedAt = await getDivergedCommit(cwd, ref);
  // Now we can find which files we added
  const cmd = await spawn(
    "git",
    ["diff", "--name-only", "--no-relative", divergedAt],
    { cwd }
  );
  if (cmd.code !== 0) {
    throw new Error(
      `Failed to diff against ${divergedAt}. Is ${divergedAt} a valid ref?`
    );
  }

  const files = cmd.stdout
    .toString()
    .trim()
    .split("\n")
    .filter((a) => a);
  if (!fullPath) return files;

  const repoRoot = await getRepoRoot({ cwd });
  return files.map((file) => path.resolve(repoRoot, file));
}

// below are less generic functions that we use in combination with other things we are doing
export async function getChangedChangesetFilesSinceRef({
  cwd,
  ref,
}: {
  cwd: string;
  ref: string;
}): Promise<Array<string>> {
  try {
    const divergedAt = await getDivergedCommit(cwd, ref);
    // Now we can find which files we added
    const cmd = await spawn(
      "git",
      ["diff", "--name-only", "--diff-filter=d", "--no-relative", divergedAt],
      {
        cwd,
      }
    );

    let tester = /.changeset\/[^/]+\.md$/;

    const files = cmd.stdout
      .toString()
      .trim()
      .split("\n")
      .filter((file) => tester.test(file));
    return files;
  } catch (err) {
    if (err instanceof GitError) return [];
    throw err;
  }
}

export async function getChangedPackagesSinceRef({
  cwd,
  ref,
  changedFilePatterns = ["**"],
}: {
  cwd: string;
  ref: string;
  changedFilePatterns?: readonly string[];
}): Promise<Package[]> {
  const changedFiles = await getChangedFilesSince({ ref, cwd, fullPath: true });

  return (
    [...(await getPackages(cwd)).packages]
      // sort packages by length of dir, so that we can check for subdirs first
      .sort((pkgA, pkgB) => pkgB.dir.length - pkgA.dir.length)
      .filter((pkg) => {
        const changedPackageFiles: string[] = [];

        for (let i = changedFiles.length - 1; i >= 0; i--) {
          const file = changedFiles[i];

          if (isSubdir(pkg.dir, file)) {
            changedFiles.splice(i, 1);
            const relativeFile = file.slice(pkg.dir.length + 1);
            changedPackageFiles.push(relativeFile);
          }
        }

        return (
          changedPackageFiles.length > 0 &&
          micromatch(changedPackageFiles, changedFilePatterns).length > 0
        );
      })
  );
}

export async function tagExists(tagStr: string, cwd: string) {
  const gitCmd = await spawn("git", ["tag", "-l", tagStr], { cwd });
  const output = gitCmd.stdout.toString().trim();
  const tagExists = !!output;
  return tagExists;
}

export async function getCurrentCommitId({
  cwd,
  short = false,
}: {
  cwd: string;
  short?: boolean;
}): Promise<string> {
  return (
    await spawn(
      "git",
      ["rev-parse", short && "--short", "HEAD"].filter<string>(Boolean as any),
      { cwd }
    )
  ).stdout
    .toString()
    .trim();
}

export async function remoteTagExists(tagStr: string) {
  const gitCmd = await spawn("git", [
    "ls-remote",
    "--tags",
    "origin",
    "-l",
    tagStr,
  ]);
  const output = gitCmd.stdout.toString().trim();
  const tagExists = !!output;
  return tagExists;
}
