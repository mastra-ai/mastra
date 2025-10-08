#!/usr/bin/env node

import { writeFile } from 'fs/promises';
import path, { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { getCommitsThatAddFiles } from '@changesets/git';
import getChangesets from '@changesets/read';
import * as p from '@clack/prompts';
import mri from 'mri';
import { rootDir } from './config';
import { getCommitUrl, getPullRequestNumber, getPullRequestUrl } from './git/getRepository';
import { getShortSha } from './git/getShortSha';
import { getReleasePlan } from './versions/getNewVersionForPackage';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function onCancel(message = 'Interrupted...'): never {
  p.cancel(message);
  process.exit(0);
}

function parseArguments(args: string[]): { path: string } {
  const parsedArgs = mri<{
    path: string;
  }>(args, {
    default: {
      path: '',
    },

    string: ['path'],
  });

  return {
    path: parsedArgs.path,
  };
}

function getCommitLink(commit: string) {
  const pullRequestNumber = getPullRequestNumber(commit);

  if (pullRequestNumber) {
    return `[#${pullRequestNumber}](${getPullRequestUrl(pullRequestNumber)})`;
  } else {
    return `[${getShortSha(commit)}](${getCommitUrl(commit)})`;
  }
}

async function main() {
  p.intro('Mastra release summary');

  const parsedArgs = parseArguments(process.argv.slice(2));
  let path: string = parsedArgs.path;
  if (!path) {
    const pathResult = await p.text({
      message: 'Path to the release summary',
      initialValue: './summary.md',
    });
    path = pathResult.toString();
  }

  const sChangesets = p.spinner();
  sChangesets.start('Getting changesets');
  const changesets = await getChangesets(rootDir);
  const releasePlan = await getReleasePlan(changesets);
  if (!releasePlan) {
    throw new Error('Release plan not found');
  }

  const changesetsByPkg = new Map<
    string,
    {
      summary: string;
      commit: string | undefined;
    }[]
  >();

  const allChangesetIds = releasePlan.changesets.map(changeset => changeset.id) || [];
  const commits = await getCommitsThatAddFiles(
    allChangesetIds.map(id => `.changeset/${id}.md`),
    { cwd: rootDir },
  );
  const commitsByChangesetId = new Map<string, string | undefined>();
  let i = 0;
  for (const commit of commits) {
    commitsByChangesetId.set(releasePlan.changesets[i++]!.id!, commit);
  }

  for (const changeset of releasePlan.changesets) {
    for (const release of changeset.releases) {
      const currentChangesets = changesetsByPkg.get(release.name) || [];
      currentChangesets.push({
        summary: changeset.summary,
        commit: commitsByChangesetId.get(changeset.id),
      });
      changesetsByPkg.set(release.name, currentChangesets);
    }
  }
  sChangesets.stop('Changesets fetched');

  const sSummary = p.spinner();
  sSummary.start('Creating summary');
  const orderedPackages = Array.from(changesetsByPkg.keys()).sort((a, b) => a.localeCompare(b));

  const summary = orderedPackages
    .map(pkg => {
      const changesets = changesetsByPkg.get(pkg) || [];
      return (
        `## ${pkg}\n` +
        `${changesets
          .map(changeset => {
            let postfix = '';
            if (changeset.commit) {
              const link = getCommitLink(changeset.commit);

              postfix = ` (${link})`;
            }
            return `- ${changeset.summary.replaceAll('\n\n', '\n\n\t')}${postfix}`;
          })
          .join('\n')}`
      );
    })
    .join('\n\n');

  const fullPath = join(__dirname, path);
  await writeFile(join(__dirname, path), summary);
  sSummary.stop('Creating summary');

  p.outro(`Summary created successfully in ${relative(rootDir, fullPath)}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
