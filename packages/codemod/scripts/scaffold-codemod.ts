/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';

const codemodName = process.argv[2];
const version = process.argv[3] ?? 'v1';
if (!codemodName) {
  console.error('Please provide a codemod name');
  process.exit(1);
}

// Templates
const codemodTemplate = `import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // TODO
});
`;

const testTemplate = `import { describe, it } from 'vitest';
import transformer from '../codemods/${version}/${codemodName}';
import { testTransform } from './test-utils';

describe('${codemodName}', () => {
  it('transforms correctly', () => {
    testTransform(transformer, '${codemodName}');
  });
});
`;

const inputTemplate = `// @ts-nocheck
// TODO: Add input code
`;

const outputTemplate = `// @ts-nocheck
// TODO: Add expected output code
`;

// File paths
const paths = {
  codemod: path.join(process.cwd(), 'src', 'codemods', version, `${codemodName}.ts`),
  test: path.join(process.cwd(), 'src', 'test', `${codemodName}.test.ts`),
  fixtures: path.join(process.cwd(), 'src', 'test', '__fixtures__'),
  bundle: path.join(process.cwd(), 'src', 'lib', 'bundle.ts'),
};

// Create files
fs.writeFileSync(paths.codemod, codemodTemplate);
fs.writeFileSync(paths.test, testTemplate);
fs.writeFileSync(path.join(paths.fixtures, `${codemodName}.input.ts`), inputTemplate);
fs.writeFileSync(path.join(paths.fixtures, `${codemodName}.output.ts`), outputTemplate);

// Update bundle.ts
const bundleContent = fs.readFileSync(paths.bundle, 'utf-8');
const codemodPath = `${version}/${codemodName}`;

// Check if the codemod is already in the bundle
if (!bundleContent.includes(`'${codemodPath}'`)) {
  // Find the BUNDLE array and add the new codemod
  const updatedBundleContent = bundleContent.replace(/export const BUNDLE = \[([\s\S]*?)\];/, (match, items) => {
    const entries = items
      .split(',')
      .map((item: string) => item.trim())
      .filter((item: string) => item.length > 0);

    entries.push(`'${codemodPath}'`);

    const formattedEntries = entries.map((entry: string) => `  ${entry}`).join(',\n');
    return `export const BUNDLE = [\n${formattedEntries}\n];`;
  });

  fs.writeFileSync(paths.bundle, updatedBundleContent);
  console.log(`Added '${codemodPath}' to BUNDLE array`);
}

console.log(`Created codemod files for '${codemodName}'`);
