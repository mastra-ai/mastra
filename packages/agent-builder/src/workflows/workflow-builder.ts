import { existsSync } from 'fs';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { Agent } from '@mastra/core/agent';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { AgentBuilderDefaults } from '../defaults';
import {
  WorkflowBuilderInputSchema,
  WorkflowBuilderResultSchema,
  WorkflowDiscoveryResultSchema,
  ProjectDiscoveryResultSchema,
  WorkflowResearchResultSchema,
  TaskExecutionResultSchema,
} from '../types';
import type { DiscoveredWorkflowSchema } from '../types';
import { resolveModel, initializeMcpTools } from '../utils';
import { planningAndApprovalWorkflow } from './task-planning';

// Step 1: Always discover existing workflows
const workflowDiscoveryStep = createStep({
  id: 'workflow-discovery',
  description: 'Discover existing workflows in the project',
  inputSchema: WorkflowBuilderInputSchema,
  outputSchema: WorkflowDiscoveryResultSchema,
  execute: async ({ inputData, runtimeContext: _runtimeContext }) => {
    console.log('Starting workflow discovery...');
    const { projectPath = process.cwd() } = inputData;

    try {
      // Check if workflows directory exists
      const workflowsPath = join(projectPath, 'src/mastra/workflows');
      if (!existsSync(workflowsPath)) {
        console.log('No workflows directory found');
        return {
          success: true,
          workflows: [],
          mastraIndexExists: existsSync(join(projectPath, 'src/mastra/index.ts')),
          message: 'No existing workflows found in the project',
        };
      }

      // Read workflow files directly
      const workflowFiles = await readdir(workflowsPath);
      const workflows: z.infer<typeof DiscoveredWorkflowSchema>[] = [];

      for (const fileName of workflowFiles) {
        if (fileName.endsWith('.ts') && !fileName.endsWith('.test.ts')) {
          const filePath = join(workflowsPath, fileName);
          try {
            const content = await readFile(filePath, 'utf-8');

            // Extract basic workflow info
            const nameMatch = content.match(/createWorkflow\s*\(\s*{\s*id:\s*['"]([^'"]+)['"]/);
            const descMatch = content.match(/description:\s*['"]([^'"]*)['"]/);

            if (nameMatch && nameMatch[1]) {
              workflows.push({
                name: nameMatch[1],
                file: filePath,
                description: descMatch?.[1] ?? 'No description available',
              });
            }
          } catch (error) {
            console.warn(`Failed to read workflow file ${filePath}:`, error);
          }
        }
      }

      console.log(`Discovered ${workflows.length} existing workflows`);
      return {
        success: true,
        workflows,
        mastraIndexExists: existsSync(join(projectPath, 'src/mastra/index.ts')),
        message:
          workflows.length > 0
            ? `Found ${workflows.length} existing workflow(s): ${workflows.map(w => w.name).join(', ')}`
            : 'No existing workflows found in the project',
      };
    } catch (error) {
      console.error('Workflow discovery failed:', error);
      return {
        success: false,
        workflows: [],
        mastraIndexExists: false,
        message: `Workflow discovery failed: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

// Step 2: Always discover project structure
const projectDiscoveryStep = createStep({
  id: 'project-discovery',
  description: 'Analyze the project structure and setup',
  inputSchema: WorkflowDiscoveryResultSchema,
  outputSchema: ProjectDiscoveryResultSchema,
  execute: async ({ inputData: _inputData, runtimeContext: _runtimeContext }) => {
    console.log('Starting project discovery...');

    try {
      // Get project structure - no need for AgentBuilder since we're just checking files
      const projectPath = process.cwd(); // Use current working directory as default
      const projectStructure = {
        hasPackageJson: existsSync(join(projectPath, 'package.json')),
        hasMastraConfig:
          existsSync(join(projectPath, 'mastra.config.js')) || existsSync(join(projectPath, 'mastra.config.ts')),
        hasSrcDirectory: existsSync(join(projectPath, 'src')),
        hasMastraDirectory: existsSync(join(projectPath, 'src/mastra')),
        hasWorkflowsDirectory: existsSync(join(projectPath, 'src/mastra/workflows')),
        hasToolsDirectory: existsSync(join(projectPath, 'src/mastra/tools')),
        hasAgentsDirectory: existsSync(join(projectPath, 'src/mastra/agents')),
      };

      // Read package.json if it exists
      let packageInfo = null;
      if (projectStructure.hasPackageJson) {
        try {
          const packageContent = await readFile(join(projectPath, 'package.json'), 'utf-8');
          packageInfo = JSON.parse(packageContent);
        } catch (error) {
          console.warn('Failed to read package.json:', error);
        }
      }

      console.log('Project discovery completed');
      return {
        success: true,
        structure: {
          hasWorkflowsDir: projectStructure.hasWorkflowsDirectory,
          hasAgentsDir: projectStructure.hasAgentsDirectory,
          hasToolsDir: projectStructure.hasToolsDirectory,
          hasMastraIndex: existsSync(join(projectPath, 'src/mastra/index.ts')),
          existingWorkflows: [],
          existingAgents: [],
          existingTools: [],
        },
        dependencies: packageInfo?.dependencies || {},
        message: 'Project discovery completed successfully',
      };
    } catch (error) {
      console.error('Project discovery failed:', error);
      return {
        success: false,
        structure: {
          hasWorkflowsDir: false,
          hasAgentsDir: false,
          hasToolsDir: false,
          hasMastraIndex: false,
          existingWorkflows: [],
          existingAgents: [],
          existingTools: [],
        },
        dependencies: {},
        message: 'Project discovery failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

// Step 3: Research what is needed to be done
const workflowResearchStep = createStep({
  id: 'workflow-research',
  description: 'Research Mastra workflows and gather relevant documentation',
  inputSchema: ProjectDiscoveryResultSchema,
  outputSchema: WorkflowResearchResultSchema,
  execute: async ({ inputData, runtimeContext }) => {
    console.log('Starting workflow research...');

    try {
      const filteredMcpTools = await initializeMcpTools();

      const researchAgent = new Agent({
        model: resolveModel(runtimeContext),
        instructions: `You are a Mastra workflow research expert. Your task is to gather relevant information about creating Mastra workflows.

RESEARCH OBJECTIVES:
1. **Core Concepts**: Understand how Mastra workflows work
2. **Best Practices**: Learn workflow patterns and conventions  
3. **Code Examples**: Find relevant implementation examples
4. **Technical Details**: Understand schemas, steps, and configuration

Use the available documentation and examples tools to gather comprehensive information about Mastra workflows.`,
        name: 'Workflow Research Agent',
        tools: filteredMcpTools,
      });

      const researchPrompt = `Research everything about Mastra workflows to help create or edit them effectively.

PROJECT CONTEXT:
- Project Structure: ${JSON.stringify(inputData.structure, null, 2)}
- Dependencies: ${JSON.stringify(inputData.dependencies, null, 2)}
- Has Workflows Directory: ${inputData.structure.hasWorkflowsDir}

Focus on:
1. How to create workflows using createWorkflow()
2. How to create and chain workflow steps
3. Best practices for workflow organization
4. Common workflow patterns and examples
5. Schema definitions and types
6. Error handling and debugging

Use the docs and examples tools to gather comprehensive information.`;

      const result = await researchAgent.generate(researchPrompt, {
        output: z.object({
          coreConceptsLearned: z.string().describe('Key concepts about Mastra workflows'),
          bestPractices: z.string().describe('Best practices for workflow development'),
          relevantExamples: z.string().describe('Relevant code examples found'),
          technicalDetails: z.string().describe('Technical implementation details'),
          recommendations: z.string().describe('Specific recommendations for this project'),
        }),
        maxSteps: 10,
      });

      const researchResult = result.object;
      if (!researchResult) {
        return {
          success: false,
          documentation: {
            workflowPatterns: [],
            stepExamples: [],
            bestPractices: [],
          },
          webResources: [],
          message: 'Research agent failed to generate valid response',
          error: 'Research agent failed to generate valid response',
        };
      }

      console.log('Research completed successfully');
      return {
        success: true,
        documentation: {
          workflowPatterns: researchResult.bestPractices.split('\n').filter(line => line.trim()),
          stepExamples: researchResult.relevantExamples.split('\n').filter(line => line.trim()),
          bestPractices: researchResult.recommendations.split('\n').filter(line => line.trim()),
        },
        webResources: [],
        message: 'Research completed successfully',
      };
    } catch (error) {
      console.error('Workflow research failed:', error);
      return {
        success: false,
        documentation: {
          workflowPatterns: [],
          stepExamples: [],
          bestPractices: [],
        },
        webResources: [],
        message: 'Research failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

// Task execution step remains the same
const taskExecutionStep = createStep({
  id: 'task-execution',
  description: 'Execute the approved task list to create or edit the workflow',
  inputSchema: z.object({
    action: z.enum(['create', 'edit']),
    workflowName: z.string().optional(),
    description: z.string().optional(),
    requirements: z.string().optional(),
    tasks: z.array(
      z.object({
        id: z.string(),
        content: z.string(),
        status: z.enum(['pending', 'in_progress', 'completed', 'blocked']),
        priority: z.enum(['high', 'medium', 'low']),
        dependencies: z.array(z.string()).optional(),
        notes: z.string().optional(),
      }),
    ),
    discoveredWorkflows: z.array(z.any()),
    projectStructure: z.any(),
    research: z.any(),
  }),
  outputSchema: TaskExecutionResultSchema,
  execute: async ({ inputData, runtimeContext }) => {
    const { action, workflowName, description, requirements, tasks, discoveredWorkflows, projectStructure, research } =
      inputData;

    console.log(`Starting task execution for ${action}ing workflow: ${workflowName}`);
    console.log(`Executing ${tasks.length} tasks...`);

    try {
      const tools = await AgentBuilderDefaults.DEFAULT_TOOLS(process.cwd());
      const mcpTools = await initializeMcpTools();

      const executionAgent = new Agent({
        model: resolveModel(runtimeContext),
        instructions: `You are a Mastra workflow implementation expert. Your task is to execute the approved task list to ${action} a workflow.

EXECUTION GUIDELINES:
1. **Follow the Task List**: Execute each task in the correct order, respecting dependencies
2. **Use Available Tools**: Use the provided file system and code tools to implement the workflow
3. **Request User Input for Decisions**: If you encounter choices (like email providers, databases, etc.), 
   USE THE SUSPEND/RESUME PATTERN TO ASK THE USER FOR CLARIFICATION. Do not make assumptions.
4. **Write Clean Code**: Follow Mastra best practices and conventions
5. **Handle Errors**: Report any issues clearly and suggest solutions
6. **Complete All Tasks**: Work through the entire task list systematically

CRITICAL: If you need to make any decisions during implementation (choosing providers, configurations, etc.), 
you must suspend the workflow and ask the user for input. DO NOT make assumptions.

AVAILABLE RESEARCH:
${JSON.stringify(research, null, 2)}

PROJECT CONTEXT:
- Action: ${action}
- Workflow Name: ${workflowName}
- Description: ${description}
- Requirements: ${requirements}
- Discovered Workflows: ${JSON.stringify(discoveredWorkflows, null, 2)}
- Project Structure: ${JSON.stringify(projectStructure, null, 2)}

Execute all tasks systematically and report progress.`,
        name: 'Workflow Execution Agent',
        tools: {
          ...tools,
          docs: mcpTools.docs || null,
          examples: mcpTools.examples || null,
        },
      });

      const completedTasks: string[] = [];
      const failedTasks: string[] = [];
      let currentTaskIndex = 0;

      // Execute tasks one by one until all are completed
      while (currentTaskIndex < tasks.length) {
        const task = tasks[currentTaskIndex];

        if (!task) {
          currentTaskIndex++;
          continue;
        }

        if (task.status === 'completed') {
          currentTaskIndex++;
          continue;
        }

        // Check dependencies
        const hasUnmetDependencies = task.dependencies?.some(depId => !completedTasks.includes(depId));

        if (hasUnmetDependencies) {
          // Skip this task for now, try next one
          currentTaskIndex++;
          continue;
        }

        console.log(`Executing task ${currentTaskIndex + 1}/${tasks.length}: ${task.content}`);

        try {
          const taskPrompt = `Execute this specific task:

TASK: ${task.content}
PRIORITY: ${task.priority}
NOTES: ${task.notes || 'None'}
DEPENDENCIES: ${task.dependencies?.join(', ') || 'None'}

Context from previous completed tasks: ${completedTasks.join(', ')}

Execute this task completely and report when done. If you need user input for any decisions, 
explain what decision needs to be made and request clarification.`;

          const taskResult = await executionAgent.generate(taskPrompt, {
            output: z.object({
              taskCompleted: z.boolean().describe('Whether the task was fully completed'),
              workDone: z.string().describe('Description of work completed'),
              filesModified: z.array(z.string()).describe('List of files that were created or modified'),
              issuesEncountered: z.string().optional().describe('Any issues or blockers encountered'),
              nextSteps: z.string().optional().describe('What needs to happen next if task is not complete'),
            }),
            maxSteps: 20,
          });

          const result = taskResult.object;
          if (result?.taskCompleted) {
            completedTasks.push(task.id);
            console.log(`✅ Task completed: ${task.content}`);
          } else {
            failedTasks.push(task.id);
            console.log(`❌ Task failed: ${task.content} - ${result?.issuesEncountered || 'Unknown error'}`);
          }
        } catch (error) {
          console.error(`Task execution failed for: ${task.content}`, error);
          failedTasks.push(task.id);
        }

        currentTaskIndex++;
      }

      const success = failedTasks.length === 0;
      const message = success
        ? `Successfully executed all ${completedTasks.length} tasks to ${action} the workflow`
        : `Completed ${completedTasks.length}/${tasks.length} tasks. Failed tasks: ${failedTasks.join(', ')}`;

      console.log(message);
      return {
        success,
        completedTasks,
        filesModified: [], // Would track actual files modified during execution
        validationResults: {
          passed: success,
          errors: failedTasks.map(id => `Task ${id} failed`),
          warnings: [],
        },
        message,
      };
    } catch (error) {
      console.error('Task execution failed:', error);
      return {
        success: false,
        completedTasks: [],
        filesModified: [],
        validationResults: {
          passed: false,
          errors: [`Task execution failed: ${error instanceof Error ? error.message : String(error)}`],
          warnings: [],
        },
        message: `Task execution failed: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

// Main Workflow Builder Workflow
export const workflowBuilderWorkflow = createWorkflow({
  id: 'workflow-builder',
  description: 'Create or edit Mastra workflows using AI-powered assistance with iterative planning',
  inputSchema: WorkflowBuilderInputSchema,
  outputSchema: WorkflowBuilderResultSchema,
  steps: [
    workflowDiscoveryStep,
    projectDiscoveryStep,
    workflowResearchStep,
    planningAndApprovalWorkflow,
    taskExecutionStep,
  ],
})
  // Step 1: Always discover existing workflows
  .then(workflowDiscoveryStep)
  // Step 2: Always discover project structure
  .then(projectDiscoveryStep)
  // Step 3: Research workflows and documentation
  .then(workflowResearchStep)
  // Map research result to planning input format
  .map(async ({ getStepResult, getInitData }) => {
    const initData = getInitData();
    const discoveryResult = getStepResult(workflowDiscoveryStep);
    const projectResult = getStepResult(projectDiscoveryStep);
    const researchResult = getStepResult(workflowResearchStep);

    return {
      action: initData.action,
      workflowName: initData.workflowName,
      description: initData.description,
      requirements: initData.requirements,
      discoveredWorkflows: discoveryResult.workflows,
      projectStructure: projectResult,
      research: researchResult,
      previousPlan: undefined,
      userAnswers: undefined,
    };
  })
  // Step 4: Planning and Approval Sub-workflow (loops until approved)
  .dountil(planningAndApprovalWorkflow, async ({ inputData }) => {
    // Continue looping until user approves the task list
    console.log(`Sub-workflow check: approved=${inputData.approved}`);
    return inputData.approved === true;
  })
  // Map sub-workflow result to task execution input
  .map(async ({ getStepResult, getInitData }) => {
    const initData = getInitData();
    const discoveryResult = getStepResult(workflowDiscoveryStep);
    const projectResult = getStepResult(projectDiscoveryStep);
    const researchResult = getStepResult(workflowResearchStep);
    const subWorkflowResult = getStepResult(planningAndApprovalWorkflow);

    return {
      action: initData.action,
      workflowName: initData.workflowName,
      description: initData.description,
      requirements: initData.requirements,
      tasks: subWorkflowResult.tasks,
      discoveredWorkflows: discoveryResult.workflows,
      projectStructure: projectResult,
      research: researchResult,
    };
  })
  // Step 5: Execute the approved tasks
  .then(taskExecutionStep)
  .commit();

// Helper function to create a workflow
export async function createWorkflowWithBuilder(
  workflowName: string,
  description: string,
  requirements: string,
  projectPath: string,
) {
  console.log(`Creating workflow: ${workflowName}`);

  // This would be called by the CLI or other entry points
  // The actual workflow execution would be handled by the Mastra engine
  return {
    workflowName,
    description,
    requirements,
    projectPath,
    action: 'create' as const,
  };
}

// Helper function to edit a workflow
export async function editWorkflowWithBuilder(
  workflowName: string,
  description: string,
  requirements: string,
  projectPath: string,
) {
  console.log(`Editing workflow: ${workflowName}`);

  return {
    workflowName,
    description,
    requirements,
    projectPath,
    action: 'edit' as const,
  };
}
