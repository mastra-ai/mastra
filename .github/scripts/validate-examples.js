import { execSync } from 'child_process';
import fs from 'fs';
import { globby } from 'globby';
import { join, dirname } from 'path';

// Find all package.json files in examples directory
const packageJsonFiles = await globby(['examples/**/package.json', '!**/node_modules/**', '!./examples/dane/**']);

let hasWorkspaceDependencies = false;
let hasMissingOverrides = false;
let hasLockFile = false;
const errors = [];

for (const packageJsonPath of packageJsonFiles) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

  // Check regular and dev dependencies for workspace: references
  hasWorkspaceDependencies = checkWorkspaceDependencies(packageJson, packageJsonPath) || hasWorkspaceDependencies;

  // This package uses a PR snapshot version as ai-sdk-v5 is not yet released on the main branch, so it won't use overrides
  if (packageJson.name.includes('mastra-ai-sdk-v5-use-chat-example')) {
    console.log('Skipping validation for mastra-ai-sdk-v5-use-chat-example');
    hasMissingOverrides = false;
  } else {
    // Validate mastra packages have correct pnpm overrides
    hasMissingOverrides = validateMastraOverrides(packageJson, packageJsonPath) || hasMissingOverrides;
  }

  // Validate lock file exists
  hasLockFile = validateLockFile(join(dirname(packageJsonPath), 'pnpm-lock.yaml')) || hasLockFile;
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

function checkWorkspaceDependencies(packageJson, packageJsonPath) {
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

// pnpm 11 no longer reads the package.json "pnpm" field, so a standalone example declares its mastra
// overrides in pnpm-workspace.yaml instead. Read that flat overrides block (no YAML dep needed) so
// pnpm 10 (package.json) and pnpm 11 (pnpm-workspace.yaml) examples both validate.
function readWorkspaceOverrides(packageJsonPath) {
  const workspacePath = join(dirname(packageJsonPath), 'pnpm-workspace.yaml');
  if (!fs.existsSync(workspacePath)) return {};

  const overrides = {};
  let inOverrides = false;
  for (const line of fs.readFileSync(workspacePath, 'utf-8').split(/\r?\n/)) {
    if (!inOverrides) {
      if (/^overrides:\s*$/.test(line)) inOverrides = true;
      continue;
    }
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (line.length - line.trimStart().length === 0) break; // dedent to a new top-level key ends the block
    const match = line.trim().match(/^["']?(@?[^"':\s]+)["']?\s*:\s*(.+)$/);
    if (match) overrides[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
  }
  return overrides;
}

function validateMastraOverrides(packageJson, packageJsonPath) {
  let hasMissingOverride = false;
  const dependencies = packageJson.dependencies || {};
  const devDependencies = packageJson.devDependencies || {};
  const overrides = { ...readWorkspaceOverrides(packageJsonPath), ...(packageJson.pnpm?.overrides || {}) };

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

function validateLockFile(lockPath) {
  const exists = fs.existsSync(lockPath);

  if (!exists) {
    errors.push(`Error: Lock file not found in ${lockPath}`);
  }
  return exists;
}
