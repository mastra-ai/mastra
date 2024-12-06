import path from 'path';
import { fileURLToPath } from 'url';

import { copyStarterFile } from './copy-starter-file.js';
import { replaceValuesInFile } from './replace-value-in-file.js';

const DOCKER_COMPOSE_FILE = 'mastra-pg.docker-compose.yaml';

export function prepareDockerComposeFile({
  sanitizedProjectName,
  postgresPort,
}: {
  sanitizedProjectName: string;
  postgresPort: number;
}) {
  let dbUrl = `postgresql://postgres:postgres@localhost:${postgresPort}/mastra`;

  editDockerComposeFileForPG({ sanitizedProjectName, postgresPort });
  copyStarterFile(DOCKER_COMPOSE_FILE, DOCKER_COMPOSE_FILE);

  return { dbUrl: String(dbUrl) };
}

const editDockerComposeFileForPG = ({
  sanitizedProjectName,
  postgresPort,
}: {
  sanitizedProjectName: string;
  postgresPort: number;
}) => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const filePath = path.resolve(__dirname, '..', 'starter-files', DOCKER_COMPOSE_FILE);
  replaceValuesInFile({
    filePath,
    replacements: [
      { replace: sanitizedProjectName, search: 'REPLACE_PROJECT_NAME' },
      { replace: `${postgresPort}`, search: 'REPLACE_DB_PORT' },
    ],
  });
};
