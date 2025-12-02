'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var spawn = require('spawndamnit');
var fs = require('fs');
var path = require('path');
var getPackages = require('@manypkg/get-packages');
var errors = require('@changesets/errors');
var isSubdir = require('is-subdir');
var micromatch = require('micromatch');

function _interopDefault (e) { return e && e.__esModule ? e : { 'default': e }; }

var spawn__default = /*#__PURE__*/_interopDefault(spawn);
var fs__default = /*#__PURE__*/_interopDefault(fs);
var path__default = /*#__PURE__*/_interopDefault(path);
var isSubdir__default = /*#__PURE__*/_interopDefault(isSubdir);
var micromatch__default = /*#__PURE__*/_interopDefault(micromatch);

async function add(pathToFile, cwd) {
  const gitCmd = await spawn__default["default"]("git", ["add", pathToFile], {
    cwd
  });
  if (gitCmd.code !== 0) {
    console.log(pathToFile, gitCmd.stderr.toString());
  }
  return gitCmd.code === 0;
}
async function commit(message, cwd) {
  const gitCmd = await spawn__default["default"]("git", ["commit", "-m", message, "--allow-empty"], {
    cwd
  });
  return gitCmd.code === 0;
}
async function getAllTags(cwd) {
  const gitCmd = await spawn__default["default"]("git", ["tag"], {
    cwd
  });
  if (gitCmd.code !== 0) {
    throw new Error(gitCmd.stderr.toString());
  }
  const tags = gitCmd.stdout.toString().trim().split("\n");
  return new Set(tags);
}

// used to create a single tag at a time for the current head only
async function tag(tagStr, cwd) {
  // NOTE: it's important we use the -m flag to create annotated tag otherwise 'git push --follow-tags' won't actually push
  // the tags
  const gitCmd = await spawn__default["default"]("git", ["tag", tagStr, "-m", tagStr], {
    cwd
  });
  return gitCmd.code === 0;
}

// Find the commit where we diverged from `ref` at using `git merge-base`
async function getDivergedCommit(cwd, ref) {
  const cmd = await spawn__default["default"]("git", ["merge-base", ref, "HEAD"], {
    cwd
  });
  if (cmd.code !== 0) {
    throw new Error(`Failed to find where HEAD diverged from "${ref}". Does "${ref}" exist and it's synced with remote?`);
  }
  return cmd.stdout.toString().trim();
}

/**
 * Get the SHAs for the commits that added files, including automatically
 * extending a shallow clone if necessary to determine any commits.
 * @param gitPaths - Paths to fetch
 * @param options - `cwd` and `short`
 */
async function getCommitsThatAddFiles(gitPaths, {
  cwd,
  short = false
}) {
  // Maps gitPath to commit SHA
  const map = new Map();

  // Paths we haven't completed processing on yet
  let remaining = gitPaths;
  do {
    // Fetch commit information for all paths we don't have yet
    const commitInfos = await Promise.all(remaining.map(async gitPath => {
      const [commitSha, parentSha] = (await spawn__default["default"]("git", ["log", "--diff-filter=A", "--max-count=1", short ? "--pretty=format:%h:%p" : "--pretty=format:%H:%p", gitPath], {
        cwd
      })).stdout.toString().split(":");
      return {
        path: gitPath,
        commitSha,
        parentSha
      };
    }));

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
      }
    }
    if (commitsWithMissingParents.length === 0) {
      break;
    }

    // The commits we've found may be the real commits or they may be the boundary of
    // a shallow clone.

    // Can we deepen the clone?
    if (await isRepoShallow({
      cwd
    })) {
      // Yes.
      await deepenCloneBy({
        by: 50,
        cwd
      });
      remaining = commitsWithMissingParents.map(p => p.path);
    } else {
      // It's not a shallow clone, so all the commit SHAs we have are legitimate.
      for (const unresolved of commitsWithMissingParents) {
        map.set(unresolved.path, unresolved.commitSha);
      }
      break;
    }
  } while (true);
  return gitPaths.map(p => map.get(p));
}
async function isRepoShallow({
  cwd
}) {
  const isShallowRepoOutput = (await spawn__default["default"]("git", ["rev-parse", "--is-shallow-repository"], {
    cwd
  })).stdout.toString().trim();
  if (isShallowRepoOutput === "--is-shallow-repository") {
    // We have an old version of Git (<2.15) which doesn't support `rev-parse --is-shallow-repository`
    // In that case, we'll test for the existence of .git/shallow.

    // Firstly, find the .git folder for the repo; note that this will be relative to the repo dir
    const gitDir = (await spawn__default["default"]("git", ["rev-parse", "--git-dir"], {
      cwd
    })).stdout.toString().trim();
    const fullGitDir = path__default["default"].resolve(cwd, gitDir);

    // Check for the existence of <gitDir>/shallow
    return fs__default["default"].existsSync(path__default["default"].join(fullGitDir, "shallow"));
  } else {
    // We have a newer Git which supports `rev-parse --is-shallow-repository`. We'll use
    // the output of that instead of messing with .git/shallow in case that changes in the future.
    return isShallowRepoOutput === "true";
  }
}
async function deepenCloneBy({
  by,
  cwd
}) {
  await spawn__default["default"]("git", ["fetch", `--deepen=${by}`], {
    cwd
  });
}
async function getRepoRoot({
  cwd
}) {
  const {
    stdout,
    code,
    stderr
  } = await spawn__default["default"]("git", ["rev-parse", "--show-toplevel"], {
    cwd
  });
  if (code !== 0) {
    throw new Error(stderr.toString());
  }
  return stdout.toString().trim().replace(/\n|\r/g, "");
}
async function getChangedFilesSince({
  cwd,
  ref,
  fullPath = false
}) {
  const divergedAt = await getDivergedCommit(cwd, ref);
  // Now we can find which files we added
  const cmd = await spawn__default["default"]("git", ["diff", "--name-only", "--no-relative", divergedAt], {
    cwd
  });
  if (cmd.code !== 0) {
    throw new Error(`Failed to diff against ${divergedAt}. Is ${divergedAt} a valid ref?`);
  }
  const files = cmd.stdout.toString().trim().split("\n").filter(a => a);
  if (!fullPath) return files;
  const repoRoot = await getRepoRoot({
    cwd
  });
  return files.map(file => path__default["default"].resolve(repoRoot, file));
}

// below are less generic functions that we use in combination with other things we are doing
async function getChangedChangesetFilesSinceRef({
  cwd,
  ref
}) {
  try {
    const divergedAt = await getDivergedCommit(cwd, ref);
    // Now we can find which files we added
    const cmd = await spawn__default["default"]("git", ["diff", "--name-only", "--diff-filter=d", "--no-relative", divergedAt], {
      cwd
    });
    let tester = /.changeset\/[^/]+\.md$/;
    const files = cmd.stdout.toString().trim().split("\n").filter(file => tester.test(file));
    return files;
  } catch (err) {
    if (err instanceof errors.GitError) return [];
    throw err;
  }
}
async function getChangedPackagesSinceRef({
  cwd,
  ref,
  changedFilePatterns = ["**"]
}) {
  const changedFiles = await getChangedFilesSince({
    ref,
    cwd,
    fullPath: true
  });
  return [...(await getPackages.getPackages(cwd)).packages]
  // sort packages by length of dir, so that we can check for subdirs first
  .sort((pkgA, pkgB) => pkgB.dir.length - pkgA.dir.length).filter(pkg => {
    const changedPackageFiles = [];
    for (let i = changedFiles.length - 1; i >= 0; i--) {
      const file = changedFiles[i];
      if (isSubdir__default["default"](pkg.dir, file)) {
        changedFiles.splice(i, 1);
        const relativeFile = file.slice(pkg.dir.length + 1);
        changedPackageFiles.push(relativeFile);
      }
    }
    return changedPackageFiles.length > 0 && micromatch__default["default"](changedPackageFiles, changedFilePatterns).length > 0;
  });
}
async function tagExists(tagStr, cwd) {
  const gitCmd = await spawn__default["default"]("git", ["tag", "-l", tagStr], {
    cwd
  });
  const output = gitCmd.stdout.toString().trim();
  const tagExists = !!output;
  return tagExists;
}
async function getCurrentCommitId({
  cwd,
  short = false
}) {
  return (await spawn__default["default"]("git", ["rev-parse", short && "--short", "HEAD"].filter(Boolean), {
    cwd
  })).stdout.toString().trim();
}
async function remoteTagExists(tagStr) {
  const gitCmd = await spawn__default["default"]("git", ["ls-remote", "--tags", "origin", "-l", tagStr]);
  const output = gitCmd.stdout.toString().trim();
  const tagExists = !!output;
  return tagExists;
}

exports.add = add;
exports.commit = commit;
exports.deepenCloneBy = deepenCloneBy;
exports.getAllTags = getAllTags;
exports.getChangedChangesetFilesSinceRef = getChangedChangesetFilesSinceRef;
exports.getChangedFilesSince = getChangedFilesSince;
exports.getChangedPackagesSinceRef = getChangedPackagesSinceRef;
exports.getCommitsThatAddFiles = getCommitsThatAddFiles;
exports.getCurrentCommitId = getCurrentCommitId;
exports.getDivergedCommit = getDivergedCommit;
exports.isRepoShallow = isRepoShallow;
exports.remoteTagExists = remoteTagExists;
exports.tag = tag;
exports.tagExists = tagExists;
