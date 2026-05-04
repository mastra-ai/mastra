import { readFile } from 'node:fs/promises';

import { globby } from 'globby';
import { estimateTokenCount } from 'tokenx';

const TOKEN_LIMIT = 500;
const files = await globby(['**/AGENTS.md', '!**/node_modules/**']);

let hasFailures = false;

for (const file of files.sort()) {
  const content = await readFile(file, 'utf8');
  const tokens = estimateTokenCount(content);
  const withinLimit = tokens <= TOKEN_LIMIT;

  console.log(`${withinLimit ? '✅' : '❌'} ${file}: ${tokens}/${TOKEN_LIMIT} tokens`);

  if (!withinLimit) {
    hasFailures = true;
  }
}

if (hasFailures) {
  console.error(`\nOne or more AGENTS.md files exceed the ${TOKEN_LIMIT}-token limit.`);
  process.exit(1);
}

console.log(`\nAll AGENTS.md files are within the ${TOKEN_LIMIT}-token limit.`);
