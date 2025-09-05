#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import semver from 'semver';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Read the core package version
const corePackageJson = JSON.parse(readFileSync(join(rootDir, 'packages/core/package.json'), 'utf-8'));
const coreVersion = corePackageJson.version;

console.log(`=
 Validating peer dependencies against core version: ${coreVersion}\n`);

// Recursively find all package.json files
function findPackageJsonFiles(dir, basePath = '') {
  const files = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    const relativePath = join(basePath, entry);

    // Skip node_modules, dist, build, and .pnpm directories
    if (entry === 'node_modules' || entry === 'dist' || entry === 'build' || entry === '.pnpm') {
      continue;
    }

    if (stat.isDirectory()) {
      files.push(...findPackageJsonFiles(fullPath, relativePath));
    } else if (entry === 'package.json') {
      files.push(relativePath);
    }
  }

  return files;
}

const packageJsonFiles = findPackageJsonFiles(rootDir);

let hasErrors = false;
const results = [];

for (const packagePath of packageJsonFiles) {
  const fullPath = join(rootDir, packagePath);

  try {
    const packageJson = JSON.parse(readFileSync(fullPath, 'utf-8'));
    const packageName = packageJson.name || relative(rootDir, dirname(fullPath));

    // Skip the core package itself
    if (packageName === '@mastra/core') {
      continue;
    }

    const peerDeps = packageJson.peerDependencies || {};
    const corePeerDep = peerDeps['@mastra/core'];

    if (corePeerDep) {
      // Use semver to properly check if the core version satisfies the peer dependency range
      // Include prerelease option to handle alpha/beta/rc versions correctly
      const isValid = semver.satisfies(coreVersion, corePeerDep, { includePrerelease: true });

      results.push({
        package: packageName,
        path: packagePath,
        currentPeerDep: corePeerDep,
        expected: coreVersion,
        isValid,
      });

      if (!isValid) {
        hasErrors = true;
      }
    }
  } catch (error) {
    console.warn(`�  Could not read ${packagePath}: ${error.message}`);
  }
}

// Display results
if (results.length === 0) {
  console.log(' No packages found with @mastra/core peer dependencies');
} else {
  console.log('=� Peer dependency validation results:\n');

  const validPackages = results.filter(r => r.isValid);
  const invalidPackages = results.filter(r => !r.isValid);

  if (validPackages.length > 0) {
    console.log(' Valid peer dependencies:');
    validPackages.forEach(pkg => {
      console.log(`   ${pkg.package}: ${pkg.currentPeerDep}`);
    });
    console.log();
  }

  if (invalidPackages.length > 0) {
    console.log('L Invalid peer dependencies:');
    invalidPackages.forEach(pkg => {
      console.log(`   ${pkg.package}: ${pkg.currentPeerDep} (expected: ${pkg.expected})`);
      console.log(`      Path: ${pkg.path}`);
    });
    console.log();
  }

  console.log(`=� Summary: ${validPackages.length} valid, ${invalidPackages.length} invalid`);
}

if (hasErrors) {
  console.log('\n=� To fix invalid peer dependencies, update them to match the core version:');
  console.log(`   "@mastra/core": "^${coreVersion}"`);
  process.exit(1);
} else {
  console.log('\n<� All peer dependencies are valid!');
}
