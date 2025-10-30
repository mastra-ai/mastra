import { createTool } from '@mastra/core/tools';
import z from 'zod';
import { FilesystemEventType, FileType, Sandbox } from '@e2b/code-interpreter';

export const createSandbox = createTool({
  id: 'createSandbox',
  description: 'Create an e2b sandbox',
  inputSchema: z.object({
    metadata: z.record(z.string()).optional().describe('Custom metadata for the sandbox'),
    envs: z.record(z.string()).optional().describe(`
      Custom environment variables for the sandbox.
      Used when executing commands and code in the sandbox.
      Can be overridden with the \`envs\` argument when executing commands or code.
    `),
    timeoutMS: z.number().optional().describe(`
      Timeout for the sandbox in **milliseconds**.
      Maximum time a sandbox can be kept alive is 24 hours (86_400_000 milliseconds) for Pro users and 1 hour (3_600_000 milliseconds) for Hobby users.
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
  execute: async ({ context: sandboxOptions }) => {
    try {
      const sandbox = await Sandbox.create(sandboxOptions);

      return {
        sandboxId: sandbox.sandboxId,
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
  description: 'Run code in an e2b sandbox',
  inputSchema: z.object({
    sandboxId: z.string().describe('The sandboxId for the sandbox to run the code'),
    code: z.string().describe('The code to run in the sandbox'),
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
  execute: async ({ context }) => {
    try {
      const sandbox = await Sandbox.connect(context.sandboxId);

      const execution = await sandbox.runCode(context.code, context.runCodeOpts);

      return {
        execution: JSON.stringify(execution.toJSON()),
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
  description: 'Read a file from the e2b sandbox',
  inputSchema: z.object({
    sandboxId: z.string().describe('The sandboxId for the sandbox to read the file from'),
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
  execute: async ({ context }) => {
    try {
      const sandbox = await Sandbox.connect(context.sandboxId);
      const fileContent = await sandbox.files.read(context.path);

      return {
        content: fileContent,
        path: context.path,
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
  description: 'Write a single file to the e2b sandbox',
  inputSchema: z.object({
    sandboxId: z.string().describe('The sandboxId for the sandbox to write the file to'),
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
  execute: async ({ context }) => {
    try {
      const sandbox = await Sandbox.connect(context.sandboxId);
      await sandbox.files.write(context.path, context.content);

      return {
        success: true,
        path: context.path,
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
  description: 'Write multiple files to the e2b sandbox',
  inputSchema: z.object({
    sandboxId: z.string().describe('The sandboxId for the sandbox to write the files to'),
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
  execute: async ({ context }) => {
    try {
      const sandbox = await Sandbox.connect(context.sandboxId);
      await sandbox.files.write(context.files);

      return {
        success: true,
        filesWritten: context.files.map(file => file.path),
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
  description: 'List files and directories in a path within the e2b sandbox',
  inputSchema: z.object({
    sandboxId: z.string().describe('The sandboxId for the sandbox to list files from'),
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
  execute: async ({ context }) => {
    try {
      const sandbox = await Sandbox.connect(context.sandboxId);
      const fileList = await sandbox.files.list(context.path);

      fileList.map(f => f.type);

      return {
        files: fileList.map(file => ({
          name: file.name,
          path: file.path,
          isDirectory: file.type === FileType.DIR,
        })),
        path: context.path,
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
  description: 'Delete a file or directory from the e2b sandbox',
  inputSchema: z.object({
    sandboxId: z.string().describe('The sandboxId for the sandbox to delete the file from'),
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
  execute: async ({ context }) => {
    try {
      const sandbox = await Sandbox.connect(context.sandboxId);
      await sandbox.files.remove(context.path);

      return {
        success: true,
        path: context.path,
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
  description: 'Create a directory in the e2b sandbox',
  inputSchema: z.object({
    sandboxId: z.string().describe('The sandboxId for the sandbox to create the directory in'),
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
  execute: async ({ context }) => {
    try {
      const sandbox = await Sandbox.connect(context.sandboxId);
      await sandbox.files.makeDir(context.path);

      return {
        success: true,
        path: context.path,
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
  description: 'Get detailed information about a file or directory in the e2b sandbox',
  inputSchema: z.object({
    sandboxId: z.string().describe('The sandboxId for the sandbox to get file information from'),
    path: z.string().describe('The path to the file or directory to get information about'),
  }),
  outputSchema: z
    .object({
      name: z.string().describe('The name of the file or directory'),
      type: z.nativeEnum(FileType).optional().describe('Whether this is a file or directory'),
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
  execute: async ({ context }) => {
    try {
      const sandbox = await Sandbox.connect(context.sandboxId);
      const info = await sandbox.files.getInfo(context.path);

      return {
        name: info.name,
        type: info.type,
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
  description: 'Check if a file or directory exists in the e2b sandbox',
  inputSchema: z.object({
    sandboxId: z.string().describe('The sandboxId for the sandbox to check file existence in'),
    path: z.string().describe('The path to check for existence'),
  }),
  outputSchema: z
    .object({
      exists: z.boolean().describe('Whether the file or directory exists'),
      path: z.string().describe('The path that was checked'),
      type: z.nativeEnum(FileType).optional().describe('The type if the path exists'),
    })
    .or(
      z.object({
        error: z.string().describe('The error from a failed existence check'),
      }),
    ),
  execute: async ({ context }) => {
    try {
      const sandbox = await Sandbox.connect(context.sandboxId);

      try {
        const info = await sandbox.files.getInfo(context.path);
        return {
          exists: true,
          path: context.path,
          type: info.type,
        };
      } catch (e) {
        // If getInfo fails, the file doesn't exist
        return {
          exists: false,
          path: context.path,
        };
      }
    } catch (e) {
      return {
        error: JSON.stringify(e),
      };
    }
  },
});

export const getFileSize = createTool({
  id: 'getFileSize',
  description: 'Get the size of a file or directory in the e2b sandbox',
  inputSchema: z.object({
    sandboxId: z.string().describe('The sandboxId for the sandbox to get file size from'),
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
      type: z.nativeEnum(FileType).optional().describe('Whether this is a file or directory'),
    })
    .or(
      z.object({
        error: z.string().describe('The error from a failed size check'),
      }),
    ),
  execute: async ({ context }) => {
    try {
      const sandbox = await Sandbox.connect(context.sandboxId);
      const info = await sandbox.files.getInfo(context.path);

      let humanReadableSize: string | undefined;

      if (context.humanReadable) {
        const bytes = info.size;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) {
          humanReadableSize = '0 B';
        } else {
          const i = Math.floor(Math.log(bytes) / Math.log(1024));
          const size = (bytes / Math.pow(1024, i)).toFixed(1);
          humanReadableSize = `${size} ${sizes[i]}`;
        }
      }

      return {
        size: info.size,
        humanReadableSize,
        path: context.path,
        type: info.type,
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
  description: 'Start watching a directory for file system changes in the e2b sandbox',
  inputSchema: z.object({
    sandboxId: z.string().describe('The sandboxId for the sandbox to watch directory in'),
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
            type: z
              .nativeEnum(FilesystemEventType)
              .describe('The type of filesystem event (WRITE, CREATE, DELETE, etc.)'),
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
  execute: async ({ context }) => {
    try {
      const sandbox = await Sandbox.connect(context.sandboxId);
      const events: Array<{ type: FilesystemEventType; name: string; timestamp: string }> = [];

      // Start watching the directory
      const handle = await sandbox.files.watchDir(
        context.path,
        async event => {
          events.push({
            type: event.type,
            name: event.name,
            timestamp: new Date().toISOString(),
          });
        },
        {
          recursive: context.recursive,
        },
      );

      // Watch for the specified duration
      await new Promise(resolve => setTimeout(resolve, context.watchDuration));

      // Stop watching
      await handle.stop();

      return {
        watchStarted: true,
        path: context.path,
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
  description: 'Run a shell command in the e2b sandbox',
  inputSchema: z.object({
    sandboxId: z.string().describe('The sandboxId for the sandbox to run the command in'),
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
  execute: async ({ context }) => {
    try {
      const sandbox = await Sandbox.connect(context.sandboxId);
      const startTime = Date.now();

      const result = await sandbox.commands.run(context.command, {
        cwd: context.workingDirectory,
        timeoutMs: context.timeoutMs,
      });

      const executionTime = Date.now() - startTime;

      return {
        success: result.exitCode === 0,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        command: context.command,
        executionTime,
      };
    } catch (e) {
      return {
        error: JSON.stringify(e),
      };
    }
  },
});
