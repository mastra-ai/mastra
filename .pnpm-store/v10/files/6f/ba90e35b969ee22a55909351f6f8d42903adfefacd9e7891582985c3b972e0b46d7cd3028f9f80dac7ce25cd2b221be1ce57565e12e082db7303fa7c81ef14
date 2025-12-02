import {
  NewChangesetWithCommit,
  VersionType,
  ChangelogFunctions,
  ModCompWithPackage,
} from "@changesets/types";

const getReleaseLine = async (
  changeset: NewChangesetWithCommit,
  _type: VersionType
) => {
  const [firstLine, ...futureLines] = changeset.summary
    .split("\n")
    .map((l) => l.trimRight());

  let returnVal = `- ${
    changeset.commit ? `${changeset.commit.slice(0, 7)}: ` : ""
  }${firstLine}`;

  if (futureLines.length > 0) {
    returnVal += `\n${futureLines.map((l) => `  ${l}`).join("\n")}`;
  }

  return returnVal;
};

const getDependencyReleaseLine = async (
  changesets: NewChangesetWithCommit[],
  dependenciesUpdated: ModCompWithPackage[]
) => {
  if (dependenciesUpdated.length === 0) return "";

  const changesetLinks = changesets.map(
    (changeset) =>
      `- Updated dependencies${
        changeset.commit ? ` [${changeset.commit.slice(0, 7)}]` : ""
      }`
  );

  const updatedDependenciesList = dependenciesUpdated.map(
    (dependency) => `  - ${dependency.name}@${dependency.newVersion}`
  );

  return [...changesetLinks, ...updatedDependenciesList].join("\n");
};

const defaultChangelogFunctions: ChangelogFunctions = {
  getReleaseLine,
  getDependencyReleaseLine,
};

export default defaultChangelogFunctions;
