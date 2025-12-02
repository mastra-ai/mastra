import { defaultConfig } from "@changesets/config";
import * as git from "@changesets/git";
import { shouldSkipPackage } from "@changesets/should-skip-package";
import {
  ChangelogFunctions,
  Config,
  ModCompWithPackage,
  NewChangeset,
  ReleasePlan,
} from "@changesets/types";
import { Packages } from "@manypkg/get-packages";
import detectIndent from "detect-indent";
import fs from "fs-extra";
import path from "path";
import prettier from "prettier";
import resolveFrom from "resolve-from";
import getChangelogEntry from "./get-changelog-entry";
import versionPackage from "./version-package";

function getPrettierInstance(cwd: string): typeof prettier {
  try {
    return require(require.resolve("prettier", { paths: [cwd] }));
  } catch (err) {
    if (!err || (err as any).code !== "MODULE_NOT_FOUND") {
      throw err;
    }
    return prettier;
  }
}

function stringDefined(s: string | undefined): s is string {
  return !!s;
}
async function getCommitsThatAddChangesets(
  changesetIds: string[],
  cwd: string
) {
  const paths = changesetIds.map((id) => `.changeset/${id}.md`);
  const commits = await git.getCommitsThatAddFiles(paths, { cwd });

  if (commits.every(stringDefined)) {
    // We have commits for all files
    return commits;
  }

  // Some files didn't exist. Try legacy filenames instead
  const missingIds = changesetIds
    .map((id, i) => (commits[i] ? undefined : id))
    .filter(stringDefined);

  const legacyPaths = missingIds.map((id) => `.changeset/${id}/changes.json`);
  const commitsForLegacyPaths = await git.getCommitsThatAddFiles(legacyPaths, {
    cwd,
  });

  // Fill in the blanks in the array of commits
  changesetIds.forEach((id, i) => {
    if (!commits[i]) {
      const missingIndex = missingIds.indexOf(id);
      commits[i] = commitsForLegacyPaths[missingIndex];
    }
  });

  return commits;
}

export default async function applyReleasePlan(
  releasePlan: ReleasePlan,
  packages: Packages,
  config: Config = defaultConfig,
  snapshot?: string | boolean,
  contextDir = __dirname
) {
  let cwd = packages.root.dir;

  let touchedFiles = [];

  const packagesByName = new Map(
    packages.packages.map((x) => [x.packageJson.name, x])
  );

  let { releases, changesets } = releasePlan;

  let releasesWithPackage = releases.map((release) => {
    let pkg = packagesByName.get(release.name);
    if (!pkg)
      throw new Error(
        `Could not find matching package for release of: ${release.name}`
      );
    return {
      ...release,
      ...pkg,
    };
  });

  // I think this might be the wrong place to do this, but gotta do it somewhere -  add changelog entries to releases
  let releaseWithChangelogs = await getNewChangelogEntry(
    releasesWithPackage,
    changesets,
    config,
    cwd,
    contextDir
  );

  if (releasePlan.preState !== undefined && snapshot === undefined) {
    if (releasePlan.preState.mode === "exit") {
      await fs.remove(path.join(cwd, ".changeset", "pre.json"));
    } else {
      await fs.writeFile(
        path.join(cwd, ".changeset", "pre.json"),
        JSON.stringify(releasePlan.preState, null, 2) + "\n"
      );
    }
  }

  let versionsToUpdate = releases.map(({ name, newVersion, type }) => ({
    name,
    version: newVersion,
    type,
  }));

  // iterate over releases updating packages
  let finalisedRelease = releaseWithChangelogs.map((release) => {
    return versionPackage(release, versionsToUpdate, {
      updateInternalDependencies: config.updateInternalDependencies,
      onlyUpdatePeerDependentsWhenOutOfRange:
        config.___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH
          .onlyUpdatePeerDependentsWhenOutOfRange,
      bumpVersionsWithWorkspaceProtocolOnly:
        config.bumpVersionsWithWorkspaceProtocolOnly,
      snapshot,
    });
  });

  let prettierInstance =
    config.prettier !== false ? getPrettierInstance(cwd) : undefined;

  for (let release of finalisedRelease) {
    let { changelog, packageJson, dir, name } = release;

    const pkgJSONPath = path.resolve(dir, "package.json");
    await updatePackageJson(pkgJSONPath, packageJson);
    touchedFiles.push(pkgJSONPath);

    if (changelog && changelog.length > 0) {
      const changelogPath = path.resolve(dir, "CHANGELOG.md");
      await updateChangelog(changelogPath, changelog, name, prettierInstance);
      touchedFiles.push(changelogPath);
    }
  }

  if (
    releasePlan.preState === undefined ||
    releasePlan.preState.mode === "exit"
  ) {
    let changesetFolder = path.resolve(cwd, ".changeset");
    await Promise.all(
      changesets.map(async (changeset) => {
        let changesetPath = path.resolve(changesetFolder, `${changeset.id}.md`);
        let changesetFolderPath = path.resolve(changesetFolder, changeset.id);
        if (await fs.pathExists(changesetPath)) {
          // DO NOT remove changeset for skipped packages
          // Mixed changeset that contains both skipped packages and not skipped packages are disallowed
          // At this point, we know there is no such changeset, because otherwise the program would've already failed,
          // so we just check if any skipped package exists in this changeset, and only remove it if none exists
          // options to skip packages were added in v2, so we don't need to do it for v1 changesets
          if (
            !changeset.releases.find((release) =>
              shouldSkipPackage(packagesByName.get(release.name)!, {
                ignore: config.ignore,
                allowPrivatePackages: config.privatePackages.version,
              })
            )
          ) {
            touchedFiles.push(changesetPath);
            await fs.remove(changesetPath);
          }
          // TO REMOVE LOGIC - this works to remove v1 changesets. We should be removed in the future
        } else if (await fs.pathExists(changesetFolderPath)) {
          touchedFiles.push(changesetFolderPath);
          await fs.remove(changesetFolderPath);
        }
      })
    );
  }

  // We return the touched files to be committed in the cli
  return touchedFiles;
}

async function getNewChangelogEntry(
  releasesWithPackage: ModCompWithPackage[],
  changesets: NewChangeset[],
  config: Config,
  cwd: string,
  contextDir: string
) {
  if (!config.changelog) {
    return Promise.resolve(
      releasesWithPackage.map((release) => ({
        ...release,
        changelog: null,
      }))
    );
  }

  let getChangelogFuncs: ChangelogFunctions = {
    getReleaseLine: () => Promise.resolve(""),
    getDependencyReleaseLine: () => Promise.resolve(""),
  };

  const changelogOpts = config.changelog[1];
  let changesetPath = path.join(cwd, ".changeset");
  let changelogPath;

  try {
    changelogPath = resolveFrom(changesetPath, config.changelog[0]);
  } catch {
    changelogPath = resolveFrom(contextDir, config.changelog[0]);
  }

  let possibleChangelogFunc = require(changelogPath);
  if (possibleChangelogFunc.default) {
    possibleChangelogFunc = possibleChangelogFunc.default;
  }
  if (
    typeof possibleChangelogFunc.getReleaseLine === "function" &&
    typeof possibleChangelogFunc.getDependencyReleaseLine === "function"
  ) {
    getChangelogFuncs = possibleChangelogFunc;
  } else {
    throw new Error("Could not resolve changelog generation functions");
  }

  let commits = await getCommitsThatAddChangesets(
    changesets.map((cs) => cs.id),
    cwd
  );
  let moddedChangesets = changesets.map((cs, i) => ({
    ...cs,
    commit: commits[i],
  }));

  return Promise.all(
    releasesWithPackage.map(async (release) => {
      let changelog = await getChangelogEntry(
        release,
        releasesWithPackage,
        moddedChangesets,
        getChangelogFuncs,
        changelogOpts,
        {
          updateInternalDependencies: config.updateInternalDependencies,
          onlyUpdatePeerDependentsWhenOutOfRange:
            config.___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH
              .onlyUpdatePeerDependentsWhenOutOfRange,
        }
      );

      return {
        ...release,
        changelog,
      };
    })
  ).catch((e) => {
    console.error(
      "The following error was encountered while generating changelog entries"
    );
    console.error(
      "We have escaped applying the changesets, and no files should have been affected"
    );
    throw e;
  });
}

async function updateChangelog(
  changelogPath: string,
  changelog: string,
  name: string,
  prettierInstance: typeof prettier | undefined
) {
  let templateString = `\n\n${changelog.trim()}\n`;

  try {
    if (fs.existsSync(changelogPath)) {
      await prependFile(changelogPath, templateString, name, prettierInstance);
    } else {
      await writeFormattedMarkdownFile(
        changelogPath,
        `# ${name}${templateString}`,
        prettierInstance
      );
    }
  } catch (e) {
    console.warn(e);
  }
}

async function updatePackageJson(
  pkgJsonPath: string,
  pkgJson: any
): Promise<void> {
  const pkgRaw = await fs.readFile(pkgJsonPath, "utf-8");
  const indent = detectIndent(pkgRaw).indent || "  ";
  const stringified =
    JSON.stringify(pkgJson, null, indent) + (pkgRaw.endsWith("\n") ? "\n" : "");

  return fs.writeFile(pkgJsonPath, stringified);
}

async function prependFile(
  filePath: string,
  data: string,
  name: string,
  prettierInstance: typeof prettier | undefined
) {
  const fileData = fs.readFileSync(filePath).toString();
  // if the file exists but doesn't have the header, we'll add it in
  if (!fileData) {
    const completelyNewChangelog = `# ${name}${data}`;
    await writeFormattedMarkdownFile(
      filePath,
      completelyNewChangelog,
      prettierInstance
    );
    return;
  }
  const index = fileData.indexOf("\n");
  const newChangelog =
    index === -1
      ? fileData + data // treat the whole file as header
      : fileData.slice(0, index) + data + fileData.slice(index + 1);

  await writeFormattedMarkdownFile(filePath, newChangelog, prettierInstance);
}

async function writeFormattedMarkdownFile(
  filePath: string,
  content: string,
  prettierInstance: typeof prettier | undefined
) {
  await fs.writeFile(
    filePath,
    prettierInstance
      ? // Prettier v3 returns a promise
        await prettierInstance.format(content, {
          ...(await prettierInstance.resolveConfig(filePath)),
          filepath: filePath,
          parser: "markdown",
        })
      : content
  );
}
