import * as p from '@clack/prompts';
import yoctoSpinner from 'yocto-spinner';

import { DepsService } from '../../services/service.deps';
import { DockerService } from '../../services/service.docker';
import { FileService } from '../../services/service.file';

const DOCKER_COMPOSE_FILE = 'mastra-pg.docker-compose.yaml';

export async function add() {
  const spinner = yoctoSpinner();
  try {
    await checkAndInstallEngineDeps();

    const depsService = new DepsService();
    const projectName = await depsService.getProjectName();

    const dockerService = new DockerService();
    spinner.start('Provisioning Mastra database');
    const { dbUrl } = await dockerService.provision(projectName);
    spinner.success('Mastra database provisioned');

    spinner.start('Starting Mastra engine');
    dockerService.startDockerContainer(DOCKER_COMPOSE_FILE);
    spinner.success('Mastra engine started');

    const fileService = new FileService();
    await fileService.setupEnvFile({ dbUrl });
    spinner.success('Mastra engine setup complete');
  } catch (error) {
    spinner.error('Failed to start Mastra engine');
    throw error;
  }
}

async function checkAndInstallEngineDeps() {
  const depsService = new DepsService();
  const depCheck = await depsService.checkDependencies(['@mastra/engine', 'drizzle-kit']);

  if (depCheck !== 'ok') {
    await installEngineDeps();
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
