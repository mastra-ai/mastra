/* eslint-disable import/no-extraneous-dependencies */
import startCase from "lodash.startcase";
import { getCommitsThatAddFiles } from "@changesets/git";
import { ComprehensiveRelease, NewChangeset } from "@changesets/types";

import { RelevantChangesets } from "../types";

async function getReleaseLine(changeset: NewChangeset, cwd: string) {
  const [firstLine, ...futureLines] = changeset.summary
    .split("\n")
    .map((l) => l.trimRight());

  const [commitThatAddsFile] = await getCommitsThatAddFiles(
    [`.changeset/${changeset.id}.md`],
    { cwd }
  );

  return `- [${commitThatAddsFile}] ${firstLine}\n${futureLines
    .map((l) => `  ${l}`)
    .join("\n")}`;
}

async function getReleaseLines(
  obj: RelevantChangesets,
  type: keyof RelevantChangesets,
  cwd: string
) {
  const releaseLines = obj[type].map((changeset) =>
    getReleaseLine(changeset, cwd)
  );
  if (!releaseLines.length) return "";
  const resolvedLines = await Promise.all(releaseLines);

  return `### ${startCase(type)} Changes\n\n${resolvedLines.join("")}`;
}

export default async function defaultChangelogGetter(
  release: ComprehensiveRelease,
  relevantChangesets: RelevantChangesets,
  options: { cwd: string }
) {
  let { cwd } = options;

  // First, we construct the release lines, summaries of changesets that caused us to be released
  let majorReleaseLines = await getReleaseLines(
    relevantChangesets,
    "major",
    cwd
  );
  let minorReleaseLines = await getReleaseLines(
    relevantChangesets,
    "minor",
    cwd
  );
  let patchReleaseLines = await getReleaseLines(
    relevantChangesets,
    "patch",
    cwd
  );

  return [
    `## ${release.newVersion}`,
    majorReleaseLines,
    minorReleaseLines,
    patchReleaseLines,
  ]
    .filter((line) => line)
    .join("\n");
}
