import { execa } from 'execa';
import yoctoSpinner from 'yocto-spinner';

import { getProjectName } from '../utils/get-project-name.js';
import { getInfraPorts } from '../utils/port-utils.js';
import { sanitizeForDockerName } from '../utils/sanitize-docker-name.js';
import { prepareDockerComposeFile } from '../utils/setup-docker-compose.js';
import { setupRoutes } from '../utils/setup-routes.js';

const DOCKER_COMPOSE_FILE = 'mastra-pg.docker-compose.yaml';
const spinner = yoctoSpinner({ text: 'Provisioning docker file\n' });
export async function provision() {
  spinner.start();
  const projectName = await getProjectName();
  const sanitizedProjectName = sanitizeForDockerName(projectName);

  const { postgresPort } = await getInfraPorts();

  try {
    spinner.text = 'Checking if Docker is running...\n';
    await execa('docker', ['info'], { stdio: 'ignore', shell: true });
  } catch (error) {
    spinner.error('Docker Daemon is not running. Please start Docker and try again\n');
    console.error();
  }

  const { dbUrl } = prepareDockerComposeFile({
    sanitizedProjectName,
    postgresPort,
  });

  spinner.text = 'Starting docker container\n';
  try {
    await execa('docker', ['compose', '-f', DOCKER_COMPOSE_FILE, 'up', '-d'], { stdio: 'inherit' });
    spinner.success('Docker containers started successfully\n');
  } catch (error) {
    spinner.error('Failed to start Docker containers\n');
    console.error(error);
  }

  spinner.start('Setting up routes');
  try {
    await setupRoutes();
    spinner.success('Routes setup successfully\n');
  } catch (err) {
    spinner.error('Could no setup routes\n');
    console.error(err);
  }

  return { dbUrl };
}
