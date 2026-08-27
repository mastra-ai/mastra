const { readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const WORKSPACE_ROUTING_FILES = new Set([
  '.github/scripts/ci-routing.cjs',
  '.github/workflows/prebuild.yml',
  '.github/workflows/test-workspaces.yml',
  '.github/workflows/secrets.test-workspaces.yml',
]);

function discoverWorkspacePackages(root = process.cwd()) {
  return readdirSync(join(root, 'workspaces'), { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name !== '_test-utils')
    .map(entry => {
      const packageJson = JSON.parse(readFileSync(join(root, 'workspaces', entry.name, 'package.json'), 'utf8'));
      return {
        id: entry.name,
        dependencies: {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
          ...packageJson.optionalDependencies,
          ...packageJson.peerDependencies,
        },
        name: packageJson.name,
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

function allWorkspacePackages(workspacePackages, reason) {
  const packages = Array.isArray(workspacePackages)
    ? workspacePackages.flatMap(pkg => (typeof pkg?.id === 'string' ? [pkg.id] : [])).sort()
    : [];

  return {
    all: true,
    packages,
    reason,
  };
}

function isValidWorkspacePackageInventory(workspacePackages) {
  if (!Array.isArray(workspacePackages) || workspacePackages.length === 0) {
    return false;
  }

  const ids = new Set();
  for (const pkg of workspacePackages) {
    if (
      !pkg ||
      typeof pkg !== 'object' ||
      typeof pkg.id !== 'string' ||
      pkg.id.length === 0 ||
      typeof pkg.name !== 'string' ||
      pkg.name.length === 0 ||
      !pkg.dependencies ||
      typeof pkg.dependencies !== 'object' ||
      Array.isArray(pkg.dependencies) ||
      ids.has(pkg.id)
    ) {
      return false;
    }
    ids.add(pkg.id);
  }

  return true;
}

function selectWorkspacePackages({ affectedTests, changedFiles, runFull, workspacePackages }) {
  if (!isValidWorkspacePackageInventory(workspacePackages)) {
    return allWorkspacePackages(discoverWorkspacePackages(), 'invalid-input');
  }

  if (
    !Array.isArray(affectedTests) ||
    affectedTests.some(file => typeof file !== 'string') ||
    !Array.isArray(changedFiles) ||
    changedFiles.some(file => typeof file !== 'string')
  ) {
    return allWorkspacePackages(workspacePackages, 'invalid-input');
  }

  if (runFull) {
    return allWorkspacePackages(workspacePackages, 'full-suite');
  }

  if (changedFiles.some(file => file.startsWith('workspaces/_test-utils/') || WORKSPACE_ROUTING_FILES.has(file))) {
    return allWorkspacePackages(workspacePackages, 'shared-workspace-input');
  }

  const packageById = new Map(workspacePackages.map(pkg => [pkg.id, pkg]));
  const selected = new Set();

  for (const file of [...affectedTests, ...changedFiles]) {
    const match = /^workspaces\/([^/]+)\//.exec(file);
    if (!match) continue;

    if (!packageById.has(match[1])) {
      return allWorkspacePackages(workspacePackages, 'unknown-workspace-package');
    }

    selected.add(match[1]);
  }

  const selectedNames = new Set(
    [...selected].map(id => workspacePackages.find(pkg => pkg.id === id)?.name).filter(Boolean),
  );
  let foundDependent = true;

  while (foundDependent) {
    foundDependent = false;

    for (const workspacePackage of workspacePackages) {
      if (
        !selected.has(workspacePackage.id) &&
        Object.keys(workspacePackage.dependencies).some(dependency => selectedNames.has(dependency))
      ) {
        selected.add(workspacePackage.id);
        selectedNames.add(workspacePackage.name);
        foundDependent = true;
      }
    }
  }

  return {
    all: false,
    packages: [...selected].sort(),
    reason: selected.size === 0 ? 'no-workspace-impact' : 'affected-packages',
  };
}

function validateWorkspacePackages(packages, workspacePackages) {
  if (!Array.isArray(packages) || !isValidWorkspacePackageInventory(workspacePackages)) {
    return false;
  }

  const knownPackages = new Set(workspacePackages.map(pkg => pkg.id));
  return (
    packages.length === new Set(packages).size &&
    packages.every(pkg => typeof pkg === 'string' && knownPackages.has(pkg))
  );
}

function qualityAssuranceInputs(changedFiles) {
  if (!Array.isArray(changedFiles) || changedFiles.some(file => typeof file !== 'string')) {
    return {
      hasAgentsInputs: true,
      hasPeerdepsInputs: true,
      agentsReasons: ['invalid-input'],
      peerdepsReasons: ['invalid-input'],
    };
  }

  const agentsReasons = changedFiles.filter(
    file =>
      file.endsWith('/AGENTS.md') ||
      file === 'AGENTS.md' ||
      file === '.github/scripts/validate-agents-md.mjs' ||
      file === '.github/scripts/ci-routing.cjs' ||
      file === '.github/workflows/lint.yml' ||
      file === 'package.json' ||
      file === 'pnpm-lock.yaml',
  );
  const peerdepsReasons = changedFiles.filter(
    file =>
      file.startsWith('.changeset/') ||
      file.endsWith('/package.json') ||
      file === 'package.json' ||
      file === 'pnpm-lock.yaml' ||
      file === 'pnpm-workspace.yaml' ||
      file === 'scripts/validate-peerdeps.mjs' ||
      file === '.github/scripts/ci-routing.cjs' ||
      file === '.github/workflows/lint.yml' ||
      file.startsWith('packages/server/src/') ||
      file.startsWith('packages/server/scripts/') ||
      file === 'packages/server/package.json',
  );

  return {
    hasAgentsInputs: agentsReasons.length > 0,
    hasPeerdepsInputs: peerdepsReasons.length > 0,
    agentsReasons,
    peerdepsReasons,
  };
}

module.exports = {
  discoverWorkspacePackages,
  qualityAssuranceInputs,
  selectWorkspacePackages,
  validateWorkspacePackages,
};
