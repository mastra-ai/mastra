import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];

const SHARED_REGISTRY_SUITES = {
  commonjs: {
    tag: 'commonjs-e2e-test',
    manifestGlobs: ['e2e-tests/commonjs/template/package.json'],
  },
  monorepo: {
    tag: 'monorepo-test',
    manifestGlobs: ['e2e-tests/monorepo/template/**/package.json'],
  },
  'no-bundling': {
    tag: 'no-bundling-test',
    manifestGlobs: ['e2e-tests/no-bundling/template/package.json'],
    extraRoots: ['@mastra/deployer'],
  },
  deployers: {
    tag: 'deployers-e2e-test',
    manifestGlobs: ['e2e-tests/deployers/template/**/package.json'],
    extraRoots: ['@mastra/deployer-vercel', '@mastra/deployer-netlify'],
  },
  'type-check': {
    tag: 'type-check-test',
    manifestGlobs: ['e2e-tests/type-check/template/package.json'],
  },
  'create-mastra': {
    tag: 'create-mastra-e2e-test',
    manifestGlobs: [],
    extraRoots: ['create-mastra'],
    includeCreateMastraBuildRoots: true,
  },
  softwarefactory: {
    tag: 'softwarefactory-e2e-test',
    manifestGlobs: [],
    // The Software Factory template is generated from mastracode/web by
    // create-factory's sync-template.mjs; its roots are whatever the
    // web project links from the monorepo, so discover them from the manifest
    // instead of hardcoding a list that can drift.
    linkManifests: ['mastracode/web/package.json'],
  },
};

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function normalizePath(path) {
  return path.split(sep).join('/');
}

function getPathBeforeGlob(glob) {
  const parts = glob.split('/');
  const globIndex = parts.findIndex(part => part.includes('*'));
  return globIndex === -1 ? parts.slice(0, -1).join('/') : parts.slice(0, globIndex).join('/');
}

async function walkPackageManifests(rootDir, startDir) {
  const manifests = [];

  async function walk(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') {
          continue;
        }
        await walk(entryPath);
      } else if (entry.name === 'package.json') {
        manifests.push(normalizePath(relative(rootDir, entryPath)));
      }
    }
  }

  await walk(join(rootDir, startDir));
  return manifests;
}

async function expandManifestGlob(rootDir, glob) {
  if (!glob.includes('*')) {
    return [glob];
  }

  const startDir = getPathBeforeGlob(glob);
  const manifests = await walkPackageManifests(rootDir, startDir);

  if (glob.endsWith('/**/package.json')) {
    return manifests;
  }

  throw new Error(`Unsupported E2E publish manifest glob: ${glob}`);
}

function collectSnapshotDependencies(manifest, tag) {
  const roots = [];
  for (const field of DEPENDENCY_FIELDS) {
    for (const [name, version] of Object.entries(manifest[field] || {})) {
      if (version === tag) {
        roots.push(name);
      }
    }
  }
  return roots;
}

async function getFixtureRoots(rootDir, suite) {
  const manifests = (await Promise.all(suite.manifestGlobs.map(glob => expandManifestGlob(rootDir, glob)))).flat();
  const roots = [];

  for (const manifestPath of manifests) {
    roots.push(...collectSnapshotDependencies(readJson(join(rootDir, manifestPath)), suite.tag));
  }

  return roots;
}

/** Collect deps declared with `link:` specs (standalone projects like mastracode/web). */
function collectLinkDependencies(manifest) {
  const roots = [];
  for (const field of DEPENDENCY_FIELDS) {
    for (const [name, version] of Object.entries(manifest[field] || {})) {
      if (version.startsWith('link:')) {
        roots.push(name);
      }
    }
  }
  return roots;
}

function getLinkManifestRoots(rootDir, suite) {
  const roots = [];
  for (const manifestPath of suite.linkManifests || []) {
    roots.push(...collectLinkDependencies(readJson(join(rootDir, manifestPath))));
  }
  return roots;
}

function getCreateMastraBuildRoots(rootDir) {
  const turbo = readJson(join(rootDir, 'packages/create-mastra/turbo.json'));
  return (turbo.tasks?.build?.dependsOn || [])
    .filter(dep => dep.startsWith('@mastra/') && dep.endsWith('#build'))
    .map(dep => dep.slice(0, -'#build'.length));
}

function rootsToFilters(roots) {
  return [...new Set(roots)].map(root => `--filter="${root}..."`);
}

export async function getSuitePublishRoots(rootDir, suiteName) {
  const suite = SHARED_REGISTRY_SUITES[suiteName];
  if (!suite) {
    throw new Error(`Unknown shared E2E registry suite: ${suiteName}`);
  }

  const roots = [
    ...(suite.extraRoots || []),
    ...(await getFixtureRoots(rootDir, suite)),
    ...getLinkManifestRoots(rootDir, suite),
  ];
  if (suite.includeCreateMastraBuildRoots) {
    roots.push(...getCreateMastraBuildRoots(rootDir));
  }

  return [...new Set(roots)];
}

export async function getSuitePublishFilters(rootDir, suiteName) {
  return rootsToFilters(await getSuitePublishRoots(rootDir, suiteName));
}

export async function getSharedRegistryPublishRoots(rootDir) {
  const roots = [];
  for (const suiteName of Object.keys(SHARED_REGISTRY_SUITES)) {
    roots.push(...(await getSuitePublishRoots(rootDir, suiteName)));
  }
  return [...new Set(roots)];
}

export async function getSharedRegistryPublishFilters(rootDir) {
  return rootsToFilters(await getSharedRegistryPublishRoots(rootDir));
}

export async function getSharedRegistryPublishGroups(rootDir) {
  const groups = [];
  for (const [suiteName, suite] of Object.entries(SHARED_REGISTRY_SUITES)) {
    groups.push({
      tag: suite.tag,
      publishFilters: await getSuitePublishFilters(rootDir, suiteName),
    });
  }
  return groups;
}
