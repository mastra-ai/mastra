import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { globby } from 'globby';
import { join, dirname } from 'node:path';

// Find all package.json files in examples directory
const packageJsonFiles = await globby(['examples/**/package.json', '!**/node_modules/**', '!./examples/dane/**']);

// An example can be a pnpm workspace of its own with several member packages.
// pnpm only honours `pnpm.overrides` at a workspace root and silently ignores it
// anywhere else, and a `workspace:` dependency between two members resolves inside
// that example rather than reaching into the monorepo. So resolve both checks where
// pnpm resolves them: against the nearest workspace root.
const workspaceRoots = new Set(
  (await globby(['examples/**/pnpm-workspace.yaml', '!**/node_modules/**'])).map(path => dirname(path)),
);

const packages = packageJsonFiles.map(packageJsonPath => ({
  path: packageJsonPath,
  root: findWorkspaceRoot(packageJsonPath),
  json: JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')),
}));

// Package names grouped by the workspace they belong to, so a `workspace:` reference
// can be told apart from one that points outside the example.
const workspaceMembers = new Map();
for (const pkg of packages) {
  if (!workspaceMembers.has(pkg.root)) workspaceMembers.set(pkg.root, new Set());
  workspaceMembers.get(pkg.root).add(pkg.json.name);
}

let hasWorkspaceDependencies = false;
let hasMissingOverrides = false;
let hasLockFile = false;
const errors = [];

for (const { path: packageJsonPath, root, json: packageJson } of packages) {
  // Check regular and dev dependencies for workspace: references
  hasWorkspaceDependencies = checkWorkspaceDependencies(packageJson, packageJsonPath, root) || hasWorkspaceDependencies;

  // This package uses a PR snapshot version as ai-sdk-v5 is not yet released on the main branch, so it won't use overrides
  if (packageJson.name.includes('mastra-ai-sdk-v5-use-chat-example')) {
    console.log('Skipping validation for mastra-ai-sdk-v5-use-chat-example');
    hasMissingOverrides = false;
  } else {
    // Validate mastra packages have correct pnpm overrides
    hasMissingOverrides = validateMastraOverrides(packageJson, packageJsonPath, root) || hasMissingOverrides;
  }

  // Validate lock file exists. Only a workspace root has one; its members share it.
  if (root === dirname(packageJsonPath)) {
    hasLockFile = validateLockFile(join(root, 'pnpm-lock.yaml')) || hasLockFile;
  }
}

if (hasWorkspaceDependencies || hasMissingOverrides) {
  console.error('Validation failed: Found workspace dependencies or missing pnpm overrides');
  console.log(errors.join(`\n`));
  process.exit(1);
}

if (!hasLockFile) {
  console.error('Validation failed: no lock file found');
  console.log(errors.join(`\n`));
  process.exit(1);
}

console.log(
  'All examples validated successfully - no workspace dependencies found and all mastra packages have correct overrides',
);

// The directory pnpm would treat as this package's project root: the nearest ancestor
// holding a pnpm-workspace.yaml, or the package's own directory when it stands alone.
function findWorkspaceRoot(packageJsonPath) {
  let dir = dirname(packageJsonPath);
  const own = dir;

  while (dir !== '.' && dir !== dirname(dir)) {
    if (workspaceRoots.has(dir)) return dir;
    dir = dirname(dir);
  }

  return own;
}

function checkWorkspaceDependencies(packageJson, packageJsonPath, root) {
  let hasWorkspaceRefs = false;
  const dependencies = packageJson.dependencies || {};
  const devDependencies = packageJson.devDependencies || {};
  const siblings = workspaceMembers.get(root) ?? new Set();

  for (const [dep, version] of [...Object.entries(dependencies), ...Object.entries(devDependencies)]) {
    // A workspace: reference to another member of the same example is fine — it resolves
    // inside the example. One that points anywhere else would break a standalone install.
    if (version.includes('workspace:') && !siblings.has(dep)) {
      errors.push(`Error: Workspace dependency found in ${packageJsonPath}: ${dep}@${version}`);
      hasWorkspaceRefs = true;
    }
  }

  return hasWorkspaceRefs;
}

function validateMastraOverrides(packageJson, packageJsonPath, root) {
  let hasMissingOverride = false;
  const dependencies = packageJson.dependencies || {};
  const devDependencies = packageJson.devDependencies || {};
  const overrides = readOverrides(root);

  for (const [dep] of [...Object.entries(dependencies), ...Object.entries(devDependencies)]) {
    if (dep.startsWith('@mastra/') || dep === 'mastra') {
      if (!overrides[dep]) {
        const where = root === dirname(packageJsonPath) ? packageJsonPath : join(root, 'package.json');
        errors.push(`Error: Mastra package ${dep} in ${packageJsonPath} must have override in ${where}`);
        hasMissingOverride = true;
      }
    }
  }

  return hasMissingOverride;
}

// Overrides always come from the workspace root's package.json, which is the only place
// pnpm reads them from.
function readOverrides(root) {
  const rootPackageJsonPath = join(root, 'package.json');

  if (!fs.existsSync(rootPackageJsonPath)) return {};

  return JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf-8')).pnpm?.overrides || {};
}

function validateLockFile(lockPath) {
  const exists = fs.existsSync(lockPath);

  if (!exists) {
    errors.push(`Error: Lock file not found in ${lockPath}`);
  }
  return exists;
}
