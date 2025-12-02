const getReleaseLine = async (changeset, _type) => {
  const [firstLine, ...futureLines] = changeset.summary.split("\n").map(l => l.trimRight());
  let returnVal = `- ${changeset.commit ? `${changeset.commit.slice(0, 7)}: ` : ""}${firstLine}`;

  if (futureLines.length > 0) {
    returnVal += `\n${futureLines.map(l => `  ${l}`).join("\n")}`;
  }

  return returnVal;
};

const getDependencyReleaseLine = async (changesets, dependenciesUpdated) => {
  if (dependenciesUpdated.length === 0) return "";
  const changesetLinks = changesets.map(changeset => `- Updated dependencies${changeset.commit ? ` [${changeset.commit.slice(0, 7)}]` : ""}`);
  const updatedDependenciesList = dependenciesUpdated.map(dependency => `  - ${dependency.name}@${dependency.newVersion}`);
  return [...changesetLinks, ...updatedDependenciesList].join("\n");
};

const defaultChangelogFunctions = {
  getReleaseLine,
  getDependencyReleaseLine
};

export { defaultChangelogFunctions as default };
