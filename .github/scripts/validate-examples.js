import fs from 'fs';
import semver from 'semver';
import { glob as globby } from 'tinyglobby';
import { dirname, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const STUDIO_PREVIEW_PACKAGE_NAME = 'examples-studio-preview';
const MASTRA_CORE_PACKAGE = '@mastra/core';

async function validateExamples({ cwd = process.cwd(), log = console.log } = {}) {
  // Find all package.json files in examples directory
  const packageJsonFiles = await globby(['examples/**/package.json', '!**/node_modules/**', '!./examples/dane/**'], {
    cwd,
  });

  let hasWorkspaceDependencies = false;
  let hasMissingOverrides = false;
  let hasInvalidStudioPreviewPeers = false;
  let hasLockFile = false;
  const errors = [];

  for (const packageJsonPath of packageJsonFiles) {
    const absolutePackageJsonPath = resolve(cwd, packageJsonPath);
    const packageJson = readJson(absolutePackageJsonPath);

    // Check regular and dev dependencies for workspace: references
    hasWorkspaceDependencies =
      checkWorkspaceDependencies(packageJson, packageJsonPath, errors) || hasWorkspaceDependencies;

    // This package uses a PR snapshot version as ai-sdk-v5 is not yet released on the main branch, so it won't use overrides
    if (packageJson.name?.includes('mastra-ai-sdk-v5-use-chat-example')) {
      log('Skipping validation for mastra-ai-sdk-v5-use-chat-example');
    } else {
      // Validate mastra packages have correct pnpm overrides
      hasMissingOverrides = validateMastraOverrides(packageJson, packageJsonPath, errors) || hasMissingOverrides;
    }

    hasInvalidStudioPreviewPeers =
      validateStudioPreviewCorePeerOverrides(packageJson, packageJsonPath, { repoRoot: cwd, errors }) ||
      hasInvalidStudioPreviewPeers;

    // Validate lock file exists
    hasLockFile = validateLockFile(join(dirname(absolutePackageJsonPath), 'pnpm-lock.yaml'), errors) || hasLockFile;
  }

  return {
    errors,
    hasInvalidStudioPreviewPeers,
    hasLockFile,
    hasMissingOverrides,
    hasWorkspaceDependencies,
  };
}

function validateStudioPreviewCorePeerOverrides(
  packageJson,
  packageJsonPath,
  { repoRoot = process.cwd(), errors = [] } = {},
) {
  if (packageJson.name !== STUDIO_PREVIEW_PACKAGE_NAME) {
    return false;
  }

  const overrides = packageJson.pnpm?.overrides || {};
  const coreOverride = overrides[MASTRA_CORE_PACKAGE];
  if (!coreOverride) {
    return false;
  }

  if (!semver.valid(coreOverride)) {
    errors.push(
      `Error: ${MASTRA_CORE_PACKAGE} override in ${packageJsonPath} must be a concrete version, found ${coreOverride}`,
    );
    return true;
  }

  let hasInvalidPeerOverride = false;
  for (const { dep, packageJsonPath: linkedPackageJsonPath, range } of getLinkedMastraCorePeerRanges(
    packageJson,
    packageJsonPath,
    repoRoot,
  )) {
    if (!semver.satisfies(coreOverride, range, { includePrerelease: true })) {
      errors.push(
        `Error: ${MASTRA_CORE_PACKAGE} override ${coreOverride} in ${packageJsonPath} must satisfy ${dep} peer range ${range} from ${relative(
          repoRoot,
          linkedPackageJsonPath,
        )}`,
      );
      hasInvalidPeerOverride = true;
    }
  }

  return hasInvalidPeerOverride;
}

async function main() {
  const result = await validateExamples();

  if (result.hasWorkspaceDependencies || result.hasMissingOverrides || result.hasInvalidStudioPreviewPeers) {
    console.error('Validation failed: Found workspace dependencies, missing pnpm overrides, or invalid peer overrides');
    console.log(result.errors.join(`\n`));
    process.exit(1);
  }

  if (!result.hasLockFile) {
    console.error('Validation failed: no lock file found');
    console.log(result.errors.join(`\n`));
    process.exit(1);
  }

  console.log(
    'All examples validated successfully - no workspace dependencies found and all mastra packages have correct overrides',
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}

function checkWorkspaceDependencies(packageJson, packageJsonPath, errors) {
  let hasWorkspaceRefs = false;
  const dependencies = packageJson.dependencies || {};
  const devDependencies = packageJson.devDependencies || {};

  for (const [dep, version] of [...Object.entries(dependencies), ...Object.entries(devDependencies)]) {
    if (version.includes('workspace:')) {
      errors.push(`Error: Workspace dependency found in ${packageJsonPath}: ${dep}@${version}`);
      hasWorkspaceRefs = true;
    }
  }

  return hasWorkspaceRefs;
}

function validateMastraOverrides(packageJson, packageJsonPath, errors) {
  let hasMissingOverride = false;
  const dependencies = packageJson.dependencies || {};
  const devDependencies = packageJson.devDependencies || {};
  const overrides = packageJson.pnpm?.overrides || {};

  for (const [dep] of [...Object.entries(dependencies), ...Object.entries(devDependencies)]) {
    if (dep.startsWith('@mastra/') || dep === 'mastra') {
      if (!overrides[dep]) {
        errors.push(`Error: Mastra package ${dep} in ${packageJsonPath} must have override`);
        hasMissingOverride = true;
      }
    }
  }

  return hasMissingOverride;
}

function validateLockFile(lockPath, errors) {
  const exists = fs.existsSync(lockPath);

  if (!exists) {
    errors.push(`Error: Lock file not found in ${lockPath}`);
  }
  return exists;
}

function getLinkedMastraCorePeerRanges(packageJson, packageJsonPath, repoRoot) {
  const overrides = packageJson.pnpm?.overrides || {};

  return Object.entries(overrides).flatMap(([dep, version]) => {
    if (dep === MASTRA_CORE_PACKAGE || typeof version !== 'string' || !version.startsWith('link:')) {
      return [];
    }

    const linkedPackageJsonPath = resolve(
      repoRoot,
      dirname(packageJsonPath),
      version.slice('link:'.length),
      'package.json',
    );
    const linkedPackageJson = readJson(linkedPackageJsonPath);
    const range = linkedPackageJson.peerDependencies?.[MASTRA_CORE_PACKAGE];

    return range ? [{ dep, packageJsonPath: linkedPackageJsonPath, range }] : [];
  });
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf-8'));
}
