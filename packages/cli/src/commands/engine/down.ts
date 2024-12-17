import yoctoSpinner from 'yocto-spinner';

import { DockerService } from '../../services/service.docker.js';

export async function down() {
  const spinner = yoctoSpinner({ text: 'Shutting down docker container\n' });
  spinner.start();
  try {
    const dockerService = new DockerService();
    await dockerService.stopDockerContainer('mastra-pg.docker-compose.yaml');
    spinner.success('Docker container shut down successfully\n');
  } catch (error) {
    spinner.error('Failed to shut down Docker container\n');
    throw error;
  }
}
