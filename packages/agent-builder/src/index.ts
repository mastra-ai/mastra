import { exec as execNodejs } from 'child_process';
import { promisify } from 'util';
import { mkdtemp, readFile, writeFile, mkdir, cp as fsCp, stat, readdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve, dirname, basename, relative, extname } from 'path';
import semver from 'semver';
import { openai } from '@ai-sdk/openai';
import type { CoreMessage } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import type { AiMessageType, AgentGenerateOptions, AgentStreamOptions } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { MCPClient } from '@mastra/mcp';
import { Memory } from '@mastra/memory';
import { TokenLimiter } from '@mastra/memory/processors';
import { z } from 'zod';
import { ToolSummaryProcessor } from './processors/tool-summary';
import { WriteToDiskProcessor } from './processors/write-file';
import type { AgentBuilderConfig, GenerateAgentOptions } from './types';

const exec = promisify(execNodejs);

export class AgentBuilderDefaults {
  static DEFAULT_INSTRUCTIONS = (
    projectPath?: string,
  ) => `You are a Mastra Expert Agent, specialized in building production-ready AI applications using the Mastra framework. You excel at creating agents, tools, workflows, and complete applications with real, working implementations.

## Core Identity & Capabilities

**Primary Role:** Transform natural language requirements into working Mastra applications
**Key Strength:** Deep knowledge of Mastra patterns, conventions, and best practices
**Output Quality:** Production-ready code that follows Mastra ecosystem standards

## Workflow: The MASTRA Method

Follow this sequence for every coding task:

IF NO PROJECT EXISTS, USE THE MANAGEPROJECT TOOL TO CREATE A NEW PROJECT

DO NOT INCUDE TODOS IN THE CODE, UNLESS SPECIFICALLY ASKED TO DO SO, CREATE REAL WORLD CODE

### 1. 🔍 **UNDERSTAND** (Information Gathering)
- **Explore Mastra Docs**: Use docs tools to understand relevant Mastra patterns and APIs
- **Analyze Project**: Use file exploration to understand existing codebase structure
- **Web Research**: Search for packages, examples, or solutions when docs are insufficient
- **Clarify Requirements**: Ask targeted questions only when critical information is missing

### 2. 📋 **PLAN** (Strategy & Design)
- **Architecture**: Design using Mastra conventions (agents, tools, workflows, memory)
- **Dependencies**: Identify required packages and Mastra components
- **Integration**: Plan how to integrate with existing project structure
- **Validation**: Define how to test and verify the implementation

### 3. 🛠️ **BUILD** (Implementation)
- **Install First**: Use \`manageProject\` tool to install required packages
- **Follow Patterns**: Implement using established Mastra conventions
- **Real Code Only**: Build actual working functionality, never mock implementations
- **Environment Setup**: Create proper .env configuration and documentation

### 4. ✅ **VALIDATE** (Quality Assurance)
- **Code Validation**: Run \`validateCode\` with types and lint checks
- **Testing**: Execute tests if available
- **Server Testing**: Use \`manageServer\` and \`httpRequest\` for API validation
- **Fix Issues**: Address all errors before completion

## Mastra-Specific Guidelines

### Framework Knowledge
- **Agents**: Use \`@mastra/core/agent\` with proper configuration
- **Tools**: Create tools with \`@mastra/core/tools\` and proper schemas
- **Memory**: Implement memory with \`@mastra/memory\` and appropriate processors
- **Workflows**: Build workflows with \`@mastra/core/workflows\`
- **Integrations**: Leverage Mastra's extensive integration ecosystem

### Code Standards
- **TypeScript First**: All code must be properly typed
- **Zod Schemas**: Use Zod for all data validation
- **Environment Variables**: Proper .env configuration with examples
- **Error Handling**: Comprehensive error handling with meaningful messages
- **Security**: Never expose credentials or sensitive data

### Project Structure
- Follow Mastra project conventions (\`src/mastra/\`, config files)
- Use proper file organization (agents, tools, workflows in separate directories)
- Maintain consistent naming conventions
- Include proper exports and imports

## Communication Style

**Conciseness**: Keep responses focused and actionable
**Clarity**: Explain complex concepts in simple terms
**Directness**: State what you're doing and why
**No Fluff**: Avoid unnecessary explanations or apologies

### Response Format
1. **Brief Status**: One line stating what you're doing
2. **Tool Usage**: Execute necessary tools
3. **Results Summary**: Concise summary of what was accomplished
4. **Next Steps**: Clear indication of completion or next actions

## Tool Usage Strategy

### File Operations
- **Project-Relative Paths**: All file paths are resolved relative to the project directory (unless absolute paths are used)
- **Read First**: Always read files before editing to understand context
- **Precise Edits**: Use exact text matching for search/replace operations
- **Batch Operations**: Group related file operations when possible

### Project Management
- **manageProject**: Use for package installation, project creation, dependency management
- **validateCode**: Always run after code changes to ensure quality
- **manageServer**: Use for testing Mastra server functionality
- **httpRequest**: Test API endpoints and integrations

### Information Gathering
- **Mastra Docs**: Primary source for Mastra-specific information
- **Web Search**: Secondary source for packages and external solutions
- **File Exploration**: Understand existing project structure and patterns

## Error Handling & Recovery

### Validation Failures
- Fix TypeScript errors immediately
- Address linting issues systematically
- Re-validate until clean

### Build Issues
- Check dependencies and versions
- Verify Mastra configuration
- Test in isolation when needed

### Integration Problems
- Verify API keys and environment setup
- Test connections independently
- Debug with logging and error messages

## Security & Best Practices

**Never:**
- Hard-code API keys or secrets
- Generate mock or placeholder implementations
- Skip error handling
- Ignore TypeScript errors
- Create insecure code patterns
- ask for file paths, you should be able to use the provided tools to explore the file system

**Always:**
- Use environment variables for configuration
- Implement proper input validation
- Follow security best practices
- Create complete, working implementations
- Test thoroughly before completion

## Output Requirements

### Code Quality
- ✅ TypeScript compilation passes
- ✅ ESLint validation passes
- ✅ Proper error handling implemented
- ✅ Environment variables configured
- ✅ Tests included when appropriate

### Documentation
- ✅ Clear setup instructions
- ✅ Environment variable documentation
- ✅ Usage examples provided
- ✅ API documentation for custom tools

### Integration
- ✅ Follows Mastra conventions
- ✅ Integrates with existing project
- ✅ Proper imports and exports
- ✅ Compatible with Mastra ecosystem

## Project Context

**Working Directory**: ${projectPath}
**Focus**: Mastra framework applications
**Goal**: Production-ready implementations

Remember: You are building real applications, not prototypes. Every implementation should be complete, secure, and ready for production use.

## Enhanced Tool Set

You have access to an enhanced set of tools based on production coding agent patterns:

### Task Management
- **taskManager**: Create and track multi-step coding tasks with states (pending, in_progress, completed, blocked). Use this for complex projects that require systematic progress tracking.

### Code Discovery & Analysis  
- **codeAnalyzer**: Analyze codebase structure, discover definitions (functions, classes, interfaces), map dependencies, and understand architectural patterns.
- **smartSearch**: Intelligent search with context awareness, pattern matching, and relevance scoring.

### Advanced File Operations
- **readFile**: Read files with optional line ranges, encoding support, metadata
- **writeFile**: Write files with directory creation, backup options
- **listDirectory**: Directory listing with filtering, recursion, metadata
- **multiEdit**: Perform multiple search-replace operations across files atomically with backup creation
- **executeCommand**: Execute shell commands with proper error handling and working directory support

**Important**: All file paths are resolved relative to the project directory unless absolute paths are provided.

### Communication & Workflow
- **askClarification**: Ask users for clarification when requirements are unclear or multiple options exist.
- **attemptCompletion**: Signal task completion with validation status and confidence metrics.

### Guidelines for Enhanced Tools:

1. **Use taskManager proactively** for any task requiring 3+ steps or complex coordination
2. **Start with codeAnalyzer** when working with unfamiliar codebases to understand structure
3. **Use smartSearch** for intelligent pattern discovery across the codebase
4. **Apply multiEdit** for systematic refactoring across multiple files
5. **Ask for clarification** when requirements are ambiguous rather than making assumptions
6. **Signal completion** with comprehensive summaries and validation status

Use the following basic examples to guide your implementation.

<examples>
### Weather Agent
\`\`\`
// ./src/agents/weather-agent.ts
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { weatherTool } from '../tools/weather-tool';

export const weatherAgent = new Agent({
  name: 'Weather Agent',
  instructions: \${instructions},
  model: openai('gpt-4o-mini'),
  tools: { weatherTool },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db', // ask user what database to use, use this as the default
    }),
  }),
});
\`\`\`

### Weather Tool
\`\`\`
// ./src/tools/weather-tool.ts
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getWeather } from '../tools/weather-tool';

export const weatherTool = createTool({
  id: 'get-weather',
  description: 'Get current weather for a location',
  inputSchema: z.object({
    location: z.string().describe('City name'),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    feelsLike: z.number(),
    humidity: z.number(),
    windSpeed: z.number(),
    windGust: z.number(),
    conditions: z.string(),
    location: z.string(),
  }),
  execute: async ({ context }) => {
    return await getWeather(context.location);
  },
});
\`\`\`

### Weather Workflow
\`\`\`
// ./src/workflows/weather-workflow.ts
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const fetchWeather = createStep({
  id: 'fetch-weather',
  description: 'Fetches weather forecast for a given city',
  inputSchema: z.object({
    city: z.string().describe('The city to get the weather for'),
  }),
  outputSchema: forecastSchema,
  execute: async ({ inputData }) => {
    if (!inputData) {
      throw new Error('Input data not found');
    }

    const geocodingUrl = \`https://geocoding-api.open-meteo.com/v1/search?name=\${encodeURIComponent(inputData.city)}&count=1\`;
    const geocodingResponse = await fetch(geocodingUrl);
    const geocodingData = (await geocodingResponse.json()) as {
      results: { latitude: number; longitude: number; name: string }[];
    };

    if (!geocodingData.results?.[0]) {
      throw new Error(\`Location '\${inputData.city}' not found\`);
    }

    const { latitude, longitude, name } = geocodingData.results[0];

    const weatherUrl = \`https://api.open-meteo.com/v1/forecast?latitude=\${latitude}&longitude=\${longitude}&current=precipitation,weathercode&timezone=auto,&hourly=precipitation_probability,temperature_2m\`
    const response = await fetch(weatherUrl);
    const data = (await response.json()) as {
      current: {
        time: string;
        precipitation: number;
        weathercode: number;
      };
      hourly: {
        precipitation_probability: number[];
        temperature_2m: number[];
      };
    };

    const forecast = {
      date: new Date().toISOString(),
      maxTemp: Math.max(...data.hourly.temperature_2m),
      minTemp: Math.min(...data.hourly.temperature_2m),
      condition: getWeatherCondition(data.current.weathercode),
      precipitationChance: data.hourly.precipitation_probability.reduce(
        (acc, curr) => Math.max(acc, curr),
        0,
      ),
      location: name,
    };

    return forecast;
  },
});

const planActivities = createStep({
  id: 'plan-activities',
  description: 'Suggests activities based on weather conditions',
  inputSchema: forecastSchema,
  outputSchema: z.object({
    activities: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const forecast = inputData;

    if (!forecast) {
      throw new Error('Forecast data not found');
    }

    const agent = mastra?.getAgent('weatherAgent');
    if (!agent) {
      throw new Error('Weather agent not found');
    }

    const prompt = \${weatherWorkflowPrompt}

    const response = await agent.stream([
      {
        role: 'user',
        content: prompt,
      },
    ]);

    let activitiesText = '';

    for await (const chunk of response.textStream) {
      process.stdout.write(chunk);
      activitiesText += chunk;
    }

    return {
      activities: activitiesText,
    };
  },
});

const weatherWorkflow = createWorkflow({
  id: 'weather-workflow',
  inputSchema: z.object({
    city: z.string().describe('The city to get the weather for'),
  }),
  outputSchema: z.object({
    activities: z.string(),
  }),
})
  .then(fetchWeather)
  .then(planActivities);

weatherWorkflow.commit();
\`\`\`
export { weatherWorkflow };
\`\`\`

### Mastra instance
\`\`\`
// ./src/mastra.ts

import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { weatherWorkflow } from './workflows/weather-workflow';
import { weatherAgent } from './agents/weather-agent';

export const mastra = new Mastra({
  workflows: { weatherWorkflow },
  agents: { weatherAgent },
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
\`\`\`

### MCPClient
\`\`\`
// ./src/mcp/client.ts

import { MCPClient } from '@mastra/mcp-client';

// leverage existing MCP servers, or create your own
export const mcpClient = new MCPClient({
  id: 'example-mcp-client',
  servers: {
    some-mcp-server: {
      command: 'npx',
      args: ["some-mcp-server"],
    },
  },
});

export const tools = await mcpClient.getTools();
\`\`\`

</examples>`;

  static DEFAULT_MEMORY_CONFIG = {
    lastMessages: 20,
  };

  static DEFAULT_TOOLS = async (projectPath?: string) => {
    const mcpClient = new MCPClient({
      id: 'agent-builder-mcp-client',
      servers: {
        // terminal: {
        // 	command: 'npx',
        // 	args: ['@dillip285/mcp-terminal', '--allowed-paths', projectPath || process.cwd()],
        // },
        // editor: {
        // 	command: 'node',
        // 	args: [
        // 		'/Users/daniellew/Documents/Mastra/mcp-editor',
        // 		'--allowedDirectories',
        // 		projectPath || process.cwd(),
        // 	],
        // },
        // web: {
        // 	command: 'node',
        // 	args: ['/Users/daniellew/Documents/Mastra/web-search/build/index.js'],
        // },
        docs: {
          command: 'npx',
          args: ['-y', '@mastra/mcp-docs-server'],
        },
      },
    });

    const tools = await mcpClient.getTools();
    const filteredTools: Record<string, any> = {};

    Object.keys(tools).forEach(key => {
      if (!key.includes('MastraCourse')) {
        filteredTools[key] = tools[key];
      }
    });

    return {
      ...filteredTools,

      // // Template Merge Tool
      // mergeTemplate: createTool({
      //   id: 'merge-template',
      //   description: 'Clone a Mastra template repository and merge it into the current project with safety checks.',
      //   inputSchema: MergeInputSchema,
      //   outputSchema: ApplyResultSchema,
      //   execute: async ({ context, mastra }) => {
      //     if (!mastra) {
      //       throw new Error('Mastra instance not available');
      //     }

      //     const workflow = mastra.getWorkflow('merge-template');
      //     if (!workflow) {
      //       throw new Error('Merge template workflow not found');
      //     }

      //     const run = await workflow.createRunAsync();
      //     const result = await run.start({ inputData: context });

      //     if (result.status === 'success') {
      //       return result.result;
      //     } else if (result.status === 'suspended') {
      //       // Handle suspension - the workflow is waiting for user input
      //       return {
      //         success: false,
      //         applied: false,
      //         conflicts: { safe: [], warn: [], block: [] },
      //         error: 'Workflow suspended - user interaction required. Use workflow resume to continue.',
      //       };
      //     } else {
      //       throw new Error(String(result.error) || 'Workflow failed');
      //     }
      //   },
      // }),

      // Core File Operations (replaces MCP editor)
      readFile: createTool({
        id: 'read-file',
        description: 'Read contents of a file with optional line range selection.',
        inputSchema: z.object({
          filePath: z.string().describe('Path to the file to read'),
          startLine: z.number().optional().describe('Starting line number (1-indexed)'),
          endLine: z.number().optional().describe('Ending line number (1-indexed, inclusive)'),
          encoding: z.string().default('utf-8').describe('File encoding'),
        }),
        outputSchema: z.object({
          success: z.boolean(),
          content: z.string().optional(),
          lines: z.array(z.string()).optional(),
          metadata: z
            .object({
              size: z.number(),
              totalLines: z.number(),
              encoding: z.string(),
              lastModified: z.string(),
            })
            .optional(),
          error: z.string().optional(),
        }),
        execute: async ({ context }) => {
          return await AgentBuilderDefaults.readFile({ ...context, projectPath });
        },
      }),

      writeFile: createTool({
        id: 'write-file',
        description: 'Write content to a file, with options for creating directories and backup.',
        inputSchema: z.object({
          filePath: z.string().describe('Path to the file to write'),
          content: z.string().describe('Content to write to the file'),
          createDirs: z.boolean().default(true).describe("Create parent directories if they don't exist"),
          backup: z.boolean().default(false).describe('Create a backup of existing file'),
          encoding: z.string().default('utf-8').describe('File encoding'),
        }),
        outputSchema: z.object({
          success: z.boolean(),
          filePath: z.string(),
          backup: z.string().optional(),
          bytesWritten: z.number().optional(),
          message: z.string(),
          error: z.string().optional(),
        }),
        execute: async ({ context }) => {
          return await AgentBuilderDefaults.writeFile({ ...context, projectPath });
        },
      }),

      listDirectory: createTool({
        id: 'list-directory',
        description: 'List contents of a directory with filtering and metadata options.',
        inputSchema: z.object({
          path: z.string().describe('Directory path to list'),
          recursive: z.boolean().default(false).describe('List subdirectories recursively'),
          includeHidden: z.boolean().default(false).describe('Include hidden files and directories'),
          pattern: z.string().optional().describe('Glob pattern to filter files'),
          maxDepth: z.number().default(10).describe('Maximum recursion depth'),
          includeMetadata: z.boolean().default(true).describe('Include file metadata'),
        }),
        outputSchema: z.object({
          success: z.boolean(),
          items: z.array(
            z.object({
              name: z.string(),
              path: z.string(),
              type: z.enum(['file', 'directory', 'symlink']),
              size: z.number().optional(),
              lastModified: z.string().optional(),
              permissions: z.string().optional(),
            }),
          ),
          totalItems: z.number(),
          path: z.string(),
          message: z.string(),
          error: z.string().optional(),
        }),
        execute: async ({ context }) => {
          return await AgentBuilderDefaults.listDirectory({ ...context, projectPath });
        },
      }),

      // General Command Execution (replaces MCP terminal)
      executeCommand: createTool({
        id: 'execute-command',
        description: 'Execute shell commands with proper error handling and output capture.',
        inputSchema: z.object({
          command: z.string().describe('Shell command to execute'),
          workingDirectory: z.string().optional().describe('Working directory for command execution'),
          timeout: z.number().default(30000).describe('Timeout in milliseconds'),
          captureOutput: z.boolean().default(true).describe('Capture command output'),
          shell: z.string().optional().describe('Shell to use (defaults to system shell)'),
          env: z.record(z.string()).optional().describe('Environment variables'),
        }),
        outputSchema: z.object({
          success: z.boolean(),
          exitCode: z.number().optional(),
          stdout: z.string().optional(),
          stderr: z.string().optional(),
          command: z.string(),
          workingDirectory: z.string().optional(),
          executionTime: z.number().optional(),
          error: z.string().optional(),
        }),
        execute: async ({ context }) => {
          return await AgentBuilderDefaults.executeCommand({
            ...context,
            workingDirectory: context.workingDirectory || projectPath,
          });
        },
      }),

      // Web Search (replaces MCP web search)
      webSearch: createTool({
        id: 'web-search',
        description: 'Search the web for current information and return structured results.',
        inputSchema: z.object({
          query: z.string().describe('Search query'),
          maxResults: z.number().default(10).describe('Maximum number of results to return'),
          region: z.string().default('us').describe('Search region/country code'),
          language: z.string().default('en').describe('Search language'),
          includeImages: z.boolean().default(false).describe('Include image results'),
          dateRange: z.enum(['day', 'week', 'month', 'year', 'all']).default('all').describe('Date range filter'),
        }),
        outputSchema: z.object({
          success: z.boolean(),
          query: z.string(),
          results: z.array(
            z.object({
              title: z.string(),
              url: z.string(),
              snippet: z.string(),
              domain: z.string(),
              publishDate: z.string().optional(),
              relevanceScore: z.number().optional(),
            }),
          ),
          totalResults: z.number(),
          searchTime: z.number(),
          suggestions: z.array(z.string()).optional(),
          error: z.string().optional(),
        }),
        execute: async ({ context }) => {
          return await AgentBuilderDefaults.webSearch(context);
        },
      }),

      // Enhanced Task Management (Critical for complex coding tasks)
      taskManager: createTool({
        id: 'task-manager',
        description:
          'Create and manage structured task lists for coding sessions. Use this for complex multi-step tasks to track progress and ensure thoroughness.',
        inputSchema: z.object({
          action: z.enum(['create', 'update', 'list', 'complete', 'remove']).describe('Task management action'),
          tasks: z
            .array(
              z.object({
                id: z.string().describe('Unique task identifier'),
                content: z.string().describe('Task description'),
                status: z.enum(['pending', 'in_progress', 'completed', 'blocked']).describe('Task status'),
                priority: z.enum(['high', 'medium', 'low']).default('medium').describe('Task priority'),
                dependencies: z.array(z.string()).optional().describe('IDs of tasks this depends on'),
                notes: z.string().optional().describe('Additional notes or context'),
              }),
            )
            .optional()
            .describe('Tasks to create or update'),
          taskId: z.string().optional().describe('Specific task ID for single task operations'),
        }),
        outputSchema: z.object({
          success: z.boolean(),
          tasks: z.array(
            z.object({
              id: z.string(),
              content: z.string(),
              status: z.string(),
              priority: z.string(),
              dependencies: z.array(z.string()).optional(),
              notes: z.string().optional(),
              createdAt: z.string(),
              updatedAt: z.string(),
            }),
          ),
          message: z.string(),
        }),
        execute: async ({ context }) => {
          return await AgentBuilderDefaults.manageTaskList(context);
        },
      }),

      // Enhanced Code Discovery
      codeAnalyzer: createTool({
        id: 'code-analyzer',
        description: 'Analyze codebase structure, discover definitions, and understand architecture patterns.',
        inputSchema: z.object({
          action: z
            .enum(['definitions', 'dependencies', 'patterns', 'structure'])
            .describe('Type of analysis to perform'),
          path: z.string().describe('Directory or file path to analyze'),
          language: z.string().optional().describe('Programming language filter'),
          depth: z.number().default(3).describe('Directory traversal depth'),
          includeTests: z.boolean().default(false).describe('Include test files in analysis'),
        }),
        outputSchema: z.object({
          success: z.boolean(),
          analysis: z.object({
            definitions: z
              .array(
                z.object({
                  name: z.string(),
                  type: z.string(),
                  file: z.string(),
                  line: z.number().optional(),
                  scope: z.string().optional(),
                }),
              )
              .optional(),
            dependencies: z
              .array(
                z.object({
                  name: z.string(),
                  type: z.enum(['import', 'require', 'include']),
                  source: z.string(),
                  target: z.string(),
                }),
              )
              .optional(),
            patterns: z
              .array(
                z.object({
                  pattern: z.string(),
                  description: z.string(),
                  files: z.array(z.string()),
                }),
              )
              .optional(),
            structure: z
              .object({
                directories: z.number(),
                files: z.number(),
                languages: z.record(z.number()),
                complexity: z.string(),
              })
              .optional(),
          }),
          message: z.string(),
        }),
        execute: async ({ context }) => {
          return await AgentBuilderDefaults.analyzeCode(context);
        },
      }),

      // Advanced File Operations
      multiEdit: createTool({
        id: 'multi-edit',
        description: 'Perform multiple search-replace operations on one or more files in a single atomic operation.',
        inputSchema: z.object({
          operations: z
            .array(
              z.object({
                filePath: z.string().describe('Path to the file to edit'),
                edits: z
                  .array(
                    z.object({
                      oldString: z.string().describe('Exact text to replace'),
                      newString: z.string().describe('Replacement text'),
                      replaceAll: z.boolean().default(false).describe('Replace all occurrences'),
                    }),
                  )
                  .describe('List of edit operations for this file'),
              }),
            )
            .describe('File edit operations to perform'),
          createBackup: z.boolean().default(true).describe('Create backup files before editing'),
        }),
        outputSchema: z.object({
          success: z.boolean(),
          results: z.array(
            z.object({
              filePath: z.string(),
              editsApplied: z.number(),
              errors: z.array(z.string()),
              backup: z.string().optional(),
            }),
          ),
          message: z.string(),
        }),
        execute: async ({ context }) => {
          return await AgentBuilderDefaults.performMultiEdit({ ...context, projectPath });
        },
      }),

      // Interactive Communication
      askClarification: createTool({
        id: 'ask-clarification',
        description: 'Ask the user for clarification when requirements are unclear or when multiple options exist.',
        inputSchema: z.object({
          question: z.string().describe('The specific question to ask'),
          options: z
            .array(
              z.object({
                id: z.string(),
                description: z.string(),
                implications: z.string().optional(),
              }),
            )
            .optional()
            .describe('Multiple choice options if applicable'),
          context: z.string().optional().describe('Additional context about why clarification is needed'),
          urgency: z.enum(['low', 'medium', 'high']).default('medium').describe('How urgent the clarification is'),
        }),
        outputSchema: z.object({
          questionId: z.string(),
          question: z.string(),
          options: z
            .array(
              z.object({
                id: z.string(),
                description: z.string(),
              }),
            )
            .optional(),
          awaitingResponse: z.boolean(),
        }),
        execute: async ({ context }) => {
          return await AgentBuilderDefaults.askClarification(context);
        },
      }),

      // Task Completion Signaling
      attemptCompletion: createTool({
        id: 'attempt-completion',
        description: 'Signal that you believe the requested task has been completed and provide a summary.',
        inputSchema: z.object({
          summary: z.string().describe('Summary of what was accomplished'),
          changes: z
            .array(
              z.object({
                type: z.enum(['file_created', 'file_modified', 'file_deleted', 'command_executed', 'dependency_added']),
                description: z.string(),
                path: z.string().optional(),
              }),
            )
            .describe('List of changes made'),
          validation: z
            .object({
              testsRun: z.boolean().default(false),
              buildsSuccessfully: z.boolean().default(false),
              manualTestingRequired: z.boolean().default(false),
            })
            .describe('Validation status'),
          nextSteps: z.array(z.string()).optional().describe('Suggested next steps or follow-up actions'),
        }),
        outputSchema: z.object({
          completionId: z.string(),
          status: z.enum(['completed', 'needs_review', 'needs_testing']),
          summary: z.string(),
          confidence: z.number().min(0).max(100),
        }),
        execute: async ({ context }) => {
          return await AgentBuilderDefaults.signalCompletion(context);
        },
      }),

      // Enhanced Pattern Search
      smartSearch: createTool({
        id: 'smart-search',
        description: 'Intelligent search across codebase with context awareness and pattern matching.',
        inputSchema: z.object({
          query: z.string().describe('Search query or pattern'),
          type: z.enum(['text', 'regex', 'fuzzy', 'semantic']).default('text').describe('Type of search to perform'),
          scope: z
            .object({
              paths: z.array(z.string()).optional().describe('Specific paths to search'),
              fileTypes: z.array(z.string()).optional().describe('File extensions to include'),
              excludePaths: z.array(z.string()).optional().describe('Paths to exclude'),
              maxResults: z.number().default(50).describe('Maximum number of results'),
            })
            .optional(),
          context: z
            .object({
              beforeLines: z.number().default(2).describe('Lines of context before match'),
              afterLines: z.number().default(2).describe('Lines of context after match'),
              includeDefinitions: z.boolean().default(false).describe('Include function/class definitions'),
            })
            .optional(),
        }),
        outputSchema: z.object({
          success: z.boolean(),
          matches: z.array(
            z.object({
              file: z.string(),
              line: z.number(),
              column: z.number().optional(),
              match: z.string(),
              context: z.object({
                before: z.array(z.string()),
                after: z.array(z.string()),
              }),
              relevance: z.number().optional(),
            }),
          ),
          summary: z.object({
            totalMatches: z.number(),
            filesSearched: z.number(),
            patterns: z.array(z.string()),
          }),
        }),
        execute: async ({ context }) => {
          return await AgentBuilderDefaults.performSmartSearch(context);
        },
      }),

      manageProject: createTool({
        id: 'manage-project',
        description:
          'Handles project management including creating project structures, managing dependencies, and package operations',
        inputSchema: z.object({
          action: z.enum(['create', 'install', 'upgrade', 'check']).describe('The action to perform'),
          features: z
            .array(z.string())
            .optional()
            .describe('Mastra features to include (e.g., ["agents", "memory", "workflows"])'),
          packageManager: z.enum(['npm', 'pnpm', 'yarn']).optional().describe('Package manager to use'),
          packages: z
            .array(
              z.object({
                name: z.string(),
                version: z.string().optional(),
              }),
            )
            .optional()
            .describe('Packages to install/upgrade'),
        }),
        outputSchema: z.object({
          success: z.boolean(),
          installed: z.array(z.string()).optional(),
          upgraded: z.array(z.string()).optional(),
          warnings: z.array(z.string()).optional(),
          message: z.string().optional(),
          details: z.string().optional(),
          error: z.string().optional(),
        }),
        execute: async ({ context }) => {
          const { action, features, packages, packageManager } = context;
          try {
            switch (action) {
              case 'create':
                return await AgentBuilderDefaults.createMastraProject({
                  projectName: projectPath,
                  features,
                  packageManager,
                });
              case 'install':
                if (!packages?.length) {
                  return {
                    success: false,
                    message: 'Packages array is required for install action',
                  };
                }
                return await AgentBuilderDefaults.installPackages({
                  packages,
                  projectPath,
                  packageManager,
                });
              case 'upgrade':
                return await AgentBuilderDefaults.upgradePackages({
                  packages,
                  projectPath,
                  packageManager,
                });
              case 'check':
                return await AgentBuilderDefaults.checkProject({
                  projectPath,
                });
              default:
                return {
                  success: false,
                  message: `Unknown action: ${action}`,
                };
            }
          } catch (error) {
            return {
              success: false,
              message: `Error executing ${action}: ${error instanceof Error ? error.message : String(error)}`,
            };
          }
        },
      }),
      validateCode: createTool({
        id: 'validate-code',
        description:
          'Validates generated code through TypeScript compilation, ESLint, schema validation, and other checks',
        inputSchema: z.object({
          projectPath: z.string().optional().describe('Path to the project to validate (defaults to current project)'),
          validationType: z
            .array(z.enum(['types', 'lint', 'schemas', 'tests', 'build']))
            .describe('Types of validation to perform'),
          files: z
            .array(z.string())
            .optional()
            .describe('Specific files to validate (if not provided, validates entire project)'),
        }),
        outputSchema: z.object({
          valid: z.boolean(),
          errors: z.array(
            z.object({
              type: z.enum(['typescript', 'eslint', 'schema', 'test', 'build']),
              severity: z.enum(['error', 'warning', 'info']),
              message: z.string(),
              file: z.string().optional(),
              line: z.number().optional(),
              column: z.number().optional(),
              code: z.string().optional(),
            }),
          ),
          summary: z.object({
            totalErrors: z.number(),
            totalWarnings: z.number(),
            validationsPassed: z.array(z.string()),
            validationsFailed: z.array(z.string()),
          }),
        }),
        execute: async ({ context }) => {
          const { projectPath: validationProjectPath, validationType, files } = context;
          const targetPath = validationProjectPath || projectPath;
          return await AgentBuilderDefaults.validateCode({
            projectPath: targetPath,
            validationType,
            files,
          });
        },
      }),
      manageServer: createTool({
        id: 'manage-server',
        description:
          'Manages the Mastra server - start, stop, restart, and check status, use the terminal tool to make curl requests to the server. There is an openapi spec for the server at http://localhost:{port}/openapi.json',
        inputSchema: z.object({
          action: z.enum(['start', 'stop', 'restart', 'status']).describe('Server management action'),
          port: z.number().optional().default(4200).describe('Port to run the server on'),
        }),
        outputSchema: z.object({
          success: z.boolean(),
          status: z.enum(['running', 'stopped', 'starting', 'stopping', 'unknown']),
          pid: z.number().optional(),
          port: z.number().optional(),
          url: z.string().optional(),
          message: z.string().optional(),
          stdout: z.array(z.string()).optional().describe('Server output lines captured during startup'),
          error: z.string().optional(),
        }),
        execute: async ({ context }) => {
          const { action, port } = context;
          try {
            switch (action) {
              case 'start':
                return await AgentBuilderDefaults.startMastraServer({
                  port,
                  projectPath,
                });
              case 'stop':
                return await AgentBuilderDefaults.stopMastraServer({
                  port,
                  projectPath,
                });
              case 'restart':
                const stopResult = await AgentBuilderDefaults.stopMastraServer({
                  port,
                  projectPath,
                });
                if (!stopResult.success) {
                  return {
                    success: false,
                    status: 'unknown' as const,
                    message: `Failed to restart: could not stop server on port ${port}`,
                    error: stopResult.error || 'Unknown stop error',
                  };
                }
                await new Promise(resolve => setTimeout(resolve, 500));
                const startResult = await AgentBuilderDefaults.startMastraServer({
                  port,
                  projectPath,
                });
                if (!startResult.success) {
                  return {
                    success: false,
                    status: 'stopped' as const,
                    message: `Failed to restart: server stopped successfully but failed to start on port ${port}`,
                    error: startResult.error || 'Unknown start error',
                  };
                }
                return {
                  ...startResult,
                  message: `Mastra server restarted successfully on port ${port}`,
                };
              case 'status':
                return await AgentBuilderDefaults.checkMastraServerStatus({
                  port,
                  projectPath,
                });
              default:
                return {
                  success: false,
                  status: 'unknown' as const,
                  message: `Unknown action: ${action}`,
                };
            }
          } catch (error) {
            return {
              success: false,
              status: 'unknown' as const,
              message: `Error managing server: ${error instanceof Error ? error.message : String(error)}`,
            };
          }
        },
      }),
      httpRequest: createTool({
        id: 'http-request',
        description: 'Makes HTTP requests to the Mastra server or external APIs for testing and integration',
        inputSchema: z.object({
          method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).describe('HTTP method'),
          url: z.string().describe('Full URL or path (if baseUrl provided)'),
          baseUrl: z.string().optional().describe('Base URL for the server (e.g., http://localhost:4200)'),
          headers: z.record(z.string()).optional().describe('HTTP headers'),
          body: z.any().optional().describe('Request body (will be JSON stringified if object)'),
          timeout: z.number().optional().default(30000).describe('Request timeout in milliseconds'),
        }),
        outputSchema: z.object({
          success: z.boolean(),
          status: z.number().optional(),
          statusText: z.string().optional(),
          headers: z.record(z.string()).optional(),
          data: z.any().optional(),
          error: z.string().optional(),
          url: z.string(),
          method: z.string(),
        }),
        execute: async ({ context }) => {
          const { method, url, baseUrl, headers, body, timeout } = context;
          try {
            return await AgentBuilderDefaults.makeHttpRequest({
              method,
              url,
              baseUrl,
              headers,
              body,
              timeout,
            });
          } catch (error) {
            return {
              success: false,
              url: baseUrl ? `${baseUrl}${url}` : url,
              method,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        },
      }),
    };
  };

  /**
   * Helper function to detect package manager
   */
  static getPackageManager(): 'npm' | 'pnpm' | 'yarn' {
    const userAgent = process.env.npm_config_user_agent || '';
    const execPath = process.env.npm_execpath || '';

    if (userAgent.includes('yarn')) return 'yarn';
    if (userAgent.includes('pnpm')) return 'pnpm';
    if (userAgent.includes('npm')) return 'npm';

    if (execPath.includes('yarn')) return 'yarn';
    if (execPath.includes('pnpm')) return 'pnpm';
    if (execPath.includes('npm')) return 'npm';

    return 'npm'; // default
  }

  /**
   * Create a new Mastra project using create-mastra CLI
   */
  static async createMastraProject({
    features,
    packageManager,
    projectName,
  }: {
    features?: string[];
    packageManager?: 'npm' | 'pnpm' | 'yarn';
    projectName?: string;
  }) {
    try {
      const pm = packageManager || AgentBuilderDefaults.getPackageManager();
      const args = [pm === 'npm' ? 'npx' : pm, 'create mastra@latest', projectName, '-l', 'openai', '-k', 'skip'];

      if (features && features.length > 0) {
        args.push('--components', features.join(','));
      }
      args.push('--example');

      const { stdout, stderr } = await exec(args.join(' '));

      return {
        success: true,
        projectPath: `./${projectName}`,
        message: `Successfully created Mastra project: ${projectName}`,
        details: stdout,
        error: stderr,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create project: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Install packages using the detected package manager
   */
  static async installPackages({
    packages,
    projectPath,
    packageManager,
  }: {
    packages: Array<{ name: string; version?: string }>;
    projectPath?: string;
    packageManager?: 'npm' | 'pnpm' | 'yarn';
  }) {
    try {
      const pm = packageManager || AgentBuilderDefaults.getPackageManager();

      const packageStrings = packages.map(
        p => `${p.name}${p.version && !p.name.includes('mastra') ? `@${p.version}` : ''}`,
      );

      let installCmd: string;
      // if (pm === 'npm') {
      //   installCmd = `npm install ${packageStrings.join(' ')}`;
      // } else if (pm === 'yarn') {
      //   installCmd = `yarn add ${packageStrings.join(' ')}`;
      // } else {
      installCmd = `pnpm add ${packageStrings.join(' ')}`;
      // }

      const execOptions = projectPath ? { cwd: projectPath } : {};
      const { stdout } = await exec(installCmd, execOptions);

      return {
        success: true,
        installed: packageStrings,
        message: `Successfully installed ${packages.length} package(s)`,
        details: stdout,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to install packages: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Upgrade packages using the detected package manager
   */
  static async upgradePackages({
    packages,
    projectPath,
    packageManager,
  }: {
    packages?: Array<{ name: string; version?: string }>;
    projectPath?: string;
    packageManager?: 'npm' | 'pnpm' | 'yarn';
  }) {
    try {
      const pm = packageManager || AgentBuilderDefaults.getPackageManager();
      let upgradeCmd: string;

      if (packages && packages.length > 0) {
        const packageStrings = packages.map(p => `${p.name}${p.version ? `@${p.version}` : '@latest'}`);
        if (pm === 'npm') {
          upgradeCmd = `npm update ${packageStrings.join(' ')}`;
        } else if (pm === 'yarn') {
          upgradeCmd = `yarn upgrade ${packageStrings.join(' ')}`;
        } else {
          upgradeCmd = `pnpm update ${packageStrings.join(' ')}`;
        }
      } else {
        if (pm === 'npm') {
          upgradeCmd = 'npm update';
        } else if (pm === 'yarn') {
          upgradeCmd = 'yarn upgrade';
        } else {
          upgradeCmd = 'pnpm update';
        }
      }

      const execOptions = projectPath ? { cwd: projectPath } : {};
      const { stdout } = await exec(upgradeCmd, execOptions);

      return {
        success: true,
        upgraded: packages?.map(p => p.name) || ['all packages'],
        message: 'Packages upgraded successfully',
        details: stdout,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to upgrade packages: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Check project health and status
   */
  static async checkProject({ projectPath }: { projectPath?: string }) {
    try {
      const execOptions = projectPath ? { cwd: projectPath } : {};

      let hasPackageJson = false;
      let hasMastraConfig = false;

      try {
        await exec('test -f package.json', execOptions);
        hasPackageJson = true;
      } catch {
        // ignore
      }

      try {
        await exec('test -f mastra.config.* || test -d src/mastra || test -d mastra', execOptions);
        hasMastraConfig = true;
      } catch {
        // ignore
      }

      const warnings: string[] = [];
      if (!hasPackageJson) {
        warnings.push('No package.json found - this may not be a Node.js project');
      }
      if (!hasMastraConfig) {
        warnings.push('No Mastra configuration found - run "npx create-mastra" to initialize');
      }

      return {
        success: true,
        message: `Project health check completed for ${projectPath || 'current directory'}`,
        warnings,
        checks: {
          hasPackageJson,
          hasMastraConfig,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to check project: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Start the Mastra server
   */
  static async startMastraServer({
    port = 4200,
    projectPath,
    env = {},
  }: {
    port?: number;
    projectPath?: string;
    env?: Record<string, string>;
  }) {
    try {
      const serverEnv = { ...process.env, ...env, PORT: port.toString() };
      const execOptions = {
        cwd: projectPath || process.cwd(),
        env: serverEnv,
      };

      const { spawn } = await import('child_process');
      const serverProcess = spawn('pnpm', ['run', 'dev'], {
        ...execOptions,
        detached: true,
        stdio: 'pipe',
      });

      const stdoutLines: string[] = [];

      const serverStarted = new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Server startup timeout after 30 seconds. Output: ${stdoutLines.join('\n')}`));
        }, 30000);

        serverProcess.stdout?.on('data', data => {
          const output = data.toString();
          const lines = output.split('\n').filter((line: string) => line.trim());
          stdoutLines.push(...lines);

          if (output.includes('Mastra API running on port')) {
            clearTimeout(timeout);
            resolve({
              success: true,
              status: 'running' as const,
              pid: serverProcess.pid,
              port,
              url: `http://localhost:${port}`,
              message: `Mastra server started successfully on port ${port}`,
              stdout: stdoutLines,
            });
          }
        });

        serverProcess.stderr?.on('data', data => {
          const errorOutput = data.toString();
          stdoutLines.push(`[STDERR] ${errorOutput}`);
          clearTimeout(timeout);
          reject(new Error(`Server startup failed with error: ${errorOutput}`));
        });

        serverProcess.on('error', error => {
          clearTimeout(timeout);
          reject(error);
        });

        serverProcess.on('exit', (code, signal) => {
          clearTimeout(timeout);
          if (code !== 0 && code !== null) {
            reject(
              new Error(
                `Server process exited with code ${code}${signal ? ` (signal: ${signal})` : ''}. Output: ${stdoutLines.join('\n')}`,
              ),
            );
          }
        });
      });

      return await serverStarted;
    } catch (error) {
      return {
        success: false,
        status: 'stopped' as const,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Stop the Mastra server
   */
  static async stopMastraServer({ port = 4200, projectPath: _projectPath }: { port?: number; projectPath?: string }) {
    try {
      const { stdout } = await exec(`lsof -ti:${port} || echo "No process found"`);

      if (!stdout.trim() || stdout.trim() === 'No process found') {
        return {
          success: true,
          status: 'stopped' as const,
          message: `No Mastra server found running on port ${port}`,
        };
      }

      const pids = stdout
        .trim()
        .split('\n')
        .filter(pid => pid.trim());
      const killedPids: number[] = [];
      const failedPids: number[] = [];

      for (const pidStr of pids) {
        const pid = parseInt(pidStr.trim());
        if (isNaN(pid)) continue;

        try {
          process.kill(pid, 'SIGTERM');
          killedPids.push(pid);
        } catch {
          failedPids.push(pid);
        }
      }

      if (killedPids.length === 0) {
        return {
          success: false,
          status: 'unknown' as const,
          message: `Failed to stop any processes on port ${port}`,
          error: `Could not kill PIDs: ${failedPids.join(', ')}`,
        };
      }

      // Wait a bit and check if processes are still running
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        const { stdout: checkStdout } = await exec(`lsof -ti:${port} || echo "No process found"`);
        if (checkStdout.trim() && checkStdout.trim() !== 'No process found') {
          // Force kill remaining processes
          const remainingPids = checkStdout
            .trim()
            .split('\n')
            .filter(pid => pid.trim());
          for (const pidStr of remainingPids) {
            const pid = parseInt(pidStr.trim());
            if (!isNaN(pid)) {
              try {
                process.kill(pid, 'SIGKILL');
              } catch {
                // ignore
              }
            }
          }

          // Final check
          await new Promise(resolve => setTimeout(resolve, 1000));
          const { stdout: finalCheck } = await exec(`lsof -ti:${port} || echo "No process found"`);
          if (finalCheck.trim() && finalCheck.trim() !== 'No process found') {
            return {
              success: false,
              status: 'unknown' as const,
              message: `Server processes still running on port ${port} after stop attempts`,
              error: `Remaining PIDs: ${finalCheck.trim()}`,
            };
          }
        }
      } catch (error) {
        console.warn('Failed to verify server stop:', error);
      }

      return {
        success: true,
        status: 'stopped' as const,
        message: `Mastra server stopped successfully (port ${port}). Killed PIDs: ${killedPids.join(', ')}`,
      };
    } catch (error) {
      return {
        success: false,
        status: 'unknown' as const,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check Mastra server status
   */
  static async checkMastraServerStatus({
    port = 4200,
    projectPath: _projectPath,
  }: {
    port?: number;
    projectPath?: string;
  }) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`http://localhost:${port}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return {
          success: true,
          status: 'running' as const,
          port,
          url: `http://localhost:${port}`,
          message: 'Mastra server is running and healthy',
        };
      } else {
        return {
          success: false,
          status: 'unknown' as const,
          port,
          message: `Server responding but not healthy (status: ${response.status})`,
        };
      }
    } catch {
      // Check if process exists on port
      try {
        const { stdout } = await exec(`lsof -ti:${port} || echo "No process found"`);
        const hasProcess = stdout.trim() && stdout.trim() !== 'No process found';

        return {
          success: Boolean(hasProcess),
          status: hasProcess ? ('starting' as const) : ('stopped' as const),
          port,
          message: hasProcess
            ? 'Server process exists but not responding to health checks'
            : 'No server process found on specified port',
        };
      } catch {
        return {
          success: false,
          status: 'stopped' as const,
          port,
          message: 'Server is not running',
        };
      }
    }
  }

  /**
   * Validate code using TypeScript, ESLint, and other tools
   */
  static async validateCode({
    projectPath,
    validationType,
    files,
  }: {
    projectPath?: string;
    validationType: Array<'types' | 'lint' | 'schemas' | 'tests' | 'build'>;
    files?: string[];
  }) {
    const errors: Array<{
      type: 'typescript' | 'eslint' | 'schema' | 'test' | 'build';
      severity: 'error' | 'warning' | 'info';
      message: string;
      file?: string;
      line?: number;
      column?: number;
      code?: string;
    }> = [];
    const validationsPassed: string[] = [];
    const validationsFailed: string[] = [];

    const execOptions = { cwd: projectPath };

    // TypeScript validation
    if (validationType.includes('types')) {
      try {
        const filePattern = files?.length ? files.join(' ') : '';
        const tscCommand = files?.length ? `npx tsc --noEmit ${filePattern}` : 'npx tsc --noEmit';
        await exec(tscCommand, execOptions);
        validationsPassed.push('types');
      } catch (error: any) {
        let tsOutput = '';
        if (error.stdout) {
          tsOutput = error.stdout;
        } else if (error.stderr) {
          tsOutput = error.stderr;
        } else if (error.message) {
          tsOutput = error.message;
        }

        errors.push({
          type: 'typescript',
          severity: 'error',
          message: tsOutput.trim() || `TypeScript validation failed: ${error.message || String(error)}`,
        });
        validationsFailed.push('types');
      }
    }

    // ESLint validation
    if (validationType.includes('lint')) {
      try {
        const filePattern = files?.length ? files.join(' ') : '.';
        const eslintCommand = `npx eslint ${filePattern} --format json`;
        const { stdout } = await exec(eslintCommand, execOptions);

        if (stdout) {
          const eslintResults = JSON.parse(stdout);
          const eslintErrors = AgentBuilderDefaults.parseESLintErrors(eslintResults);
          errors.push(...eslintErrors);

          if (eslintErrors.some(e => e.severity === 'error')) {
            validationsFailed.push('lint');
          } else {
            validationsPassed.push('lint');
          }
        } else {
          validationsPassed.push('lint');
        }
      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (errorMessage.includes('"filePath"') || errorMessage.includes('messages')) {
          try {
            const eslintResults = JSON.parse(errorMessage);
            const eslintErrors = AgentBuilderDefaults.parseESLintErrors(eslintResults);
            errors.push(...eslintErrors);
            validationsFailed.push('lint');
          } catch {
            errors.push({
              type: 'eslint',
              severity: 'error',
              message: `ESLint validation failed: ${errorMessage}`,
            });
            validationsFailed.push('lint');
          }
        } else {
          validationsPassed.push('lint');
        }
      }
    }

    // Build validation
    if (validationType.includes('build')) {
      try {
        await exec('npm run build || pnpm build || yarn build', execOptions);
        validationsPassed.push('build');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({
          type: 'build',
          severity: 'error',
          message: `Build failed: ${errorMessage}`,
        });
        validationsFailed.push('build');
      }
    }

    // Test validation
    if (validationType.includes('tests')) {
      try {
        const testCommand = files?.length ? `npx vitest run ${files.join(' ')}` : 'npm test || pnpm test || yarn test';
        await exec(testCommand, execOptions);
        validationsPassed.push('tests');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({
          type: 'test',
          severity: 'error',
          message: `Tests failed: ${errorMessage}`,
        });
        validationsFailed.push('tests');
      }
    }

    const totalErrors = errors.filter(e => e.severity === 'error').length;
    const totalWarnings = errors.filter(e => e.severity === 'warning').length;
    const isValid = totalErrors === 0;

    return {
      valid: isValid,
      errors,
      summary: {
        totalErrors,
        totalWarnings,
        validationsPassed,
        validationsFailed,
      },
    };
  }

  /**
   * Parse ESLint errors from JSON output
   */
  static parseESLintErrors(eslintResults: any[]): Array<{
    type: 'eslint';
    severity: 'error' | 'warning';
    message: string;
    file?: string;
    line?: number;
    column?: number;
    code?: string;
  }> {
    const errors: Array<{
      type: 'eslint';
      severity: 'error' | 'warning';
      message: string;
      file?: string;
      line?: number;
      column?: number;
      code?: string;
    }> = [];

    for (const result of eslintResults) {
      for (const message of result.messages || []) {
        if (message.message) {
          errors.push({
            type: 'eslint',
            severity: message.severity === 1 ? 'warning' : 'error',
            message: message.message,
            file: result.filePath || undefined,
            line: message.line || undefined,
            column: message.column || undefined,
            code: message.ruleId || undefined,
          });
        }
      }
    }

    return errors;
  }

  /**
   * Make HTTP request to server or external API
   */
  static async makeHttpRequest({
    method,
    url,
    baseUrl,
    headers = {},
    body,
    timeout = 30000,
  }: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    url: string;
    baseUrl?: string;
    headers?: Record<string, string>;
    body?: any;
    timeout?: number;
  }) {
    try {
      const fullUrl = baseUrl ? `${baseUrl}${url}` : url;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const requestOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        signal: controller.signal,
      };

      if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      const response = await fetch(fullUrl, requestOptions);
      clearTimeout(timeoutId);

      let data: any;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        data,
        url: fullUrl,
        method,
      };
    } catch (error) {
      return {
        success: false,
        url: baseUrl ? `${baseUrl}${url}` : url,
        method,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Enhanced task management system for complex coding tasks
   */
  static async manageTaskList(context: {
    action: 'create' | 'update' | 'list' | 'complete' | 'remove';
    tasks?: Array<{
      id: string;
      content: string;
      status: 'pending' | 'in_progress' | 'completed' | 'blocked';
      priority: 'high' | 'medium' | 'low';
      dependencies?: string[];
      notes?: string;
    }>;
    taskId?: string;
  }) {
    // In-memory task storage (could be enhanced with persistent storage)
    if (!AgentBuilderDefaults.taskStorage) {
      AgentBuilderDefaults.taskStorage = new Map();
    }

    const sessionId = 'current'; // Could be enhanced with proper session management
    const existingTasks = AgentBuilderDefaults.taskStorage.get(sessionId) || [];

    try {
      switch (context.action) {
        case 'create':
          if (!context.tasks?.length) {
            return {
              success: false,
              tasks: existingTasks,
              message: 'No tasks provided for creation',
            };
          }

          const newTasks = context.tasks.map(task => ({
            ...task,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }));

          const allTasks = [...existingTasks, ...newTasks];
          AgentBuilderDefaults.taskStorage.set(sessionId, allTasks);

          return {
            success: true,
            tasks: allTasks,
            message: `Created ${newTasks.length} new task(s)`,
          };

        case 'update':
          if (!context.tasks?.length) {
            return {
              success: false,
              tasks: existingTasks,
              message: 'No tasks provided for update',
            };
          }

          const updatedTasks = existingTasks.map(existing => {
            const update = context.tasks!.find(t => t.id === existing.id);
            return update ? { ...existing, ...update, updatedAt: new Date().toISOString() } : existing;
          });

          AgentBuilderDefaults.taskStorage.set(sessionId, updatedTasks);

          return {
            success: true,
            tasks: updatedTasks,
            message: 'Tasks updated successfully',
          };

        case 'complete':
          if (!context.taskId) {
            return {
              success: false,
              tasks: existingTasks,
              message: 'Task ID required for completion',
            };
          }

          const completedTasks = existingTasks.map(task =>
            task.id === context.taskId
              ? { ...task, status: 'completed' as const, updatedAt: new Date().toISOString() }
              : task,
          );

          AgentBuilderDefaults.taskStorage.set(sessionId, completedTasks);

          return {
            success: true,
            tasks: completedTasks,
            message: `Task ${context.taskId} marked as completed`,
          };

        case 'remove':
          if (!context.taskId) {
            return {
              success: false,
              tasks: existingTasks,
              message: 'Task ID required for removal',
            };
          }

          const filteredTasks = existingTasks.filter(task => task.id !== context.taskId);
          AgentBuilderDefaults.taskStorage.set(sessionId, filteredTasks);

          return {
            success: true,
            tasks: filteredTasks,
            message: `Task ${context.taskId} removed`,
          };

        case 'list':
        default:
          return {
            success: true,
            tasks: existingTasks,
            message: `Found ${existingTasks.length} task(s)`,
          };
      }
    } catch (error) {
      return {
        success: false,
        tasks: existingTasks,
        message: `Task management error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Analyze codebase structure and patterns
   */
  static async analyzeCode(context: {
    action: 'definitions' | 'dependencies' | 'patterns' | 'structure';
    path: string;
    language?: string;
    depth?: number;
    includeTests?: boolean;
  }) {
    try {
      const { action, path, language, depth = 3, includeTests = false } = context;

      // Use ripgrep for fast searching
      const excludePatterns = includeTests ? [] : ['*test*', '*spec*', '__tests__'];
      const languagePattern = language ? `*.${language}` : '*';

      switch (action) {
        case 'definitions':
          // Search for function/class/interface definitions
          const definitionPatterns = [
            'function\\s+([a-zA-Z_][a-zA-Z0-9_]*)',
            'class\\s+([a-zA-Z_][a-zA-Z0-9_]*)',
            'interface\\s+([a-zA-Z_][a-zA-Z0-9_]*)',
            'const\\s+([a-zA-Z_][a-zA-Z0-9_]*)\\s*=',
            'export\\s+(function|class|interface|const)\\s+([a-zA-Z_][a-zA-Z0-9_]*)',
          ];

          const definitions: Array<{ name: string; type: string; file: string; line?: number; scope?: string }> = [];

          for (const pattern of definitionPatterns) {
            try {
              const { stdout } = await exec(
                `rg -n "${pattern}" "${path}" --type ${languagePattern} --max-depth ${depth}`,
              );
              const matches = stdout.split('\n').filter(line => line.trim());

              matches.forEach(match => {
                const parts = match.split(':');
                if (parts.length >= 3) {
                  const file = parts[0];
                  const lineStr = parts[1];
                  const line = parseInt(lineStr || '0');
                  const content = parts.slice(2).join(':');
                  const nameMatch = content.match(/([a-zA-Z_][a-zA-Z0-9_]*)/);

                  if (nameMatch && nameMatch[1]) {
                    definitions.push({
                      name: nameMatch[1],
                      type: pattern.includes('function')
                        ? 'function'
                        : pattern.includes('class')
                          ? 'class'
                          : pattern.includes('interface')
                            ? 'interface'
                            : 'variable',
                      file: file || '',
                      line,
                      scope: 'top-level',
                    });
                  }
                }
              });
            } catch {
              // Continue with other patterns if one fails
            }
          }

          return {
            success: true,
            analysis: { definitions },
            message: `Found ${definitions.length} code definitions`,
          };

        case 'dependencies':
          // Search for import/require statements
          const depPatterns = [
            'import\\s+.*\\s+from\\s+[\'"]([^\'"]+)[\'"]',
            'require\\([\'"]([^\'"]+)[\'"]\\)',
            '#include\\s+[<"]([^>"]+)[>"]',
          ];

          const dependencies: Array<{
            name: string;
            type: 'import' | 'require' | 'include';
            source: string;
            target: string;
          }> = [];

          for (const pattern of depPatterns) {
            try {
              const { stdout } = await exec(`rg -n "${pattern}" "${path}" --type ${languagePattern}`);
              const matches = stdout.split('\n').filter(line => line.trim());

              matches.forEach(match => {
                const parts = match.split(':');
                if (parts.length >= 3) {
                  const file = parts[0];
                  const content = parts.slice(2).join(':');
                  const depMatch = content.match(new RegExp(pattern));

                  if (depMatch && depMatch[1]) {
                    dependencies.push({
                      name: depMatch[1],
                      type: pattern.includes('import') ? 'import' : pattern.includes('require') ? 'require' : 'include',
                      source: file || '',
                      target: depMatch[1],
                    });
                  }
                }
              });
            } catch {
              // Continue with other patterns
            }
          }

          return {
            success: true,
            analysis: { dependencies },
            message: `Found ${dependencies.length} dependencies`,
          };

        case 'structure':
          const { stdout: lsOutput } = await exec(`find "${path}" -type f -name "${languagePattern}" | head -1000`);
          const files = lsOutput.split('\n').filter(line => line.trim());

          const { stdout: dirOutput } = await exec(`find "${path}" -type d | wc -l`);
          const directories = parseInt(dirOutput.trim());

          // Count languages by file extension
          const languages: Record<string, number> = {};
          files.forEach(file => {
            const ext = file.split('.').pop();
            if (ext) {
              languages[ext] = (languages[ext] || 0) + 1;
            }
          });

          const complexity = files.length > 1000 ? 'high' : files.length > 100 ? 'medium' : 'low';

          return {
            success: true,
            analysis: {
              structure: {
                directories,
                files: files.length,
                languages,
                complexity,
              },
            },
            message: `Analyzed project structure: ${files.length} files in ${directories} directories`,
          };

        default:
          return {
            success: false,
            analysis: {},
            message: `Unknown analysis action: ${action}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        analysis: {},
        message: `Code analysis error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Perform multiple edits across files atomically
   */
  static async performMultiEdit(context: {
    operations: Array<{
      filePath: string;
      edits: Array<{
        oldString: string;
        newString: string;
        replaceAll?: boolean;
      }>;
    }>;
    createBackup?: boolean;
    projectPath?: string;
  }) {
    const results: Array<{
      filePath: string;
      editsApplied: number;
      errors: string[];
      backup?: string;
    }> = [];

    try {
      const { resolve, isAbsolute } = await import('path');
      const { projectPath } = context;

      for (const operation of context.operations) {
        // Resolve path relative to project directory if it's not absolute
        const resolvedPath = isAbsolute(operation.filePath)
          ? operation.filePath
          : resolve(projectPath || process.cwd(), operation.filePath);

        const result = {
          filePath: resolvedPath,
          editsApplied: 0,
          errors: [] as string[],
          backup: undefined as string | undefined,
        };

        try {
          // Read file content
          const { readFile, writeFile } = await import('fs/promises');
          const originalContent = await readFile(resolvedPath, 'utf-8');

          // Create backup if requested
          if (context.createBackup) {
            const backupPath = `${resolvedPath}.backup.${Date.now()}`;
            await writeFile(backupPath, originalContent);
            result.backup = backupPath;
          }

          let modifiedContent = originalContent;

          // Apply edits sequentially
          for (const edit of operation.edits) {
            if (edit.replaceAll) {
              const regex = new RegExp(edit.oldString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
              const matches = modifiedContent.match(regex);
              if (matches) {
                modifiedContent = modifiedContent.replace(regex, edit.newString);
                result.editsApplied += matches.length;
              }
            } else {
              if (modifiedContent.includes(edit.oldString)) {
                modifiedContent = modifiedContent.replace(edit.oldString, edit.newString);
                result.editsApplied++;
              } else {
                result.errors.push(`String not found: "${edit.oldString.substring(0, 50)}..."`);
              }
            }
          }

          // Write modified content
          if (result.editsApplied > 0) {
            await writeFile(resolvedPath, modifiedContent);
          }
        } catch (error) {
          result.errors.push(error instanceof Error ? error.message : String(error));
        }

        results.push(result);
      }

      const totalEdits = results.reduce((sum, r) => sum + r.editsApplied, 0);
      const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

      return {
        success: totalErrors === 0,
        results,
        message: `Applied ${totalEdits} edits across ${results.length} files${totalErrors > 0 ? ` with ${totalErrors} errors` : ''}`,
      };
    } catch (error) {
      return {
        success: false,
        results,
        message: `Multi-edit operation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Ask user for clarification
   */
  static async askClarification(context: {
    question: string;
    options?: Array<{ id: string; description: string; implications?: string }>;
    context?: string;
    urgency?: 'low' | 'medium' | 'high';
  }) {
    const questionId = `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store question for potential follow-up (in real implementation, this might be stored in session state)
    if (!AgentBuilderDefaults.pendingQuestions) {
      AgentBuilderDefaults.pendingQuestions = new Map();
    }

    AgentBuilderDefaults.pendingQuestions.set(questionId, {
      ...context,
      timestamp: new Date().toISOString(),
    });

    return {
      questionId,
      question: context.question,
      options: context.options?.map(opt => ({ id: opt.id, description: opt.description })),
      awaitingResponse: true,
    };
  }

  /**
   * Signal task completion
   */
  static async signalCompletion(context: {
    summary: string;
    changes: Array<{
      type: 'file_created' | 'file_modified' | 'file_deleted' | 'command_executed' | 'dependency_added';
      description: string;
      path?: string;
    }>;
    validation: {
      testsRun?: boolean;
      buildsSuccessfully?: boolean;
      manualTestingRequired?: boolean;
    };
    nextSteps?: string[];
  }) {
    const completionId = `completion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Calculate confidence based on validation status
    let confidence = 70; // Base confidence
    if (context.validation.testsRun) confidence += 15;
    if (context.validation.buildsSuccessfully) confidence += 15;
    if (context.validation.manualTestingRequired) confidence -= 10;

    // Determine status
    let status: 'completed' | 'needs_review' | 'needs_testing';
    if (context.validation.testsRun && context.validation.buildsSuccessfully) {
      status = 'completed';
    } else if (context.validation.manualTestingRequired) {
      status = 'needs_testing';
    } else {
      status = 'needs_review';
    }

    return {
      completionId,
      status,
      summary: context.summary,
      confidence: Math.min(100, Math.max(0, confidence)),
    };
  }

  /**
   * Perform intelligent search with context
   */
  static async performSmartSearch(context: {
    query: string;
    type?: 'text' | 'regex' | 'fuzzy' | 'semantic';
    scope?: {
      paths?: string[];
      fileTypes?: string[];
      excludePaths?: string[];
      maxResults?: number;
    };
    context?: {
      beforeLines?: number;
      afterLines?: number;
      includeDefinitions?: boolean;
    };
  }) {
    try {
      const { query, type = 'text', scope = {}, context: searchContext = {} } = context;

      const { paths = ['.'], fileTypes = [], excludePaths = [], maxResults = 50 } = scope;

      const { beforeLines = 2, afterLines = 2 } = searchContext;

      let rgCommand = 'rg';

      // Add context lines
      if (beforeLines > 0 || afterLines > 0) {
        rgCommand += ` -A ${afterLines} -B ${beforeLines}`;
      }

      // Add line numbers
      rgCommand += ' -n';

      // Handle search type
      if (type === 'regex') {
        rgCommand += ' -e';
      } else if (type === 'fuzzy') {
        rgCommand += ' --fixed-strings';
      }

      // Add file type filters
      if (fileTypes.length > 0) {
        fileTypes.forEach(ft => {
          rgCommand += ` --type-add 'custom:*.${ft}' -t custom`;
        });
      }

      // Add exclude patterns
      excludePaths.forEach(path => {
        rgCommand += ` --glob '!${path}'`;
      });

      // Add max count
      rgCommand += ` -m ${maxResults}`;

      // Add search paths
      rgCommand += ` "${query}" ${paths.join(' ')}`;

      const { stdout } = await exec(rgCommand);
      const lines = stdout.split('\n').filter(line => line.trim());

      const matches: Array<{
        file: string;
        line: number;
        column?: number;
        match: string;
        context: { before: string[]; after: string[] };
        relevance?: number;
      }> = [];

      let currentMatch: any = null;

      lines.forEach(line => {
        if (line.includes(':') && !line.startsWith('-')) {
          // This is a match line
          const parts = line.split(':');
          if (parts.length >= 3) {
            // Save previous match if exists
            if (currentMatch) {
              matches.push(currentMatch);
            }

            currentMatch = {
              file: parts[0] || '',
              line: parseInt(parts[1] || '0'),
              match: parts.slice(2).join(':'),
              context: { before: [], after: [] },
              relevance: type === 'fuzzy' ? Math.random() * 100 : undefined,
            };
          }
        } else if (line.startsWith('-') && currentMatch) {
          // This is a context line
          const contextLine = line.substring(1);
          if (currentMatch.context.before.length < beforeLines) {
            currentMatch.context.before.push(contextLine);
          } else {
            currentMatch.context.after.push(contextLine);
          }
        }
      });

      // Add the last match
      if (currentMatch) {
        matches.push(currentMatch);
      }

      // Count files searched (approximate)
      const filesSearched = new Set(matches.map(m => m.file)).size;

      return {
        success: true,
        matches: matches.slice(0, maxResults),
        summary: {
          totalMatches: matches.length,
          filesSearched,
          patterns: [query],
        },
      };
    } catch (error) {
      return {
        success: false,
        matches: [],
        summary: {
          totalMatches: 0,
          filesSearched: 0,
          patterns: [context.query],
        },
      };
    }
  }

  // Static storage properties
  private static taskStorage: Map<string, any[]>;
  private static pendingQuestions: Map<string, any>;

  /**
   * Read file contents with optional line range
   */
  static async readFile(context: {
    filePath: string;
    startLine?: number;
    endLine?: number;
    encoding?: string;
    projectPath?: string;
  }) {
    try {
      const { readFile } = await import('fs/promises');
      const { stat } = await import('fs/promises');
      const { resolve, isAbsolute } = await import('path');
      const { filePath, startLine, endLine, encoding = 'utf-8', projectPath } = context;

      // Resolve path relative to project directory if it's not absolute
      const resolvedPath = isAbsolute(filePath) ? filePath : resolve(projectPath || process.cwd(), filePath);

      const stats = await stat(resolvedPath);
      const content = await readFile(resolvedPath, { encoding: encoding as BufferEncoding });
      const lines = content.split('\n');

      let resultContent = content;
      let resultLines = lines;

      if (startLine !== undefined || endLine !== undefined) {
        const start = Math.max(0, (startLine || 1) - 1);
        const end = endLine !== undefined ? Math.min(lines.length, endLine) : lines.length;
        resultLines = lines.slice(start, end);
        resultContent = resultLines.join('\n');
      }

      return {
        success: true,
        content: resultContent,
        lines: resultLines,
        metadata: {
          size: stats.size,
          totalLines: lines.length,
          encoding,
          lastModified: stats.mtime.toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Write content to file with directory creation and backup options
   */
  static async writeFile(context: {
    filePath: string;
    content: string;
    createDirs?: boolean;
    backup?: boolean;
    encoding?: string;
    projectPath?: string;
  }) {
    try {
      const { writeFile, mkdir, copyFile } = await import('fs/promises');
      const { dirname, resolve, isAbsolute } = await import('path');
      const { filePath, content, createDirs = true, backup = false, encoding = 'utf-8', projectPath } = context;

      // Resolve path relative to project directory if it's not absolute
      const resolvedPath = isAbsolute(filePath) ? filePath : resolve(projectPath || process.cwd(), filePath);
      const dir = dirname(resolvedPath);

      // Create directories if needed
      if (createDirs) {
        await mkdir(dir, { recursive: true });
      }

      let backupPath: string | undefined;

      // Create backup if requested
      if (backup) {
        try {
          backupPath = `${resolvedPath}.backup.${Date.now()}`;
          await copyFile(resolvedPath, backupPath);
        } catch {
          // File might not exist, which is fine
        }
      }

      // Write the file
      await writeFile(resolvedPath, content, { encoding: encoding as BufferEncoding });

      return {
        success: true,
        filePath: resolvedPath,
        backup: backupPath,
        bytesWritten: Buffer.byteLength(content, encoding as BufferEncoding),
        message: `Successfully wrote ${Buffer.byteLength(content, encoding as BufferEncoding)} bytes to ${filePath}`,
      };
    } catch (error) {
      return {
        success: false,
        filePath: context.filePath,
        message: `Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * List directory contents with filtering and metadata
   */
  static async listDirectory(context: {
    path: string;
    recursive?: boolean;
    includeHidden?: boolean;
    pattern?: string;
    maxDepth?: number;
    includeMetadata?: boolean;
    projectPath?: string;
  }) {
    try {
      const { readdir, stat } = await import('fs/promises');
      const { join, relative, resolve, isAbsolute } = await import('path');

      const {
        path,
        recursive = false,
        includeHidden = false,
        pattern,
        maxDepth = 10,
        includeMetadata = true,
        projectPath,
      } = context;

      // Resolve path relative to project directory if it's not absolute
      const resolvedPath = isAbsolute(path) ? path : resolve(projectPath || process.cwd(), path);

      const items: Array<{
        name: string;
        path: string;
        type: 'file' | 'directory' | 'symlink';
        size?: number;
        lastModified?: string;
        permissions?: string;
      }> = [];

      async function processDirectory(dirPath: string, currentDepth: number = 0) {
        if (currentDepth > maxDepth) return;

        const entries = await readdir(dirPath);

        for (const entry of entries) {
          if (!includeHidden && entry.startsWith('.')) continue;

          const fullPath = join(dirPath, entry);
          const relativePath = relative(resolvedPath, fullPath);

          if (pattern) {
            // Simple pattern matching
            const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
            if (!new RegExp(regexPattern).test(entry)) continue;
          }

          let stats;
          let type: 'file' | 'directory' | 'symlink';

          try {
            stats = await stat(fullPath);
            if (stats.isDirectory()) {
              type = 'directory';
            } else if (stats.isSymbolicLink()) {
              type = 'symlink';
            } else {
              type = 'file';
            }
          } catch {
            continue; // Skip entries we can't stat
          }

          const item: any = {
            name: entry,
            path: relativePath || entry,
            type,
          };

          if (includeMetadata) {
            item.size = stats.size;
            item.lastModified = stats.mtime.toISOString();
            item.permissions = `0${(stats.mode & parseInt('777', 8)).toString(8)}`;
          }

          items.push(item);

          // Recurse into directories if requested
          if (recursive && type === 'directory') {
            await processDirectory(fullPath, currentDepth + 1);
          }
        }
      }

      await processDirectory(resolvedPath);

      return {
        success: true,
        items,
        totalItems: items.length,
        path: resolvedPath,
        message: `Listed ${items.length} items in ${resolvedPath}`,
      };
    } catch (error) {
      return {
        success: false,
        items: [],
        totalItems: 0,
        path: context.path,
        message: `Failed to list directory: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute shell commands with proper error handling
   */
  static async executeCommand(context: {
    command: string;
    workingDirectory?: string;
    timeout?: number;
    captureOutput?: boolean;
    shell?: string;
    env?: Record<string, string>;
  }) {
    try {
      const { command, workingDirectory, timeout = 30000, captureOutput = true, shell, env } = context;

      const startTime = Date.now();
      const execOptions: any = {
        timeout,
        env: { ...process.env, ...env },
      };

      if (workingDirectory) {
        execOptions.cwd = workingDirectory;
      }

      if (shell) {
        execOptions.shell = shell;
      }

      const { stdout, stderr } = await exec(command, execOptions);
      const executionTime = Date.now() - startTime;

      return {
        success: true,
        exitCode: 0,
        stdout: captureOutput ? String(stdout) : undefined,
        stderr: captureOutput ? String(stderr) : undefined,
        command,
        workingDirectory,
        executionTime,
      };
    } catch (error: any) {
      const executionTime = Date.now() - Date.now();

      return {
        success: false,
        exitCode: error.code || 1,
        stdout: String(error.stdout || ''),
        stderr: String(error.stderr || ''),
        command: context.command,
        workingDirectory: context.workingDirectory,
        executionTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Web search using a simple search approach
   */
  static async webSearch(context: {
    query: string;
    maxResults?: number;
    region?: string;
    language?: string;
    includeImages?: boolean;
    dateRange?: 'day' | 'week' | 'month' | 'year' | 'all';
  }) {
    try {
      const {
        query,
        maxResults = 10,
        region = 'us',
        language = 'en',
        includeImages = false,
        dateRange = 'all',
      } = context;

      const startTime = Date.now();

      // For now, implement a basic search using DuckDuckGo's instant answer API
      // In a real implementation, you'd want to use a proper search API
      const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&skip_disambig=1`;

      const response = await fetch(searchUrl);
      const data: any = await response.json();

      const results: Array<{
        title: string;
        url: string;
        snippet: string;
        domain: string;
        publishDate?: string;
        relevanceScore?: number;
      }> = [];

      // Parse DuckDuckGo results
      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics.slice(0, maxResults)) {
          if (topic.FirstURL && topic.Text) {
            const url = new URL(topic.FirstURL);
            results.push({
              title: topic.Text.split(' - ')[0] || topic.Text.substring(0, 60),
              url: topic.FirstURL,
              snippet: topic.Text,
              domain: url.hostname,
              relevanceScore: Math.random() * 100, // Placeholder scoring
            });
          }
        }
      }

      // Add abstract as first result if available
      if (data.Abstract && data.AbstractURL) {
        const url = new URL(data.AbstractURL);
        results.unshift({
          title: data.Heading || 'Main Result',
          url: data.AbstractURL,
          snippet: data.Abstract,
          domain: url.hostname,
          relevanceScore: 100,
        });
      }

      const searchTime = Date.now() - startTime;

      return {
        success: true,
        query,
        results: results.slice(0, maxResults),
        totalResults: results.length,
        searchTime,
        suggestions:
          data.RelatedTopics?.slice(maxResults, maxResults + 3)
            ?.map((t: any) => t.Text?.split(' - ')[0] || t.Text?.substring(0, 30))
            .filter(Boolean) || [],
      };
    } catch (error) {
      return {
        success: false,
        query: context.query,
        results: [],
        totalResults: 0,
        searchTime: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

// =============================================================================
// Template Merge Workflow Implementation
// =============================================================================
//
// This workflow implements a comprehensive template merging system that:
// 1. Clones template repositories at specific refs (tags/commits)
// 2. Discovers units (agents, workflows, MCP servers/tools) in templates
// 3. Topologically orders units based on dependencies
// 4. Analyzes conflicts and creates safety classifications
// 5. Applies changes with git branching and checkpoints per unit
//
// The workflow follows the "auto-decide vs ask" principles:
// - Auto: adding new files, missing deps, appending arrays, new scripts with template:slug:* namespace
// - Prompt: overwriting files, major upgrades, renaming conflicts, new ports, postInstall commands
// - Block: removing files, downgrading deps, changing TS target/module, modifying CI/CD secrets
//
// Usage with Mastra templates (see https://mastra.ai/api/templates.json):
//   const run = await mergeTemplateWorkflow.createRunAsync();
//   const result = await run.start({
//     inputData: {
//       repo: 'https://github.com/mastra-ai/template-pdf-questions',
//       ref: 'main', // optional
//       targetPath: './my-project', // optional, defaults to cwd
//     }
//   });
//   // The workflow will automatically analyze and merge the template structure
//
// =============================================================================

// Utility functions to work with Mastra templates
export async function fetchMastraTemplates(): Promise<
  Array<{
    slug: string;
    title: string;
    description: string;
    githubUrl: string;
    tags: string[];
    agents: string[];
    workflows: string[];
    tools: string[];
  }>
> {
  try {
    const response = await fetch('https://mastra.ai/api/templates.json');
    const data = (await response.json()) as Array<{
      slug: string;
      title: string;
      description: string;
      githubUrl: string;
      tags: string[];
      agents: string[];
      workflows: string[];
      tools: string[];
    }>;
    return data;
  } catch (error) {
    throw new Error(`Failed to fetch Mastra templates: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper to get a specific template by slug
export async function getMastraTemplate(slug: string) {
  const templates = await fetchMastraTemplates();
  const template = templates.find(t => t.slug === slug);
  if (!template) {
    throw new Error(`Template "${slug}" not found. Available templates: ${templates.map(t => t.slug).join(', ')}`);
  }
  return template;
}

// Helper to merge a template by slug
export async function mergeTemplateBySlug(slug: string, targetPath?: string) {
  const template = await getMastraTemplate(slug);
  const run = await mergeTemplateWorkflow.createRunAsync();
  return await run.start({
    inputData: {
      repo: template.githubUrl,
      slug: template.slug,
      targetPath,
    },
  });
}

// Types for the merge template workflow
export interface TemplateUnit {
  kind: 'agent' | 'workflow' | 'tool' | 'mcp-server' | 'integration';
  id: string;
}

export interface TemplateManifest {
  slug: string;
  ref?: string;
  description?: string;
  units: TemplateUnit[];
}

export interface MergePlan {
  slug: string;
  commitSha: string;
  templateDir: string;
  units: TemplateUnit[];
}

// Schema definitions
const TemplateUnitSchema = z.object({
  kind: z.enum(['agent', 'workflow', 'tool', 'mcp-server', 'integration']),
  id: z.string(),
});

const TemplateManifestSchema = z.object({
  slug: z.string(),
  ref: z.string().optional(),
  description: z.string().optional(),
  units: z.array(TemplateUnitSchema),
});

const MergeInputSchema = z.object({
  repo: z.string().describe('Git URL or local path of the template repo'),
  ref: z.string().optional().describe('Tag/branch/commit to checkout (defaults to main/master)'),
  slug: z.string().optional().describe('Slug for branch/scripts; defaults to inferred from repo'),
  targetPath: z.string().optional().describe('Project path to merge into; defaults to current directory'),
});

const MergePlanSchema = z.object({
  slug: z.string(),
  commitSha: z.string(),
  templateDir: z.string(),
  units: z.array(TemplateUnitSchema),
});

const ApplyResultSchema = z.object({
  success: z.boolean(),
  applied: z.boolean(),
  branchName: z.string().optional(),
  error: z.string().optional(),
});

// Utility functions
function kindWeight(kind: string): number {
  const order = ['mcp-server', 'mcp-tool', 'tool', 'workflow', 'agent', 'integration'];
  const idx = order.indexOf(kind);
  return idx === -1 ? order.length : idx;
}

function resolveVersionRange(
  projectRange: string | undefined,
  templateRange: string,
): string | { conflict: string; project: string; template: string } {
  if (!projectRange) return templateRange;

  try {
    const intersection = semver.intersects(projectRange, templateRange, { includePrerelease: true });
    if (intersection) {
      // Find the highest version that satisfies both ranges
      const maxProject = semver.maxSatisfying(['1.0.0'], projectRange); // This is simplified
      const maxTemplate = semver.maxSatisfying(['1.0.0'], templateRange);
      return templateRange; // Prefer template range for now
    }
    return { conflict: 'version mismatch', project: projectRange, template: templateRange };
  } catch {
    return templateRange; // Fallback to template range
  }
}

async function safeReadJson(filePath: string): Promise<Record<string, any> | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function writeJson(filePath: string, value: Record<string, any>): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2) + '\n', 'utf-8');
}

async function expandGlobPattern(baseDir: string, pattern: string): Promise<string[]> {
  const fullPath = join(baseDir, pattern);

  // Simple glob expansion - in practice, you'd use a proper glob library
  if (pattern.includes('**')) {
    const prefix = pattern.split('**')[0] || '';
    const prefixPath = join(baseDir, prefix);
    try {
      const results: string[] = [];
      const walkDir = async (dir: string): Promise<void> => {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          const relativePath = relative(baseDir, fullPath);
          if (entry.isDirectory()) {
            await walkDir(fullPath);
          } else if (relativePath.startsWith(prefix)) {
            results.push(relativePath);
          }
        }
      };
      await walkDir(prefixPath);
      return results;
    } catch {
      return [];
    }
  } else {
    // Exact file match
    try {
      await stat(fullPath);
      return [pattern];
    } catch {
      return [];
    }
  }
}

// Step 1: Clone template to temp directory
const cloneTemplateStep = createStep({
  id: 'clone-template',
  description: 'Clone the template repository to a temporary directory at the specified ref',
  inputSchema: MergeInputSchema,
  outputSchema: z.object({
    templateDir: z.string(),
    commitSha: z.string(),
    slug: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { repo, ref = 'main', slug } = inputData;

    if (!repo) {
      throw new Error('Repository URL or path is required');
    }

    // Extract slug from repo URL if not provided
    const inferredSlug =
      slug ||
      repo
        .split('/')
        .pop()
        ?.replace(/\.git$/, '') ||
      'template';

    // Create temporary directory
    const tempDir = await mkdtemp(join(tmpdir(), 'mastra-template-'));

    try {
      // Clone repository
      const cloneCmd = `git clone "${repo}" "${tempDir}"`;
      await exec(cloneCmd);

      // Checkout specific ref if provided
      if (ref !== 'main' && ref !== 'master') {
        await exec(`git checkout "${ref}"`, { cwd: tempDir });
      }

      // Get commit SHA
      const { stdout: commitSha } = await exec('git rev-parse HEAD', { cwd: tempDir });

      return {
        templateDir: tempDir,
        commitSha: commitSha.trim(),
        slug: inferredSlug,
      };
    } catch (error) {
      // Cleanup on error
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch {}
      throw new Error(`Failed to clone template: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});

// Step 2: Get template info from API
const discoverUnitsStep = createStep({
  id: 'discover-units',
  description: 'Fetch template information from Mastra templates API',
  inputSchema: z.object({
    templateDir: z.string(),
    commitSha: z.string(),
    slug: z.string(),
  }),
  outputSchema: z.object({
    manifest: TemplateManifestSchema,
    units: z.array(TemplateUnitSchema),
  }),
  execute: async ({ inputData }) => {
    const { slug } = inputData;

    // Fetch template info from API
    const response = await fetch('https://mastra.ai/api/templates.json');
    const templates = (await response.json()) as Array<{
      slug: string;
      title: string;
      description: string;
      agents: string[];
      workflows: string[];
      tools: string[];
      mcp: string[];
    }>;

    const template = templates.find(t => t.slug === slug);
    if (!template) {
      throw new Error(`Template "${slug}" not found in Mastra templates API`);
    }

    const units: TemplateUnit[] = [];

    // Add agents
    template.agents.forEach(agentId => {
      units.push({ kind: 'agent', id: agentId });
    });

    // Add workflows
    template.workflows.forEach(workflowId => {
      units.push({ kind: 'workflow', id: workflowId });
    });

    // Add tools
    template.tools.forEach(toolId => {
      units.push({ kind: 'tool', id: toolId });
    });

    // Add MCP servers
    template.mcp.forEach(mcpId => {
      units.push({ kind: 'mcp-server', id: mcpId });
    });

    // Add integration unit for general template files
    units.push({ kind: 'integration', id: 'general' });

    const manifest: TemplateManifest = {
      slug,
      description: template.description,
      units,
    };

    return { manifest, units };
  },
});

// Step 3: Topological ordering (simplified)
const orderUnitsStep = createStep({
  id: 'order-units',
  description: 'Sort units in topological order based on kind weights',
  inputSchema: z.object({
    manifest: TemplateManifestSchema,
    units: z.array(TemplateUnitSchema),
  }),
  outputSchema: z.object({
    orderedUnits: z.array(TemplateUnitSchema),
  }),
  execute: async ({ inputData }) => {
    const { units } = inputData;

    // Simple sort by kind weight (mcp-servers first, then tools, agents, workflows, integration last)
    const orderedUnits = [...units].sort((a, b) => {
      const aWeight = kindWeight(a.kind);
      const bWeight = kindWeight(b.kind);
      return aWeight - bWeight;
    });

    return { orderedUnits };
  },
});

// Step 4: Intelligent merging with AgentBuilder
const intelligentMergeStep = createStep({
  id: 'intelligent-merge',
  description: 'Use AgentBuilder to intelligently merge template files',
  inputSchema: z.object({
    orderedUnits: z.array(TemplateUnitSchema),
    templateDir: z.string(),
    commitSha: z.string(),
    slug: z.string(),
    targetPath: z.string().optional(),
  }),
  outputSchema: ApplyResultSchema,
  execute: async ({ inputData }) => {
    const { orderedUnits, templateDir, commitSha, slug } = inputData;
    const targetPath = inputData.targetPath || process.cwd();

    try {
      // Initialize AgentBuilder for the merging process
      const agentBuilder = new AgentBuilder({
        projectPath: targetPath,
        model: openai('gpt-4o-mini'),
        instructions: `
You are an expert at merging Mastra template repositories into existing projects. Your task is to intelligently integrate template code from the official Mastra templates (https://mastra.ai/api/templates.json).

DO NOT DO ANY EDITS OUTSIDE OF MERGING THE FILES FROM THE TEMPLATE TO THE TARGET PROJECT.

IF THE FILE FOR THE RESOURCE DOES NOT EXIST IN THE TARGET PROJECT, YOU CAN JUST COPY THE EXACT FILE FROM THE TEMPLATE TO THE TARGET PROJECT.

CRITICAL: When committing changes, NEVER add other dependency/build directories. Only add the actual template source files you create/modify. Use specific file paths with 'git add' instead of 'git add .' to avoid accidentally committing dependencies.

Key responsibilities:
1. Analyze the template files and existing project structure
2. Intelligently resolve conflicts by merging code when possible
3. Update configuration files (package.json, tsconfig.json) appropriately
4. Ensure all imports and dependencies are correctly handled
5. Integrate Mastra agents, workflows, tools, and MCP servers properly
6. Update the main Mastra instance file to register new components

For Mastra-specific merging:
- Merge agents into src/mastra/agents/ and register in main Mastra config
- Merge workflows into src/mastra/workflows/ and register appropriately  
- Merge tools into src/mastra/tools/ and register in tools config
- Handle MCP servers and any integrations properly
- Update package.json dependencies from template requirements
- Maintain TypeScript imports and exports correctly

Template information from Mastra API:
- Slug: ${slug}
- Units to integrate: ${orderedUnits.map(u => `${u.kind}:${u.id}`).join(', ')}
- Template source: ${templateDir}

For conflicts, prefer additive merging and maintain existing project patterns.
`,
      });

      const branchName = `feat/install-template-${slug}`;

      // Create branch
      await exec(`git checkout -b "${branchName}"`, { cwd: targetPath });

      // Process each unit with the agent
      for (const unit of orderedUnits) {
        const mergePrompt = `
Merge the following ${unit.kind} unit "${unit.id}" from template "${slug}":

Template directory: ${templateDir}
Target directory: ${targetPath}

Task: Copy and integrate the ${unit.kind} "${unit.id}" from the template source into the target project.

For ${unit.kind} units:
1. Find the appropriate files in the template (e.g., src/mastra/agents/${unit.id}.ts for agents)
2. Copy to the correct location in target project 
3. Update any import paths or references as needed
4. Ensure the merged code follows TypeScript best practices
5. Update the main Mastra configuration to register this ${unit.kind}

After merging all files for this unit, commit the changes with message:
"feat(template): add ${unit.kind} ${unit.id} (${slug}@${commitSha.substring(0, 7)})"
`;

        // Use the agent to handle the merging
        const result = await agentBuilder.stream(mergePrompt);

        // let buffer = []

        for await (const chunk of result.fullStream) {
          if (chunk.type === 'text-delta' || chunk.type === 'reasoning' || chunk.type === 'tool-result') {
            // buffer.push(chunk.textDelta);
            console.log(chunk);
            // if (buffer.length > 20) {
            //   console.log(buffer.join(''));
            //   buffer = [];
          }
        }

        // console.log(buffer.join(''));

        // The agent should have handled all the file operations through its tools
        // Let's verify the changes were applied with selective git add
        // try {
        //   // Only add src/ directory and package.json, avoid node_modules
        //   await exec(`git add src/ package.json || true`, { cwd: targetPath });
        //   await exec(`git commit -m "feat(template): add ${unit.kind} ${unit.id} (${slug}@${commitSha.substring(0, 7)})" || true`, { cwd: targetPath });
        // } catch (commitError) {
        //   // Continue if commit fails (might be no changes)
        //   console.warn(`Commit failed for unit ${unit.id}:`, commitError);
        // }
      }

      // Handle package.json merging with agent intelligence
      //       const packageMergePrompt = `
      // Analyze the template package.json at ${templateDir}/package.json and merge any necessary dependencies into the target project's package.json at ${targetPath}/package.json.

      // Rules for merging:
      // 1. For dependencies: Use semver to resolve conflicts, prefer compatible ranges
      // 2. For scripts: Add new scripts with template:${slug}: prefix, don't overwrite existing ones
      // 3. Maintain existing package.json structure and formatting
      // 4. Only add dependencies that are actually needed by the template code

      // After updating package.json, commit with message: "feat(template): update package.json for ${slug}"
      // `;

      // await agentBuilder.generate(packageMergePrompt);

      // // Commit package.json changes
      // try {
      //   await exec(`git add package.json || true`, { cwd: targetPath });
      //   await exec(`git commit -m "feat(template): update package.json for ${slug}" || true`, { cwd: targetPath });
      // } catch {
      //   // Continue if commit fails
      // }

      // Install dependencies
      //       const installPrompt = `
      // Install the new dependencies that were added to package.json. Use the appropriate package manager (detect from lockfiles).
      // Run the installation command and handle any peer dependency warnings or conflicts intelligently.
      // `;

      //       await agentBuilder.generate(installPrompt);

      //       // Check for any additional setup commands in template
      //       const setupPrompt = `
      // Check the template directory ${templateDir} for any README.md or setup instructions.
      // If there are any additional setup steps mentioned (like environment variables, database setup, etc.),
      // provide clear instructions to the user about what needs to be done manually.
      // `;

      //       await agentBuilder.generate(setupPrompt);

      return {
        success: true,
        applied: true,
        branchName,
      };
    } catch (error) {
      return {
        success: false,
        applied: false,
        error: `Failed to merge template: ${error instanceof Error ? error.message : String(error)}`,
      };
    } finally {
      // Cleanup temp directory
      try {
        await rm(templateDir, { recursive: true, force: true });
      } catch {}
    }
  },
});

// Create the complete workflow
export const mergeTemplateWorkflow = createWorkflow({
  id: 'merge-template',
  description:
    'Merges a Mastra template repository into the current project using intelligent AgentBuilder-powered merging',
  inputSchema: MergeInputSchema,
  outputSchema: ApplyResultSchema,
  steps: [cloneTemplateStep, discoverUnitsStep, orderUnitsStep, intelligentMergeStep],
})
  .then(cloneTemplateStep)
  .then(discoverUnitsStep)
  .then(orderUnitsStep)
  .map(async ({ getStepResult, getInitData }) => {
    const cloneResult = getStepResult(cloneTemplateStep);
    const discoverResult = getStepResult(discoverUnitsStep);
    const orderResult = getStepResult(orderUnitsStep);
    const initData = getInitData();

    return {
      orderedUnits: orderResult.orderedUnits,
      templateDir: cloneResult.templateDir,
      commitSha: cloneResult.commitSha,
      slug: cloneResult.slug || discoverResult.manifest.slug,
      targetPath: initData.targetPath,
    };
  })
  .then(intelligentMergeStep)
  .commit();

export class AgentBuilder extends Agent {
  private builderConfig: AgentBuilderConfig;

  /**
   * Private constructor - use AgentBuilder.create() instead
   */
  constructor(config: AgentBuilderConfig) {
    const combinedInstructions =
      AgentBuilderDefaults.DEFAULT_INSTRUCTIONS(config.projectPath) +
      (config.instructions
        ? `

## Additional Instructions
${config.instructions}`
        : '');

    const agentConfig = {
      name: 'agent-builder',
      description:
        'An AI agent specialized in generating Mastra agents, tools, and workflows from natural language requirements.',
      instructions: combinedInstructions,
      model: config.model,
      tools: async () => {
        return { ...(await AgentBuilderDefaults.DEFAULT_TOOLS(config.projectPath)), ...(config.tools || {}) };
      },
      workflows: {
        'merge-template': mergeTemplateWorkflow,
      },
      memory: new Memory({
        options: AgentBuilderDefaults.DEFAULT_MEMORY_CONFIG,
        processors: [
          new WriteToDiskProcessor({ prefix: 'before-filter' }),
          new ToolSummaryProcessor({ summaryModel: config.summaryModel || config.model }),
          new TokenLimiter(100000),
          new WriteToDiskProcessor({ prefix: 'after-filter' }),
        ],
      }),
    };

    super(agentConfig);
    this.builderConfig = config;
  }

  /**
   * Enhanced generate method with AgentBuilder-specific configuration
   * Overrides the base Agent generate method to provide additional project context
   */
  generate: Agent['generate'] = async (
    messages: string | string[] | CoreMessage[] | AiMessageType[],
    generateOptions: (GenerateAgentOptions & AgentGenerateOptions<any, any>) | undefined = {},
  ): Promise<any> => {
    const { ...baseOptions } = generateOptions;

    const originalInstructions = await this.getInstructions({ runtimeContext: generateOptions?.runtimeContext });
    const additionalInstructions = baseOptions.instructions;

    let enhancedInstructions = originalInstructions as string;
    if (additionalInstructions) {
      enhancedInstructions = `${originalInstructions}\n\n${additionalInstructions}`;
    }

    const enhancedContext = [...(baseOptions.context || [])];

    const enhancedOptions = {
      ...baseOptions,
      maxSteps: 300, // Higher default for code generation
      temperature: 0.3, // Lower temperature for more consistent code generation
      instructions: enhancedInstructions,
      context: enhancedContext,
    };

    this.logger.debug(`[AgentBuilder:${this.name}] Starting generation with enhanced context`, {
      projectPath: this.builderConfig.projectPath,
    });

    return super.generate(messages, enhancedOptions);
  };

  /**
   * Enhanced stream method with AgentBuilder-specific configuration
   * Overrides the base Agent stream method to provide additional project context
   */
  stream: Agent['stream'] = async (
    messages: string | string[] | CoreMessage[] | AiMessageType[],
    streamOptions: (GenerateAgentOptions & AgentStreamOptions<any, any>) | undefined = {},
  ): Promise<any> => {
    const { ...baseOptions } = streamOptions;

    const originalInstructions = await this.getInstructions({ runtimeContext: streamOptions?.runtimeContext });
    const additionalInstructions = baseOptions.instructions;

    let enhancedInstructions = originalInstructions as string;
    if (additionalInstructions) {
      enhancedInstructions = `${originalInstructions}\n\n${additionalInstructions}`;
    }
    const enhancedContext = [...(baseOptions.context || [])];

    const enhancedOptions = {
      ...baseOptions,
      maxSteps: 100, // Higher default for code generation
      temperature: 0.3, // Lower temperature for more consistent code generation
      instructions: enhancedInstructions,
      context: enhancedContext,
    };

    this.logger.debug(`[AgentBuilder:${this.name}] Starting streaming with enhanced context`, {
      projectPath: this.builderConfig.projectPath,
    });

    return super.stream(messages, enhancedOptions);
  };

  /**
   * Generate a Mastra agent from natural language requirements
   */
  async generateAgent(
    requirements: string,
    options?: {
      outputFormat?: 'code' | 'explanation' | 'both';
      runtimeContext?: any;
    },
  ) {
    const prompt = `Generate a Mastra agent based on these requirements: ${requirements}

Please provide:
1. Complete agent code with proper configuration
2. Any custom tools the agent needs
3. Example usage
4. Testing recommendations

${options?.outputFormat === 'explanation' ? 'Focus on explaining the approach and architecture.' : ''}
${options?.outputFormat === 'code' ? 'Focus on providing complete, working code.' : ''}
${!options?.outputFormat || options.outputFormat === 'both' ? 'Provide both explanation and complete code.' : ''}`;

    return super.generate(prompt, {
      runtimeContext: options?.runtimeContext,
    });
  }

  /**
   * Get the default configuration for AgentBuilder
   */
  static defaultConfig(projectPath?: string) {
    return {
      instructions: AgentBuilderDefaults.DEFAULT_INSTRUCTIONS(projectPath),
      memoryConfig: AgentBuilderDefaults.DEFAULT_MEMORY_CONFIG,
      tools: AgentBuilderDefaults.DEFAULT_TOOLS,
    };
  }
}
