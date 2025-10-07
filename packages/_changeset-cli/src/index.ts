#!/usr/bin/env node

import * as p from '@clack/prompts';
import mri from 'mri';
import color from 'picocolors';
import { createCustomChangeset } from './changeset/createCustomChangeset.js';
import { getChangesetMessage } from './changeset/getChangesetMessage.js';
import { getVersionBumps } from './changeset/getVersionBumps.js';
import { getChangedPackages } from './git/getChangedPackages.js';
import { getSummary } from './ui/getSummary.js';
import { getDefaultUpdatedPeerDependencies, updatePeerDependencies } from './versions/updatePeerDependencies.js';

function onCancel(message = 'Interrupted...'): never {
  p.cancel(message);
  process.exit(0);
}

async function main() {
  p.intro('Mastra Changesets');

  const args = process.argv.slice(2);
  const parsedArgs = mri<{
    message: string;
    skipPrompt: boolean;
    major: string[];
    minor: string[];
    patch: string[];
  }>(args, {
    alias: {
      message: 'm',
      skipPrompt: 's',
    },
    default: {
      skipPrompt: false,
      message: '',
      major: [],
      minor: [],
      patch: [],
    },
    boolean: ['skipPrompt'],
    string: ['message', 'major', 'minor', 'patch'],
  });
  parsedArgs.patch = ([] as string[]).concat(parsedArgs.patch);
  parsedArgs.minor = ([] as string[]).concat(parsedArgs.minor);
  parsedArgs.major = ([] as string[]).concat(parsedArgs.major);

  const skipPrompt: boolean = parsedArgs.skipPrompt;
  let message: string = parsedArgs.message;

  try {
    const s = p.spinner();
    s.start('Finding changed packages');
    const changedPackages = await getChangedPackages();
    s.stop(
      `Found ${changedPackages.length} changed package(s): ${color.dim(changedPackages.map(pkg => `${pkg.name}`).join(', '))}`,
    );

    let versionBumps = await getVersionBumps(
      {
        major: parsedArgs.major,
        minor: parsedArgs.minor.filter(pkg => !parsedArgs.major.includes(pkg)),
        patch: ([] as string[])
          .concat(changedPackages.map(pkg => pkg.name))
          .filter(pkg => !parsedArgs.major.includes(pkg) && !parsedArgs.minor.includes(pkg)),
      },
      onCancel,
      skipPrompt,
    );
    let updatedPeerDeps = getDefaultUpdatedPeerDependencies();
    // Open external editor for changeset message if there are version bumps
    if (versionBumps && Object.keys(versionBumps).length > 0) {
      if (!message) {
        message = await getChangesetMessage(versionBumps, onCancel);
      }

      // Create a changeset with the user's message
      const s = p.spinner();
      s.start('Creating changeset');
      const changesetId = await createCustomChangeset(versionBumps, message);
      s.stop(`Created changeset: ${changesetId}`);

      // Handle peer dependencies updates
      updatedPeerDeps = await updatePeerDependencies(versionBumps);
    }

    const updatedPackagesList = Object.entries(versionBumps).map(([pkg, bump]) => `${pkg}: ${bump}`);

    const summaryOutput = getSummary(updatedPackagesList, updatedPeerDeps);
    p.note(summaryOutput, 'Summary');

    p.outro('✨ Changeset process completed successfully!');
  } catch (error: any) {
    p.cancel(`Error: ${error.message}`);
    process.exit(1);
  }
}

main().catch(console.error);
