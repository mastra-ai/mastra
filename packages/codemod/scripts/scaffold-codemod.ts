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
};

// Create files
fs.writeFileSync(paths.codemod, codemodTemplate);
fs.writeFileSync(paths.test, testTemplate);
fs.writeFileSync(path.join(paths.fixtures, `${codemodName}.input.ts`), inputTemplate);
fs.writeFileSync(path.join(paths.fixtures, `${codemodName}.output.ts`), outputTemplate);

console.log(`Created codemod files for '${codemodName}'`);
