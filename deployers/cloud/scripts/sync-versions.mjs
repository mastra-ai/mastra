import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getPackages } from '@manypkg/get-packages';
import { writeJson } from 'fs-extra/esm';

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

await writeJson(join(__dirname, '../versions.json'), versionsToWrite);
