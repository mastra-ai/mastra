#!/usr/bin/env node

import * as p from '@clack/prompts';
import mri from 'mri';
import color from 'picocolors';
import { createCustomChangeset } from './changeset/createCustomChangeset.js';
import { getChangesetMessage } from './changeset/getChangesetMessage.js';
import { getVersionBumps } from './changeset/getVersionBumps.js';
import { getChangedPackages } from './git/getChangedPackages.js';
import type { CliArgs, VersionBumps, UpdatedPeerDependencies, ChangedPackage } from './types.js';
import { getSummary } from './ui/getSummary.js';
import { getDefaultUpdatedPeerDependencies, updatePeerDependencies } from './versions/updatePeerDependencies.js';

function onCancel(message = 'Interrupted...'): never {
  p.cancel(message);
  process.exit(0);
}

function nonEmptyArray(arr: string[]): boolean {
  return arr.filter(Boolean).length > 0;
}

function parseArguments(args: string[]): CliArgs {
  const parsedArgs = mri<{
    message: string;
    skipPrompt: boolean;
    major: string | string[];
    minor: string | string[];
    patch: string | string[];
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

  const ensureArray = (value: string | string[]): string[] => {
    return ([] as string[]).concat(value);
  };

  return {
    message: parsedArgs.message,
    skipPrompt: parsedArgs.skipPrompt,
    major: ensureArray(parsedArgs.major),
    minor: ensureArray(parsedArgs.minor),
    patch: ensureArray(parsedArgs.patch),
  };
}

async function detectChangedPackages(): Promise<ChangedPackage[]> {
  const s = p.spinner();
  s.start('Finding changed packages');

  const changedPackages = await getChangedPackages();

  s.stop(
    `Found ${changedPackages.length} changed package(s): ${color.dim(changedPackages.map(pkg => pkg.name).join(', '))}`,
  );

  return changedPackages;
}

function prepareVersionBumpInputs(changedPackages: ChangedPackage[], parsedArgs: CliArgs) {
  return {
    major: parsedArgs.major,
    minor: parsedArgs.minor.filter(pkg => !parsedArgs.major.includes(pkg)),
    patch: Array.from(new Set(changedPackages.map(pkg => pkg.name).concat(parsedArgs.patch))).filter(
      pkg => !parsedArgs.major.includes(pkg) && !parsedArgs.minor.includes(pkg),
    ),
  };
}

async function createChangesetWithMessage(
  versionBumps: VersionBumps,
  message: string | undefined,
  skipPrompt: boolean,
  onCancel: (message?: string) => never,
): Promise<string> {
  let finalMessage = message;

  if (!finalMessage && !skipPrompt) {
    finalMessage = await getChangesetMessage(versionBumps, onCancel);
  }

  if (!finalMessage) {
    p.log.error('No changeset message provided');
    process.exit(1);
  }

  const s = p.spinner();
  s.start('Creating changeset');
  const changesetId = await createCustomChangeset(versionBumps, finalMessage);
  s.stop(`Created changeset: ${changesetId}`);

  return changesetId;
}

function displaySummary(versionBumps: VersionBumps, updatedPeerDeps: UpdatedPeerDependencies): void {
  const updatedPackagesList = Object.entries(versionBumps).map(([pkg, bump]) => `${pkg}: ${bump}`);

  const summaryOutput = getSummary(updatedPackagesList, updatedPeerDeps);
  p.note(summaryOutput, 'Summary');
}

async function main() {
  p.intro('Mastra Changesets');

  const parsedArgs = parseArguments(process.argv.slice(2));

  try {
    // Detect changed packages
    const changedPackages = await detectChangedPackages();

    // No changes detected, exit early
    if (changedPackages.length === 0) {
      p.outro('No changed packages detected. Exiting.');
      process.exit(0);
    }

    // Error early if --skipPrompt is used but no --major, --minor, or --patch flags are provided
    if (parsedArgs.skipPrompt) {
      const hasVersionBumps =
        nonEmptyArray(parsedArgs.major) || nonEmptyArray(parsedArgs.minor) || nonEmptyArray(parsedArgs.patch);

      if (!hasVersionBumps) {
        p.cancel(`Please provide at least one of --major, --minor, or --patch flags when using --skipPrompt.`);
        process.exit(1);
      }
    }

    // Prepare version bump inputs
    const versionBumpInputs = prepareVersionBumpInputs(changedPackages, parsedArgs);

    // Get version bumps from user
    const versionBumps = await getVersionBumps(versionBumpInputs, onCancel, parsedArgs.skipPrompt);

    // Initialize peer dependency tracking
    let updatedPeerDeps: UpdatedPeerDependencies = getDefaultUpdatedPeerDependencies();

    // Process changesets if there are version bumps
    if (Object.keys(versionBumps).length > 0) {
      await createChangesetWithMessage(versionBumps, parsedArgs.message, parsedArgs.skipPrompt, onCancel);

      // Handle peer dependencies updates
      updatedPeerDeps = await updatePeerDependencies(versionBumps);
    }

    // Display summary
    displaySummary(versionBumps, updatedPeerDeps);

    p.outro('✨ Changeset process completed successfully!');
  } catch (error) {
    if (error instanceof Error) {
      p.cancel(`Unexpected error: ${error.message}`);
      if (error.stack) {
        p.log.error(error.stack);
      }
    } else {
      p.cancel('An unknown error occurred');
    }
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
