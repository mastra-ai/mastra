import * as p from '@clack/prompts';
import color from 'picocolors';
import { getPublicPackages } from '../pkg/getPublicPackages.js';
import type { VersionBumps, PreSelectedPackages, BumpType } from '../types.js';

function getAvailablePackagesForBump(packages: string[], major: string[] = [], minor: string[] = []): string[] {
  return packages.filter(pkg => !major.includes(pkg) && !minor.includes(pkg));
}

async function promptForVersionBumps({
  preSelectedPackages,
  onCancel,
}: {
  preSelectedPackages: PreSelectedPackages;
  onCancel: (message?: string) => never;
}): Promise<PreSelectedPackages> {
  const allPackages = await getPublicPackages();

  const changedPackages = Array.from(
    new Set([...preSelectedPackages.major, ...preSelectedPackages.minor, ...preSelectedPackages.patch]),
  );
  const unchangedPackages = allPackages.filter(pkg => !changedPackages.includes(pkg.packageJson.name));

  const result = await p.group(
    {
      packages: () => {
        return p.autocompleteMultiselect({
          message: `Which packages would you like to include? ${color.dim('(use arrow keys / space bar)')}`,
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
      major: ({ results }): Promise<string[]> => {
        const packages = (results.packages ?? []) as string[];
        return p.multiselect({
          message: `Which packages should have a ${color.red('major')} bump? ${color.dim('(use arrow keys / space bar)')}`,
          options: packages.map((value: string) => ({ value })),
          initialValues: preSelectedPackages.major.filter(pkg => packages.includes(pkg)),
          required: false,
        }) as Promise<string[]>;
      },
      minor: ({ results }): Promise<string[]> => {
        const packages = (results.packages ?? []) as string[];
        const possiblePackages = getAvailablePackagesForBump(packages, results.major as string[] | undefined);

        if (possiblePackages.length === 0) {
          return Promise.resolve([] as string[]);
        }

        return p.multiselect({
          message: `Which packages should have a ${color.yellow('minor')} bump? ${color.dim('(use arrow keys / space bar)')}`,
          options: possiblePackages.map(value => ({ value })),
          initialValues: preSelectedPackages.minor.filter(pkg => packages.includes(pkg)),
          required: false,
        }) as Promise<string[]>;
      },
      patch: async ({ results }): Promise<string[]> => {
        const packages = (results.packages ?? []) as string[];
        const possiblePackages = getAvailablePackagesForBump(
          packages,
          results.major as string[] | undefined,
          results.minor as string[] | undefined,
        );

        if (possiblePackages.length === 0) {
          return Promise.resolve([] as string[]);
        }
        const note = possiblePackages.join(',');

        p.log.step(`These packages will have a ${color.green('patch')} bump.\n${color.dim(note)}`);
        return possiblePackages;
      },
    },
    {
      onCancel: () => {
        return void onCancel('Version selection cancelled.');
      },
    },
  );

  return result as PreSelectedPackages;
}

function processBumpSelections(bumpSelections: PreSelectedPackages, versionBumps: VersionBumps): VersionBumps {
  const bumpTypes = ['major', 'minor', 'patch'] as const;

  bumpTypes.forEach(bumpType => {
    const packages = bumpSelections[bumpType];
    if (Array.isArray(packages)) {
      packages.forEach(pkg => {
        versionBumps[pkg] = bumpType as BumpType;
      });
    }
  });

  return versionBumps;
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

  const preSelectedPackages: PreSelectedPackages = {
    major: major.filter(pkg => packagesByName.has(pkg)),
    minor: minor.filter(pkg => packagesByName.has(pkg)),
    patch: patch.filter(pkg => packagesByName.has(pkg)),
  };

  if (skipPrompt) {
    versionBumps = processBumpSelections(preSelectedPackages, versionBumps);
  } else {
    const bumpSelections = await promptForVersionBumps({ preSelectedPackages, onCancel });

    if (bumpSelections) {
      versionBumps = processBumpSelections(bumpSelections, versionBumps);
    }
  }

  return versionBumps;
}
