export interface Sandbox {
  id: string;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
}

export interface CodeResult {
  output: string;
  error?: string;
  success: boolean;
  executionTime: number;
}

export interface FileInfo {
  name: string;
  type: 'file' | 'directory';
}
