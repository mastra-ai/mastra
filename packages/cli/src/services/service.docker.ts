import { execa } from 'execa';
import path from 'path';
import { check } from 'tcp-port-used';
import { fileURLToPath } from 'url';

import { copyStarterFile } from '../utils/copy-starter-file.js';
import { replaceValuesInFile } from '../utils/replace-value-in-file.js';

export class DockerService {
  // Docker functionality will be moved here from provision.ts

  sanitizeName(name: string): string {
    // Convert to lowercase
    let sanitized = name.toLowerCase();

    // Replace any non-alphanumeric characters (excluding dashes) with dashes
    sanitized = sanitized.replace(/[^a-z0-9-]/g, '-');

    // Trim dashes from the start and end
    sanitized = sanitized.replace(/^-+|-+$/g, '');

    // Ensure name is between 2 and 255 characters
    if (sanitized.length < 2) {
      throw new Error('Name must be at least 2 characters long.');
    }
    if (sanitized.length > 255) {
      sanitized = sanitized.substring(0, 255);
    }

    return sanitized;
  }

  async isPortOpen(port: number): Promise<boolean> {
    return new Promise(resolve => {
      check(port).then((inUse: boolean) => {
        resolve(!inUse);
      });
    });
  }

  private async getNextOpenPort(startFrom: number = 2222): Promise<number> {
    for (const port of Array.from({ length: 20 }, (_, i) => startFrom + i)) {
      const isOpen = await this.isPortOpen(port);
      if (isOpen) {
        return port;
      }
    }
    throw new Error('No open ports found after 20 attempts');
  }

  async getInfraPorts({
    defaultPostgresPort,
  }: { defaultAdminPort?: number; defaultInngestPort?: number; defaultPostgresPort?: number } = {}) {
    let postgresPort = defaultPostgresPort || 5432;
    const dbPortOpen = await this.isPortOpen(postgresPort);

    if (!dbPortOpen) {
      postgresPort = (await this.getNextOpenPort(postgresPort)) as number;
    }

    return { postgresPort };
  }

  async checkDockerRunning(spinner: any) {
    spinner.text = 'Checking if Docker is running...\n';
    try {
      await execa('docker', ['info'], { stdio: 'ignore', shell: true });
      spinner.success('Docker is running\n');
    } catch (error) {
      spinner.error('Docker Daemon is not running. Please start Docker and try again\n');
      console.error();
      throw error; // Re-throw the error if needed
    }
  }

  async startDockerContainer(dockerComposeFile: string, spinner: any) {
    spinner.text = 'Starting docker container\n';
    try {
      await execa('docker', ['compose', '-f', dockerComposeFile, 'up', '-d'], { stdio: 'inherit' });
      spinner.success('Docker containers started successfully\n');
    } catch (error) {
      spinner.error('Failed to start Docker containers\n');
      console.error(error);
      throw error; // Re-throw the error if needed
    }
  }

  prepareComposeFile({ sanitizedProjectName, postgresPort }: { sanitizedProjectName: string; postgresPort: number }) {
    let dbUrl = `postgresql://postgres:postgres@localhost:${postgresPort}/mastra`;

    this.editComposeFile({ sanitizedProjectName, postgresPort });
    copyStarterFile('mastra-pg.docker-compose.yaml', 'mastra-pg.docker-compose.yaml');

    return { dbUrl: String(dbUrl) };
  }

  private editComposeFile({
    sanitizedProjectName,
    postgresPort,
  }: {
    sanitizedProjectName: string;
    postgresPort: number;
  }) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const filePath = path.resolve(__dirname, '..', 'starter-files', 'mastra-pg.docker-compose.yaml');
    replaceValuesInFile({
      filePath,
      replacements: [
        { replace: sanitizedProjectName, search: 'REPLACE_PROJECT_NAME' },
        { replace: `${postgresPort}`, search: 'REPLACE_DB_PORT' },
      ],
    });
  }
}
