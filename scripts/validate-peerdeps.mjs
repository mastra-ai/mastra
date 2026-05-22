#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import semver from 'semver';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const corePackageJson = JSON.parse(readFileSync(join(rootDir, 'packages/core/package.json'), 'utf-8'));
const coreVersion = corePackageJson.version;

console.log(`Validating peer dependencies against core version: ${coreVersion}\n`);

function findPackageJsonFiles(dir, basePath = '') {
  const files = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    const relativePath = join(basePath, entry);

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

function readPackageInfo(packagePath) {
  const fullPath = join(rootDir, packagePath);
  const packageJson = JSON.parse(readFileSync(fullPath, 'utf-8'));

  return {
    json: packageJson,
    name: packageJson.name || relative(rootDir, dirname(fullPath)),
    path: packagePath,
  };
}

function getCorePeerDep(packageJson) {
  return packageJson.peerDependencies?.['@mastra/core'];
}

function getRuntimeWorkspaceDeps(packageJson) {
  return {
    ...(packageJson.dependencies || {}),
    ...(packageJson.optionalDependencies || {}),
  };
}

function coreRangeSubset(range, requiredRange) {
  try {
    return semver.subset(range, requiredRange, { includePrerelease: true });
  } catch {
    return false;
  }
}

const packageJsonFiles = findPackageJsonFiles(rootDir);
const packages = [];
const packageByName = new Map();
const readErrors = [];
let hasErrors = false;

for (const packagePath of packageJsonFiles) {
  try {
    const packageInfo = readPackageInfo(packagePath);
    packages.push(packageInfo);

    if (packageInfo.json.name) {
      packageByName.set(packageInfo.json.name, packageInfo);
    }
  } catch (error) {
    readErrors.push({ path: packagePath, message: error.message });
    hasErrors = true;
  }
}

const versionResults = [];
const propagatedPeerErrors = [];

for (const packageInfo of packages) {
  if (packageInfo.name === '@mastra/core') {
    continue;
  }

  const corePeerDep = getCorePeerDep(packageInfo.json);

  if (corePeerDep) {
    const isValid = semver.satisfies(coreVersion, corePeerDep, { includePrerelease: true });

    versionResults.push({
      package: packageInfo.name,
      path: packageInfo.path,
      currentPeerDep: corePeerDep,
      expected: coreVersion,
      isValid,
    });

    if (!isValid) {
      hasErrors = true;
    }
  }

  const runtimeWorkspaceDeps = getRuntimeWorkspaceDeps(packageInfo.json);

  for (const dependencyName of Object.keys(runtimeWorkspaceDeps)) {
    const dependencyPackage = packageByName.get(dependencyName);
    const dependencyCorePeerDep = dependencyPackage ? getCorePeerDep(dependencyPackage.json) : undefined;

    if (!dependencyCorePeerDep) {
      continue;
    }

    const corePeerDepFallsBelowDependency = corePeerDep && !coreRangeSubset(corePeerDep, dependencyCorePeerDep);

    if (corePeerDepFallsBelowDependency) {
      propagatedPeerErrors.push({
        package: packageInfo.name,
        path: packageInfo.path,
        dependency: dependencyName,
        dependencyPath: dependencyPackage.path,
        dependencyCorePeerDep,
        currentPeerDep: corePeerDep,
      });
      hasErrors = true;
    }
  }
}

if (readErrors.length > 0) {
  console.log('Could not read some package.json files:');
  readErrors.forEach(error => {
    console.log(`   ${error.path}: ${error.message}`);
  });
  console.log();
}

if (versionResults.length === 0) {
  console.log('No packages found with @mastra/core peer dependencies');
} else {
  console.log('Peer dependency validation results:\n');

  const validPackages = versionResults.filter(r => r.isValid);
  const invalidPackages = versionResults.filter(r => !r.isValid);

  if (validPackages.length > 0) {
    console.log('Valid peer dependencies:');
    validPackages.forEach(pkg => {
      console.log(`   ${pkg.package}: ${pkg.currentPeerDep}`);
    });
    console.log();
  }

  if (invalidPackages.length > 0) {
    console.log('Invalid peer dependencies:');
    invalidPackages.forEach(pkg => {
      console.log(`   ${pkg.package}: ${pkg.currentPeerDep} (expected to include: ${pkg.expected})`);
      console.log(`      Path: ${pkg.path}`);
    });
    console.log();
  }

  console.log(`Version summary: ${validPackages.length} valid, ${invalidPackages.length} invalid`);
}

if (propagatedPeerErrors.length > 0) {
  console.log('\nTransitive @mastra/core peer dependency errors:');
  propagatedPeerErrors.forEach(error => {
    const current = error.currentPeerDep ?? '(missing)';
    console.log(`   ${error.package}: ${current}`);
    console.log(`      depends on ${error.dependency}, which requires @mastra/core ${error.dependencyCorePeerDep}`);
    console.log(`      Path: ${error.path}`);
  });
}

if (hasErrors) {
  console.log('\nTo fix invalid peer dependencies:');
  console.log(`   - Ensure package @mastra/core peer ranges include ${coreVersion}`);
  console.log('   - Ensure a package peer range is a subset of every runtime Mastra dependency core peer range');
  process.exit(1);
}

console.log('\nAll peer dependencies are valid!');
