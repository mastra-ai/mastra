import { spawn as nodeSpawn } from 'child_process';
import { readFile, writeFile, mkdir, stat, readdir } from 'fs/promises';
import { join, dirname, relative, isAbsolute, resolve } from 'path';
import { createTool } from '@mastra/core/tools';
import ignore from 'ignore';
import { z } from 'zod';
import { exec, execFile, spawnSWPM, spawnWithOutput } from './utils';

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

DO NOT INCLUDE TODOS IN THE CODE, UNLESS SPECIFICALLY ASKED TO DO SO, CREATE REAL WORLD CODE

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
- **writeFile**: Write files with directory creation
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

</examples>`;

  static DEFAULT_MEMORY_CONFIG = {
    lastMessages: 20,
  };

  static DEFAULT_FOLDER_STRUCTURE = {
    agent: 'src/mastra/agents',
    workflow: 'src/mastra/workflows',
    tool: 'src/mastra/tools',
    'mcp-server': 'src/mastra/mcp',
    network: 'src/mastra/networks',
  };

  static DEFAULT_TOOLS = async (projectPath: string, mode: 'template' | 'code-editor' = 'code-editor') => {
    const agentBuilderTools = {
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
        description: 'Write content to a file, with options for creating directories.',
        inputSchema: z.object({
          filePath: z.string().describe('Path to the file to write'),
          content: z.string().describe('Content to write to the file'),
          createDirs: z.boolean().default(true).describe("Create parent directories if they don't exist"),
          encoding: z.string().default('utf-8').describe('File encoding'),
        }),
        outputSchema: z.object({
          success: z.boolean(),
          filePath: z.string(),
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
          pattern: z.string().default('*').describe('Glob pattern to filter files'),
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
                content: z.string().describe('Task description, optional if just updating the status').optional(),
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
          createBackup: z.boolean().default(false).describe('Create backup files before editing'),
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

      replaceLines: createTool({
        id: 'replace-lines',
        description:
          'Replace specific line ranges in files with new content. IMPORTANT: This tool replaces ENTIRE lines, not partial content within lines. Lines are 1-indexed.',
        inputSchema: z.object({
          filePath: z.string().describe('Path to the file to edit'),
          startLine: z
            .number()
            .describe('Starting line number to replace (1-indexed, inclusive). Count from the first line = 1'),
          endLine: z
            .number()
            .describe(
              'Ending line number to replace (1-indexed, inclusive). To replace single line, use same number as startLine',
            ),
          newContent: z
            .string()
            .describe(
              'New content to replace the lines with. Use empty string "" to delete lines completely. For multiline content, include \\n characters',
            ),
          createBackup: z.boolean().default(false).describe('Create backup file before editing'),
        }),
        outputSchema: z.object({
          success: z.boolean(),
          message: z.string(),
          linesReplaced: z.number().optional(),
          backup: z.string().optional(),
          error: z.string().optional(),
        }),
        execute: async ({ context }) => {
          return await AgentBuilderDefaults.replaceLines({ ...context, projectPath });
        },
      }),

      // File diagnostics tool to help debug line replacement issues
      showFileLines: createTool({
        id: 'show-file-lines',
        description:
          'Show specific lines from a file with line numbers. Useful for debugging before using replaceLines.',
        inputSchema: z.object({
          filePath: z.string().describe('Path to the file to examine'),
          startLine: z
            .number()
            .optional()
            .describe('Starting line number to show (1-indexed). If not provided, shows all lines'),
          endLine: z
            .number()
            .optional()
            .describe(
              'Ending line number to show (1-indexed, inclusive). If not provided but startLine is, shows only that line',
            ),
          context: z.number().default(2).describe('Number of context lines to show before and after the range'),
        }),
        outputSchema: z.object({
          success: z.boolean(),
          lines: z.array(
            z.object({
              lineNumber: z.number(),
              content: z.string(),
              isTarget: z.boolean().describe('Whether this line is in the target range'),
            }),
          ),
          totalLines: z.number(),
          message: z.string(),
          error: z.string().optional(),
        }),
        execute: async ({ context }) => {
          return await AgentBuilderDefaults.showFileLines({ ...context, projectPath });
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
          return await AgentBuilderDefaults.performSmartSearch(context, projectPath);
        },
      }),

      validateCode: createTool({
        id: 'validate-code',
        description:
          'Validates code using a fast hybrid approach: syntax → semantic → lint. RECOMMENDED: Always provide specific files for optimal performance and accuracy.',
        inputSchema: z.object({
          projectPath: z.string().optional().describe('Path to the project to validate (defaults to current project)'),
          validationType: z
            .array(z.enum(['types', 'lint', 'schemas', 'tests', 'build']))
            .describe('Types of validation to perform. Recommended: ["types", "lint"] for code quality'),
          files: z
            .array(z.string())
            .optional()
            .describe(
              'RECOMMENDED: Specific files to validate (e.g., files you created/modified). Uses hybrid validation: fast syntax check → semantic types → ESLint. Without files, falls back to slower CLI validation.',
            ),
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

          // BEST PRACTICE: Always provide files array for optimal performance
          // Hybrid approach: syntax (1ms) → semantic (100ms) → ESLint (50ms)
          // Without files: falls back to CLI validation (2000ms+)

          return await AgentBuilderDefaults.validateCode({
            projectPath: targetPath,
            validationType,
            files,
          });
        },
      }),
    };

    if (mode === 'template') {
      return agentBuilderTools;
    } else {
      return {
        ...agentBuilderTools,

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

        // Task Completion Signaling
        attemptCompletion: createTool({
          id: 'attempt-completion',
          description: 'Signal that you believe the requested task has been completed and provide a summary.',
          inputSchema: z.object({
            summary: z.string().describe('Summary of what was accomplished'),
            changes: z
              .array(
                z.object({
                  type: z.enum([
                    'file_created',
                    'file_modified',
                    'file_deleted',
                    'command_executed',
                    'dependency_added',
                  ]),
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

        manageProject: createTool({
          id: 'manage-project',
          description:
            'Handles project management including creating project structures, managing dependencies, and package operations.',
          inputSchema: z.object({
            action: z.enum(['create', 'install', 'upgrade']).describe('The action to perform'),
            features: z
              .array(z.string())
              .optional()
              .describe('Mastra features to include (e.g., ["agents", "memory", "workflows"])'),
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
            const { action, features, packages } = context;
            try {
              switch (action) {
                case 'create':
                  return await AgentBuilderDefaults.createMastraProject({
                    projectName: projectPath,
                    features,
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
                  });
                case 'upgrade':
                  if (!packages?.length) {
                    return {
                      success: false,
                      message: 'Packages array is required for upgrade action',
                    };
                  }
                  return await AgentBuilderDefaults.upgradePackages({
                    packages,
                    projectPath,
                  });
                // case 'check':
                //   return await AgentBuilderDefaults.checkProject({
                //     projectPath,
                //   });
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
    }
  };

  /**
   * Create a new Mastra project using create-mastra CLI
   */
  static async createMastraProject({ features, projectName }: { features?: string[]; projectName?: string }) {
    try {
      const args = ['pnpx', 'create-mastra@latest', projectName?.replace(/[;&|`$(){}\[\]]/g, '') ?? '', '-l', 'openai'];
      if (features && features.length > 0) {
        args.push('--components', features.join(','));
      }
      args.push('--example');

      const { stdout, stderr } = await spawnWithOutput(args[0]!, args.slice(1), {});

      return {
        success: true,
        projectPath: `./${projectName}`,
        message: `Successfully created Mastra project: ${projectName}.`,
        details: stdout,
        error: stderr,
      };
    } catch (error) {
      console.log(error);
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
  }: {
    packages: Array<{ name: string; version?: string }>;
    projectPath?: string;
  }) {
    try {
      console.log('Installing packages:', JSON.stringify(packages, null, 2));

      const packageStrings = packages.map(p => `${p.name}`);

      await spawnSWPM(projectPath || '', 'add', packageStrings);

      return {
        success: true,
        installed: packageStrings,
        message: `Successfully installed ${packages.length} package(s).`,
        details: '',
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
  }: {
    packages?: Array<{ name: string; version?: string }>;
    projectPath?: string;
  }) {
    try {
      console.log('Upgrading specific packages:', JSON.stringify(packages, null, 2));

      let packageNames: string[] = [];

      if (packages && packages.length > 0) {
        packageNames = packages.map(p => `${p.name}`);
      }
      await spawnSWPM(projectPath || '', 'upgrade', packageNames);

      return {
        success: true,
        upgraded: packages?.map(p => p.name) || ['all packages'],
        message: `Packages upgraded successfully.`,
        details: '',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to upgrade packages: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // /**
  //  * Check project health and status
  //  */
  // static async checkProject({ projectPath }: { projectPath?: string }) {
  //   try {
  //     const execOptions = projectPath ? { cwd: projectPath } : {};

  //     let hasPackageJson = false;
  //     let hasMastraConfig = false;

  //     try {
  //       await exec('test -f package.json', execOptions);
  //       hasPackageJson = true;
  //     } catch {
  //       // ignore
  //     }

  //     try {
  //       await exec('test -f mastra.config.* || test -d src/mastra || test -d mastra', execOptions);
  //       hasMastraConfig = true;
  //     } catch {
  //       // ignore
  //     }

  //     const warnings: string[] = [];
  //     if (!hasPackageJson) {
  //       warnings.push('No package.json found - this may not be a Node.js project');
  //     }
  //     if (!hasMastraConfig) {
  //       warnings.push('No Mastra configuration found - run "npx create-mastra" to initialize');
  //     }

  //     return {
  //       success: true,
  //       message: `Project health check completed for ${projectPath || 'current directory'}`,
  //       warnings,
  //       checks: {
  //         hasPackageJson,
  //         hasMastraConfig,
  //       },
  //     };
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: `Failed to check project: ${error instanceof Error ? error.message : String(error)}`,
  //     };
  //   }
  // }

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

      const serverProcess = nodeSpawn('pnpm', ['run', 'dev'], {
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
    // Validate port to ensure it is a safe integer
    if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
      return {
        success: false,
        status: 'error' as const,
        error: `Invalid port value: ${String(port)}`,
      };
    }
    try {
      // Run lsof safely without shell interpretation
      const { stdout } = await execFile('lsof', ['-ti', String(port)]);
      // If no output, treat as "No process found"
      const effectiveStdout = stdout.trim() ? stdout : 'No process found';

      if (!effectiveStdout || effectiveStdout === 'No process found') {
        return {
          success: true,
          status: 'stopped' as const,
          message: `No Mastra server found running on port ${port}`,
        };
      }

      const pids = stdout
        .trim()
        .split('\n')
        .filter((pid: string) => pid.trim());
      const killedPids: number[] = [];
      const failedPids: number[] = [];

      for (const pidStr of pids) {
        const pid = parseInt(pidStr.trim());
        if (isNaN(pid)) continue;

        try {
          process.kill(pid, 'SIGTERM');
          killedPids.push(pid);
        } catch (e) {
          failedPids.push(pid);
          console.warn(`Failed to kill process ${pid}:`, e);
        }
      }

      // If some processes failed to be killed, still report partial success
      // but include warning about failed processes

      if (killedPids.length === 0) {
        return {
          success: false,
          status: 'unknown' as const,
          message: `Failed to stop any processes on port ${port}`,
          error: `Could not kill PIDs: ${failedPids.join(', ')}`,
        };
      }

      // Report partial success if some processes were killed but others failed
      if (failedPids.length > 0) {
        console.warn(
          `Killed ${killedPids.length} processes but failed to kill ${failedPids.length} processes: ${failedPids.join(', ')}`,
        );
      }

      // Wait a bit and check if processes are still running
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        const { stdout: checkStdoutRaw } = await execFile('lsof', ['-ti', String(port)]);
        const checkStdout = checkStdoutRaw.trim() ? checkStdoutRaw : 'No process found';
        if (checkStdout && checkStdout !== 'No process found') {
          // Force kill remaining processes
          const remainingPids = checkStdout
            .trim()
            .split('\n')
            .filter((pid: string) => pid.trim());
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
          const { stdout: finalCheckRaw } = await execFile('lsof', ['-ti', String(port)]);
          const finalCheck = finalCheckRaw.trim() ? finalCheckRaw : 'No process found';
          if (finalCheck && finalCheck !== 'No process found') {
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
        const { stdout } = await execFile('lsof', ['-ti', String(port)]);
        const effectiveStdout = stdout.trim() ? stdout : 'No process found';
        const hasProcess = effectiveStdout && effectiveStdout !== 'No process found';

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

  // Cache for TypeScript program (lazily loaded)
  private static tsProgram: any | null = null;
  private static programProjectPath: string | null = null;

  /**
   * Validate code using hybrid approach: syntax -> types -> lint
   *
   * BEST PRACTICES FOR CODING AGENTS:
   *
   * ✅ RECOMMENDED (Fast & Accurate):
   * validateCode({
   *   validationType: ['types', 'lint'],
   *   files: ['src/workflows/my-workflow.ts', 'src/components/Button.tsx']
   * })
   *
   * Performance: ~150ms
   * - Syntax check (1ms) - catches 80% of issues instantly
   * - Semantic validation (100ms) - full type checking with dependencies
   * - ESLint (50ms) - style and best practices
   * - Only shows errors from YOUR files
   *
   * ❌ AVOID (Slow & Noisy):
   * validateCode({ validationType: ['types', 'lint'] }) // no files specified
   *
   * Performance: ~2000ms+
   * - Full project CLI validation
   * - Shows errors from all project files (confusing)
   * - Much slower for coding agents
   *
   * @param projectPath - Project root directory (defaults to cwd)
   * @param validationType - ['types', 'lint'] recommended for most use cases
   * @param files - ALWAYS provide this for best performance
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

    const targetProjectPath = projectPath || process.cwd();

    // If no files specified, use legacy CLI-based validation for backward compatibility
    if (!files || files.length === 0) {
      return this.validateCodeCLI({ projectPath, validationType });
    }

    // Hybrid validation approach for specific files (default behavior)
    for (const filePath of files) {
      const absolutePath = isAbsolute(filePath) ? filePath : resolve(targetProjectPath, filePath);

      try {
        const fileContent = await readFile(absolutePath, 'utf-8');
        const fileResults = await this.validateSingleFileHybrid(
          absolutePath,
          fileContent,
          targetProjectPath,
          validationType,
        );

        errors.push(...fileResults.errors);

        // Track validation results
        for (const type of validationType) {
          const hasErrors = fileResults.errors.some(e => e.type === type && e.severity === 'error');
          if (hasErrors) {
            if (!validationsFailed.includes(type)) validationsFailed.push(type);
          } else {
            if (!validationsPassed.includes(type)) validationsPassed.push(type);
          }
        }
      } catch (error) {
        errors.push({
          type: 'typescript',
          severity: 'error',
          message: `Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
          file: filePath,
        });
        validationsFailed.push('types');
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
   * CLI-based validation for when no specific files are provided
   */
  static async validateCodeCLI({
    projectPath,
    validationType,
  }: {
    projectPath?: string;
    validationType: Array<'types' | 'lint' | 'schemas' | 'tests' | 'build'>;
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

    // TypeScript validation (legacy approach)
    if (validationType.includes('types')) {
      try {
        // Use execFile for safe argument passing to avoid shell interpretation
        const args = ['tsc', '--noEmit'];
        await execFile('npx', args, execOptions);
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
        const eslintArgs = ['eslint', '--format', 'json'];
        const { stdout } = await execFile('npx', eslintArgs, execOptions);

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
   * Hybrid validation for a single file
   */
  static async validateSingleFileHybrid(
    filePath: string,
    fileContent: string,
    projectPath: string,
    validationType: Array<'types' | 'lint' | 'schemas' | 'tests' | 'build'>,
  ) {
    const errors: Array<{
      type: 'typescript' | 'eslint' | 'schema' | 'test' | 'build';
      severity: 'error' | 'warning' | 'info';
      message: string;
      file?: string;
      line?: number;
      column?: number;
      code?: string;
    }> = [];

    // Step 1: Fast syntax validation
    if (validationType.includes('types')) {
      const syntaxErrors = await this.validateSyntaxOnly(fileContent, filePath);
      errors.push(...syntaxErrors);

      // Fail fast on syntax errors
      if (syntaxErrors.length > 0) {
        return { errors };
      }

      // Step 2: TypeScript semantic validation (if syntax is clean)
      const typeErrors = await this.validateTypesSemantic(filePath, projectPath);
      errors.push(...typeErrors);
    }

    // Step 3: ESLint validation (only if no critical errors)
    if (validationType.includes('lint') && !errors.some(e => e.severity === 'error')) {
      const lintErrors = await this.validateESLintSingle(filePath, projectPath);
      errors.push(...lintErrors);
    }

    return { errors };
  }

  /**
   * Fast syntax-only validation using TypeScript parser
   */
  static async validateSyntaxOnly(fileContent: string, fileName: string) {
    const errors: Array<{
      type: 'typescript';
      severity: 'error';
      message: string;
      file?: string;
      line?: number;
      column?: number;
    }> = [];

    try {
      // Dynamically import TypeScript to avoid bundling issues
      const ts = await import('typescript');

      const sourceFile = ts.createSourceFile(fileName, fileContent, ts.ScriptTarget.Latest, true);

      // Create a minimal program to get syntax diagnostics
      const options: any = {
        allowJs: true,
        checkJs: false,
        noEmit: true,
      };

      const host: any = {
        getSourceFile: (name: string) => (name === fileName ? sourceFile : undefined),
        writeFile: () => {},
        getCurrentDirectory: () => '',
        getDirectories: () => [],
        fileExists: (name: string) => name === fileName,
        readFile: (name: string) => (name === fileName ? fileContent : undefined),
        getCanonicalFileName: (name: string) => name,
        useCaseSensitiveFileNames: () => true,
        getNewLine: () => '\n',
        getDefaultLibFileName: () => 'lib.d.ts',
      };

      const program = ts.createProgram([fileName], options, host);
      const diagnostics = program.getSyntacticDiagnostics(sourceFile);

      for (const diagnostic of diagnostics) {
        if (diagnostic.start !== undefined) {
          const position = sourceFile.getLineAndCharacterOfPosition(diagnostic.start);
          errors.push({
            type: 'typescript',
            severity: 'error',
            message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
            file: fileName,
            line: position.line + 1,
            column: position.character + 1,
          });
        }
      }
    } catch (error) {
      // If TypeScript is not available, fall back to basic validation
      console.warn('TypeScript not available for syntax validation:', error);

      // Basic syntax check - look for common syntax errors
      const lines = fileContent.split('\n');
      const commonErrors = [
        { pattern: /\bimport\s+.*\s+from\s+['""][^'"]*$/, message: 'Unterminated import statement' },
        { pattern: /\{[^}]*$/, message: 'Unclosed brace' },
        { pattern: /\([^)]*$/, message: 'Unclosed parenthesis' },
        { pattern: /\[[^\]]*$/, message: 'Unclosed bracket' },
      ];

      lines.forEach((line, index) => {
        commonErrors.forEach(({ pattern, message }) => {
          if (pattern.test(line)) {
            errors.push({
              type: 'typescript',
              severity: 'error',
              message,
              file: fileName,
              line: index + 1,
            });
          }
        });
      });
    }

    return errors;
  }

  /**
   * TypeScript semantic validation using incremental program
   */
  static async validateTypesSemantic(filePath: string, projectPath: string) {
    const errors: Array<{
      type: 'typescript';
      severity: 'error' | 'warning';
      message: string;
      file?: string;
      line?: number;
      column?: number;
    }> = [];

    try {
      // Initialize or reuse TypeScript program
      const program = await this.getOrCreateTSProgram(projectPath);
      if (!program) {
        return errors; // Fallback to no validation if program creation fails
      }

      const sourceFile = program.getSourceFile(filePath);
      if (!sourceFile) {
        return errors; // File not in program
      }

      const diagnostics = [
        ...program.getSemanticDiagnostics(sourceFile),
        ...program.getSyntacticDiagnostics(sourceFile),
      ];

      // Dynamically import TypeScript for diagnostic processing
      const ts = await import('typescript');

      for (const diagnostic of diagnostics) {
        if (diagnostic.start !== undefined) {
          const position = sourceFile.getLineAndCharacterOfPosition(diagnostic.start);
          errors.push({
            type: 'typescript',
            severity: diagnostic.category === ts.DiagnosticCategory.Warning ? 'warning' : 'error',
            message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
            file: filePath,
            line: position.line + 1,
            column: position.character + 1,
          });
        }
      }
    } catch (error) {
      // Fallback to no semantic validation on error
      console.warn(`TypeScript semantic validation failed for ${filePath}:`, error);
    }

    return errors;
  }

  /**
   * ESLint validation for a single file
   */
  static async validateESLintSingle(filePath: string, projectPath: string) {
    const errors: Array<{
      type: 'eslint';
      severity: 'error' | 'warning';
      message: string;
      file?: string;
      line?: number;
      column?: number;
      code?: string;
    }> = [];

    try {
      const { stdout } = await execFile('npx', ['eslint', filePath, '--format', 'json'], { cwd: projectPath });

      if (stdout) {
        const eslintResults = JSON.parse(stdout);
        const eslintErrors = this.parseESLintErrors(eslintResults);
        errors.push(...eslintErrors);
      }
    } catch (error: any) {
      // Try to parse error output
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('"filePath"') || errorMessage.includes('messages')) {
        try {
          const eslintResults = JSON.parse(errorMessage);
          const eslintErrors = this.parseESLintErrors(eslintResults);
          errors.push(...eslintErrors);
        } catch {
          // Ignore ESLint errors in hybrid mode for now
        }
      }
    }

    return errors;
  }

  /**
   * Get or create TypeScript program
   */
  static async getOrCreateTSProgram(projectPath: string): Promise<any | null> {
    // Return cached program if same project
    if (this.tsProgram && this.programProjectPath === projectPath) {
      return this.tsProgram;
    }

    try {
      // Dynamically import TypeScript
      const ts = await import('typescript');

      const configPath = ts.findConfigFile(projectPath, ts.sys.fileExists, 'tsconfig.json');
      if (!configPath) {
        return null; // No tsconfig found
      }

      const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
      if (configFile.error) {
        return null;
      }

      const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, projectPath);

      if (parsedConfig.errors.length > 0) {
        return null;
      }

      // Create regular program
      this.tsProgram = ts.createProgram({
        rootNames: parsedConfig.fileNames,
        options: parsedConfig.options,
      });

      this.programProjectPath = projectPath;
      return this.tsProgram;
    } catch (error) {
      console.warn('Failed to create TypeScript program:', error);
      return null;
    }
  }

  // Note: Old filterTypeScriptErrors method removed in favor of hybrid validation approach

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
      content?: string;
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

    // Cleanup old sessions to prevent memory leaks
    // Keep only the last 10 sessions
    const sessions = Array.from(AgentBuilderDefaults.taskStorage.keys());
    if (sessions.length > 10) {
      const sessionsToRemove = sessions.slice(0, sessions.length - 10);
      sessionsToRemove.forEach(session => AgentBuilderDefaults.taskStorage.delete(session));
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
      const { action, path, language, depth = 3 } = context;

      // Use ripgrep for fast searching
      // const excludePatterns = includeTests ? [] : ['*test*', '*spec*', '__tests__'];
      // Only allow a list of known extensions/language types to prevent shell injection
      const ALLOWED_LANGUAGES = [
        'js',
        'ts',
        'jsx',
        'tsx',
        'py',
        'java',
        'go',
        'cpp',
        'c',
        'cs',
        'rb',
        'php',
        'rs',
        'kt',
        'swift',
        'm',
        'scala',
        'sh',
        'json',
        'yaml',
        'yml',
        'toml',
        'ini',
      ];
      let languagePattern = '*';
      if (language && ALLOWED_LANGUAGES.includes(language)) {
        languagePattern = `*.${language}`;
      }

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
              const { stdout } = await execFile('rg', [
                '-n',
                pattern,
                path,
                '--type',
                languagePattern,
                '--max-depth',
                String(depth),
              ]);
              const matches = stdout.split('\n').filter((line: string) => line.trim());

              matches.forEach((match: string) => {
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
              const { stdout } = await execFile('rg', ['-n', pattern, path, '--type', languagePattern]);
              const matches = stdout.split('\n').filter((line: string) => line.trim());

              matches.forEach((match: string) => {
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
          // Use execFile for find commands to avoid shell injection
          const { stdout: lsOutput } = await execFile('find', [path, '-type', 'f', '-name', languagePattern]);
          const allFiles = lsOutput.split('\n').filter((line: string) => line.trim());
          const files = allFiles.slice(0, 1000); // Limit to 1000 files like head -1000

          const { stdout: dirOutput } = await execFile('find', [path, '-type', 'd']);
          const directories = dirOutput.split('\n').filter((line: string) => line.trim()).length;

          // Count languages by file extension
          const languages: Record<string, number> = {};
          files.forEach((file: string) => {
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
    const { operations, createBackup = false, projectPath = process.cwd() } = context;
    const results: Array<{
      filePath: string;
      editsApplied: number;
      errors: string[];
      backup?: string;
    }> = [];

    try {
      for (const operation of operations) {
        const filePath = isAbsolute(operation.filePath) ? operation.filePath : join(projectPath, operation.filePath);
        let editsApplied = 0;
        const errors: string[] = [];
        let backup: string | undefined;

        try {
          // Create backup if requested
          if (createBackup) {
            const backupPath = `${filePath}.backup.${Date.now()}`;
            const originalContent = await readFile(filePath, 'utf-8');
            await writeFile(backupPath, originalContent, 'utf-8');
            backup = backupPath;
          }

          // Read current file content
          let content = await readFile(filePath, 'utf-8');

          // Apply each edit
          for (const edit of operation.edits) {
            const { oldString, newString, replaceAll = false } = edit;

            if (replaceAll) {
              const regex = new RegExp(oldString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
              const matches = content.match(regex);
              if (matches) {
                content = content.replace(regex, newString);
                editsApplied += matches.length;
              }
            } else {
              if (content.includes(oldString)) {
                content = content.replace(oldString, newString);
                editsApplied++;
              } else {
                errors.push(`String not found: "${oldString.substring(0, 50)}${oldString.length > 50 ? '...' : ''}"`);
              }
            }
          }

          // Write updated content back
          await writeFile(filePath, content, 'utf-8');
        } catch (error) {
          errors.push(`File operation error: ${error instanceof Error ? error.message : String(error)}`);
        }

        results.push({
          filePath: operation.filePath,
          editsApplied,
          errors,
          backup,
        });
      }

      const totalEdits = results.reduce((sum, r) => sum + r.editsApplied, 0);
      const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

      return {
        success: totalErrors === 0,
        results,
        message: `Applied ${totalEdits} edits across ${operations.length} files${totalErrors > 0 ? ` with ${totalErrors} errors` : ''}`,
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
   * Replace specific line ranges in a file with new content
   */
  static async replaceLines(context: {
    filePath: string;
    startLine: number;
    endLine: number;
    newContent: string;
    createBackup?: boolean;
    projectPath?: string;
  }) {
    const { filePath, startLine, endLine, newContent, createBackup = false, projectPath = process.cwd() } = context;

    try {
      const fullPath = isAbsolute(filePath) ? filePath : join(projectPath, filePath);

      // Read current file content
      const content = await readFile(fullPath, 'utf-8');
      const lines = content.split('\n');

      // Validate line numbers
      if (startLine < 1 || endLine < 1) {
        return {
          success: false,
          message: `Line numbers must be 1 or greater. Got startLine: ${startLine}, endLine: ${endLine}`,
          error: 'Invalid line range',
        };
      }

      if (startLine > lines.length || endLine > lines.length) {
        return {
          success: false,
          message: `Line range ${startLine}-${endLine} is out of bounds. File has ${lines.length} lines. Remember: lines are 1-indexed, so valid range is 1-${lines.length}.`,
          error: 'Invalid line range',
        };
      }

      if (startLine > endLine) {
        return {
          success: false,
          message: `Start line (${startLine}) cannot be greater than end line (${endLine}).`,
          error: 'Invalid line range',
        };
      }

      // Create backup if requested
      let backup: string | undefined;
      if (createBackup) {
        const backupPath = `${fullPath}.backup.${Date.now()}`;
        await writeFile(backupPath, content, 'utf-8');
        backup = backupPath;
      }

      // Replace the specified line range
      const beforeLines = lines.slice(0, startLine - 1);
      const afterLines = lines.slice(endLine);
      const newLines = newContent ? newContent.split('\n') : [];

      const updatedLines = [...beforeLines, ...newLines, ...afterLines];
      const updatedContent = updatedLines.join('\n');

      // Write updated content back
      await writeFile(fullPath, updatedContent, 'utf-8');

      const linesReplaced = endLine - startLine + 1;
      const newLineCount = newLines.length;

      return {
        success: true,
        message: `Successfully replaced ${linesReplaced} lines (${startLine}-${endLine}) with ${newLineCount} new lines in ${filePath}`,
        linesReplaced,
        backup,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to replace lines: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Show file lines with line numbers for debugging
   */
  static async showFileLines(context: {
    filePath: string;
    startLine?: number;
    endLine?: number;
    context?: number;
    projectPath?: string;
  }) {
    const { filePath, startLine, endLine, context: contextLines = 2, projectPath = process.cwd() } = context;

    try {
      const fullPath = isAbsolute(filePath) ? filePath : join(projectPath, filePath);

      // Read current file content
      const content = await readFile(fullPath, 'utf-8');
      const lines = content.split('\n');

      let targetStart = startLine;
      let targetEnd = endLine;

      // If no range specified, show all lines
      if (!targetStart) {
        targetStart = 1;
        targetEnd = lines.length;
      } else if (!targetEnd) {
        targetEnd = targetStart;
      }

      // Calculate actual display range with context
      const displayStart = Math.max(1, targetStart - contextLines);
      const displayEnd = Math.min(lines.length, targetEnd + contextLines);

      const result = [];
      for (let i = displayStart; i <= displayEnd; i++) {
        const lineIndex = i - 1; // Convert to 0-based for array access
        const isTarget = i >= targetStart && i <= targetEnd;

        result.push({
          lineNumber: i,
          content: lineIndex < lines.length ? (lines[lineIndex] ?? '') : '',
          isTarget,
        });
      }

      return {
        success: true,
        lines: result,
        totalLines: lines.length,
        message: `Showing lines ${displayStart}-${displayEnd} of ${lines.length} total lines in ${filePath}`,
      };
    } catch (error) {
      return {
        success: false,
        lines: [],
        totalLines: 0,
        message: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error.message : String(error),
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
  static async performSmartSearch(
    context: {
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
    },
    projectPath: string,
  ) {
    try {
      const { query, type = 'text', scope = {}, context: searchContext = {} } = context;

      const { paths = ['.'], fileTypes = [], excludePaths = [], maxResults = 50 } = scope;

      const { beforeLines = 2, afterLines = 2 } = searchContext;

      // Build command and arguments array safely
      const rgArgs: string[] = [];

      // Add context lines
      if (beforeLines > 0) {
        rgArgs.push('-B', beforeLines.toString());
      }
      if (afterLines > 0) {
        rgArgs.push('-A', afterLines.toString());
      }

      // Add line numbers
      rgArgs.push('-n');

      // Handle search type
      if (type === 'regex') {
        rgArgs.push('-e');
      } else if (type === 'fuzzy') {
        rgArgs.push('--fixed-strings');
      }

      // Add file type filters
      if (fileTypes.length > 0) {
        fileTypes.forEach(ft => {
          rgArgs.push('--type-add', `custom:*.${ft}`, '-t', 'custom');
        });
      }

      // Add exclude patterns
      excludePaths.forEach(path => {
        rgArgs.push('--glob', `!${path}`);
      });

      // Add max count
      rgArgs.push('-m', maxResults.toString());

      // Add the search query and paths
      rgArgs.push(query);
      rgArgs.push(...paths);

      // Execute safely using execFile
      const { stdout } = await execFile('rg', rgArgs, {
        cwd: projectPath,
      });
      const lines = stdout.split('\n').filter((line: string) => line.trim());

      const matches: Array<{
        file: string;
        line: number;
        column?: number;
        match: string;
        context: { before: string[]; after: string[] };
        relevance?: number;
      }> = [];

      let currentMatch: any = null;

      lines.forEach((line: string) => {
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
    } catch {
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
    encoding?: string;
    projectPath?: string;
  }) {
    try {
      const { filePath, content, createDirs = true, encoding = 'utf-8', projectPath } = context;

      // Resolve path relative to project directory if it's not absolute
      const resolvedPath = isAbsolute(filePath) ? filePath : resolve(projectPath || process.cwd(), filePath);
      const dir = dirname(resolvedPath);

      // Create directories if needed
      if (createDirs) {
        await mkdir(dir, { recursive: true });
      }

      // Write the file
      await writeFile(resolvedPath, content, { encoding: encoding as BufferEncoding });

      return {
        success: true,
        filePath: resolvedPath,
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
      const {
        path,
        recursive = false,
        includeHidden = false,
        pattern,
        maxDepth = 10,
        includeMetadata = true,
        projectPath,
      } = context;

      const gitignorePath = join(projectPath || process.cwd(), '.gitignore');
      let gitignoreFilter: ignore.Ignore | undefined;

      try {
        const gitignoreContent = await readFile(gitignorePath, 'utf-8');
        gitignoreFilter = ignore().add(gitignoreContent);
      } catch (err: any) {
        if (err.code !== 'ENOENT') {
          console.error(`Error reading .gitignore file:`, err);
        }
        // If .gitignore doesn't exist, gitignoreFilter remains undefined, meaning no files are ignored by gitignore.
      }

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
        const relativeToProject = relative(projectPath || process.cwd(), dirPath);
        if (gitignoreFilter?.ignores(relativeToProject)) return;
        if (currentDepth > maxDepth) return;

        const entries = await readdir(dirPath);

        for (const entry of entries) {
          const entryPath = join(dirPath, entry);
          const relativeEntryPath = relative(projectPath || process.cwd(), entryPath);
          if (gitignoreFilter?.ignores(relativeEntryPath)) continue;
          if (!includeHidden && entry.startsWith('.')) continue;

          const fullPath = entryPath;
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
    const startTime = Date.now();
    try {
      const { command, workingDirectory, timeout = 30000, captureOutput = true, shell, env } = context;

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
      const executionTime = Date.now() - startTime;

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
        // region = 'us',
        // language = 'en',
        // includeImages = false,
        // dateRange = 'all',
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
