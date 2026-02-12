/**
 * Mock sandbox for unit tests.
 *
 * A simple sandbox implementation for fast unit testing.
 */

import type {
  WorkspaceSandbox,
  SandboxInfo,
  CommandResult,
  ExecuteCommandOptions,
  WorkspaceFilesystem,
  MountResult,
  ProviderStatus,
} from '@mastra/core/workspace';

export interface MockSandboxOptions {
  /** Unique identifier */
  id?: string;
  /** Predefined command responses */
  commandResponses?: Map<string, CommandResult>;
  /** Default response for unknown commands */
  defaultResponse?: CommandResult;
}

/**
 * Mock sandbox for testing.
 *
 * Returns predefined responses for commands.
 */
export class MockSandbox implements WorkspaceSandbox {
  readonly id: string;
  readonly name = 'MockSandbox';
  readonly provider = 'mock';

  status: ProviderStatus = 'pending';

  private commandResponses: Map<string, CommandResult>;
  private defaultResponse: CommandResult;
  private mountedFilesystems: Map<string, WorkspaceFilesystem> = new Map();

  constructor(options: MockSandboxOptions = {}) {
    this.id = options.id ?? `mock-sandbox-${Date.now().toString(36)}`;
    this.commandResponses = options.commandResponses ?? new Map();
    this.defaultResponse = options.defaultResponse ?? {
      success: true,
      exitCode: 0,
      stdout: '',
      stderr: '',
      executionTimeMs: 0,
    };
  }

  /**
   * Add a predefined response for a command.
   */
  setCommandResponse(command: string, response: CommandResult): void {
    this.commandResponses.set(command, response);
  }

  async start(): Promise<void> {
    this.status = 'starting';
    this.status = 'running';
  }

  async stop(): Promise<void> {
    this.status = 'stopping';
    this.status = 'stopped';
  }

  async destroy(): Promise<void> {
    this.status = 'destroying';
    this.mountedFilesystems.clear();
    this.status = 'destroyed';
  }

  async isReady(): Promise<boolean> {
    return this.status === 'running';
  }

  async getInfo(): Promise<SandboxInfo> {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      createdAt: new Date(),
      mounts: Array.from(this.mountedFilesystems.entries()).map(([path, fs]) => ({
        path,
        filesystem: fs.id,
      })),
    };
  }

  async executeCommand(command: string, args: string[] = [], _options?: ExecuteCommandOptions): Promise<CommandResult> {
    const startTime = Date.now();
    const fullCommand = `${command} ${args.join(' ')}`.trim();

    // Check for exact match
    if (this.commandResponses.has(fullCommand)) {
      return this.commandResponses.get(fullCommand)!;
    }

    // Check for command-only match
    if (this.commandResponses.has(command)) {
      return this.commandResponses.get(command)!;
    }

    // Handle some basic commands
    if (command === 'echo') {
      return {
        success: true,
        exitCode: 0,
        stdout: args.join(' ') + '\n',
        stderr: '',
        executionTimeMs: Date.now() - startTime,
      };
    }

    if (command === 'pwd') {
      return {
        success: true,
        exitCode: 0,
        stdout: '/home/user\n',
        stderr: '',
        executionTimeMs: Date.now() - startTime,
      };
    }

    return this.defaultResponse;
  }

  async mount(filesystem: WorkspaceFilesystem, mountPath: string): Promise<MountResult> {
    this.mountedFilesystems.set(mountPath, filesystem);
    return { success: true, mountPath };
  }

  async unmount(mountPath: string): Promise<void> {
    this.mountedFilesystems.delete(mountPath);
  }

  getInstructions(): string {
    return 'Mock sandbox for testing.';
  }
}
