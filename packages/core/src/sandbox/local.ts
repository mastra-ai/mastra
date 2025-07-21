import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';
import { MastraSandbox } from './base';
import type { Sandbox, CommandResult, CodeResult, FileInfo } from './types';

const execAsync = promisify(exec);

export class LocalSandbox extends MastraSandbox {
  private workingDirectory: string;
  private environment: Record<string, string>;
  private sandboxId: string | null = null;

  constructor(
    options: {
      workingDirectory?: string;
      environment?: Record<string, string>;
    } = {},
  ) {
    super({
      name: 'local',
    });

    this.workingDirectory = options.workingDirectory || process.cwd();
    // Filter out undefined values from process.env
    const processEnv = Object.fromEntries(
      Object.entries(process.env).filter(([_, value]) => value !== undefined),
    ) as Record<string, string>;
    this.environment = { ...processEnv, ...options.environment };
  }

  async create({ language: _language }: { language: 'typescript' | 'python' }): Promise<Sandbox> {
    // For local sandbox, we just generate a unique ID
    this.sandboxId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create a temporary directory for this sandbox session
    const sandboxDir = path.join(this.workingDirectory, '.mastra-sandbox', this.sandboxId);
    await fs.mkdir(sandboxDir, { recursive: true });

    return { id: this.sandboxId };
  }

  async delete(sandboxId: string): Promise<void> {
    const sandboxDir = path.join(this.workingDirectory, '.mastra-sandbox', sandboxId);

    try {
      // Check if the sandbox directory exists
      await fs.access(sandboxDir);

      // Remove the sandbox directory and all its contents
      await fs.rm(sandboxDir, { recursive: true, force: true });
    } catch (error) {
      // If the directory doesn't exist, that's fine - it's already "deleted"
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const fullPath = path.resolve(this.workingDirectory, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf8');
  }

  async readFile(filePath: string): Promise<string | null> {
    try {
      const fullPath = path.resolve(this.workingDirectory, filePath);
      return await fs.readFile(fullPath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async createDirectory(dirPath: string): Promise<void> {
    const fullPath = path.resolve(this.workingDirectory, dirPath);
    await fs.mkdir(fullPath, { recursive: true });
  }

  async listFiles(directory: string): Promise<FileInfo[]> {
    const fullPath = path.resolve(this.workingDirectory, directory);
    const entries = await fs.readdir(fullPath, { withFileTypes: true });

    return entries.map(entry => ({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file',
    }));
  }

  async executeCommand(
    command: string,
    options: {
      workingDirectory?: string;
      environment?: Record<string, string>;
      timeout?: number;
    } = {},
  ): Promise<CommandResult> {
    const workDir = options.workingDirectory || this.workingDirectory;
    const env = { ...this.environment, ...options.environment };

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workDir,
        env,
        timeout: options.timeout || 30000, // 30 second default
      });

      return {
        stdout,
        stderr,
        exitCode: 0,
        success: true,
      };
    } catch (error: any) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode: error.code || 1,
        success: false,
      };
    }
  }

  async executeCode(
    code: string,
    options: {
      language: 'typescript' | 'python' | 'javascript';
      environment?: Record<string, string>;
      timeout?: number;
    },
  ): Promise<CodeResult> {
    const startTime = Date.now();
    const env = { ...this.environment, ...options.environment };

    try {
      let command: string;
      let args: string[] = [];

      switch (options.language) {
        case 'javascript':
          command = 'node';
          args = ['-e', code];
          break;
        case 'typescript':
          // For TypeScript, we need to compile first or use ts-node
          command = 'npx';
          args = ['ts-node', '-e', code];
          break;
        case 'python':
          command = 'python3';
          args = ['-c', code];
          break;
        default:
          throw new Error(`Unsupported language: ${options.language}`);
      }

      // Use spawn instead of exec for better argument handling
      const { spawn } = await import('child_process');
      const childProcess = spawn(command, args, {
        cwd: this.workingDirectory,
        env,
        timeout: options.timeout || 30000,
      });

      let stdout = '';
      let stderr = '';

      childProcess.stdout.on('data', data => {
        stdout += data.toString();
      });

      childProcess.stderr.on('data', data => {
        stderr += data.toString();
      });

      return new Promise(resolve => {
        childProcess.on('close', code => {
          if (code === 0) {
            resolve({
              output: stdout,
              error: stderr || undefined,
              success: true,
              executionTime: Date.now() - startTime,
            });
          } else {
            resolve({
              output: '',
              error: stderr || 'Process exited with non-zero code',
              success: false,
              executionTime: Date.now() - startTime,
            });
          }
        });

        childProcess.on('error', error => {
          resolve({
            output: '',
            error: error.message,
            success: false,
            executionTime: Date.now() - startTime,
          });
        });
      });
    } catch (error: any) {
      return {
        output: '',
        error: error.stderr || error.message,
        success: false,
        executionTime: Date.now() - startTime,
      };
    }
  }

  async setEnvironment(variables: Record<string, string>): Promise<void> {
    this.environment = { ...this.environment, ...variables };
  }

  async getEnvironment(): Promise<Record<string, string>> {
    return { ...this.environment };
  }

  async setWorkingDirectory(path: string): Promise<void> {
    this.workingDirectory = path;
  }
}
