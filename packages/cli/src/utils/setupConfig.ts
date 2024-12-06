import { copyStarterFile, replaceValuesInFile } from '../lib.js';

const KPL_CONFIG_FILE = 'mastra.config.ts';
export async function setupConfig({
  postgresPort,
  sanitizedProjectName,
}: {
  postgresPort: number;
  sanitizedProjectName: string;
}) {
  copyStarterFile('config.ts', KPL_CONFIG_FILE);

  replaceValuesInFile({
    filePath: KPL_CONFIG_FILE,
    replacements: [
      {
        search: 'REPLACE_DB_PORT',
        replace: `${postgresPort}`,
      },
      {
        search: 'PROJECT_NAME',
        replace: `${sanitizedProjectName}`,
      },
    ],
  });
}
