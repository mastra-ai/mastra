import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { expect, it } from 'vitest';

it('embeds the Mastra Code package version in the installed CLI', async () => {
  const packageDir = resolve(__dirname, '..', '..', 'mastracode', 'tui');
  const pkg = JSON.parse(await readFile(resolve(packageDir, 'package.json'), 'utf8')) as { version: string };
  const cli = await readFile(resolve(packageDir, 'dist', 'cli.js'), 'utf8');

  expect(cli).toContain(JSON.stringify(pkg.version));
  expect(cli).not.toMatch(
    /import\s*\{[^}]*\bgetCurrentVersion\b[^}]*\}\s*from\s*['"]@mastra\/code-sdk\/utils\/update-check['"]/,
  );
});
