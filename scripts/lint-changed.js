#!/usr/bin/env node

import { execSync } from 'child_process';

// Get changed files
const changedFiles = execSync('pnpm --silent list-changed-files', { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(file => file.trim() !== '');

// Filter for JS/TS files and extract package directories
const jsTsFiles = changedFiles.filter(file => /\.(js|mjs|ts|tsx)$/.test(file));

// Extract unique package directories
const packages = [
  ...new Set(
    jsTsFiles
      .map(file => {
        // Match package directory pattern: packages/name, auth/name, stores/name, etc.
        const match = file.match(
          /^(packages|auth|stores|client-sdks|deployers|voice|observability|workflows|pubsub)\/[^/]+/,
        );
        return match ? match[0] : null;
      })
      .filter(Boolean),
  ),
];

// Skip examples and docs
const filteredPackages = packages.filter(pkg => !pkg.includes('examples') && !pkg.includes('docs'));

if (filteredPackages.length > 0) {
  console.log(`Running lint with --fix on: ${filteredPackages.join(', ')}`);

  // Build turbo filter command - use ./ prefix for directory-based filtering
  const filterArgs = filteredPackages.map(pkg => `--filter "./${pkg}"`).join(' ');
  const command = `pnpm turbo ${filterArgs} lint -- --fix`;

  execSync(command, { stdio: 'inherit' });
} else {
  console.log('No changed JS/TS files to lint');
}
