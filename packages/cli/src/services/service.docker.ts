import { execa } from 'execa';
import fs from 'fs';
import path from 'path';
import { check } from 'tcp-port-used';
import { fileURLToPath } from 'url';

import { FileService } from './service.file';

export class DockerService {
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
    return new Promise((resolve, reject) => {
      check(port)
        .then((inUse: boolean) => {
          resolve(!inUse);
        })
        .catch(reject);
    });
  }

  async provision(projectName: string): Promise<{ dbUrl: string }> {
    const sanitizedProjectName = this.sanitizeName(projectName);

    const { postgresPort } = await this.getInfraPorts();

    try {
      if (!(await this.checkDockerRunning())) {
        throw new Error('Docker Daemon is not running. Please start Docker and try again\n');
      }

      const { dbUrl } = await this.prepareComposeFile({
        sanitizedProjectName,
        postgresPort,
      });

      return { dbUrl };
    } catch (error) {
      throw error;
    }
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

  async checkDockerRunning() {
    try {
      await execa('docker', ['info'], { stdio: 'ignore', shell: true });
      return true;
    } catch (error) {
      return false;
    }
  }

  async startDockerContainer(dockerComposeFile: string) {
    try {
      await execa('docker', ['compose', '-f', dockerComposeFile, 'up', '-d'], { stdio: 'inherit' });
      return true;
    } catch (error) {
      return false;
    }
  }

  async stopDockerContainer(dockerComposeFile: string) {
    try {
      await execa('docker', ['compose', '-f', dockerComposeFile, 'down'], { stdio: 'inherit' });
      return true;
    } catch (error) {
      return false;
    }
  }

  async prepareComposeFile({
    sanitizedProjectName,
    postgresPort,
  }: {
    sanitizedProjectName: string;
    postgresPort: number;
  }) {
    let dbUrl = `postgresql://postgres:postgres@localhost:${postgresPort}/mastra`;

    this.editComposeFile({ sanitizedProjectName, postgresPort });
    const fileService = new FileService();
    await fileService.copyStarterFile('mastra-pg.docker-compose.yaml', 'mastra-pg.docker-compose.yaml');

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
    const filePath = path.resolve(__dirname, 'starter-files', 'mastra-pg.docker-compose.yaml');

    const fileService = new FileService();
    fileService.replaceValuesInFile({
      filePath,
      replacements: [
        { replace: sanitizedProjectName, search: 'REPLACE_PROJECT_NAME' },
        { replace: `${postgresPort}`, search: 'REPLACE_DB_PORT' },
      ],
    });
  }

  getComposeFile(composePath?: string) {
    const fileService = new FileService();
    let composeFile: string;
    if (composePath) {
      if (!fs.existsSync(composePath)) {
        throw new Error(`Docker compose file not found: ${composePath}`);
      }
      composeFile = composePath;
    } else {
      composeFile = fileService.getFirstExistingFile([
        'mastra-pg.docker-compose.yaml',
        'mastra-pg.docker-compose.yml',
        'docker-compose.yaml',
        'docker-compose.yml',
      ]);
    }

    return composeFile;
  }
}
