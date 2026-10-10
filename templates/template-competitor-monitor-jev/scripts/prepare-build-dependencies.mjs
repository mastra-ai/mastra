import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';

// Mastra externalizes Stagehand but does not copy npm overrides into its output manifest.
const source = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const outputPath = new URL('../.mastra/output/package.json', import.meta.url);
const output = JSON.parse(await readFile(outputPath, 'utf8'));
output.overrides = source.overrides;
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('BUILD_REQUIRES_NPM_LIFECYCLE');
execFileSync(process.execPath, [npmCli, 'install', '--ignore-scripts', '--no-audit', '--no-fund'], {
  cwd: new URL('../.mastra/output/', import.meta.url),
  stdio: 'inherit',
});
