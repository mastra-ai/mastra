import { exec as execNodejs } from 'child_process';
import { promisify } from 'util';
import type { CoreMessage } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import type {
	AiMessageType,
	AgentGenerateOptions,
	AgentStreamOptions,
} from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { MCPClient } from '@mastra/mcp';
import { Memory } from '@mastra/memory';
import { TokenLimiter } from '@mastra/memory/processors';
import { z } from 'zod';
import { ToolSummaryProcessor } from './processors/tool-summary';
import { WriteToDiskProcessor } from './processors/write-file';
import type { AgentBuilderConfig, GenerateAgentOptions } from './types';



const exec = promisify(execNodejs);

export class AgentBuilderDefaults {
	static DEFAULT_INSTRUCTIONS = (projectPath?: string) => `You are a Mastra Expert Agent, specialized in building production-ready AI applications using the Mastra framework. You excel at creating agents, tools, workflows, and complete applications with real, working implementations.

## Core Identity & Capabilities

**Primary Role:** Transform natural language requirements into working Mastra applications
**Key Strength:** Deep knowledge of Mastra patterns, conventions, and best practices
**Output Quality:** Production-ready code that follows Mastra ecosystem standards

## Workflow: The MASTRA Method

Follow this sequence for every coding task:

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

	static DEFAULT_TOOLS = async (projectPath?: string) => {
		const mcpClient = new MCPClient({
			id: 'agent-builder-mcp-client',
			servers: {
				terminal: {
					command: 'npx',
					args: ['@dillip285/mcp-terminal', '--allowed-paths', projectPath || process.cwd()],
				},
				editor: {
					command: 'node',
					args: [
						'/Users/daniellew/Documents/Mastra/mcp-editor',
						'--allowedDirectories',
						projectPath || process.cwd(),
					],
				},
				web: {
					command: 'node',
					args: ['/Users/daniellew/Documents/Mastra/web-search/build/index.js'],
				},
				docs: {
					command: 'npx',
					args: ['-y', '@mastra/mcp-docs-server'],
				},
			},
		});

		const tools = await mcpClient.getTools();
		const filteredTools: Record<string, any> = {};

		Object.keys(tools).forEach((key) => {
			if (!key.includes('MastraCourse')) {
				filteredTools[key] = tools[key];
			}
		});

		return {
			...filteredTools,
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
					packageManager: z
						.enum(['npm', 'pnpm', 'yarn'])
						.optional()
						.describe('Package manager to use'),
					packages: z
						.array(
							z.object({
								name: z.string(),
								version: z.string().optional(),
							})
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
					projectPath: z
						.string()
						.optional()
						.describe('Path to the project to validate (defaults to current project)'),
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
						})
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
					stdout: z
						.array(z.string())
						.optional()
						.describe('Server output lines captured during startup'),
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
								await new Promise((resolve) => setTimeout(resolve, 500));
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
				description:
					'Makes HTTP requests to the Mastra server or external APIs for testing and integration',
				inputSchema: z.object({
					method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).describe('HTTP method'),
					url: z.string().describe('Full URL or path (if baseUrl provided)'),
					baseUrl: z
						.string()
						.optional()
						.describe('Base URL for the server (e.g., http://localhost:4200)'),
					headers: z.record(z.string()).optional().describe('HTTP headers'),
					body: z.any().optional().describe('Request body (will be JSON stringified if object)'),
					timeout: z
						.number()
						.optional()
						.default(30000)
						.describe('Request timeout in milliseconds'),
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
			const args = [
				pm === 'npm' ? 'npx' : pm,
				'create mastra@latest',
				projectName,
				'-l',
				'openai',
				'-k',
				'skip',
			];

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
			const packageStrings = packages.map((p) => `${p.name}${p.version ? `@${p.version}` : ''}`);

			let installCmd: string;
			if (pm === 'npm') {
				installCmd = `npm install ${packageStrings.join(' ')}`;
			} else if (pm === 'yarn') {
				installCmd = `yarn add ${packageStrings.join(' ')}`;
			} else {
				installCmd = `pnpm add ${packageStrings.join(' ')}`;
			}

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
				const packageStrings = packages.map((p) => `${p.name}${p.version ? `@${p.version}` : '@latest'}`);
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
				upgraded: packages?.map((p) => p.name) || ['all packages'],
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
					reject(
						new Error(`Server startup timeout after 30 seconds. Output: ${stdoutLines.join('\n')}`)
					);
				}, 30000);

				serverProcess.stdout?.on('data', (data) => {
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

				serverProcess.stderr?.on('data', (data) => {
					const errorOutput = data.toString();
					stdoutLines.push(`[STDERR] ${errorOutput}`);
					clearTimeout(timeout);
					reject(new Error(`Server startup failed with error: ${errorOutput}`));
				});

				serverProcess.on('error', (error) => {
					clearTimeout(timeout);
					reject(error);
				});

				serverProcess.on('exit', (code, signal) => {
					clearTimeout(timeout);
					if (code !== 0 && code !== null) {
						reject(
							new Error(
								`Server process exited with code ${code}${signal ? ` (signal: ${signal})` : ''}. Output: ${stdoutLines.join('\n')}`
							)
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
	static async stopMastraServer({
		port = 4200,
		projectPath: _projectPath,
	}: {
		port?: number;
		projectPath?: string;
	}) {
		try {
			const { stdout } = await exec(`lsof -ti:${port} || echo "No process found"`);

			if (!stdout.trim() || stdout.trim() === 'No process found') {
				return {
					success: true,
					status: 'stopped' as const,
					message: `No Mastra server found running on port ${port}`,
				};
			}

			const pids = stdout.trim().split('\n').filter((pid) => pid.trim());
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
			await new Promise((resolve) => setTimeout(resolve, 2000));

			try {
				const { stdout: checkStdout } = await exec(`lsof -ti:${port} || echo "No process found"`);
				if (checkStdout.trim() && checkStdout.trim() !== 'No process found') {
					// Force kill remaining processes
					const remainingPids = checkStdout.trim().split('\n').filter((pid) => pid.trim());
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
					await new Promise((resolve) => setTimeout(resolve, 1000));
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

					if (eslintErrors.some((e) => e.severity === 'error')) {
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
				const testCommand = files?.length
					? `npx vitest run ${files.join(' ')}`
					: 'npm test || pnpm test || yarn test';
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

		const totalErrors = errors.filter((e) => e.severity === 'error').length;
		const totalWarnings = errors.filter((e) => e.severity === 'warning').length;
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
}

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
		const {
			...baseOptions
		} = generateOptions;

		const originalInstructions = await this.getInstructions({ runtimeContext: generateOptions?.runtimeContext });
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
		const {
			...baseOptions
		} = streamOptions;

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
		}
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