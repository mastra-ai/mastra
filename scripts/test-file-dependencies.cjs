// File reads and directory scans do not create import edges. Register their
// inputs here: exact repository-relative files, or directories ending in '/'.
// Directory inputs also match newly added and deleted files.
const ui = 'packages/playground-ui';
const testFileDependencies = {
  [`${ui}/src/theme-export.test.ts`]: [`${ui}/package.json`, `${ui}/theme.css`, `${ui}/theme/`, `${ui}/src/`],
  [`${ui}/src/components-exports.test.ts`]: [`${ui}/package.json`, `${ui}/src/ds/components/`],
  [`${ui}/src/ds/tokens/color-foundations-coverage.test.tsx`]: [`${ui}/theme.css`, `${ui}/theme/`],
  [`${ui}/src/hooks/__tests__/storybook-coverage.test.ts`]: [`${ui}/src/hooks/`, `${ui}/src/lib/keyboard/`],
  [`${ui}/src/ds/primitives/floating.test.ts`]: [`${ui}/src/ds/components/`],
  [`${ui}/src/lib/toast.test.ts`]: [`${ui}/src/lib/toast.css`],
  [`${ui}/src/ds/components/MarkdownRenderer/markdown-renderer.test.tsx`]: [
    `${ui}/src/ds/components/MarkdownRenderer/markdown-renderer.css`,
  ],
  [`${ui}/src/domains/chat/tools/__tests__/tool-card-hooks.test.ts`]: [`${ui}/src/domains/chat/tools/tool-card.tsx`],
  [`${ui}/src/lib/file/__tests__/schemes.parity.test.ts`]: [
    'packages/core/src/agent/message-list/prompt/attachments-to-parts.ts',
  ],
};

function getTestFileDependencies(changedFiles, testFiles) {
  const existingTests = new Set(testFiles);
  return Object.fromEntries(
    Object.entries(testFileDependencies)
      .filter(([testFile]) => existingTests.has(testFile))
      .map(([testFile, inputs]) => [
        testFile,
        changedFiles.filter(
          file =>
            file === 'scripts/test-file-dependencies.cjs' ||
            inputs.some(input => (input.endsWith('/') ? file.startsWith(input) : file === input)),
        ),
      ])
      .filter(([, inputs]) => inputs.length > 0),
  );
}

module.exports = { getTestFileDependencies };
