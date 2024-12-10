import yoctoSpinner from 'yocto-spinner';

import { DockerService } from '../../services/service.docker.js';
import { getProjectName } from '../../utils/get-project-name.js';

const DOCKER_COMPOSE_FILE = 'mastra-pg.docker-compose.yaml';

export async function provision() {
  const spinner = yoctoSpinner({ text: 'Provisioning docker file\n' });
  spinner.start();
  const projectName = await getProjectName();

  const dockerService = new DockerService();
  const sanitizedProjectName = dockerService.sanitizeName(projectName);

  const { postgresPort } = await dockerService.getInfraPorts();

  try {
    await dockerService.checkDockerRunning(spinner);

    const { dbUrl } = dockerService.prepareComposeFile({
      sanitizedProjectName,
      postgresPort,
    });

    await dockerService.startDockerContainer(DOCKER_COMPOSE_FILE, spinner);

    spinner.success('Provisioning completed successfully\n');
    return { dbUrl };
  } catch (error) {
    spinner.error('Provisioning failed\n');
    throw error;
  }
}
