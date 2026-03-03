import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPackages } from '@manypkg/get-packages';

const __dirname = dirname(fileURLToPath(import.meta.url));

const { packages } = await getPackages(process.cwd());
const versionsToSync = ['@mastra/loggers', '@mastra/libsql', '@mastra/cloud'];

const versionsToWrite = {};
packages.forEach(pkg => {
  if (versionsToSync.includes(pkg.packageJson.name)) {
    const version = pkg.packageJson.version;
    versionsToWrite[pkg.packageJson.name] = version;
  }
});

console.log(`Writing versions to versions.json:\n${JSON.stringify(versionsToWrite, null, 2)}`);

await writeFile(join(__dirname, '../versions.json'), JSON.stringify(versionsToWrite, null, 2) + '\n', 'utf-8');
