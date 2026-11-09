import { expect, it } from 'vitest';
import { resolveProjectRoot, resolveRuntimeRoot } from '../../src/mastra/runtime/paths.ts';

it('uses the same runtime for terminal commands, Mastra dev and production start', () => {
  const root = '/project/vendor-risk';
  const expected = `${root}/.runtime`;
  expect(resolveRuntimeRoot({}, root)).toBe(expected);
  expect(
    resolveProjectRoot({ MASTRA_DEV: 'true', MASTRA_PROJECT_ROOT: `${root}/.mastra` }, `${root}/src/mastra/public`),
  ).toBe(root);
  expect(resolveProjectRoot({ MASTRA_PROJECT_ROOT: root }, `${root}/.mastra/output`)).toBe(root);
  expect(
    resolveRuntimeRoot({ MASTRA_DEV: 'true', MASTRA_PROJECT_ROOT: `${root}/.mastra` }, `${root}/src/mastra/public`),
  ).toBe(expected);
  expect(resolveRuntimeRoot({ MASTRA_PROJECT_ROOT: root }, `${root}/.mastra/output`)).toBe(expected);
  expect(resolveRuntimeRoot({ MASTRA_DEV: 'true', MASTRA_PROJECT_ROOT: root }, `${root}/src/mastra/public`)).toBe(
    expected,
  );
});
