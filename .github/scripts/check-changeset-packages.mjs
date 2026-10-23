import { createRequire } from 'node:module';

// Use the CLI's own parsers and workspace discovery so ignore glob semantics stay in sync.
const require = createRequire(import.meta.url);
const requireChangesets = createRequire(require.resolve('@changesets/cli/package.json'));
const { getPackages } = requireChangesets('@manypkg/get-packages');
const { read: readConfig } = requireChangesets('@changesets/config');
const { default: readChangesets } = requireChangesets('@changesets/read');

const cwd = process.cwd();
const packages = await getPackages(cwd);
const config = await readConfig(cwd, packages);
const changesets = await readChangesets(cwd);
const packageNames = new Set(packages.packages.map(pkg => pkg.packageJson.name));
const ignored = new Set(config.ignore);
const errors = [];

for (const changeset of changesets) {
  for (const release of changeset.releases) {
    if (!packageNames.has(release.name)) {
      errors.push(`.changeset/${changeset.id}.md: unknown workspace package "${release.name}".`);
    } else if (ignored.has(release.name)) {
      errors.push(
        `.changeset/${changeset.id}.md: package "${release.name}" is ignored by Changesets. Remove it from the changeset; delete the file if no release entries remain.`,
      );
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('All changeset packages exist and are not ignored.');
}
