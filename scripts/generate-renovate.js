import { readFile, readdir, writeFile } from 'fs/promises';
import { join } from 'path/posix';

const workspace = await readFile('./pnpm-workspace.yaml', 'utf-8');
// Parse the YAML content manually
// Assuming the workspace YAML is simple with packages array
const packagesMatch = workspace.match(/packages:\s*\n((?:\s*-\s*.+\n?)+)/);
const packages = packagesMatch
  ? packagesMatch[1]
      .split('\n')
      .map(line => {
        const match = line.match(/\s*-\s*(.+)/);
        return match ? match[1].trim().replaceAll('"', '') : null;
      })
      .filter(Boolean)
      .filter(x => !x.startsWith('!'))
  : [];

// find all packages in the workspace
// Flatten the array of package directories
const listOfPackages = [];

for await (const pkg of packages.filter(pkg => !pkg.startsWith('examples/') && !pkg.startsWith('docs/'))) {
  // If the package pattern contains a wildcard, find all matching directories
  if (pkg.includes('*')) {
    // Get the base directory (everything before the first wildcard)
    const baseDir = pkg.split('*')[0];

    try {
      // Read all entries in the base directory
      const entries = await readdir(baseDir, { withFileTypes: true });

      // Filter for directories that match the pattern
      const matchingDirs = entries.filter(entry => entry.isDirectory()).map(entry => join(baseDir, entry.name));
      // .filter(fullPath => regexPattern.test(fullPath));

      listOfPackages.push(...matchingDirs);
    } catch (error) {
      console.error(`Error reading directories for pattern ${pkg}:`, error);
    }
  } else {
    // If no wildcard, add the package path as is
    listOfPackages.push(pkg);
  }
}

const renovateConfig = {
  $schema: 'https://docs.renovatebot.com/renovate-schema.json',
  rangeStrategy: 'bump',
  extends: [
    'config:recommended',
    ':dependencyDashboard',
    ':disableRateLimiting',
    ':maintainLockFilesWeekly',
    ':semanticCommits',
    ':automergeDisabled',
    ':disablePeerDependencies',
  ],
  postUpdateOptions: ['pnpmDedupe'],
  rebaseWhen: 'conflicted',
  major: {
    dependencyDashboardApproval: true,
  },
  ignorePaths: ['docs/**'],
  packageRules: [
    {
      packagePatterns: ['*'],
      enabled: false,
    },
    {
      matchDepTypes: ['engines'],
      enabled: false,
    },
    {
      groupName: 'examples',
      commitMessageTopic: 'examples',
      groupSlug: 'examples-minor',
      matchFileNames: ['examples/**'],
      schedule: 'before 7am on Monday',
      matchUpdateTypes: ['patch', 'minor'],
      enabled: true,
    },
    { matchPackageNames: ['@types/node'], matchUpdateTypes: ['minor', 'patch'], enabled: true },
    {
      groupName: 'AI SDK',
      commitMessageTopic: 'AI SDK',
      matchFileNames: ['+(package.json)', '**/package.json', '!./docs/**'],
      matchPackageNames: ['ai', '/^@ai-sdk\//'],
      matchUpdateTypes: ['major', 'minor', 'patch'],
      matchDepTypes: ['dependencies', 'devDependencies'],
      dependencyDashboardApproval: false,
      enabled: true,
    },
    {
      groupName: 'E2E tests',
      commitMessageTopic: 'e2e-tests',
      matchFileNames: ['e2e-tests/**/package.json'],
      matchDepTypes: ['dependencies', 'devDependencies'],
      dependencyDashboardApproval: false,
      enabled: true,
    },
    {
      groupName: 'typescript',
      matchFileNames: ['+(package.json)', '**/package.json', '!./examples/**', '!./docs/**'],
      matchPackageNames: ['typescript', '/^@typescript-eslint\//'],
      matchUpdateTypes: ['major', 'minor', 'patch'],
      matchDepTypes: ['dependencies', 'devDependencies'],
      dependencyDashboardApproval: false,
      enabled: true,
    },
    {
      groupName: 'formatting & linting',
      commitMessageTopic: 'Formatting & linting',
      matchFileNames: ['+(package.json)', '**/package.json'],
      matchPackageNames: ['eslint', 'prettier', '/^eslint-/'],
      excludePackageNames: ['@typescript-eslint/'],
      matchUpdateTypes: ['major', 'minor', 'patch'],
      matchDepTypes: ['dependencies', 'devDependencies'],
      dependencyDashboardApproval: false,
      enabled: true,
    },
    {
      groupName: 'Build tools',
      commitMessageTopic: 'Build tools',
      matchFileNames: ['+(package.json)', '**/package.json'],
      matchUpdateTypes: ['major', 'minor', 'patch'],
      matchDepTypes: ['devDependencies'],
      matchPackageNames: ['@microsoft/api-extractor', 'tsup', 'rollup'],
      enabled: true,
    },
  ],
};

const excludedPackages = renovateConfig.packageRules
  .map(rule => rule.matchPackageNames)
  .flat()
  .filter(Boolean);

excludedPackages.push('vitest');

// renovateConfig.packageRules.unshift({
//   matchPackageNames: Array.from(new Set(excludedPackages)),
//   enabled: false,
// });

for (const pkg of listOfPackages) {
  const packageJsonPath = `${pkg}/package.json`;
  try {
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
    let packageName = packageJson.name || pkg;
    if (packageName.startsWith('@mastra/')) {
      packageName = `Mastra ${packageName.replace('@mastra/', '')}`;
    }

    renovateConfig.packageRules.push({
      groupName: packageName,
      commitMessageTopic: `${packageName}`,
      matchFileNames: [`${pkg}/*/package.json`],
      matchUpdateTypes: ['minor', 'patch'],
      matchDepTypes: ['dependencies', 'devDependencies'],
      enabled: true,
    });

    renovateConfig.packageRules.push({
      groupName: `major-${packageName}`,
      commitMessageTopic: `${packageName}`,
      matchFileNames: [`${pkg}/package.json`],
      matchUpdateTypes: ['major'],
      matchDepTypes: ['dependencies', 'devDependencies'],
      enabled: true,
    });
  } catch (error) {
    console.warn(`Could not read package.json for ${pkg}, using directory name instead`);
    renovateConfig.packageRules.push({
      groupName: pkg,
      commitMessageTopic: `${pkg}`,
      matchFileNames: [`${pkg}/package.json`],
      matchUpdateTypes: ['minor', 'patch'],
      matchDepTypes: ['dependencies', 'devDependencies'],
      enabled: true,
    });

    renovateConfig.packageRules.push({
      groupName: `major-${pkg}`,
      commitMessageTopic: `${pkg}`,
      matchFileNames: [`${pkg}/package.json`],
      matchUpdateTypes: ['major'],
      matchDepTypes: ['dependencies', 'devDependencies'],
      enabled: true,
    });
  }
}

await writeFile('./renovate.json', JSON.stringify(renovateConfig, null, 2));
