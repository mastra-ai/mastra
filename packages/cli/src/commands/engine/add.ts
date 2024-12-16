import * as p from '@clack/prompts';
import yoctoSpinner from 'yocto-spinner';

import { DepsService } from '../../services/service.deps.js';
import { DockerService } from '../../services/service.docker.js';
import { FileService } from '../../services/service.file.js';

const DOCKER_COMPOSE_FILE = 'mastra-pg.docker-compose.yaml';

export async function add() {
  const spinner = yoctoSpinner({ text: 'Setting up Mastra Engine\n' });
  spinner.start();
  try {
    await installEngineDeps();

    const depsService = new DepsService();
    const projectName = await depsService.getProjectName();

    const dockerService = new DockerService();
    const { dbUrl } = await dockerService.provision(projectName);
    dockerService.startDockerContainer(DOCKER_COMPOSE_FILE);

    const fileService = new FileService();
    await fileService.setupEnvFile({ dbUrl });
  } catch (error) {
    spinner.error('Failed to start Docker containers\n');
    throw error;
  }
}

async function installEngineDeps() {
  const spinner = yoctoSpinner({ text: 'Installing Mastra engine dependencies\n' });

  try {
    const confirm = await p.confirm({
      message: 'Do you want to install the required dependencies (@mastra/engine and drizzle-kit)?',
      initialValue: false,
    });

    if (p.isCancel(confirm)) {
      p.cancel('Installation Cancelled');
      process.exit(0);
    }

    if (!confirm) {
      p.cancel('Installation Cancelled');
      process.exit(0);
    }

    const depsService = new DepsService();

    spinner.start();
    await depsService.installPackages(['@mastra/engine@alpha', 'drizzle-kit']);
    spinner.success('Dependencies installed successfully');
  } catch (err) {
    spinner.error('Could not install dependencies');
    console.error(err);
  }
}
