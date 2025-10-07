import * as p from '@clack/prompts';
import color from 'picocolors';
import { getPublicPackages } from '../pkg/getPublicPackages.js';
import type { VersionBumps } from './getChangesetMessage.js';

function getAvailablePackagesForBump(
  packages: string[],
  major: string[] | undefined,
  minor: string[] | undefined,
): string[] {
  const majorArray = Array.isArray(major) ? major : [];
  const minorArray = Array.isArray(minor) ? minor : [];
  return packages.filter(pkg => !majorArray.includes(pkg) && !minorArray.includes(pkg));
}

async function promptForVersionBumps({
  preSelectedPackages,
  onCancel,
}: {
  preSelectedPackages: {
    major: string[];
    minor: string[];
    patch: string[];
  };
  onCancel: (message?: string) => never;
}): Promise<any> {
  const allPackages = await getPublicPackages();

  const changedPackages = Array.from(
    new Set([...preSelectedPackages.major, ...preSelectedPackages.minor, ...preSelectedPackages.patch]),
  );
  const unchangedPackages = allPackages.filter(pkg => !changedPackages.includes(pkg.packageJson.name));
  return await p.group(
    {
      packages: () => {
        return p.autocompleteMultiselect({
          message: 'Which packages would you like to include?',
          options: [
            ...changedPackages.map(pkg => ({ value: pkg, label: pkg, hint: 'changed' })),
            ...unchangedPackages.map(pkg => ({ value: pkg.packageJson.name, label: pkg.packageJson.name })),
          ],
          placeholder: 'Type to search...',
          maxItems: 20,
          required: true,
          initialValues: changedPackages,
        });
      },
      major: ({ results }: any) => {
        const packages = (results.packages ?? []) as string[];
        return p.multiselect({
          message: `Which packages should have a ${color.red('major')} bump?`,
          options: packages.map((value: string) => ({ value })),
          initialValues: preSelectedPackages.major.filter(pkg => packages.includes(pkg)),
          required: false,
        });
      },
      minor: ({ results }: any) => {
        const packages = (results.packages ?? []) as string[];
        const possiblePackages = getAvailablePackagesForBump(packages, results.major as string[] | undefined, []);

        if (possiblePackages.length === 0) {
          return;
        }

        return p.multiselect({
          message: `Which packages should have a ${color.yellow('minor')} bump?`,
          options: possiblePackages.map(value => ({ value })),
          initialValues: preSelectedPackages.minor.filter(pkg => packages.includes(pkg)),
          required: false,
        });
      },
      patch: async ({ results }: any) => {
        const packages = (results.packages ?? []) as string[];
        const possiblePackages = getAvailablePackagesForBump(
          packages,
          results.major as string[] | undefined,
          results.minor as string[] | undefined,
        );

        if (possiblePackages.length === 0) {
          return;
        }
        const note = possiblePackages.join(',');

        p.log.step(`These packages will have a ${color.green('patch')} bump.\n${color.dim(note)}`);
        return possiblePackages;
      },
    },
    {
      onCancel: () => {
        onCancel('Version selection cancelled.');
        return;
      },
    },
  );
}

export async function getVersionBumps(
  {
    major,
    minor,
    patch,
  }: {
    major: string[];
    minor: string[];
    patch: string[];
  },
  onCancel: (message?: string) => never,
  skipPrompt: boolean,
): Promise<VersionBumps> {
  let versionBumps: VersionBumps = {};

  const publicPackages = await getPublicPackages();
  const packagesByName = new Set(publicPackages.map(pkg => pkg.packageJson.name));

  const preSelectedPackages = {
    major: major.filter(pkg => packagesByName.has(pkg)),
    minor: minor.filter(pkg => packagesByName.has(pkg)),
    patch: patch.filter(pkg => packagesByName.has(pkg)),
  };

  if (skipPrompt) {
    for (const [bumpType, values] of Object.entries(preSelectedPackages)) {
      values.forEach((pkg: string) => {
        versionBumps[pkg] = bumpType as 'major' | 'minor' | 'patch';
      });
    }
  } else {
    const bumpSelections = await promptForVersionBumps({ preSelectedPackages, onCancel });

    // Transform the selections into a versionBumps object
    if (bumpSelections) {
      // Add major bumps
      if (bumpSelections.major && Array.isArray(bumpSelections.major)) {
        bumpSelections.major.forEach((pkg: string) => {
          versionBumps[pkg] = 'major';
        });
      }

      // Add minor bumps
      if (bumpSelections.minor && Array.isArray(bumpSelections.minor)) {
        bumpSelections.minor.forEach((pkg: string) => {
          versionBumps[pkg] = 'minor';
        });
      }

      // Add patch bumps
      if (bumpSelections.patch && Array.isArray(bumpSelections.patch)) {
        bumpSelections.patch.forEach((pkg: string) => {
          versionBumps[pkg] = 'patch';
        });
      }
    }
  }

  return versionBumps;
}
