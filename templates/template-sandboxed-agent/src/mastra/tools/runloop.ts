import { createTool } from '@mastra/core/tools';
import z from 'zod';
import RunloopSDK from '@runloop/api-client';

// Initialize Runloop SDK instance (uses RUNLOOP_API_KEY from env)
const runloop = new RunloopSDK();

// Helper function to escape code for shell execution
function escapeCodeForShell(code: string): string {
  // Escape single quotes by replacing ' with '\''
  return code.replace(/'/g, "'\\''");
}

// Helper function to parse ls -la output into file list
function parseLsOutput(output: string, basePath: string): Array<{ name: string; path: string; isDirectory: boolean }> {
  const lines = output.trim().split('\n').filter(line => line.trim());
  const files: Array<{ name: string; path: string; isDirectory: boolean }> = [];

  for (const line of lines) {
    // Skip header line and . / .. entries
    if (line.startsWith('total') || line.includes(' -> ')) continue;
    
    const parts = line.trim().split(/\s+/);
    if (parts.length < 9) continue;

    const permissions = parts[0];
    const isDirectory = permissions.startsWith('d');
    const name = parts.slice(8).join(' '); // Handle filenames with spaces
    
    // Skip . and ..
    if (name === '.' || name === '..') continue;

    const path = basePath.endsWith('/') ? `${basePath}${name}` : `${basePath}/${name}`;
    files.push({ name, path, isDirectory });
  }

  return files;
}

// Helper function to parse stat output
function parseStatOutput(output: string, path: string): {
  name: string;
  path: string;
  size: number;
  mode: number;
  permissions: string;
  owner: string;
  group: string;
  modifiedTime?: Date;
  isDirectory: boolean;
} {
  const lines = output.trim().split('\n');
  const result: any = {
    name: path.split('/').pop() || path,
    path,
    size: 0,
    mode: 0,
    permissions: '',
    owner: '',
    group: '',
    isDirectory: false,
  };

  for (const line of lines) {
    if (line.includes('Size:')) {
      const match = line.match(/Size:\s*(\d+)/);
      if (match) result.size = parseInt(match[1], 10);
    }
    if (line.includes('Access:')) {
      const match = line.match(/Access:\s*\((\d+)\/(\w+)\)/);
      if (match) {
        result.mode = parseInt(match[1], 8);
        result.permissions = match[2];
      }
    }
    if (line.includes('Uid:')) {
      const match = line.match(/Uid:\s*\(\s*\d+\/(\w+)\)/);
      if (match) result.owner = match[1];
    }
    if (line.includes('Gid:')) {
      const match = line.match(/Gid:\s*\(\s*\d+\/(\w+)\)/);
      if (match) result.group = match[1];
    }
    if (line.includes('Modify:')) {
      const match = line.match(/Modify:\s*(.+)/);
      if (match) {
        try {
          result.modifiedTime = new Date(match[1].trim());
        } catch (e) {
          // Ignore date parsing errors
        }
      }
    }
    if (line.includes('File:')) {
      const match = line.match(/File:\s*.+->\s*(.+)/);
      if (match) {
        result.symlinkTarget = match[1].trim();
      }
    }
  }

  // Check if directory using ls -d
  return result;
}

export const createSandbox = createTool({
  id: 'createSandbox',
  description: 'Create a Runloop devbox',
  inputSchema: z.object({
    metadata: z.record(z.string()).optional().describe('Custom metadata for the devbox'),
    envs: z.record(z.string()).optional().describe(`
      Custom environment variables for the devbox.
      Used when executing commands and code in the devbox.
      Can be overridden with the \`envs\` argument when executing commands or code.
    `),
    timeoutMS: z.number().optional().describe(`
      Timeout for the devbox in **milliseconds**.
      Note: Runloop devboxes have different timeout policies than E2B.
      @default 300_000 // 5 minutes
    `),
  }),
  outputSchema: z
    .object({
      sandboxId: z.string(),
    })
    .or(
      z.object({
        error: z.string(),
      }),
    ),
  execute: async sandboxOptions => {
    try {
      const blueprintName = process.env.RUNLOOP_PUBLIC_BLUEPRINT_NAME;
      
      const createOptions: any = {
        name: `devbox-${Date.now()}`,
      };

      if (blueprintName) {
        createOptions.blueprint_name = blueprintName;
      }

      if (sandboxOptions.envs) {
        createOptions.environment_variables = sandboxOptions.envs;
      }

      const devbox = await runloop.api.devboxes.create(createOptions);

      return {
        sandboxId: devbox.id,
      };
    } catch (e) {
      return {
        error: JSON.stringify(e),
      };
    }
  },
});

export const runCode = createTool({
  id: 'runCode',
  description: 'Run code in a Runloop devbox',
  inputSchema: z.object({
    sandboxId: z.string().describe('The sandboxId for the devbox to run the code'),
    code: z.string().describe('The code to run in the devbox'),
    runCodeOpts: z
      .object({
        language: z
          .enum(['ts', 'js', 'python'])
          .default('python')
          .describe('language used for code execution. If not provided, default python context is used'),
        envs: z.record(z.string()).optional().describe('Custom environment variables for code execution.'),
        timeoutMS: z.number().optional().describe(`
        Timeout for the code execution in **milliseconds**.
        @default 60_000 // 60 seconds
      `),
        requestTimeoutMs: z.number().optional().describe(`
        Timeout for the request in **milliseconds**.
        @default 30_000 // 30 seconds
      `),
      })
      .optional()
      .describe('Run code options'),
  }),
  outputSchema: z
    .object({
      execution: z.string().describe('Serialized representation of the execution results'),
    })
    .or(
      z.object({
        error: z.string().describe('The error from a failed execution'),
      }),
    ),
  execute: async input => {
    try {
      const devbox = runloop.api.devboxes.fromId(input.sandboxId);
      const language = input.runCodeOpts?.language || 'python';
      const timeoutMs = input.runCodeOpts?.timeoutMS || 60_000;

      // Escape code for shell execution
      const escapedCode = escapeCodeForShell(input.code);

      // Build command based on language
      let command: string;
      if (language === 'python') {
        command = `python -c '${escapedCode}'`;
      } else if (language === 'js') {
        command = `node -e '${escapedCode}'`;
      } else if (language === 'ts') {
        // Try ts-node first, fallback to compile then run
        command = `ts-node -e '${escapedCode}' || (echo '${escapedCode}' > /tmp/script.ts && tsc /tmp/script.ts && node /tmp/script.js)`;
      } else {
        command = `python -c '${escapedCode}'`;
      }

      // Set environment variables if provided
      const envVars = input.runCodeOpts?.envs;
      if (envVars) {
        const envString = Object.entries(envVars)
          .map(([key, value]) => `${key}='${escapeCodeForShell(value)}'`)
          .join(' ');
        command = `${envString} ${command}`;
      }

      const result = await devbox.cmd.exec({ command });

      const stdout = await result.stdout();
      const stderr = result.stderr || '';

      return {
        execution: JSON.stringify({
          stdout,
          stderr,
          exitCode: result.exitCode,
          language,
          command,
        }),
      };
    } catch (e) {
      return {
        error: JSON.stringify(e),
      };
    }
  },
});

export const readFile = createTool({
  id: 'readFile',
  description: 'Read a file from the Runloop devbox',
  inputSchema: z.object({
    sandboxId: z.string().describe('The sandboxId for the devbox to read the file from'),
    path: z.string().describe('The path to the file to read'),
  }),
  outputSchema: z
    .object({
      content: z.string().describe('The content of the file'),
      path: z.string().describe('The path of the file that was read'),
    })
    .or(
      z.object({
        error: z.string().describe('The error from a failed file read'),
      }),
    ),
  execute: async input => {
    try {
      const devbox = runloop.api.devboxes.fromId(input.sandboxId);
      const content = await devbox.file.read({ file_path: input.path });

      return {
        content,
        path: input.path,
      };
    } catch (e) {
      return {
        error: JSON.stringify(e),
      };
    }
  },
});

export const writeFile = createTool({
  id: 'writeFile',
  description: 'Write a single file to the Runloop devbox',
  inputSchema: z.object({
    sandboxId: z.string().describe('The sandboxId for the devbox to write the file to'),
    path: z.string().describe('The path where the file should be written'),
    content: z.string().describe('The content to write to the file'),
  }),
  outputSchema: z
    .object({
      success: z.boolean().describe('Whether the file was written successfully'),
      path: z.string().describe('The path where the file was written'),
    })
    .or(
      z.object({
        error: z.string().describe('The error from a failed file write'),
      }),
    ),
  execute: async input => {
    try {
      const devbox = runloop.api.devboxes.fromId(input.sandboxId);
      await devbox.file.write({ file_path: input.path, contents: input.content });

      return {
        success: true,
        path: input.path,
      };
    } catch (e) {
      return {
        error: JSON.stringify(e),
      };
    }
  },
});

export const writeFiles = createTool({
  id: 'writeFiles',
  description: 'Write multiple files to the Runloop devbox',
  inputSchema: z.object({
    sandboxId: z.string().describe('The sandboxId for the devbox to write the files to'),
    files: z
      .array(
        z.object({
          path: z.string().describe('The path where the file should be written'),
          data: z.string().describe('The content to write to the file'),
        }),
      )
      .describe('Array of files to write, each with path and data'),
  }),
  outputSchema: z
    .object({
      success: z.boolean().describe('Whether all files were written successfully'),
      filesWritten: z.array(z.string()).describe('Array of file paths that were written'),
    })
    .or(
      z.object({
        error: z.string().describe('The error from a failed files write'),
      }),
    ),
  execute: async input => {
    try {
      const devbox = runloop.api.devboxes.fromId(input.sandboxId);
      const filesWritten: string[] = [];

      // Write files sequentially
      for (const file of input.files) {
        await devbox.file.write({ file_path: file.path, contents: file.data });
        filesWritten.push(file.path);
      }

      return {
        success: true,
        filesWritten,
      };
    } catch (e) {
      return {
        error: JSON.stringify(e),
      };
    }
  },
});

export const listFiles = createTool({
  id: 'listFiles',
  description: 'List files and directories in a path within the Runloop devbox',
  inputSchema: z.object({
    sandboxId: z.string().describe('The sandboxId for the devbox to list files from'),
    path: z.string().default('/').describe('The directory path to list files from'),
  }),
  outputSchema: z
    .object({
      files: z
        .array(
          z.object({
            name: z.string().describe('The name of the file or directory'),
            path: z.string().describe('The full path of the file or directory'),
            isDirectory: z.boolean().describe('Whether this is a directory'),
          }),
        )
        .describe('Array of files and directories'),
      path: z.string().describe('The path that was listed'),
    })
    .or(
      z.object({
        error: z.string().describe('The error from a failed file listing'),
      }),
    ),
  execute: async input => {
    try {
      const devbox = runloop.api.devboxes.fromId(input.sandboxId);
      const result = await devbox.cmd.exec({ command: `ls -la "${input.path}"` });
      const stdout = await result.stdout();

      const files = parseLsOutput(stdout, input.path);

      return {
        files,
        path: input.path,
      };
    } catch (e) {
      return {
        error: JSON.stringify(e),
      };
    }
  },
});

export const deleteFile = createTool({
  id: 'deleteFile',
  description: 'Delete a file or directory from the Runloop devbox',
  inputSchema: z.object({
    sandboxId: z.string().describe('The sandboxId for the devbox to delete the file from'),
    path: z.string().describe('The path to the file or directory to delete'),
  }),
  outputSchema: z
    .object({
      success: z.boolean().describe('Whether the file was deleted successfully'),
      path: z.string().describe('The path that was deleted'),
    })
    .or(
      z.object({
        error: z.string().describe('The error from a failed file deletion'),
      }),
    ),
  execute: async input => {
    try {
      const devbox = runloop.api.devboxes.fromId(input.sandboxId);
      const result = await devbox.cmd.exec({ command: `rm -rf "${input.path}"` });

      if (result.exitCode !== 0) {
        const stderr = result.stderr || '';
        throw new Error(`Failed to delete file: ${stderr}`);
      }

      return {
        success: true,
        path: input.path,
      };
    } catch (e) {
      return {
        error: JSON.stringify(e),
      };
    }
  },
});

export const createDirectory = createTool({
  id: 'createDirectory',
  description: 'Create a directory in the Runloop devbox',
  inputSchema: z.object({
    sandboxId: z.string().describe('The sandboxId for the devbox to create the directory in'),
    path: z.string().describe('The path where the directory should be created'),
  }),
  outputSchema: z
    .object({
      success: z.boolean().describe('Whether the directory was created successfully'),
      path: z.string().describe('The path where the directory was created'),
    })
    .or(
      z.object({
        error: z.string().describe('The error from a failed directory creation'),
      }),
    ),
  execute: async input => {
    try {
      const devbox = runloop.api.devboxes.fromId(input.sandboxId);
      const result = await devbox.cmd.exec({ command: `mkdir -p "${input.path}"` });

      if (result.exitCode !== 0) {
        const stderr = result.stderr || '';
        throw new Error(`Failed to create directory: ${stderr}`);
      }

      return {
        success: true,
        path: input.path,
      };
    } catch (e) {
      return {
        error: JSON.stringify(e),
      };
    }
  },
});

export const getFileInfo = createTool({
  id: 'getFileInfo',
  description: 'Get detailed information about a file or directory in the Runloop devbox',
  inputSchema: z.object({
    sandboxId: z.string().describe('The sandboxId for the devbox to get file information from'),
    path: z.string().describe('The path to the file or directory to get information about'),
  }),
  outputSchema: z
    .object({
      name: z.string().describe('The name of the file or directory'),
      type: z.string().optional().describe('Whether this is a file or directory'),
      path: z.string().describe('The full path of the file or directory'),
      size: z.number().describe('The size of the file or directory in bytes'),
      mode: z.number().describe('The file mode (permissions as octal number)'),
      permissions: z.string().describe('Human-readable permissions string'),
      owner: z.string().describe('The owner of the file or directory'),
      group: z.string().describe('The group of the file or directory'),
      modifiedTime: z.date().optional().describe('The last modified time in ISO string format'),
      symlinkTarget: z.string().optional().describe('The target path if this is a symlink, null otherwise'),
    })
    .or(
      z.object({
        error: z.string().describe('The error from a failed file info request'),
      }),
    ),
  execute: async input => {
    try {
      const devbox = runloop.api.devboxes.fromId(input.sandboxId);
      const result = await devbox.cmd.exec({ command: `stat "${input.path}"` });
      const stdout = await result.stdout();

      if (result.exitCode !== 0) {
        throw new Error(`Failed to get file info: ${stdout}`);
      }

      const info = parseStatOutput(stdout, input.path);

      // Check if it's a directory
      const lsResult = await devbox.cmd.exec({ command: `test -d "${input.path}" && echo "dir" || echo "file"` });
      const lsStdout = await lsResult.stdout();
      const isDirectory = lsStdout.trim() === 'dir';

      return {
        name: info.name,
        type: isDirectory ? 'directory' : 'file',
        path: info.path,
        size: info.size,
        mode: info.mode,
        permissions: info.permissions,
        owner: info.owner,
        group: info.group,
        modifiedTime: info.modifiedTime,
        symlinkTarget: info.symlinkTarget,
      };
    } catch (e) {
      return {
        error: JSON.stringify(e),
      };
    }
  },
});

export const checkFileExists = createTool({
  id: 'checkFileExists',
  description: 'Check if a file or directory exists in the Runloop devbox',
  inputSchema: z.object({
    sandboxId: z.string().describe('The sandboxId for the devbox to check file existence in'),
    path: z.string().describe('The path to check for existence'),
  }),
  outputSchema: z
    .object({
      exists: z.boolean().describe('Whether the file or directory exists'),
      path: z.string().describe('The path that was checked'),
      type: z.string().optional().describe('The type if the path exists (file or directory)'),
    })
    .or(
      z.object({
        error: z.string().describe('The error from a failed existence check'),
      }),
    ),
  execute: async input => {
    try {
      const devbox = runloop.api.devboxes.fromId(input.sandboxId);
      
      // Check if file exists
      const testResult = await devbox.cmd.exec({ command: `test -e "${input.path}" && echo "exists" || echo "not_exists"` });
      const stdout = await testResult.stdout();
      const exists = stdout.trim() === 'exists';

      if (!exists) {
        return {
          exists: false,
          path: input.path,
        };
      }

      // Determine type
      const typeResult = await devbox.cmd.exec({ command: `test -d "${input.path}" && echo "directory" || echo "file"` });
      const typeStdout = await typeResult.stdout();
      const type = typeStdout.trim();

      return {
        exists: true,
        path: input.path,
        type,
      };
    } catch (e) {
      return {
        error: JSON.stringify(e),
      };
    }
  },
});

export const getFileSize = createTool({
  id: 'getFileSize',
  description: 'Get the size of a file or directory in the Runloop devbox',
  inputSchema: z.object({
    sandboxId: z.string().describe('The sandboxId for the devbox to get file size from'),
    path: z.string().describe('The path to the file or directory'),
    humanReadable: z
      .boolean()
      .default(false)
      .describe("Whether to return size in human-readable format (e.g., '1.5 KB', '2.3 MB')"),
  }),
  outputSchema: z
    .object({
      size: z.number().describe('The size in bytes'),
      humanReadableSize: z.string().optional().describe('Human-readable size string if requested'),
      path: z.string().describe('The path that was checked'),
      type: z.string().optional().describe('Whether this is a file or directory'),
    })
    .or(
      z.object({
        error: z.string().describe('The error from a failed size check'),
      }),
    ),
  execute: async input => {
    try {
      const devbox = runloop.api.devboxes.fromId(input.sandboxId);
      
      // Get file size
      const sizeResult = await devbox.cmd.exec({ command: `stat -c%s "${input.path}"` });
      const sizeStdout = await sizeResult.stdout();
      const size = parseInt(sizeStdout.trim(), 10);

      if (isNaN(size)) {
        throw new Error('Failed to parse file size');
      }

      // Get file type
      const typeResult = await devbox.cmd.exec({ command: `test -d "${input.path}" && echo "directory" || echo "file"` });
      const typeStdout = await typeResult.stdout();
      const type = typeStdout.trim();

      let humanReadableSize: string | undefined;

      if (input.humanReadable) {
        const bytes = size;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) {
          humanReadableSize = '0 B';
        } else {
          const i = Math.floor(Math.log(bytes) / Math.log(1024));
          const sizeValue = (bytes / Math.pow(1024, i)).toFixed(1);
          humanReadableSize = `${sizeValue} ${sizes[i]}`;
        }
      }

      return {
        size,
        humanReadableSize,
        path: input.path,
        type,
      };
    } catch (e) {
      return {
        error: JSON.stringify(e),
      };
    }
  },
});

export const watchDirectory = createTool({
  id: 'watchDirectory',
  description: 'Monitor a directory for file system changes in the Runloop devbox (uses polling since native watching is not available)',
  inputSchema: z.object({
    sandboxId: z.string().describe('The sandboxId for the devbox to watch directory in'),
    path: z.string().describe('The directory path to watch for changes'),
    recursive: z.boolean().default(false).describe('Whether to watch subdirectories recursively'),
    watchDuration: z
      .number()
      .default(30000)
      .describe('How long to watch for changes in milliseconds (default 30 seconds)'),
  }),
  outputSchema: z
    .object({
      watchStarted: z.boolean().describe('Whether the watch was started successfully'),
      path: z.string().describe('The path that was watched'),
      events: z
        .array(
          z.object({
            type: z.string().describe('The type of filesystem event (CREATE, DELETE, MODIFY)'),
            name: z.string().describe('The name of the file that changed'),
            timestamp: z.string().describe('When the event occurred'),
          }),
        )
        .describe('Array of filesystem events that occurred during the watch period'),
    })
    .or(
      z.object({
        error: z.string().describe('The error from a failed directory watch'),
      }),
    ),
  execute: async input => {
    try {
      const devbox = runloop.api.devboxes.fromId(input.sandboxId);
      const events: Array<{ type: string; name: string; timestamp: string }> = [];

      // Get initial file list
      const initialResult = await devbox.cmd.exec({ 
        command: `find "${input.path}" ${input.recursive ? '' : '-maxdepth 1'} -type f 2>/dev/null | sort` 
      });
      const initialFiles = new Set((await initialResult.stdout()).trim().split('\n').filter(f => f));

      // Poll for changes
      const pollInterval = 1000; // Poll every second
      const endTime = Date.now() + input.watchDuration;
      
      while (Date.now() < endTime) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
        const currentResult = await devbox.cmd.exec({ 
          command: `find "${input.path}" ${input.recursive ? '' : '-maxdepth 1'} -type f 2>/dev/null | sort` 
        });
        const currentFiles = new Set((await currentResult.stdout()).trim().split('\n').filter(f => f));

        // Detect new files
        for (const file of currentFiles) {
          if (!initialFiles.has(file)) {
            events.push({
              type: 'CREATE',
              name: file.split('/').pop() || file,
              timestamp: new Date().toISOString(),
            });
          }
        }

        // Detect deleted files
        for (const file of initialFiles) {
          if (!currentFiles.has(file)) {
            events.push({
              type: 'DELETE',
              name: file.split('/').pop() || file,
              timestamp: new Date().toISOString(),
            });
          }
        }

        // Update initial files for next iteration
        initialFiles.clear();
        currentFiles.forEach(f => initialFiles.add(f));
      }

      return {
        watchStarted: true,
        path: input.path,
        events,
      };
    } catch (e) {
      return {
        error: JSON.stringify(e),
      };
    }
  },
});

export const runCommand = createTool({
  id: 'runCommand',
  description: 'Run a shell command in the Runloop devbox',
  inputSchema: z.object({
    sandboxId: z.string().describe('The sandboxId for the devbox to run the command in'),
    command: z.string().describe('The shell command to execute'),
    workingDirectory: z.string().optional().describe('The working directory to run the command in'),
    timeoutMs: z.number().default(30000).describe('Timeout for the command execution in milliseconds'),
    captureOutput: z.boolean().default(true).describe('Whether to capture stdout and stderr output'),
  }),
  outputSchema: z
    .object({
      success: z.boolean().describe('Whether the command executed successfully'),
      exitCode: z.number().describe('The exit code of the command'),
      stdout: z.string().describe('The standard output from the command'),
      stderr: z.string().describe('The standard error from the command'),
      command: z.string().describe('The command that was executed'),
      executionTime: z.number().describe('How long the command took to execute in milliseconds'),
    })
    .or(
      z.object({
        error: z.string().describe('The error from a failed command execution'),
      }),
    ),
  execute: async input => {
    try {
      const devbox = runloop.api.devboxes.fromId(input.sandboxId);
      const startTime = Date.now();

      let command = input.command;
      if (input.workingDirectory) {
        command = `cd "${input.workingDirectory}" && ${command}`;
      }

      const result = await devbox.cmd.exec({ command });
      const stdout = await result.stdout();
      const executionTime = Date.now() - startTime;

      return {
        success: result.exitCode === 0,
        exitCode: result.exitCode,
        stdout,
        stderr: result.stderr || '',
        command: input.command,
        executionTime,
      };
    } catch (e) {
      return {
        error: JSON.stringify(e),
      };
    }
  },
});

