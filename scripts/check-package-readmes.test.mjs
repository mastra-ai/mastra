import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  SUPPORT_TEXT,
  buildDocsRouteSet,
  discoverPackages,
  extractLinks,
  shouldCheckPackage,
  validateReadme,
} from './check-package-readmes.mjs';

const scriptPath = fileURLToPath(new URL('./check-package-readmes.mjs', import.meta.url));

function createFixture() {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'check-package-readmes-'));
  writeJson(path.join(rootDir, 'package.json'), { name: 'fixture-root', private: true });
  return rootDir;
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath, content) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function validReadme(name, relativeDirectory, documentation = '- Mastra documentation') {
  return `# ${name}

A concise package description.

## Installation

\`\`\`bash
npm install ${name}
\`\`\`

## Usage

\`\`\`ts
import { createExample } from '${name}';

createExample();
\`\`\`

## Documentation

${documentation}

## Changelog

[View the changelog](https://github.com/mastra-ai/mastra/blob/main/${relativeDirectory}/CHANGELOG.md).

## Support

${SUPPORT_TEXT}
`;
}

function addPackage(rootDir, relativeDirectory, options = {}) {
  const name = options.name ?? `@mastra/${path.basename(relativeDirectory)}`;
  const packageDirectory = path.join(rootDir, relativeDirectory);
  writeJson(path.join(packageDirectory, 'package.json'), {
    name,
    ...(options.private === undefined ? {} : { private: options.private }),
  });

  if (options.readme !== false) {
    writeText(
      path.join(packageDirectory, 'README.md'),
      typeof options.readme === 'string' ? options.readme : validReadme(name, relativeDirectory),
    );
  }
  if (options.changelog !== false) {
    writeText(path.join(packageDirectory, 'CHANGELOG.md'), '# Changelog\n');
  }

  return packageDirectory;
}

function runCli(rootDir, ...arguments_) {
  return spawnSync(process.execPath, [scriptPath, ...arguments_], {
    cwd: rootDir,
    encoding: 'utf8',
  });
}

test('matches the canonical package eligibility rules', () => {
  assert.equal(shouldCheckPackage({ name: '@mastra/core' }), true);
  assert.equal(shouldCheckPackage({ name: 'mastra' }), true);
  assert.equal(shouldCheckPackage({ name: 'create-mastra-app' }), true);
  assert.equal(shouldCheckPackage({ name: '@internal/test' }), false);
  assert.equal(shouldCheckPackage({ name: '@mastra/memory-integration-tests-case' }), false);
  assert.equal(shouldCheckPackage({ name: '@mastra/core', private: true }), false);
  assert.equal(shouldCheckPackage({}), false);
  assert.equal(shouldCheckPackage({ name: 'unrelated-package' }), false);

  const rootDir = createFixture();
  addPackage(rootDir, 'packages/public', { name: '@mastra/public' });
  addPackage(rootDir, 'packages/private', { name: '@mastra/private', private: true });
  addPackage(rootDir, 'packages/ignored', { name: '@internal/ignored' });
  addPackage(rootDir, 'packages/unrelated', { name: 'unrelated-package' });

  assert.deepEqual(
    discoverPackages(rootDir).map(packageInfo => packageInfo.relativeDirectory),
    ['packages/public'],
  );
});

test('reports missing README and CHANGELOG files with exact diagnostics', () => {
  const rootDir = createFixture();
  addPackage(rootDir, 'packages/missing', { readme: false, changelog: false });

  const result = runCli(rootDir);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /packages\/missing\/README\.md:/);
  assert.match(result.stderr, /packages\/missing: missing README/);
  assert.match(result.stderr, /packages\/missing: missing CHANGELOG/);
});

test('requires the prescribed section order and non-empty content', () => {
  const rootDir = createFixture();
  const relativeDirectory = 'packages/sections';
  const name = '@mastra/sections';
  const readme = validReadme(name, relativeDirectory)
    .replace('## Usage\n\n```ts\n', '## Documentation\n\n## Usage\n\n```ts\n')
    .replace('## Documentation\n\n- Mastra documentation\n\n', '');
  addPackage(rootDir, relativeDirectory, { name, readme });

  const result = runCli(rootDir);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /expected H2 sections in this exact order/);
  assert.match(result.stderr, /Documentation section is empty or missing/);
});

test('ignores Markdown headings inside fenced usage examples', () => {
  const rootDir = createFixture();
  const relativeDirectory = 'packages/fenced-heading';
  const name = '@mastra/fenced-heading';
  addPackage(rootDir, relativeDirectory, {
    name,
    readme: validReadme(name, relativeDirectory).replace(
      'createExample();',
      "createExample('## Not a README section');",
    ),
  });

  const result = runCli(rootDir);

  assert.equal(result.status, 0, result.stderr);
});

test('parses README headings with CRLF line endings', () => {
  const rootDir = createFixture();
  const relativeDirectory = 'packages/crlf';
  const name = '@mastra/crlf';
  addPackage(rootDir, relativeDirectory, {
    name,
    readme: validReadme(name, relativeDirectory).replaceAll('\n', '\r\n'),
  });

  const result = runCli(rootDir);

  assert.equal(result.status, 0, result.stderr);
});

test('requires the exact package installation command', () => {
  const rootDir = createFixture();
  const relativeDirectory = 'packages/install';
  const name = '@mastra/install';
  addPackage(rootDir, relativeDirectory, {
    name,
    readme: validReadme(name, relativeDirectory).replace(`npm install ${name}`, 'npm install @mastra/other'),
  });

  const result = runCli(rootDir);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /exact command: npm install @mastra\/install/);
});

test('rejects export introspection and class aliases as usage examples', () => {
  const rootDir = createFixture();
  const introspectionDirectory = 'packages/introspection';
  const aliasDirectory = 'packages/alias';
  const introspectionName = '@mastra/introspection';
  const aliasName = '@mastra/alias';

  addPackage(rootDir, introspectionDirectory, {
    name: introspectionName,
    readme: validReadme(introspectionName, introspectionDirectory).replace(
      `import { createExample } from '${introspectionName}';\n\ncreateExample();`,
      `import * as packageApi from '${introspectionName}';\nconst availableExports = Object.values(packageApi);`,
    ),
  });
  addPackage(rootDir, aliasDirectory, {
    name: aliasName,
    readme: validReadme(aliasName, aliasDirectory).replace(
      `import { createExample } from '${aliasName}';\n\ncreateExample();`,
      `import { XAIRealtimeVoice } from '${aliasName}';\nconst voice = XAIRealtimeVoice;`,
    ),
  });

  const result = runCli(rootDir);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /packages\/introspection\/README\.md/);
  assert.match(result.stderr, /packages\/alias\/README\.md/);
  assert.match(result.stderr, /functional package example/);
});

test('rejects generic prerequisite boilerplate and import-only usage examples', () => {
  const rootDir = createFixture();
  const boilerplateDirectory = 'packages/boilerplate';
  const importOnlyDirectory = 'packages/import-only';

  addPackage(rootDir, boilerplateDirectory, {
    name: '@mastra/boilerplate',
    readme: validReadme('@mastra/boilerplate', boilerplateDirectory).replace(
      '## Usage\n\n',
      '## Usage\n\nConfigure the prerequisites described in the documentation.\n\n',
    ),
  });
  addPackage(rootDir, importOnlyDirectory, {
    name: '@mastra/import-only',
    readme: validReadme('@mastra/import-only', importOnlyDirectory).replace(
      `import { createExample } from '@mastra/import-only';\n\ncreateExample();`,
      `import { Example } from '@mastra/import-only';`,
    ),
  });

  const result = runCli(rootDir);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /must state concrete prerequisites or omit the prerequisite preamble/);
  assert.match(result.stderr, /functional package example/);
});

test('requires integration docs frontmatter to include the package name', () => {
  const rootDir = createFixture();
  const relativeDirectory = 'packages/provider';
  const documentationUrl = 'https://mastra.ai/integrations/provider';
  writeText(
    path.join(rootDir, 'docs/src/content/en/integrations/provider.mdx'),
    '---\npackages:\n  - "@mastra/other-provider"\n---\n# Provider\n',
  );
  addPackage(rootDir, relativeDirectory, {
    name: '@mastra/provider',
    readme: validReadme('@mastra/provider', relativeDirectory, `- [Provider](${documentationUrl})`),
  });

  const result = runCli(rootDir);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /integration docs link does not document @mastra\/provider/);
  assert.match(result.stderr, new RegExp(documentationUrl.replaceAll('/', '\\/')));
});

test('requires the exact package changelog URL', () => {
  const rootDir = createFixture();
  const relativeDirectory = 'packages/changelog';
  const name = '@mastra/changelog';
  addPackage(rootDir, relativeDirectory, {
    name,
    readme: validReadme(name, relativeDirectory).replace(
      `${relativeDirectory}/CHANGELOG.md`,
      'packages/other/CHANGELOG.md',
    ),
  });

  const result = runCli(rootDir);

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Changelog section must link to https:\/\/github\.com\/mastra-ai\/mastra\/blob\/main\/packages\/changelog\/CHANGELOG\.md/,
  );
});

test('requires the standard Discord support paragraph', () => {
  const rootDir = createFixture();
  const relativeDirectory = 'packages/support';
  const name = '@mastra/support';
  addPackage(rootDir, relativeDirectory, {
    name,
    readme: validReadme(name, relativeDirectory).replace(SUPPORT_TEXT, 'Ask for help elsewhere.'),
  });

  const result = runCli(rootDir);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /standard Discord support paragraph/);
});

test('resolves default, index, direct MDX, encoded, query, anchor, and scalar slug routes', () => {
  const rootDir = createFixture();
  writeText(path.join(rootDir, 'docs/src/content/en/docs/getting-started.mdx'), '# Getting started\n');
  writeText(path.join(rootDir, 'docs/src/content/en/docs/guides/index.mdx'), '# Guides\n');
  writeText(path.join(rootDir, 'docs/src/content/en/docs/space name.mdx'), '# Encoded\n');
  writeText(
    path.join(rootDir, 'docs/src/content/en/docs/slugs/unquoted.mdx'),
    '---\nslug: custom-unquoted\n---\n# Unquoted\n',
  );
  writeText(
    path.join(rootDir, 'docs/src/content/en/docs/slugs/single.mdx'),
    "---\nslug: 'custom-single'\n---\n# Single\n",
  );
  writeText(
    path.join(rootDir, 'docs/src/content/en/docs/slugs/double.mdx'),
    '---\nslug: "/custom-double"\n---\n# Double\n',
  );
  writeText(path.join(rootDir, 'docs/src/content/en/reference/api.mdx'), '# API\n');
  writeText(path.join(rootDir, 'docs/src/content/en/integrations/provider/index.mdx'), '# Provider\n');
  writeText(path.join(rootDir, 'docs/src/content/en/models/provider.mdx'), '# Model\n');

  const relativeDirectory = 'packages/routes';
  const documentation = [
    '- [Default](https://mastra.ai/docs/getting-started?source=readme#start)',
    '- [Index](https://mastra.ai/docs/guides/)',
    '- [Direct MDX](https://mastra.ai/reference/api.mdx)',
    '- [Encoded](https://mastra.ai/docs/space%20name)',
    '- [Unquoted slug](https://mastra.ai/docs/slugs/custom-unquoted)',
    '- [Single slug](https://mastra.ai/docs/slugs/custom-single)',
    '- [Double slug](https://mastra.ai/docs/custom-double)',
    '- <https://mastra.ai/integrations/provider>',
    '- https://mastra.ai/models/provider',
  ].join('\n');
  addPackage(rootDir, relativeDirectory, {
    name: '@mastra/routes',
    readme: validReadme('@mastra/routes', relativeDirectory, documentation),
  });

  const result = runCli(rootDir);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /All 1 eligible package READMEs passed validation/);
});

test('ignores links in fenced code and Markdown images', () => {
  const rootDir = createFixture();
  const relativeDirectory = 'packages/ignored-links';
  const documentation = `- Package documentation is forthcoming.

\`\`\`md
[Not a real link](https://mastra.ai/docs/does-not-exist)
\`\`\`

![Diagram](https://mastra.ai/reference/also-does-not-exist)`;
  addPackage(rootDir, relativeDirectory, {
    name: '@mastra/ignored-links',
    readme: validReadme('@mastra/ignored-links', relativeDirectory, documentation),
  });

  assert.deepEqual(
    extractLinks('```md\nhttps://mastra.ai/docs/nope\n```\n![Image](https://mastra.ai/docs/nope-again)'),
    [],
  );
  const result = runCli(rootDir);
  assert.equal(result.status, 0, result.stderr);
});

test('reports unresolved docs links with the package directory and source URL', () => {
  const rootDir = createFixture();
  const relativeDirectory = 'packages/broken-link';
  const brokenUrl = 'https://mastra.ai/docs/does-not-exist';
  addPackage(rootDir, relativeDirectory, {
    name: '@mastra/broken-link',
    readme: validReadme('@mastra/broken-link', relativeDirectory, `- [Broken](${brokenUrl})`),
  });

  const result = runCli(rootDir);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /packages\/broken-link\/README\.md:/);
  assert.match(result.stderr, /unresolved Mastra docs link/);
  assert.match(result.stderr, new RegExp(brokenUrl.replaceAll('/', '\\/')));
});

test('focused mode validates only canonical packages under selected directories or README paths', () => {
  const rootDir = createFixture();
  addPackage(rootDir, 'packages/good', { name: '@mastra/good' });
  addPackage(rootDir, 'packages/bad', { name: '@mastra/bad', readme: false });

  const directoryResult = runCli(rootDir, 'packages/good');
  const readmeResult = runCli(rootDir, 'packages/good/README.md');
  const allResult = runCli(rootDir);

  assert.equal(directoryResult.status, 0, directoryResult.stderr);
  assert.equal(readmeResult.status, 0, readmeResult.stderr);
  assert.equal(allResult.status, 1);
  assert.doesNotMatch(directoryResult.stderr, /packages\/bad/);
});

test('--print-readme-paths prints sorted paths only after all selected READMEs exist', () => {
  const rootDir = createFixture();
  addPackage(rootDir, 'packages/zeta', { name: '@mastra/zeta' });
  addPackage(rootDir, 'packages/alpha', { name: '@mastra/alpha' });

  const passingResult = runCli(rootDir, '--print-readme-paths', 'packages');

  assert.equal(passingResult.status, 0, passingResult.stderr);
  assert.equal(passingResult.stderr, '');
  assert.equal(passingResult.stdout, 'packages/alpha/README.md\npackages/zeta/README.md\n');

  addPackage(rootDir, 'packages/missing', { name: '@mastra/missing', readme: false });
  const failingResult = runCli(rootDir, '--print-readme-paths', 'packages');

  assert.equal(failingResult.status, 1);
  assert.equal(failingResult.stdout, '');
  assert.match(failingResult.stderr, /packages\/missing: missing README/);
});

test('pure validation helpers return multiple actionable diagnostics', () => {
  const rootDir = createFixture();
  const docsRoutes = buildDocsRouteSet(rootDir);
  const errors = validateReadme({
    content: '# Package\n\n## Installation\n\nWrong\n',
    name: '@mastra/multiple',
    relativeDirectory: 'packages/multiple',
    docsRoutes,
  });

  assert.ok(errors.length > 3);
  assert.ok(errors.some(error => error.includes('exact command')));
  assert.ok(errors.some(error => error.includes('Changelog section')));
  assert.ok(errors.some(error => error.includes('Support section')));
});
