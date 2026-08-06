import { describe, expect, test } from 'vitest';
import routing from './experiment-worker-routing.cjs';

const { dispatchedJobEnabled, experimentWorkerE2eChanged, scheduledJobEnabled } = routing;

const routedPaths = [
  'e2e-tests/experiment-worker/tests/minimal-agent.test.ts',
  'e2e-tests/_local-registry-setup/registry.js',
  'packages/cli/src/commands/experiment/build.ts',
  'packages/deployer/src/build/analyze.ts',
  'packages/deployer/src/services/deps.ts',
  '.github/workflows/e2e-tests.yml',
  '.github/workflows/e2e-experiment-worker.yml',
  '.github/workflows/prebuild.yml',
  'pnpm-lock.yaml',
];

describe('experiment worker workflow routing', () => {
  test.each(routedPaths)('routes changes to %s', path => {
    expect(experimentWorkerE2eChanged([path])).toBe(true);
  });

  test('routes CLI entry changes only when experiment registration changes', () => {
    expect(
      experimentWorkerE2eChanged(['packages/cli/src/commands/index.ts'], '+ registerCommand(experimentCommand)'),
    ).toBe(true);
    expect(experimentWorkerE2eChanged(['packages/cli/src/index.ts'], '+ registerCommand(devCommand)')).toBe(false);
  });

  test('does not route unrelated E2E or package changes', () => {
    expect(experimentWorkerE2eChanged(['e2e-tests/deployers/index.test.ts'])).toBe(false);
    expect(experimentWorkerE2eChanged(['packages/core/src/agent/index.ts'])).toBe(false);
  });

  test('routes scheduled execution to full, browser, and every gated job', () => {
    expect(scheduledJobEnabled('pr')).toBe(false);
    expect(scheduledJobEnabled('full')).toBe(true);
    expect(scheduledJobEnabled('browser')).toBe(true);
    expect(scheduledJobEnabled('gated-remote-sandbox')).toBe(true);
    expect(scheduledJobEnabled('gated-object-store')).toBe(true);
    expect(scheduledJobEnabled('gated-real-model')).toBe(true);
    expect(scheduledJobEnabled('gated-hosted-proxy')).toBe(true);
  });

  test.each([
    [{ tier: 'pr', job: 'pr' }, true],
    [{ tier: 'pr', job: 'full' }, false],
    [{ tier: 'full', job: 'full' }, true],
    [{ tier: 'full', job: 'browser' }, true],
    [{ tier: 'full', job: 'gated-real-model' }, false],
    [{ tier: 'gated', job: 'gated-real-model' }, true],
    [{ tier: 'gated', job: 'full' }, false],
  ] as const)('routes dispatch %o', (input, expected) => {
    expect(dispatchedJobEnabled(input)).toBe(expected);
  });

  test.each([
    ['workspace-browser', 'browser'],
    ['remote-sandbox', 'gated-remote-sandbox'],
    ['object-store', 'gated-object-store'],
    ['real-model', 'gated-real-model'],
    ['hosted-proxy', 'gated-hosted-proxy'],
    ['minimal-agent', 'full'],
  ])('routes explicit scenario %s only to %s', (scenario, owner) => {
    const jobs = [
      'pr',
      'full',
      'browser',
      'gated-remote-sandbox',
      'gated-object-store',
      'gated-real-model',
      'gated-hosted-proxy',
    ];
    expect(jobs.filter(job => dispatchedJobEnabled({ tier: 'full', scenario, job }))).toEqual([owner]);
  });
});
