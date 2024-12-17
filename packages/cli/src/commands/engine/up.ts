import yoctoSpinner from 'yocto-spinner';

import { DockerService } from '../../services/service.docker.js';

export async function up() {
  const spinner = yoctoSpinner({ text: 'Starting docker container\n' });
  spinner.start();
  try {
    const dockerService = new DockerService();
    await dockerService.startDockerContainer('mastra-pg.docker-compose.yaml');
    spinner.success('Docker containers started successfully\n');
  } catch (error) {
    spinner.error('Failed to start Docker containers\n');
    throw error;
  }
}
