import { MastraBase } from '../base';
import type { Sandbox, CommandResult, CodeResult, FileInfo } from './types';

export abstract class MastraSandbox extends MastraBase {
  // Sandbox lifecycle
  abstract create({ language }: { language: 'typescript' | 'python' }): Promise<Sandbox>;
  abstract delete(sandboxId: string): Promise<void>;

  // File System Operations
  abstract writeFile(filePath: string, content: string): Promise<void>;
  abstract readFile(filePath: string): Promise<string | null>;
  abstract createDirectory(path: string): Promise<void>;
  abstract listFiles(directory: string): Promise<FileInfo[]>;

  // Command Execution (Shell commands)
  abstract executeCommand(
    command: string,
    options: {
      workingDirectory?: string;
      environment?: Record<string, string>;
      timeout?: number;
    },
  ): Promise<CommandResult>;

  // Code Execution (REPL-style)
  abstract executeCode(
    code: string,
    options: {
      language: 'typescript' | 'python' | 'javascript';
      environment?: Record<string, string>;
      timeout?: number;
    },
  ): Promise<CodeResult>;

  // Environment
  abstract setEnvironment(variables: Record<string, string>): Promise<void>;
  abstract getEnvironment(): Promise<Record<string, string>>;
  abstract setWorkingDirectory(path: string): Promise<void>;
}
