import yoctoSpinner from 'yocto-spinner';

import { DepsService } from '../../services/service.deps';
import { DockerService } from '../../services/service.docker';

const DOCKER_COMPOSE_FILE = 'mastra-pg.docker-compose.yaml';

const spinner = yoctoSpinner();
export async function provision() {
  spinner.start('Provisioning docker file\n');
  const depsService = new DepsService();
  const projectName = await depsService.getProjectName();

  const dockerService = new DockerService();
  const sanitizedProjectName = dockerService.sanitizeName(projectName);

  const { postgresPort } = await dockerService.getInfraPorts();

  try {
    await dockerService.checkDockerRunning();

    const { dbUrl } = await dockerService.prepareComposeFile({
      sanitizedProjectName,
      postgresPort,
    });

    await dockerService.startDockerContainer(DOCKER_COMPOSE_FILE);
    spinner.success('Provisioning completed successfully\n');
    return { dbUrl };
  } catch (error) {
    spinner.error('Provisioning failed\n');
    throw error;
  }
}
