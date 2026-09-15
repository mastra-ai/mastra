const { execFileSync } = require('node:child_process');
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

function qualityAssuranceInputs(changedFiles, packageReadmePaths = []) {
  if (!Array.isArray(changedFiles) || changedFiles.some(file => typeof file !== 'string')) {
    return {
      hasAgentsInputs: true,
      hasPeerdepsInputs: true,
      hasReadmeInputs: true,
      readmeReasons: ['invalid-input'],
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

  const eligibleReadmes = new Set(packageReadmePaths);
  const readmeReasons = changedFiles.filter(
    file =>
      eligibleReadmes.has(file) ||
      file === '.github/scripts/check-package-readmes.mjs' ||
      file === '.github/scripts/check-package-readmes.test.mjs' ||
      file === '.github/scripts/ci-routing.cjs' ||
      file === '.github/workflows/lint.yml',
  );

  return {
    hasAgentsInputs: agentsReasons.length > 0,
    hasPeerdepsInputs: peerdepsReasons.length > 0,
    hasReadmeInputs: readmeReasons.length > 0,
    agentsReasons,
    peerdepsReasons,
    readmeReasons,
  };
}

const IGNORED_MANIFEST_PREFIXES = ['docs/', 'examples/', 'explorations/'];
const TEST_FILE_RE = /\.(?:test|spec)(?:-d)?\.tsx?$/;
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
const TEST_FILE_PATTERNS = [
  '*.test.ts',
  '**/*.test.ts',
  '*.test.tsx',
  '**/*.test.tsx',
  '*.spec.ts',
  '**/*.spec.ts',
  '*.spec.tsx',
  '**/*.spec.tsx',
  '*.test-d.ts',
  '**/*.test-d.ts',
  '*.test-d.tsx',
  '**/*.test-d.tsx',
  '*.spec-d.ts',
  '**/*.spec-d.ts',
  '*.spec-d.tsx',
  '**/*.spec-d.tsx',
];

function packageDirFromChangedManifest(file) {
  if (typeof file !== 'string') {
    return null;
  }

  if (file === 'package.json' || !file.endsWith('/package.json')) {
    return null;
  }

  if (file.includes('/node_modules/') || IGNORED_MANIFEST_PREFIXES.some(prefix => file.startsWith(prefix))) {
    return null;
  }

  return file.slice(0, -'package.json'.length);
}

function dependencyFieldsChanged(before, after) {
  const left = before && typeof before === 'object' ? before : {};
  const right = after && typeof after === 'object' ? after : {};
  return DEPENDENCY_FIELDS.some(field => JSON.stringify(left[field] ?? {}) !== JSON.stringify(right[field] ?? {}));
}

function gitJsonAt(sha, file, execFileSyncImpl) {
  try {
    return JSON.parse(execFileSyncImpl('git', ['show', `${sha}:${file}`], { encoding: 'utf8' }));
  } catch {
    return null;
  }
}

function gitManifestDependencyFieldsChanged(file, baseSha, headSha, execFileSyncImpl = execFileSync) {
  if (typeof file !== 'string' || !baseSha || !headSha) {
    return false;
  }

  const after = gitJsonAt(headSha, file, execFileSyncImpl);
  if (!after) {
    return false;
  }

  return dependencyFieldsChanged(gitJsonAt(baseSha, file, execFileSyncImpl) ?? {}, after);
}

function discoverRepoTestFiles(execFileSyncImpl = execFileSync, cwd = process.cwd()) {
  let output = '';
  try {
    output = execFileSyncImpl('git', ['ls-files', ...TEST_FILE_PATTERNS], { encoding: 'utf8', cwd });
  } catch {
    return [];
  }

  return [
    ...new Set(
      output
        .split(/\r?\n/)
        .filter(
          line =>
            line && !line.includes('__fixtures__') && !line.includes('/fixtures/') && !line.includes('node_modules'),
        ),
    ),
  ];
}

function testsForChangedPackageManifests(changedFiles, testFiles, didDependencyFieldsChange) {
  if (!Array.isArray(changedFiles) || !Array.isArray(testFiles) || typeof didDependencyFieldsChange !== 'function') {
    return [];
  }

  const dirs = changedFiles.flatMap(file => {
    const dir = packageDirFromChangedManifest(file);
    if (!dir || !didDependencyFieldsChange(file)) {
      return [];
    }
    return [dir];
  });

  if (dirs.length === 0) {
    return [];
  }

  return [
    ...new Set(
      testFiles.filter(testFile => {
        if (typeof testFile !== 'string' || !TEST_FILE_RE.test(testFile)) {
          return false;
        }

        if (testFile.includes('__fixtures__') || testFile.includes('/fixtures/')) {
          return false;
        }

        return dirs.some(dir => testFile.startsWith(dir));
      }),
    ),
  ].sort();
}

function planAffectedUnitTests({
  graphAffectedTests = [],
  graphTestFileCount = 0,
  changedFiles,
  repoTestFiles,
  didDependencyFieldsChange,
  hasChangedSource,
}) {
  const manifestTests = testsForChangedPackageManifests(changedFiles, repoTestFiles, didDependencyFieldsChange);
  const affectedTests = [...new Set([...(graphAffectedTests || []), ...manifestTests])].sort();
  const count = affectedTests.length;
  const total = Math.max(graphTestFileCount || 0, Array.isArray(repoTestFiles) ? repoTestFiles.length : 0, 1);
  const ratio = count / total;
  const runFull = (Boolean(hasChangedSource) || manifestTests.length > 0) && ratio > 0.5;

  return { affectedTests, manifestTests, count, total, ratio, runFull };
}

module.exports = {
  TEST_FILE_PATTERNS,
  dependencyFieldsChanged,
  discoverRepoTestFiles,
  discoverWorkspacePackages,
  gitManifestDependencyFieldsChanged,
  planAffectedUnitTests,
  qualityAssuranceInputs,
  selectWorkspacePackages,
  testsForChangedPackageManifests,
  validateWorkspacePackages,
};
