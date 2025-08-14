import { mkdtemp, copyFile, readFile, mkdir, readdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join, dirname, resolve, extname, basename } from 'path';
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { existsSync } from 'fs';
import { AgentBuilderDefaults } from '../defaults';
import {
  exec,
  getMastraTemplate,
  kindWeight,
  spawnSWPM,
  logGitState,
  backupAndReplaceFile,
  renameAndCopyFile,
} from '../utils';
import { AgentBuilder } from '..';
import type { TemplateUnit } from '../types';
import { ApplyResultSchema, MergeInputSchema, TemplateUnitSchema } from '../types';

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

// Step 2: Analyze template package.json for dependencies
const analyzePackageStep = createStep({
  id: 'analyze-package',
  description: 'Analyze the template package.json to extract dependency information',
  inputSchema: z.object({
    templateDir: z.string(),
    commitSha: z.string(),
    slug: z.string(),
  }),
  outputSchema: z.object({
    dependencies: z.record(z.string()).optional(),
    devDependencies: z.record(z.string()).optional(),
    peerDependencies: z.record(z.string()).optional(),
    scripts: z.record(z.string()).optional(),
    packageInfo: z.object({
      name: z.string().optional(),
      version: z.string().optional(),
      description: z.string().optional(),
    }),
  }),
  execute: async ({ inputData }) => {
    console.log('Analyzing template package.json...');
    const { templateDir } = inputData;
    const packageJsonPath = join(templateDir, 'package.json');

    try {
      const packageJsonContent = await readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      console.log('Template package.json:', JSON.stringify(packageJson, null, 2));

      return {
        dependencies: packageJson.dependencies || {},
        devDependencies: packageJson.devDependencies || {},
        peerDependencies: packageJson.peerDependencies || {},
        scripts: packageJson.scripts || {},
        packageInfo: {
          name: packageJson.name,
          version: packageJson.version,
          description: packageJson.description,
        },
      };
    } catch (error) {
      console.warn(`Failed to read template package.json: ${error instanceof Error ? error.message : String(error)}`);
      return {
        dependencies: {},
        devDependencies: {},
        peerDependencies: {},
        scripts: {},
        packageInfo: {},
      };
    }
  },
});

const flatInstallStep = createStep({
  id: 'flat-install',
  description: 'Run a flat install command without specifying packages',
  inputSchema: z.object({
    targetPath: z.string().describe('Path to the project to install packages in'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    details: z.string().optional(),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    console.log('Running flat install...');
    const targetPath = inputData.targetPath || runtimeContext.get('targetPath') || process.cwd();

    try {
      // Run flat install using swpm (no specific packages)
      await spawnSWPM(targetPath, 'install', []);

      return {
        success: true,
        message: 'Successfully ran flat install command',
        details: 'Installed all dependencies from package.json',
      };
    } catch (error) {
      console.error('Flat install failed:', error);
      return {
        success: false,
        message: `Flat install failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});

// NOTE: This is commented out code to let the agent handle package.json merging. Leaving in case we want to use it later.
const packageMergeStep = createStep({
  id: 'package-merge',
  description: 'Merge template package.json dependencies into target project and install',
  inputSchema: z.object({
    commitSha: z.string(),
    slug: z.string(),
    targetPath: z.string().optional(),
    packageInfo: z.object({
      dependencies: z.record(z.string()).optional(),
      devDependencies: z.record(z.string()).optional(),
      peerDependencies: z.record(z.string()).optional(),
      scripts: z.record(z.string()).optional(),
      packageInfo: z.object({
        name: z.string().optional(),
        version: z.string().optional(),
        description: z.string().optional(),
      }),
    }),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    applied: z.boolean(),
    message: z.string(),
    error: z.string().optional(),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    console.log('Package merge step starting...');
    const { commitSha, slug, packageInfo } = inputData;
    const targetPath = inputData.targetPath || runtimeContext.get('targetPath') || process.cwd();

    try {
      const allTools = await AgentBuilderDefaults.DEFAULT_TOOLS(targetPath);

      const packageMergeAgent = new Agent({
        name: 'package-merger',
        description: 'Specialized agent for merging package.json dependencies',
        instructions: `You are a package.json merge specialist. Your job is to:

1. **Read the target project's package.json** using readFile tool
2. **Merge template dependencies** into the target package.json following these rules:
   - For dependencies: Add ALL NEW ones with template versions, KEEP EXISTING versions for conflicts
   - For devDependencies: Add ALL NEW ones with template versions, KEEP EXISTING versions for conflicts  
   - For peerDependencies: Add ALL NEW ones with template versions, KEEP EXISTING versions for conflicts
   - For scripts: Add new scripts with "template:${slug}:" prefix, don't overwrite existing ones
   - Maintain existing package.json structure and formatting
3. **Write the updated package.json** using writeFile tool

Template Dependencies to Merge:
- Dependencies: ${JSON.stringify(packageInfo.dependencies || {}, null, 2)}
- Dev Dependencies: ${JSON.stringify(packageInfo.devDependencies || {}, null, 2)}
- Peer Dependencies: ${JSON.stringify(packageInfo.peerDependencies || {}, null, 2)}
- Scripts: ${JSON.stringify(packageInfo.scripts || {}, null, 2)}

CRITICAL MERGE RULES:
1. For each dependency in template dependencies, if it does NOT exist in target, ADD it with template version
2. For each dependency in template dependencies, if it ALREADY exists in target, KEEP target version
3. You MUST add ALL template dependencies that don't conflict - do not skip any
4. Be explicit about what you're adding vs keeping

EXAMPLE:
Template has: {"@mastra/libsql": "latest", "@mastra/core": "latest", "zod": "^3.25.67"}
Target has: {"@mastra/core": "latest", "zod": "^3.25.0"}
Result should have: {"@mastra/core": "latest", "zod": "^3.25.0", "@mastra/libsql": "latest"}

Be systematic and thorough. Always read the existing package.json first, then merge, then write.`,
        model: openai('gpt-4o-mini'),
        tools: {
          readFile: allTools.readFile,
          writeFile: allTools.writeFile,
          listDirectory: allTools.listDirectory,
        },
      });

      console.log('Starting package merge agent...');
      console.log('Template dependencies to merge:', JSON.stringify(packageInfo.dependencies, null, 2));
      console.log('Template devDependencies to merge:', JSON.stringify(packageInfo.devDependencies, null, 2));

      const result = await packageMergeAgent.stream(
        `Please merge the template dependencies into the target project's package.json at ${targetPath}/package.json.`,
        { experimental_output: z.object({ success: z.boolean() }) },
      );

      let buffer: string[] = [];
      for await (const chunk of result.fullStream) {
        if (chunk.type === 'text-delta') {
          buffer.push(chunk.textDelta);
          if (buffer.length > 20) {
            console.log(buffer.join(''));
            buffer = [];
          }
        }
      }

      if (buffer.length > 0) {
        console.log(buffer.join(''));
      }

      return {
        success: true,
        applied: true,
        message: `Successfully merged template dependencies and installed packages for ${slug}`,
      };
    } catch (error) {
      console.error('Package merge failed:', error);
      return {
        success: false,
        applied: false,
        message: `Package merge failed: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

// Step 3: Discover template units by scanning the templates directory
const discoverUnitsStep = createStep({
  id: 'discover-units',
  description: 'Discover template units by analyzing the templates directory structure',
  inputSchema: z.object({
    templateDir: z.string(),
    commitSha: z.string(),
    slug: z.string(),
  }),
  outputSchema: z.object({
    units: z.array(TemplateUnitSchema),
  }),
  execute: async ({ inputData }) => {
    const { templateDir, slug } = inputData;

    const tools = await AgentBuilderDefaults.DEFAULT_TOOLS(templateDir);

    const agent = new Agent({
      model: openai('gpt-4o-mini'),
      instructions: `You are an expert at analyzing Mastra projects.

Your task is to scan the provided directory and identify all available units (agents, workflows, tools, MCP servers, networks).

Mastram Project Structure Analysis:
- Each Mastra project has a structure like: ${AgentBuilderDefaults.DEFAULT_FOLDER_STRUCTURE.agent}, ${AgentBuilderDefaults.DEFAULT_FOLDER_STRUCTURE.workflow}, ${AgentBuilderDefaults.DEFAULT_FOLDER_STRUCTURE.tool}, ${AgentBuilderDefaults.DEFAULT_FOLDER_STRUCTURE['mcp-server']}, ${AgentBuilderDefaults.DEFAULT_FOLDER_STRUCTURE.network}
- Analyze TypeScript files in each category directory to identify exported units

CRITICAL: YOU MUST USE YOUR TOOLS (readFile, listDirectory) TO DISCOVER THE UNITS IN THE TEMPLATE DIRECTORY.

IMPORTANT - Agent Discovery Rules:
1. **Multiple Agent Files**: Some templates have separate files for each agent (e.g., evaluationAgent.ts, researchAgent.ts)
2. **Single File Multiple Agents**: Some files may export multiple agents (look for multiple 'export const' or 'export default' statements)
3. **Agent Identification**: Look for exported variables that are instances of 'new Agent()' or similar patterns
4. **Naming Convention**: Agent names should be extracted from the export name (e.g., 'weatherAgent', 'evaluationAgent')

For each Mastra project directory you analyze:
1. Scan all TypeScript files in ${AgentBuilderDefaults.DEFAULT_FOLDER_STRUCTURE.agent} and identify ALL exported agents
2. Scan all TypeScript files in ${AgentBuilderDefaults.DEFAULT_FOLDER_STRUCTURE.workflow} and identify ALL exported workflows
3. Scan all TypeScript files in ${AgentBuilderDefaults.DEFAULT_FOLDER_STRUCTURE.tool} and identify ALL exported tools
4. Scan all TypeScript files in ${AgentBuilderDefaults.DEFAULT_FOLDER_STRUCTURE['mcp-server']} and identify ALL exported MCP servers
5. Scan all TypeScript files in ${AgentBuilderDefaults.DEFAULT_FOLDER_STRUCTURE.network} and identify ALL exported networks
6. Scan for any OTHER files in src/mastra that are NOT in the above default folders (e.g., lib/, utils/, types/, etc.) and identify them as 'other' files

Return the actual exported names of the units, as well as the file names.`,
      name: 'Mastra Project Discoverer',
      tools: {
        readFile: tools.readFile,
        listDirectory: tools.listDirectory,
      },
    });

    const result = await agent.generate(
      `Analyze the Mastra project directory structure at "${templateDir}".

            List directory contents using listDirectory tool, and then analyze each file with readFile tool.
      IMPORTANT:
      - Look inside the actual file content to find export statements like 'export const agentName = new Agent(...)'
      - A single file may contain multiple exports
      - Return the actual exported variable names, as well as the file names
      - If a directory doesn't exist or has no files, return an empty array

      Return the analysis in the exact format specified in the output schema.`,
      {
        experimental_output: z.object({
          agents: z.array(z.object({ name: z.string(), file: z.string() })).optional(),
          workflows: z.array(z.object({ name: z.string(), file: z.string() })).optional(),
          tools: z.array(z.object({ name: z.string(), file: z.string() })).optional(),
          mcp: z.array(z.object({ name: z.string(), file: z.string() })).optional(),
          networks: z.array(z.object({ name: z.string(), file: z.string() })).optional(),
          other: z.array(z.object({ name: z.string(), file: z.string() })).optional(),
        }),
        maxSteps: 100,
      },
    );

    const template = result.object ?? {};

    const units: TemplateUnit[] = [];

    // Add agents
    template.agents?.forEach((agentId: { name: string; file: string }) => {
      units.push({ kind: 'agent', id: agentId.name, file: agentId.file });
    });

    // Add workflows
    template.workflows?.forEach((workflowId: { name: string; file: string }) => {
      units.push({ kind: 'workflow', id: workflowId.name, file: workflowId.file });
    });

    // Add tools
    template.tools?.forEach((toolId: { name: string; file: string }) => {
      units.push({ kind: 'tool', id: toolId.name, file: toolId.file });
    });

    // Add MCP servers
    template.mcp?.forEach((mcpId: { name: string; file: string }) => {
      units.push({ kind: 'mcp-server', id: mcpId.name, file: mcpId.file });
    });

    // Add networks
    template.networks?.forEach((networkId: { name: string; file: string }) => {
      units.push({ kind: 'network', id: networkId.name, file: networkId.file });
    });

    // Add other files
    template.other?.forEach((otherId: { name: string; file: string }) => {
      units.push({ kind: 'other', id: otherId.name, file: otherId.file });
    });

    console.log('Discovered units:', JSON.stringify(units, null, 2));

    return { units };
  },
});

// Step 4: Topological ordering (simplified)
const orderUnitsStep = createStep({
  id: 'order-units',
  description: 'Sort units in topological order based on kind weights',
  inputSchema: z.object({
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
    conflicts: z.array(
      z.object({
        unit: z.object({
          kind: z.string(),
          id: z.string(),
        }),
        issue: z.string(),
        sourceFile: z.string(),
        targetFile: z.string(),
      }),
    ),
    copiedFiles: z.array(
      z.object({
        source: z.string(),
        destination: z.string(),
        unit: z.object({
          kind: z.string(),
          id: z.string(),
        }),
      }),
    ),
    templateDir: z.string(),
    commitSha: z.string(),
    slug: z.string(),
    targetPath: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    applied: z.boolean(),
    message: z.string(),
    conflictsResolved: z.array(
      z.object({
        unit: z.object({
          kind: z.string(),
          id: z.string(),
        }),
        issue: z.string(),
        resolution: z.string(),
      }),
    ),
    error: z.string().optional(),
    branchName: z.string().optional(),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    console.log('Intelligent merge step starting...');
    const { conflicts, copiedFiles, commitSha, slug, templateDir } = inputData;
    const targetPath = inputData.targetPath || runtimeContext.get('targetPath') || process.cwd();

    const baseBranchName = `feat/install-template-${slug}`;
    try {
      // Create or switch to git branch for template integration
      let branchName = baseBranchName;

      try {
        // Try to create new branch
        await exec(`git checkout -b "${branchName}"`, { cwd: targetPath });
        console.log(`Created new branch: ${branchName}`);
      } catch (error) {
        // If branch exists, check if we can switch to it or create a unique name
        const errorStr = error instanceof Error ? error.message : String(error);
        if (errorStr.includes('already exists')) {
          try {
            // Try to switch to existing branch
            await exec(`git checkout "${branchName}"`, { cwd: targetPath });
            console.log(`Switched to existing branch: ${branchName}`);
          } catch (switchError) {
            // If can't switch, create a unique branch name
            const timestamp = Date.now().toString().slice(-6);
            branchName = `${baseBranchName}-${timestamp}`;
            await exec(`git checkout -b "${branchName}"`, { cwd: targetPath });
            console.log(`Created unique branch: ${branchName}`);
          }
        } else {
          throw error; // Re-throw if it's a different error
        }
      }

      // Create copyFile tool for edge cases
      const copyFileTool = createTool({
        id: 'copy-file',
        description:
          'Copy a file from template to target project (use only for edge cases - most files are already copied programmatically).',
        inputSchema: z.object({
          sourcePath: z.string().describe('Path to the source file relative to template directory'),
          destinationPath: z.string().describe('Path to the destination file relative to target project'),
        }),
        outputSchema: z.object({
          success: z.boolean(),
          message: z.string(),
          error: z.string().optional(),
        }),
        execute: async ({ context }) => {
          try {
            const { sourcePath, destinationPath } = context;

            // Use templateDir directly from input
            const resolvedSourcePath = resolve(templateDir, sourcePath);
            const resolvedDestinationPath = resolve(targetPath, destinationPath);

            if (existsSync(resolvedSourcePath) && !existsSync(dirname(resolvedDestinationPath))) {
              await mkdir(dirname(resolvedDestinationPath), { recursive: true });
            }

            await copyFile(resolvedSourcePath, resolvedDestinationPath);
            return {
              success: true,
              message: `Successfully copied file from ${sourcePath} to ${destinationPath}`,
            };
          } catch (error) {
            return {
              success: false,
              message: `Failed to copy file: ${error instanceof Error ? error.message : String(error)}`,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        },
      });

      // Initialize AgentBuilder for merge and registration
      const agentBuilder = new AgentBuilder({
        projectPath: targetPath,
        mode: 'template',
        model: openai('gpt-4o-mini'),
        instructions: `
You are an expert at integrating Mastra template components into existing projects.

CRITICAL CONTEXT:
- Files have been programmatically copied from template to target project
- Your job is to handle integration issues, registration, and validation

FILES SUCCESSFULLY COPIED:
${JSON.stringify(copiedFiles, null, 2)}

CONFLICTS TO RESOLVE:
${JSON.stringify(conflicts, null, 2)}

CRITICAL INSTRUCTIONS:
1. **When committing changes**: NEVER add dependency/build directories. Use specific file paths with 'git add'
2. **Package management**: NO need to install packages (already handled by package merge step)
3. **Validation**: When validation fails due to import issues, check existing files and imports for correct naming conventions
4. **Variable vs file names**: A variable name might differ from file name (e.g., filename: ./downloaderTool.ts, export const fetcherTool(...))
5. **File copying**: Most files are already copied programmatically. Only use copyFile tool for edge cases where additional files are needed

KEY RESPONSIBILITIES:
1. Resolve any conflicts from the programmatic copy step
2. Register components in existing Mastra index file (agents, workflows, networks, mcp-servers)
3. DO NOT register tools in existing Mastra index file - tools should remain standalone
4. Fix import path issues in copied files
5. Ensure TypeScript imports and exports are correct
6. Validate integration works properly
7. Copy additional files ONLY if needed for conflict resolution or missing dependencies

MASTRA-SPECIFIC INTEGRATION:
- Agents: Register in existing Mastra index file
- Workflows: Register in existing Mastra index file
- Networks: Register in existing Mastra index file
- MCP servers: Register in existing Mastra index file
- Tools: Copy to ${AgentBuilderDefaults.DEFAULT_FOLDER_STRUCTURE.tool} but DO NOT register in existing Mastra index file

EDGE CASE FILE COPYING:
- IF a file for a resource does not exist in the target project AND was not programmatically copied, you can use copyFile tool
- When taking files from template, ensure you get the right file name and path
- Only copy files that are actually needed for the integration to work

NAMING CONVENTION GUIDANCE:
When fixing imports or understanding naming patterns, use these examples:

**Import Path Patterns:**
- camelCase files: import { myAgent } from './myAgent'
- snake_case files: import { myAgent } from './my_agent'
- kebab-case files: import { myAgent } from './my-agent'
- PascalCase files: import { MyAgent } from './MyAgent'

**Naming Detection Examples:**
- Files like "weatherAgent.ts", "chatAgent.ts" → use camelCase
- Files like "weather_agent.ts", "chat_agent.ts" → use snake_case  
- Files like "weather-agent.ts", "chat-agent.ts" → use kebab-case
- Files like "WeatherAgent.ts", "ChatAgent.ts" → use PascalCase

**Key Rule:** Keep variable/export names unchanged - only adapt file names and import paths

Template information:
- Slug: ${slug}
- Commit: ${commitSha.substring(0, 7)}
- Branch: ${branchName}
`,
        tools: {
          copyFile: copyFileTool,
        },
      });

      // Create task list for systematic processing
      const tasks = [];

      // Add conflict resolution tasks
      conflicts.forEach((conflict, index) => {
        tasks.push({
          id: `conflict-${conflict.unit.kind}-${conflict.unit.id}`,
          content: `Resolve conflict: ${conflict.issue}`,
          status: 'pending' as const,
          priority: 'high' as const,
          notes: `Unit: ${conflict.unit.kind}:${conflict.unit.id}, Issue: ${conflict.issue}, Source: ${conflict.sourceFile}, Target: ${conflict.targetFile}`,
        });
      });

      // Add registration tasks for successfully copied files
      const nonToolFiles = copiedFiles.filter(f => f.unit.kind !== 'tool');
      if (nonToolFiles.length > 0) {
        tasks.push({
          id: 'register-components',
          content: `Register ${nonToolFiles.length} components in existing Mastra index file (src/mastra/index.ts)`,
          status: 'pending' as const,
          priority: 'medium' as const,
          dependencies: conflicts.length > 0 ? conflicts.map(c => `conflict-${c.unit.kind}-${c.unit.id}`) : undefined,
          notes: `Components to register: ${nonToolFiles.map(f => `${f.unit.kind}:${f.unit.id}`).join(', ')}`,
        });
      }

      // Note: Validation is handled by the dedicated validation step, not here

      console.log(`Creating task list with ${tasks.length} tasks...`);
      await AgentBuilderDefaults.manageTaskList({ action: 'create', tasks });

      // Log git state before merge operations
      await logGitState(targetPath, 'before intelligent merge');

      // Process tasks systematically
      const result = await agentBuilder.stream(`
You need to work through a task list to complete the template integration.

CRITICAL INSTRUCTIONS:

**STEP 1: GET YOUR TASK LIST**
1. Use manageTaskList tool with action "list" to see all pending tasks
2. Work through tasks in dependency order (complete dependencies first)

**STEP 2: PROCESS EACH TASK SYSTEMATICALLY**
For each task:
1. Use manageTaskList to mark the current task as 'in_progress'
2. Complete the task according to its requirements
3. Use manageTaskList to mark the task as 'completed' when done
4. Continue until all tasks are completed

**TASK TYPES AND REQUIREMENTS:**

**Conflict Resolution Tasks:**
- Analyze the specific conflict and determine best resolution strategy
- For file name conflicts: merge content or rename appropriately
- For missing files: investigate and copy if needed
- For other issues: apply appropriate fixes

**Component Registration Task:**
- Update main Mastra instance file to register new components
- Only register: agents, workflows, networks, mcp-servers
- DO NOT register tools in main config
- Ensure proper import paths and naming conventions

**COMMIT STRATEGY:**
- After resolving conflicts: "feat(template): resolve conflicts for ${slug}@${commitSha.substring(0, 7)}"
- After registration: "feat(template): register components from ${slug}@${commitSha.substring(0, 7)}"

**CRITICAL NOTES:**
- Template source: ${templateDir}
- Target project: ${targetPath}
- Focus ONLY on conflict resolution and component registration
- Use executeCommand for git commits after each task
- DO NOT perform validation - that's handled by the dedicated validation step

Start by listing your tasks and work through them systematically!
`);

      // Extract actual conflict resolution details from agent execution
      const actualResolutions: Array<{
        taskId: string;
        action: string;
        status: string;
        content: string;
        notes?: string;
      }> = [];

      for await (const chunk of result.fullStream) {
        if (chunk.type === 'step-finish' || chunk.type === 'step-start') {
          console.log({
            type: chunk.type,
            msgId: chunk.messageId,
          });
        } else {
          console.log(JSON.stringify(chunk, null, 2));

          // Extract task management tool results
          if (chunk.type === 'tool-result' && chunk.toolName === 'manageTaskList') {
            try {
              const toolResult = chunk.result;
              if (toolResult.action === 'update' && toolResult.status === 'completed') {
                actualResolutions.push({
                  taskId: toolResult.taskId || '',
                  action: toolResult.action,
                  status: toolResult.status,
                  content: toolResult.content || '',
                  notes: toolResult.notes,
                });
                console.log(`📋 Task completed: ${toolResult.taskId} - ${toolResult.content}`);
              }
            } catch (parseError) {
              console.warn('Failed to parse task management result:', parseError);
            }
          }
        }
      }

      // Log git state after merge operations
      await logGitState(targetPath, 'after intelligent merge');

      // Map actual resolutions back to conflicts
      const conflictResolutions = conflicts.map(conflict => {
        const taskId = `conflict-${conflict.unit.kind}-${conflict.unit.id}`;
        const actualResolution = actualResolutions.find(r => r.taskId === taskId);

        if (actualResolution) {
          return {
            unit: conflict.unit,
            issue: conflict.issue,
            resolution:
              actualResolution.notes ||
              actualResolution.content ||
              `Completed: ${conflict.unit.kind} ${conflict.unit.id}`,
            actualWork: true,
          };
        } else {
          return {
            unit: conflict.unit,
            issue: conflict.issue,
            resolution: `No specific resolution found for ${conflict.unit.kind} ${conflict.unit.id}`,
            actualWork: false,
          };
        }
      });

      return {
        success: true,
        applied: true,
        branchName,
        message: `Successfully resolved ${conflicts.length} conflicts from template ${slug}`,
        conflictsResolved: conflictResolutions,
      };
    } catch (error) {
      return {
        success: false,
        applied: false,
        branchName: baseBranchName,
        message: `Failed to resolve conflicts: ${error instanceof Error ? error.message : String(error)}`,
        conflictsResolved: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

// Helper function to determine conflict resolution strategy
const determineConflictStrategy = (
  unit: { kind: string; id: string },
  targetFile: string,
): 'skip' | 'backup-and-replace' | 'rename' => {
  // For now, always skip conflicts to avoid disrupting existing files
  // TODO: Enable advanced strategies based on user feedback
  return 'skip';

  // Future logic (currently disabled):
  // if (['agent', 'workflow', 'network'].includes(unit.kind)) {
  //   return 'backup-and-replace';
  // }
  // if (unit.kind === 'tool') {
  //   return 'rename';
  // }
  // return 'backup-and-replace';
};

// Step 6: Programmatic File Copy Step - copies template files to target project
const programmaticFileCopyStep = createStep({
  id: 'programmatic-file-copy',
  description: 'Programmatically copy template files to target project based on ordered units',
  inputSchema: z.object({
    orderedUnits: z.array(
      z.object({
        kind: z.string(),
        id: z.string(),
        file: z.string(),
      }),
    ),
    templateDir: z.string(),
    commitSha: z.string(),
    slug: z.string(),
    targetPath: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    copiedFiles: z.array(
      z.object({
        source: z.string(),
        destination: z.string(),
        unit: z.object({
          kind: z.string(),
          id: z.string(),
        }),
      }),
    ),
    conflicts: z.array(
      z.object({
        unit: z.object({
          kind: z.string(),
          id: z.string(),
        }),
        issue: z.string(),
        sourceFile: z.string(),
        targetFile: z.string(),
      }),
    ),
    message: z.string(),
    error: z.string().optional(),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    console.log('Programmatic file copy step starting...');
    const { orderedUnits, templateDir, commitSha, slug } = inputData;
    const targetPath = inputData.targetPath || runtimeContext.get('targetPath') || process.cwd();

    try {
      const copiedFiles: Array<{
        source: string;
        destination: string;
        unit: { kind: string; id: string };
      }> = [];

      const conflicts: Array<{
        unit: { kind: string; id: string };
        issue: string;
        sourceFile: string;
        targetFile: string;
      }> = [];

      // Analyze target project naming convention first
      const analyzeNamingConvention = async (
        directory: string,
      ): Promise<'camelCase' | 'snake_case' | 'kebab-case' | 'PascalCase' | 'unknown'> => {
        try {
          const files = await readdir(resolve(targetPath, directory), { withFileTypes: true });
          const tsFiles = files.filter(f => f.isFile() && f.name.endsWith('.ts')).map(f => f.name);

          if (tsFiles.length === 0) return 'unknown';

          // Check for patterns
          const camelCaseCount = tsFiles.filter(f => /^[a-z][a-zA-Z0-9]*\.ts$/.test(f)).length;
          const snakeCaseCount = tsFiles.filter(f => /^[a-z][a-z0-9_]*\.ts$/.test(f) && f.includes('_')).length;
          const kebabCaseCount = tsFiles.filter(f => /^[a-z][a-z0-9-]*\.ts$/.test(f) && f.includes('-')).length;
          const pascalCaseCount = tsFiles.filter(f => /^[A-Z][a-zA-Z0-9]*\.ts$/.test(f)).length;

          const max = Math.max(camelCaseCount, snakeCaseCount, kebabCaseCount, pascalCaseCount);
          if (max === 0) return 'unknown';

          if (camelCaseCount === max) return 'camelCase';
          if (snakeCaseCount === max) return 'snake_case';
          if (kebabCaseCount === max) return 'kebab-case';
          if (pascalCaseCount === max) return 'PascalCase';

          return 'unknown';
        } catch {
          return 'unknown';
        }
      };

      // Convert naming based on convention
      const convertNaming = (name: string, convention: string): string => {
        const baseName = basename(name, extname(name));
        const ext = extname(name);

        switch (convention) {
          case 'camelCase':
            return (
              baseName
                .replace(/[-_]/g, '')
                .replace(/([A-Z])/g, (match, p1, offset) => (offset === 0 ? p1.toLowerCase() : p1)) + ext
            );
          case 'snake_case':
            return (
              baseName
                .replace(/[-]/g, '_')
                .replace(/([A-Z])/g, (match, p1, offset) => (offset === 0 ? '' : '_') + p1.toLowerCase()) + ext
            );
          case 'kebab-case':
            return (
              baseName
                .replace(/[_]/g, '-')
                .replace(/([A-Z])/g, (match, p1, offset) => (offset === 0 ? '' : '-') + p1.toLowerCase()) + ext
            );
          case 'PascalCase':
            return baseName.replace(/[-_]/g, '').replace(/^[a-z]/, match => match.toUpperCase()) + ext;
          default:
            return name;
        }
      };

      // Process each unit
      for (const unit of orderedUnits) {
        console.log(`Processing ${unit.kind} unit "${unit.id}" from file "${unit.file}"`);

        // Resolve source file path with fallback logic
        let sourceFile: string;
        let resolvedUnitFile: string;

        // Check if unit.file already contains directory structure
        if (unit.file.includes('/')) {
          // unit.file has path structure (e.g., "src/mastra/agents/weatherAgent.ts")
          sourceFile = resolve(templateDir, unit.file);
          resolvedUnitFile = unit.file;
        } else {
          // unit.file is just filename (e.g., "weatherAgent.ts") - use fallback
          const folderPath =
            AgentBuilderDefaults.DEFAULT_FOLDER_STRUCTURE[
              unit.kind as keyof typeof AgentBuilderDefaults.DEFAULT_FOLDER_STRUCTURE
            ];
          if (!folderPath) {
            conflicts.push({
              unit: { kind: unit.kind, id: unit.id },
              issue: `Unknown unit kind: ${unit.kind}`,
              sourceFile: unit.file,
              targetFile: 'N/A',
            });
            continue;
          }
          resolvedUnitFile = `${folderPath}/${unit.file}`;
          sourceFile = resolve(templateDir, resolvedUnitFile);
        }

        // Check if source file exists
        if (!existsSync(sourceFile)) {
          conflicts.push({
            unit: { kind: unit.kind, id: unit.id },
            issue: `Source file not found: ${sourceFile}`,
            sourceFile: resolvedUnitFile,
            targetFile: 'N/A',
          });
          continue;
        }

        // Extract target directory from resolved unit file path
        const targetDir = dirname(resolvedUnitFile);

        // Analyze target naming convention
        const namingConvention = await analyzeNamingConvention(targetDir);
        console.log(`Detected naming convention in ${targetDir}: ${namingConvention}`);

        // Convert unit.id to target filename with proper extension
        const fileExtension = extname(unit.file);
        const convertedFileName =
          namingConvention !== 'unknown'
            ? convertNaming(unit.id + fileExtension, namingConvention)
            : unit.id + fileExtension;

        const targetFile = resolve(targetPath, targetDir, convertedFileName);

        // Handle file conflicts with strategy-based resolution
        if (existsSync(targetFile)) {
          const strategy = determineConflictStrategy(unit, targetFile);
          console.log(`File exists: ${convertedFileName}, using strategy: ${strategy}`);

          switch (strategy) {
            case 'skip':
              conflicts.push({
                unit: { kind: unit.kind, id: unit.id },
                issue: `File exists - skipped: ${convertedFileName}`,
                sourceFile: unit.file,
                targetFile: `${targetDir}/${convertedFileName}`,
              });
              console.log(`⏭️ Skipped ${unit.kind} "${unit.id}": file already exists`);
              continue;

            case 'backup-and-replace':
              try {
                await backupAndReplaceFile(sourceFile, targetFile);
                copiedFiles.push({
                  source: sourceFile,
                  destination: targetFile,
                  unit: { kind: unit.kind, id: unit.id },
                });
                console.log(
                  `🔄 Replaced ${unit.kind} "${unit.id}": ${unit.file} → ${convertedFileName} (backup created)`,
                );
                continue;
              } catch (backupError) {
                conflicts.push({
                  unit: { kind: unit.kind, id: unit.id },
                  issue: `Failed to backup and replace: ${backupError instanceof Error ? backupError.message : String(backupError)}`,
                  sourceFile: unit.file,
                  targetFile: `${targetDir}/${convertedFileName}`,
                });
                continue;
              }

            case 'rename':
              try {
                const uniqueTargetFile = await renameAndCopyFile(sourceFile, targetFile);
                copiedFiles.push({
                  source: sourceFile,
                  destination: uniqueTargetFile,
                  unit: { kind: unit.kind, id: unit.id },
                });
                console.log(`📝 Renamed ${unit.kind} "${unit.id}": ${unit.file} → ${basename(uniqueTargetFile)}`);
                continue;
              } catch (renameError) {
                conflicts.push({
                  unit: { kind: unit.kind, id: unit.id },
                  issue: `Failed to rename and copy: ${renameError instanceof Error ? renameError.message : String(renameError)}`,
                  sourceFile: unit.file,
                  targetFile: `${targetDir}/${convertedFileName}`,
                });
                continue;
              }

            default:
              conflicts.push({
                unit: { kind: unit.kind, id: unit.id },
                issue: `Unknown conflict strategy: ${strategy}`,
                sourceFile: unit.file,
                targetFile: `${targetDir}/${convertedFileName}`,
              });
              continue;
          }
        }

        // Ensure target directory exists
        await mkdir(dirname(targetFile), { recursive: true });

        // Copy the file
        try {
          await copyFile(sourceFile, targetFile);
          copiedFiles.push({
            source: sourceFile,
            destination: targetFile,
            unit: { kind: unit.kind, id: unit.id },
          });
          console.log(`✓ Copied ${unit.kind} "${unit.id}": ${unit.file} → ${convertedFileName}`);
        } catch (copyError) {
          conflicts.push({
            unit: { kind: unit.kind, id: unit.id },
            issue: `Failed to copy file: ${copyError instanceof Error ? copyError.message : String(copyError)}`,
            sourceFile: unit.file,
            targetFile: `${targetDir}/${convertedFileName}`,
          });
        }
      }

      // Commit the copied files
      if (copiedFiles.length > 0) {
        try {
          const fileList = copiedFiles.map(f => f.destination).join(' ');
          await exec(`git add ${fileList}`, { cwd: targetPath });
          await exec(
            `git commit -m "feat(template): copy ${copiedFiles.length} files from ${slug}@${commitSha.substring(0, 7)}"`,
            { cwd: targetPath },
          );
          console.log(`✓ Committed ${copiedFiles.length} copied files`);
        } catch (commitError) {
          console.warn('Failed to commit copied files:', commitError);
        }
      }

      const message = `Programmatic file copy completed. Copied ${copiedFiles.length} files, ${conflicts.length} conflicts detected.`;
      console.log(message);

      return {
        success: true,
        copiedFiles,
        conflicts,
        message,
      };
    } catch (error) {
      console.error('Programmatic file copy failed:', error);
      throw new Error(`Programmatic file copy failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});

// Step 7: Validation and Fix Step - validates merged code and fixes any issues
const validationAndFixStep = createStep({
  id: 'validation-and-fix',
  description: 'Validate the merged template code and fix any validation errors using a specialized agent',
  inputSchema: z.object({
    commitSha: z.string(),
    slug: z.string(),
    targetPath: z.string().optional(),
    templateDir: z.string(),
    orderedUnits: z.array(
      z.object({
        kind: z.string(),
        id: z.string(),
        file: z.string(),
      }),
    ),
    copiedFiles: z.array(
      z.object({
        source: z.string(),
        destination: z.string(),
        unit: z.object({
          kind: z.string(),
          id: z.string(),
        }),
      }),
    ),
    conflictsResolved: z
      .array(
        z.object({
          unit: z.object({
            kind: z.string(),
            id: z.string(),
          }),
          issue: z.string(),
          resolution: z.string(),
        }),
      )
      .optional(),
    maxIterations: z.number().optional().default(5),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    applied: z.boolean(),
    message: z.string(),
    validationResults: z.object({
      valid: z.boolean(),
      errorsFixed: z.number(),
      remainingErrors: z.number(),
    }),
    error: z.string().optional(),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    console.log('Validation and fix step starting...');
    const { commitSha, slug, orderedUnits, templateDir, copiedFiles, conflictsResolved, maxIterations = 5 } = inputData;
    const targetPath = inputData.targetPath || runtimeContext.get('targetPath') || process.cwd();

    // Skip validation if no changes were made
    const hasChanges = copiedFiles.length > 0 || (conflictsResolved && conflictsResolved.length > 0);
    if (!hasChanges) {
      console.log('⏭️ Skipping validation - no files copied or conflicts resolved');
      return {
        success: true,
        applied: false,
        message: 'No changes to validate - template already integrated or no conflicts resolved',
        validationResults: {
          valid: true,
          errorsFixed: 0,
          remainingErrors: 0,
        },
      };
    }

    console.log(
      `📋 Changes detected: ${copiedFiles.length} files copied, ${conflictsResolved?.length || 0} conflicts resolved`,
    );

    let currentIteration = 1; // Declare at function scope for error handling

    try {
      const allTools = await AgentBuilderDefaults.DEFAULT_TOOLS(targetPath, 'template');

      const validationAgent = new Agent({
        name: 'code-validator-fixer',
        description: 'Specialized agent for validating and fixing template integration issues',
        instructions: `You are a code validation and fixing specialist. Your job is to:

1. **Run comprehensive validation** using the validateCode tool to check for:
   - TypeScript compilation errors
   - ESLint issues
   - Import/export problems
   - Missing dependencies

2. **Fix validation errors systematically**:
   - Use readFile to examine files with errors
   - Use multiEdit to fix issues like missing imports, incorrect paths, syntax errors
   - Use listDirectory to understand project structure when fixing import paths
   - Update file contents to resolve TypeScript and linting issues

3. **Re-validate after fixes** to ensure all issues are resolved

4. **Focus on template integration issues**:
   - Files were copied with new names based on unit IDs
   - Original template imports may reference old filenames
   - Missing imports in index files
   - Incorrect file paths in imports
   - Type mismatches after integration
   - Missing exports in barrel files
   - Use the COPIED FILES mapping below to fix import paths

CRITICAL: Always validate the entire project first to get a complete picture of issues, then fix them systematically, and re-validate to confirm fixes worked.

CRITICAL IMPORT PATH RESOLUTION:
The following files were copied from template with new names:
${JSON.stringify(copiedFiles, null, 2)}

When fixing import errors:
1. Check if the missing module corresponds to a copied file
2. Use listDirectory to verify actual filenames in target directories
3. Update import paths to match the actual copied filenames
4. Ensure exported variable names match what's being imported

EXAMPLE: If error shows "Cannot find module './tools/download-csv-tool'" but a file was copied as "csv-fetcher-tool.ts", update the import to "./tools/csv-fetcher-tool"

${conflictsResolved ? `CONFLICTS RESOLVED BY INTELLIGENT MERGE:\n${JSON.stringify(conflictsResolved, null, 2)}\n` : ''}

INTEGRATED UNITS:
${JSON.stringify(orderedUnits, null, 2)}

Be thorough and methodical. Always use listDirectory to verify actual file existence before fixing imports.`,
        model: openai('gpt-4o-mini'),
        tools: {
          validateCode: allTools.validateCode,
          readFile: allTools.readFile,
          multiEdit: allTools.multiEdit,
          listDirectory: allTools.listDirectory,
          executeCommand: allTools.executeCommand,
        },
      });

      console.log('Starting validation and fix agent with internal loop...');

      let validationResults = {
        valid: false,
        errorsFixed: 0,
        remainingErrors: 1, // Start with 1 to enter the loop
        iteration: currentIteration,
      };

      // Loop up to maxIterations times or until all errors are fixed
      while (validationResults.remainingErrors > 0 && currentIteration <= maxIterations) {
        console.log(`\n=== Validation Iteration ${currentIteration} ===`);

        const iterationPrompt =
          currentIteration === 1
            ? `Please validate the template integration and fix any errors found in the project at ${targetPath}. The template "${slug}" (${commitSha.substring(0, 7)}) was just integrated and may have validation issues that need fixing.

Start by running validateCode with all validation types to get a complete picture of any issues, then systematically fix them.`
            : `Continue validation and fixing for the template integration at ${targetPath}. This is iteration ${currentIteration} of validation.

Previous iterations may have fixed some issues, so start by re-running validateCode to see the current state, then fix any remaining issues.`;

        const result = await validationAgent.stream(iterationPrompt, {
          experimental_output: z.object({ success: z.boolean() }),
        });

        let iterationErrors = 0;
        let previousErrors = validationResults.remainingErrors;

        for await (const chunk of result.fullStream) {
          if (chunk.type === 'step-finish' || chunk.type === 'step-start') {
            console.log({
              type: chunk.type,
              msgId: chunk.messageId,
              iteration: currentIteration,
            });
          } else {
            console.log(JSON.stringify(chunk, null, 2));
          }
          if (chunk.type === 'tool-result') {
            // Track validation results
            if (chunk.toolName === 'validateCode') {
              const toolResult = chunk.result as any;
              if (toolResult?.summary) {
                iterationErrors = toolResult.summary.totalErrors || 0;
                console.log(`Iteration ${currentIteration}: Found ${iterationErrors} errors`);
              }
            }
          }
        }

        // Update results for this iteration
        validationResults.remainingErrors = iterationErrors;
        validationResults.errorsFixed += Math.max(0, previousErrors - iterationErrors);
        validationResults.valid = iterationErrors === 0;
        validationResults.iteration = currentIteration;

        console.log(`Iteration ${currentIteration} complete: ${iterationErrors} errors remaining`);

        // Break if no errors or max iterations reached
        if (iterationErrors === 0) {
          console.log(`✅ All validation issues resolved in ${currentIteration} iterations!`);
          break;
        } else if (currentIteration >= maxIterations) {
          console.log(`⚠️  Max iterations (${maxIterations}) reached. ${iterationErrors} errors still remaining.`);
          break;
        }

        currentIteration++;
      }

      // Commit the validation fixes
      try {
        await exec(
          `git add . && git commit -m "fix(template): resolve validation errors for ${slug}@${commitSha.substring(0, 7)}" || true`,
          {
            cwd: targetPath,
          },
        );
      } catch (commitError) {
        console.warn('Failed to commit validation fixes:', commitError);
      }

      return {
        success: true,
        applied: true,
        message: `Validation completed in ${currentIteration} iteration${currentIteration > 1 ? 's' : ''}. ${validationResults.valid ? 'All issues resolved!' : `${validationResults.remainingErrors} issues remaining`}`,
        validationResults: {
          valid: validationResults.valid,
          errorsFixed: validationResults.errorsFixed,
          remainingErrors: validationResults.remainingErrors,
        },
      };
    } catch (error) {
      console.error('Validation and fix failed:', error);
      return {
        success: false,
        applied: false,
        message: `Validation and fix failed: ${error instanceof Error ? error.message : String(error)}`,
        validationResults: {
          valid: false,
          errorsFixed: 0,
          remainingErrors: -1,
        },
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      // Cleanup template directory
      try {
        await rm(templateDir, { recursive: true, force: true });
        console.log(`✓ Cleaned up template directory: ${templateDir}`);
      } catch (cleanupError) {
        console.warn('Failed to cleanup template directory:', cleanupError);
      }
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
  steps: [
    cloneTemplateStep,
    analyzePackageStep,
    discoverUnitsStep,
    orderUnitsStep,
    packageMergeStep,
    flatInstallStep,
    programmaticFileCopyStep,
    intelligentMergeStep,
    validationAndFixStep,
  ],
})
  .then(cloneTemplateStep)
  .parallel([analyzePackageStep, discoverUnitsStep])
  .map(async ({ getStepResult }) => {
    const discoverResult = getStepResult(discoverUnitsStep);
    return discoverResult;
  })
  .then(orderUnitsStep)
  .map(async ({ getStepResult, getInitData }) => {
    const cloneResult = getStepResult(cloneTemplateStep);
    const packageResult = getStepResult(analyzePackageStep);
    const initData = getInitData();

    return {
      commitSha: cloneResult.commitSha,
      slug: cloneResult.slug,
      targetPath: initData.targetPath,
      packageInfo: packageResult,
    };
  })
  .then(packageMergeStep)
  .map(async ({ getInitData }) => {
    const initData = getInitData();
    return {
      targetPath: initData.targetPath,
    };
  })
  .then(flatInstallStep)
  .map(async ({ getStepResult, getInitData }) => {
    const cloneResult = getStepResult(cloneTemplateStep);
    const orderResult = getStepResult(orderUnitsStep);
    const initData = getInitData();

    return {
      orderedUnits: orderResult.orderedUnits,
      templateDir: cloneResult.templateDir,
      commitSha: cloneResult.commitSha,
      slug: cloneResult.slug,
      targetPath: initData.targetPath,
    };
  })
  .then(programmaticFileCopyStep)
  .map(async ({ getStepResult, getInitData }) => {
    const copyResult = getStepResult(programmaticFileCopyStep);
    const cloneResult = getStepResult(cloneTemplateStep);
    const initData = getInitData();

    return {
      conflicts: copyResult.conflicts,
      copiedFiles: copyResult.copiedFiles,
      commitSha: cloneResult.commitSha,
      slug: cloneResult.slug,
      targetPath: initData.targetPath,
      templateDir: cloneResult.templateDir,
    };
  })
  .then(intelligentMergeStep)
  .map(async ({ getStepResult, getInitData }) => {
    const cloneResult = getStepResult(cloneTemplateStep);
    const orderResult = getStepResult(orderUnitsStep);
    const copyResult = getStepResult(programmaticFileCopyStep);
    const mergeResult = getStepResult(intelligentMergeStep);
    const initData = getInitData();

    return {
      commitSha: cloneResult.commitSha,
      slug: cloneResult.slug,
      targetPath: initData.targetPath,
      templateDir: cloneResult.templateDir,
      orderedUnits: orderResult.orderedUnits,
      copiedFiles: copyResult.copiedFiles,
      conflictsResolved: mergeResult.conflictsResolved,
    };
  })
  .then(validationAndFixStep)
  .map(async ({ getStepResult, getInitData }) => {
    const validationResult = getStepResult(validationAndFixStep);
    const intelligentMergeResult = getStepResult(intelligentMergeStep);
    const copyResult = getStepResult(programmaticFileCopyStep);
    const cloneResult = getStepResult(cloneTemplateStep);
    const initData = getInitData();

    // Ensure branchName is always present, with fallback logic
    const branchName =
      intelligentMergeResult.branchName || `feat/install-template-${cloneResult.slug || initData.slug}`;

    // Aggregate errors from all steps
    const allErrors = [copyResult.error, intelligentMergeResult.error, validationResult.error].filter(Boolean);

    // Determine overall success based on all step results
    const overallSuccess =
      copyResult.success !== false && intelligentMergeResult.success !== false && validationResult.success;

    // Create comprehensive message
    const messages = [];
    if (copyResult.copiedFiles?.length > 0) {
      messages.push(`${copyResult.copiedFiles.length} files copied`);
    }
    if (copyResult.conflicts?.length > 0) {
      messages.push(`${copyResult.conflicts.length} conflicts skipped`);
    }
    if (intelligentMergeResult.conflictsResolved?.length > 0) {
      messages.push(`${intelligentMergeResult.conflictsResolved.length} conflicts resolved`);
    }
    if (validationResult.validationResults?.errorsFixed > 0) {
      messages.push(`${validationResult.validationResults.errorsFixed} validation errors fixed`);
    }

    const comprehensiveMessage =
      messages.length > 0
        ? `Template merge completed: ${messages.join(', ')}`
        : validationResult.message || 'Template merge completed';

    return {
      success: overallSuccess,
      applied: validationResult.applied || copyResult.copiedFiles?.length > 0 || false,
      message: comprehensiveMessage,
      validationResults: validationResult.validationResults,
      error: allErrors.length > 0 ? allErrors.join('; ') : undefined,
      errors: allErrors.length > 0 ? allErrors : undefined,
      branchName,
      // Additional debugging info
      stepResults: {
        copySuccess: copyResult.success,
        mergeSuccess: intelligentMergeResult.success,
        validationSuccess: validationResult.success,
        filesCopied: copyResult.copiedFiles?.length || 0,
        conflictsSkipped: copyResult.conflicts?.length || 0,
        conflictsResolved: intelligentMergeResult.conflictsResolved?.length || 0,
      },
    };
  })
  .commit();

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
