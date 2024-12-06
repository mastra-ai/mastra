import { copyStarterFile, replaceValuesInFile } from '../lib.js';

const DOCKER_COMPOSE_FILE = 'mastra-pg.docker-compose.yaml';

export function prepareDockerComposeFile({
  sanitizedProjectName,
  postgresPort,
}: {
  sanitizedProjectName: string;
  postgresPort: number;
}) {
  let dbUrl = `postgresql://postgres:postgres@localhost:${postgresPort}/mastra`;

  const editDockerComposeFileForPG = () => {
    replaceValuesInFile({
      filePath: DOCKER_COMPOSE_FILE,
      replacements: [
        { replace: sanitizedProjectName, search: 'REPLACE_PROJECT_NAME' },
        { replace: `${postgresPort}`, search: 'REPLACE_DB_PORT' },
      ],
    });
  };

  copyStarterFile(DOCKER_COMPOSE_FILE, DOCKER_COMPOSE_FILE);
  editDockerComposeFileForPG();

  return { dbUrl: String(dbUrl) };
}
