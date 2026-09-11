import { describe, expect, test } from 'vitest';
import routing from './studio-e2e-routing.cjs';

const { studioE2eChanged } = routing;

const routedPaths = [
  'packages/playground/src/pages/experiments/review-queue/index.tsx',
  'packages/playground/src/domains/review/dataset-review.tsx',
  'packages/playground/src/App.tsx',
  'packages/playground-ui/src/components/Button/Button.tsx',
  'packages/playground-ui/src/domains/memory/components/memory-list.tsx',
];

describe('studio E2E routing', () => {
  test.each(routedPaths)('routes source change %s', path => {
    expect(studioE2eChanged([path])).toBe(true);
  });

  test('routes mixed change lists containing at least one source file', () => {
    expect(
      studioE2eChanged([
        'packages/core/src/index.ts',
        'packages/playground/src/pages/experiments/review-queue/index.tsx',
        '.changeset/experiment-review-queue-page.md',
      ]),
    ).toBe(true);
  });

  test.each([
    'packages/core/src/index.ts',
    'packages/server/src/index.ts',
    'docs/guides/playground.mdx',
    '.changeset/experiment-review-queue-page.md',
    'packages/playground/package.json',
    'packages/playground-ui/package.json',
    'packages/playground/e2e/tests/root.spec.ts',
    'packages/playground/dist/index.html',
    'packages/playground-ui/dist/style.css',
    'packages/playground/playwright.config.ts',
    'packages/playground/public/favicon.ico',
  ])('does not route unrelated change %s', path => {
    expect(studioE2eChanged([path])).toBe(false);
  });

  test('does not route a changeset-only or docs-only change list', () => {
    expect(studioE2eChanged(['.changeset/experiment-review-queue-page.md'])).toBe(false);
    expect(studioE2eChanged(['docs/guides/playground.mdx'])).toBe(false);
  });

  test('prefix boundary: packages/playground-e2e/src/ does not trigger', () => {
    expect(studioE2eChanged(['packages/playground-e2e/src/index.ts'])).toBe(false);
  });

  test('prefix boundary: packages/playgroundui/src/ does not trigger', () => {
    expect(studioE2eChanged(['packages/playgroundui/src/index.ts'])).toBe(false);
  });

  test('returns false for an empty change list', () => {
    expect(studioE2eChanged([])).toBe(false);
  });
});
