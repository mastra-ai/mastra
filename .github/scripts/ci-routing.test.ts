import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import routing from './ci-routing.cjs';

const { qualityAssuranceInputs, selectWorkspacePackages, validateWorkspacePackages } = routing;
const majorVersionWorkflow = readFileSync(new URL('../workflows/major-version-check.yml', import.meta.url), 'utf8');
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
  });
});

describe('major version workflow routing', () => {
  test('uses exact approval command matching for triggers and comment scanning', () => {
    expect(majorVersionWorkflow).toContain("github.event.comment.body == '!allow-major'");
    expect(majorVersionWorkflow).toContain("github.event.changes.body.from == '!allow-major'");
    expect(majorVersionWorkflow).toContain("comment => comment.body === '!allow-major'");
    expect(majorVersionWorkflow).not.toContain('comment.body.trim().toLowerCase()');
  });

  test('isolates pull request and approval-comment concurrency', () => {
    expect(majorVersionWorkflow).toContain(
      'group: ${{ github.workflow }}-${{ github.event_name }}-${{ github.head_ref || github.event.issue.number || github.run_id }}',
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

  test('fails closed when changed files are unavailable', () => {
    expect(qualityAssuranceInputs(undefined)).toMatchObject({
      hasAgentsInputs: true,
      hasPeerdepsInputs: true,
    });
  });
});
