import yoctoSpinner from 'yocto-spinner';

import { DockerService } from '../../services/service.docker.js';

export async function down(composePath?: string) {
  const spinner = yoctoSpinner({ text: 'Shutting down docker container\n' });
  spinner.start();
  try {
    const dockerService = new DockerService();
    const composeFile = dockerService.getComposeFile(composePath);
    await dockerService.stopDockerContainer(composeFile);
    spinner.success('Docker container shut down successfully\n');
  } catch (error) {
    spinner.error('Failed to shut down Docker container\n');
    throw error;
  }
}
