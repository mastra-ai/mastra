import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { expect, it } from 'vitest';

it('embeds the Mastra Code package version in the installed CLI', async () => {
  const packageDir = resolve(__dirname, '..', '..', 'mastracode', 'tui');
  const pkg = JSON.parse(await readFile(resolve(packageDir, 'package.json'), 'utf8')) as { version: string };
  // dist/cli.js is a small bootstrap that re-execs Node with heap flags, then imports the real entry chunk.
  const bootstrap = await readFile(resolve(packageDir, 'dist', 'cli.js'), 'utf8');
  const mainChunk = bootstrap.match(/import\(\s*['"](\.\/main-[^'"]+\.js)['"]\s*\)/)?.[1];
  expect(mainChunk).toBeDefined();
  const cli = await readFile(resolve(packageDir, 'dist', mainChunk!), 'utf8');

  expect(cli).toContain(JSON.stringify(pkg.version));
  expect(cli).not.toMatch(
    /import\s*\{[^}]*\bgetCurrentVersion\b[^}]*\}\s*from\s*['"]@mastra\/code-sdk\/utils\/update-check['"]/,
  );
});
