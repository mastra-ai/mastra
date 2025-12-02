import yaml from 'js-yaml';

const mdRegex = /\s*---([^]*?)\n\s*---(\s*(?:\n|$)[^]*)/;
function parseChangesetFile(contents) {
  const execResult = mdRegex.exec(contents);

  if (!execResult) {
    throw new Error(`could not parse changeset - invalid frontmatter: ${contents}`);
  }

  let [, roughReleases, roughSummary] = execResult;
  let summary = roughSummary.trim();
  let releases;

  try {
    const yamlStuff = yaml.safeLoad(roughReleases);

    if (yamlStuff) {
      releases = Object.entries(yamlStuff).map(([name, type]) => ({
        name,
        type
      }));
    } else {
      releases = [];
    }
  } catch (e) {
    throw new Error(`could not parse changeset - invalid frontmatter: ${contents}`);
  }

  if (!releases) {
    throw new Error(`could not parse changeset - unknown error: ${contents}`);
  }

  return {
    releases,
    summary
  };
}

export { parseChangesetFile as default };
