import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { expect, it } from 'vitest';

/** The CLI bundle plus the local chunks it imports, since the bundler may move the boot into a shared chunk. */
async function readCliBundle(cliPath: string): Promise<string> {
  const cli = await readFile(cliPath, 'utf8');
  const chunks = [...cli.matchAll(/from\s*['"](\.\/[^'"]+\.js)['"]/g)].map(match =>
    readFile(resolve(dirname(cliPath), match[1]!), 'utf8'),
  );
  return [cli, ...(await Promise.all(chunks))].join('\n');
}

it('embeds the Mastra Code package version in the installed CLI', async () => {
  const packageDir = resolve(__dirname, '..', '..', 'mastracode', 'tui');
  const pkg = JSON.parse(await readFile(resolve(packageDir, 'package.json'), 'utf8')) as { version: string };
  const cli = await readCliBundle(resolve(packageDir, 'dist', 'cli.js'));

  expect(cli).toContain(JSON.stringify(pkg.version));
  expect(cli).not.toMatch(
    /import\s*\{[^}]*\bgetCurrentVersion\b[^}]*\}\s*from\s*['"]@mastra\/code-sdk\/utils\/update-check['"]/,
  );
});
