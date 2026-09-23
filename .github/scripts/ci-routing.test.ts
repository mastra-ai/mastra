import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverPackages } from './check-package-readmes.mjs';
import { describe, expect, test } from 'vitest';
import routing from './ci-routing.cjs';

const { discoverWorkspacePackages, qualityAssuranceInputs, selectWorkspacePackages, validateWorkspacePackages } =
  routing;
const majorVersionWorkflow = readFileSync(new URL('../workflows/major-version-check.yml', import.meta.url), 'utf8');
const prebuildWorkflow = readFileSync(new URL('../workflows/prebuild.yml', import.meta.url), 'utf8');
const workspaceCloudWorkflow = readFileSync(
  new URL('../workflows/secrets.test-workspaces.yml', import.meta.url),
  'utf8',
);

const workspacePackages = [
  { id: 's3', name: '@mastra/s3', dependencies: {} },
  { id: 'gcs', name: '@mastra/gcs', dependencies: {} },
  { id: 'e2b', name: '@mastra/e2b', dependencies: { '@mastra/s3': 'workspace:*', '@mastra/gcs': 'workspace:*' } },
  { id: 'e2b-desktop', name: '@mastra/e2b-desktop', dependencies: { '@mastra/e2b': 'workspace:*' } },
  { id: 'vercel', name: '@mastra/vercel', dependencies: {} },
];

describe('workspace CI routing', () => {
  test('selects a directly changed workspace package', () => {
    expect(
      selectWorkspacePackages({
        affectedTests: [],
        changedFiles: ['workspaces/vercel/src/index.ts'],
        runFull: false,
        workspacePackages,
      }),
    ).toEqual({ all: false, packages: ['vercel'], reason: 'affected-packages' });
  });

  test('selects a newly added workspace package', () => {
    expect(
      selectWorkspacePackages({
        affectedTests: [],
        changedFiles: ['workspaces/new-provider/src/index.ts'],
        runFull: false,
        workspacePackages: [
          ...workspacePackages,
          { id: 'new-provider', name: '@mastra/new-provider', dependencies: {} },
        ],
      }),
    ).toEqual({ all: false, packages: ['new-provider'], reason: 'affected-packages' });
  });

  test('selects packages with affected workspace tests', () => {
    expect(
      selectWorkspacePackages({
        affectedTests: ['workspaces/gcs/src/gcs.test.ts'],
        changedFiles: ['packages/core/src/index.ts'],
        runFull: false,
        workspacePackages,
      }),
    ).toEqual({ all: false, packages: ['e2b', 'e2b-desktop', 'gcs'], reason: 'affected-packages' });
  });

  test('includes reverse workspace dependents', () => {
    expect(
      selectWorkspacePackages({
        affectedTests: [],
        changedFiles: ['workspaces/s3/package.json'],
        runFull: false,
        workspacePackages,
      }),
    ).toEqual({ all: false, packages: ['e2b', 'e2b-desktop', 's3'], reason: 'affected-packages' });
  });

  test('deduplicates and sorts selections from changed files and affected tests', () => {
    expect(
      selectWorkspacePackages({
        affectedTests: ['workspaces/s3/src/s3.test.ts', 'workspaces/gcs/src/gcs.test.ts'],
        changedFiles: ['workspaces/gcs/package.json', 'workspaces/s3/package.json'],
        runFull: false,
        workspacePackages,
      }),
    ).toEqual({ all: false, packages: ['e2b', 'e2b-desktop', 'gcs', 's3'], reason: 'affected-packages' });
  });

  test.each([
    ['workspaces/_test-utils/src/index.ts'],
    ['.github/scripts/ci-routing.cjs'],
    ['.github/workflows/prebuild.yml'],
    ['.github/workflows/test-workspaces.yml'],
    ['.github/workflows/secrets.test-workspaces.yml'],
  ])('fails closed for shared workspace input %s', file => {
    expect(
      selectWorkspacePackages({
        affectedTests: [],
        changedFiles: [file],
        runFull: false,
        workspacePackages,
      }),
    ).toEqual({ all: true, packages: ['e2b', 'e2b-desktop', 'gcs', 's3', 'vercel'], reason: 'shared-workspace-input' });
  });

  test('fails closed for a full affected test suite, invalid input, or deleted package', () => {
    expect(
      selectWorkspacePackages({
        affectedTests: [],
        changedFiles: [],
        runFull: true,
        workspacePackages,
      }),
    ).toEqual({ all: true, packages: ['e2b', 'e2b-desktop', 'gcs', 's3', 'vercel'], reason: 'full-suite' });

    expect(
      selectWorkspacePackages({
        affectedTests: undefined,
        changedFiles: [],
        runFull: false,
        workspacePackages,
      }),
    ).toEqual({ all: true, packages: ['e2b', 'e2b-desktop', 'gcs', 's3', 'vercel'], reason: 'invalid-input' });

    expect(
      selectWorkspacePackages({
        affectedTests: ['workspaces/s3/src/index.ts'],
        changedFiles: [123],
        runFull: false,
        workspacePackages,
      }),
    ).toEqual({ all: true, packages: ['e2b', 'e2b-desktop', 'gcs', 's3', 'vercel'], reason: 'invalid-input' });

    expect(
      selectWorkspacePackages({
        affectedTests: [123],
        changedFiles: [],
        runFull: false,
        workspacePackages,
      }),
    ).toEqual({ all: true, packages: ['e2b', 'e2b-desktop', 'gcs', 's3', 'vercel'], reason: 'invalid-input' });

    const discoveredPackages = discoverWorkspacePackages().map(pkg => pkg.id);
    const invalidObjectSelection = selectWorkspacePackages({
      affectedTests: [],
      changedFiles: [],
      runFull: false,
      workspacePackages: {},
    });
    expect(invalidObjectSelection).toEqual({ all: true, packages: discoveredPackages, reason: 'invalid-input' });
    expect(prebuildWorkflow).toContain('const workspacesChanged = workspaceSelection.packages.length > 0;');
    expect(invalidObjectSelection.packages.length > 0).toBe(true);

    expect(
      selectWorkspacePackages({
        affectedTests: [],
        changedFiles: [],
        runFull: false,
        workspacePackages: [...workspacePackages, null],
      }),
    ).toEqual({ all: true, packages: discoveredPackages, reason: 'invalid-input' });

    expect(
      selectWorkspacePackages({
        affectedTests: [],
        changedFiles: [],
        runFull: false,
        workspacePackages: [...workspacePackages, { id: 's3', name: '@mastra/duplicate', dependencies: {} }],
      }),
    ).toEqual({ all: true, packages: discoveredPackages, reason: 'invalid-input' });

    expect(
      selectWorkspacePackages({
        affectedTests: [],
        changedFiles: [],
        runFull: false,
        workspacePackages: [{ id: 123, name: '@mastra/invalid', dependencies: {} }],
      }),
    ).toEqual({ all: true, packages: discoveredPackages, reason: 'invalid-input' });

    expect(
      selectWorkspacePackages({
        affectedTests: [],
        changedFiles: [],
        runFull: false,
        workspacePackages: [{ id: 'invalid', name: 123, dependencies: {} }],
      }),
    ).toEqual({ all: true, packages: discoveredPackages, reason: 'invalid-input' });

    expect(
      selectWorkspacePackages({
        affectedTests: [],
        changedFiles: ['workspaces/deleted-package/src/index.ts'],
        runFull: false,
        workspacePackages,
      }),
    ).toEqual({
      all: true,
      packages: ['e2b', 'e2b-desktop', 'gcs', 's3', 'vercel'],
      reason: 'unknown-workspace-package',
    });
  });

  test.each(['packages/core/src/index.ts', 'docs/guides/workspaces.mdx'])(
    'returns an empty selection for unrelated changes: %s',
    file => {
      expect(
        selectWorkspacePackages({
          affectedTests: [],
          changedFiles: [file],
          runFull: false,
          workspacePackages,
        }),
      ).toEqual({ all: false, packages: [], reason: 'no-workspace-impact' });
    },
  );

  test('validates cloud package matrices against the known workspace packages', () => {
    expect(validateWorkspacePackages(['s3', 'e2b'], workspacePackages)).toBe(true);
    expect(validateWorkspacePackages([], workspacePackages)).toBe(true);
    expect(validateWorkspacePackages(['s3', 'unknown'], workspacePackages)).toBe(false);
    expect(validateWorkspacePackages(['s3', 's3'], workspacePackages)).toBe(false);
    expect(validateWorkspacePackages(['s3', 1], workspacePackages)).toBe(false);
    expect(validateWorkspacePackages(undefined, workspacePackages)).toBe(false);
    expect(validateWorkspacePackages(['s3'], [null])).toBe(false);
    expect(
      validateWorkspacePackages(
        ['s3'],
        [...workspacePackages, { id: 's3', name: '@mastra/duplicate', dependencies: {} }],
      ),
    ).toBe(false);
    expect(validateWorkspacePackages(['s3'], [{ id: 123, name: '@mastra/s3', dependencies: {} }])).toBe(false);
    expect(validateWorkspacePackages(['s3'], [{ id: 's3', name: 123, dependencies: {} }])).toBe(false);
  });
});

describe('major version workflow routing', () => {
  test('uses exact approval command matching for triggers and comment scanning', () => {
    expect(majorVersionWorkflow).toContain("github.event.comment.body == '!allow-major'");
    expect(majorVersionWorkflow).toContain("github.event.changes.body.from == '!allow-major'");
    expect(majorVersionWorkflow).toContain("comment => comment.body === '!allow-major'");
    expect(majorVersionWorkflow).not.toContain('comment.body.trim().toLowerCase()');
  });

  test('keys pull request concurrency by pull request number', () => {
    expect(majorVersionWorkflow).toContain('github.event.pull_request.number ||');
  });

  test('isolates ordinary comments from approval-command concurrency', () => {
    expect(majorVersionWorkflow).toContain(
      "((github.event.comment.body == '!allow-major' || github.event.changes.body.from == '!allow-major') && github.event.issue.number) || github.run_id",
    );
  });
});

describe('workspace cloud workflow routing', () => {
  test('uses event-derived SHAs when artifact validation falls back', () => {
    expect(workspaceCloudWorkflow).toContain('DIFF_RANGE="$EXPECTED_BASE_SHA...$HEAD_SHA"');
    expect(workspaceCloudWorkflow).toContain('DIFF_RANGE="origin/main...$HEAD_SHA"');
    expect(workspaceCloudWorkflow).not.toMatch(/DIFF_RANGE=.*ARTIFACT_(?:BASE|HEAD)_SHA/);
    expect(workspaceCloudWorkflow).not.toMatch(/git ls-tree[^\n]*ARTIFACT_HEAD_SHA/);
  });
});

describe('quality assurance CI routing', () => {
  test('uses checker eligibility and includes deleted READMEs without selecting nested or ignored files', () => {
    const root = mkdtempSync(join(tmpdir(), 'readme-routing-'));
    try {
      const packages = [
        { directory: 'packages/public', name: '@mastra/public' },
        { directory: 'packages/core', name: '@mastra/core' },
        { directory: 'packages/internal', name: '@internal/test' },
        { directory: 'packages/private', name: '@mastra/private', private: true },
        { directory: 'packages/unrelated', name: 'unrelated' },
        { directory: 'packages/create-mastra', name: 'create-mastra' },
        { directory: 'mastracode/mastra-factory', name: 'create-factory' },
      ];
      for (const pkg of packages) {
        mkdirSync(join(root, pkg.directory), { recursive: true });
        writeFileSync(join(root, pkg.directory, 'package.json'), JSON.stringify(pkg));
      }
      // No README files exist: deleting one must still trigger validation.
      const readmes = discoverPackages(root).map(pkg => `${pkg.relativeDirectory}/README.md`);
      const changedFiles = [
        ...packages.map(pkg => `${pkg.directory}/README.md`),
        'README.md',
        'docs/README.md',
        'packages/public/src/README.md',
      ];
      expect(qualityAssuranceInputs(changedFiles, readmes)).toMatchObject({
        hasReadmeInputs: true,
        readmeReasons: [
          'packages/public/README.md',
          'packages/create-mastra/README.md',
          'mastracode/mastra-factory/README.md',
        ],
      });
      expect(
        qualityAssuranceInputs(
          changedFiles.filter(file => !readmes.includes(file)),
          readmes,
        ),
      ).toMatchObject({
        hasReadmeInputs: false,
        readmeReasons: [],
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test.each([
    '.github/scripts/check-package-readmes.mjs',
    '.github/scripts/check-package-readmes.test.mjs',
    '.github/scripts/ci-routing.cjs',
    '.github/workflows/lint.yml',
  ])('runs README validation when its infrastructure changes: %s', file => {
    expect(qualityAssuranceInputs([file])).toMatchObject({ hasReadmeInputs: true, readmeReasons: [file] });
  });

  test('skips README validation for empty or unrelated changes', () => {
    for (const files of [[], ['packages/public/src/index.ts'], ['docs/page.mdx']]) {
      expect(qualityAssuranceInputs(files, ['packages/public/README.md'])).toMatchObject({
        hasReadmeInputs: false,
        readmeReasons: [],
      });
    }
  });

  test('wires eligible README discovery and the conditional job into the QA workflow', () => {
    const workflow = readFileSync(new URL('../workflows/lint.yml', import.meta.url), 'utf8');
    expect(workflow).toContain('qualityAssuranceInputs(changedFiles, packageReadmePaths)');
    expect(workflow).toContain('discoverPackages(process.cwd())');
    expect(workflow).toContain('has_readme_inputs: ${{ steps.filter.outputs.has_readme_inputs }}');
    expect(workflow).toContain("if: needs.changes.outputs.has_readme_inputs == 'true'");
    expect(workflow).toContain('run: node .github/scripts/check-package-readmes.mjs');
  });

  test('runs only relevant checks for unrelated code', () => {
    expect(qualityAssuranceInputs(['packages/core/src/agent/index.ts'])).toMatchObject({
      hasAgentsInputs: false,
      hasPeerdepsInputs: false,
    });
  });

  test.each([
    ['AGENTS.md', { hasAgentsInputs: true, hasPeerdepsInputs: false }],
    ['.github/scripts/validate-agents-md.mjs', { hasAgentsInputs: true, hasPeerdepsInputs: false }],
    ['package.json', { hasAgentsInputs: true, hasPeerdepsInputs: true }],
    ['.changeset/bright-bugs-fix.md', { hasAgentsInputs: false, hasPeerdepsInputs: true }],
    ['.changeset/config.json', { hasAgentsInputs: false, hasPeerdepsInputs: true }],
    ['workspaces/s3/package.json', { hasAgentsInputs: false, hasPeerdepsInputs: true }],
    ['packages/server/src/index.ts', { hasAgentsInputs: false, hasPeerdepsInputs: true }],
    ['docs/guides/workspaces.mdx', { hasAgentsInputs: false, hasPeerdepsInputs: false }],
  ])('routes %s', (file, expected) => {
    expect(qualityAssuranceInputs([file])).toMatchObject(expected);
  });

  test('reports the input paths that selected each QA check', () => {
    expect(qualityAssuranceInputs(['AGENTS.md', '.changeset/config.json'])).toMatchObject({
      agentsReasons: ['AGENTS.md'],
      peerdepsReasons: ['.changeset/config.json'],
    });
  });

  test.each([undefined, [123]])('fails closed when changed files are malformed: %j', changedFiles => {
    expect(qualityAssuranceInputs(changedFiles)).toEqual({
      hasAgentsInputs: true,
      hasPeerdepsInputs: true,
      hasReadmeInputs: true,
      readmeReasons: ['invalid-input'],
      agentsReasons: ['invalid-input'],
      peerdepsReasons: ['invalid-input'],
    });
  });
});
