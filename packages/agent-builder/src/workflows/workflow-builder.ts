import { existsSync } from 'fs';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { Agent } from '@mastra/core/agent';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { stepCountIs } from 'ai';
import { z } from 'zod';
import { AgentBuilder } from '../agent';
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

      const researchOutputSchema = z.object({
        coreConceptsLearned: z.string().describe('Key concepts about Mastra workflows'),
        bestPractices: z.string().describe('Best practices for workflow development'),
        relevantExamples: z.string().describe('Relevant code examples found'),
        technicalDetails: z.string().describe('Technical implementation details'),
        recommendations: z.string().describe('Specific recommendations for this project'),
      });

      const result = await researchAgent.generateVNext(researchPrompt, {
        output: researchOutputSchema,
        // stopWhen: stepCountIs(10),
      });

      const researchResult: z.infer<typeof researchOutputSchema> = await result.object;
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
    projectPath: z.string().optional(),
  }),
  outputSchema: TaskExecutionResultSchema,
  suspendSchema: z.object({
    questions: z.array(
      z.object({
        id: z.string(),
        question: z.string(),
        type: z.enum(['choice', 'text', 'boolean']),
        options: z.array(z.string()).optional(),
        context: z.string().optional(),
      }),
    ),
    currentProgress: z.string(),
    completedTasks: z.array(z.string()),
    message: z.string(),
  }),
  resumeSchema: z.object({
    answers: z.array(
      z.object({
        questionId: z.string(),
        answer: z.string(),
      }),
    ),
  }),
  execute: async ({ inputData, resumeData, suspend, runtimeContext }) => {
    const {
      action,
      workflowName,
      description,
      requirements,
      tasks,
      discoveredWorkflows,
      projectStructure,
      research,
      projectPath,
    } = inputData;

    console.log(`Starting task execution for ${action}ing workflow: ${workflowName}`);
    console.log(`Executing ${tasks.length} tasks using AgentBuilder stream...`);

    try {
      const currentProjectPath = projectPath || process.cwd();

      const executionAgent = new AgentBuilder({
        projectPath: currentProjectPath,
        model: resolveModel(runtimeContext),
        instructions: `You are executing a workflow ${action} task for: "${workflowName}"

CRITICAL WORKFLOW EXECUTION REQUIREMENTS:
1. **EXPLORE PROJECT STRUCTURE FIRST**: Use listDirectory and readFile tools to understand the existing project layout, folder structure, and conventions before creating any files
2. **FOLLOW PROJECT CONVENTIONS**: Look at existing workflows, agents, and file structures to understand where new files should be placed (typically src/mastra/workflows/, src/mastra/agents/, etc.)
3. **Use Task Management Tool**: Use the taskManager tool to track and manage your progress through the task list
4. **COMPLETE EVERY SINGLE TASK**: You MUST complete ALL ${tasks.length} tasks in the provided task list. Do not stop until every task is completed
5. **Follow Task Dependencies**: Execute tasks in the correct order, respecting dependencies
6. **Request User Input When Needed**: If you encounter choices (like email providers, databases, etc.) that require user decision, return questions for clarification
7. **Write Files in Correct Locations**: After exploring the project structure, place workflow files in the appropriate directories following the project's conventions

CRITICAL COMPLETION REQUIREMENTS: 
- ALWAYS explore the directory structure before creating files to understand where they should go
- You MUST complete ALL ${tasks.length} tasks before returning status='completed'
- Use the taskManager tool to track your progress and ensure no tasks are missed
- If you need to make any decisions during implementation (choosing providers, configurations, etc.), return questions for user clarification
- DO NOT make assumptions about file locations - explore first!
- The task list provided is the source of truth - you must complete every single task in it

PROJECT CONTEXT:
- Action: ${action}
- Workflow Name: ${workflowName}
- Description: ${description}
- Requirements: ${requirements}
- Project Path: ${currentProjectPath}
- Discovered Workflows: ${JSON.stringify(discoveredWorkflows, null, 2)}
- Project Structure: ${JSON.stringify(projectStructure, null, 2)}

AVAILABLE RESEARCH:
${JSON.stringify(research, null, 2)}

INITIAL TASK LIST:
${tasks.map(task => `- ${task.id}: ${task.content} (Priority: ${task.priority})`).join('\n')}

${resumeData ? `USER PROVIDED ANSWERS: ${JSON.stringify(resumeData.answers, null, 2)}` : ''}

Start by exploring the project structure, then use the taskManager tool to create your initial task list, and work through each task systematically.

CRITICAL VALIDATION INSTRUCTIONS:
- When using the validateCode tool, ALWAYS pass the specific files you created or modified using the 'files' parameter
- The validation will automatically filter results to only show errors from your files
- This prevents confusion from validation errors in unrelated project files
- Example: validateCode({ validationType: ['types', 'lint'], files: ['src/workflows/my-workflow.ts', 'src/agents/my-agent.ts'] })
- ALWAYS validate after creating or modifying files to ensure they compile correctly`,
      });

      // Create the execution prompt
      const executionPrompt = resumeData
        ? `Continue working on the task list. The user has provided answers to your questions: ${JSON.stringify(resumeData.answers, null, 2)}. 

CRITICAL: You must complete ALL ${tasks.length} tasks from the original task list. Use the taskManager tool to check your progress and continue with the next tasks. Do not stop until every single task is completed.`
        : `Begin executing the task list to ${action} the workflow "${workflowName}". 

CRITICAL REQUIREMENTS:
- You MUST complete ALL ${tasks.length} tasks in the provided task list
- Start by exploring the project directory structure using listDirectory and readFile tools to understand:
  - Where workflows are typically stored (look for src/mastra/workflows/ or similar)
  - What the existing file structure looks like
  - How other workflows are organized and named
  - Where agent files are stored if needed
- Then use the taskManager tool to set up your task list and work through each task systematically
- Ensure you place files in the correct locations
- DO NOT return status='completed' until ALL ${tasks.length} tasks are finished

CRITICAL VALIDATION INSTRUCTIONS:
- When using the validateCode tool, ALWAYS pass the specific files you created or modified using the 'files' parameter
- The validation will automatically filter results to only show errors from your files
- This prevents confusion from validation errors in unrelated project files
- Example: validateCode({ validationType: ['types', 'lint'], files: ['src/workflows/my-workflow.ts', 'src/agents/my-agent.ts'] })
- ALWAYS validate after creating or modifying files to ensure they compile correctly

TASK LIST TO COMPLETE (${tasks.length} total tasks):
${tasks.map((task, index) => `${index + 1}. [${task.id}] ${task.content}`).join('\n')}

You must complete every single one of these tasks before finishing.`;

      const originalInstructions = await executionAgent.getInstructions({ runtimeContext: runtimeContext });
      const additionalInstructions = executionAgent.instructions;

      let enhancedInstructions = originalInstructions as string;
      if (additionalInstructions) {
        enhancedInstructions = `${originalInstructions}\n\n${additionalInstructions}`;
      }

      const enhancedOptions = {
        stopWhen: stepCountIs(100),
        temperature: 0.3,
        instructions: enhancedInstructions,
      };

      // Loop until all tasks are completed
      let finalResult: any = null;
      let completedTaskIds: string[] = [];
      let allTasksCompleted = false;
      let iterationCount = 0;
      const maxIterations = 5; // Prevent infinite loops

      const expectedTaskIds = tasks.map(task => task.id);

      while (!allTasksCompleted && iterationCount < maxIterations) {
        iterationCount++;

        // Calculate remaining tasks
        const remainingTaskIds = expectedTaskIds.filter(taskId => !completedTaskIds.includes(taskId));
        const remainingTasks = tasks.filter(task => remainingTaskIds.includes(task.id));

        console.log(`\n=== EXECUTION ITERATION ${iterationCount} ===`);
        console.log(`Completed tasks: ${completedTaskIds.length}/${expectedTaskIds.length}`);
        console.log(`Remaining tasks: ${remainingTaskIds.join(', ')}`);

        // Create prompt for this iteration
        const iterationPrompt =
          iterationCount === 1
            ? executionPrompt
            : `Continue working on the remaining tasks. You have already completed these tasks: [${completedTaskIds.join(', ')}]

REMAINING TASKS TO COMPLETE (${remainingTasks.length} tasks):
${remainingTasks.map((task, index) => `${index + 1}. [${task.id}] ${task.content} (Priority: ${task.priority})`).join('\n')}

CRITICAL: You must complete ALL of these remaining ${remainingTasks.length} tasks. Do not stop until every single one is finished.

CRITICAL VALIDATION INSTRUCTIONS:
- When using the validateCode tool, ALWAYS pass the specific files you created or modified using the 'files' parameter
- The validation will automatically filter results to only show errors from your files
- This prevents confusion from validation errors in unrelated project files
- Example: validateCode({ validationType: ['types', 'lint'], files: ['src/workflows/my-workflow.ts', 'src/agents/my-agent.ts'] })
- ALWAYS validate after creating or modifying files to ensure they compile correctly

${resumeData ? `USER PROVIDED ANSWERS: ${JSON.stringify(resumeData.answers, null, 2)}` : ''}`;

        // Use stream to let the agent manage its own execution
        const stream = await executionAgent.streamVNext(iterationPrompt, {
          structuredOutput: {
            schema: z.object({
              status: z
                .enum(['in_progress', 'completed', 'needs_clarification'])
                .describe('Status - only use "completed" when ALL remaining tasks are finished'),
              progress: z.string().describe('Current progress description'),
              completedTasks: z
                .array(z.string())
                .describe('List of ALL completed task IDs (including previously completed ones)'),
              totalTasksRequired: z
                .number()
                .describe(`Total number of tasks that must be completed (should be ${tasks.length})`),
              tasksRemaining: z.array(z.string()).describe('List of task IDs that still need to be completed'),
              filesModified: z
                .array(z.string())
                .describe('List of files that were created or modified - use these exact paths for validateCode tool'),
              questions: z
                .array(
                  z.object({
                    id: z.string(),
                    question: z.string(),
                    type: z.enum(['choice', 'text', 'boolean']),
                    options: z.array(z.string()).optional(),
                    context: z.string().optional(),
                  }),
                )
                .optional()
                .describe('Questions for user if clarification is needed'),
              message: z.string().describe('Summary of work completed or current status'),
              error: z.string().optional().describe('Any errors encountered'),
            }),
            model: resolveModel(runtimeContext),
          },
          ...enhancedOptions,
        });

        // Process the stream and get the final result
        let finalMessage = '';
        for await (const chunk of stream.fullStream) {
          if (chunk.type === 'text-delta') {
            finalMessage += chunk.payload.text;
          }

          if (chunk.type === 'step-finish') {
            console.log(finalMessage);
            finalMessage = '';
          }

          if (chunk.type === 'tool-result') {
            console.log(chunk);
          }

          if (chunk.type === 'finish') {
            console.log(chunk);
          }
        }

        await stream.consumeStream();
        finalResult = await stream.object;

        console.log(`Iteration ${iterationCount} result:`, { finalResult });

        if (!finalResult) {
          throw new Error(`No result received from agent execution on iteration ${iterationCount}`);
        }

        // Update completed tasks
        completedTaskIds = finalResult.completedTasks || [];
        allTasksCompleted = expectedTaskIds.every(taskId => completedTaskIds.includes(taskId));

        console.log(
          `After iteration ${iterationCount}: ${completedTaskIds.length}/${expectedTaskIds.length} tasks completed`,
        );

        // If agent needs clarification, break out and suspend
        if (finalResult.status === 'needs_clarification' && finalResult.questions && finalResult.questions.length > 0) {
          console.log(
            `Agent needs clarification on iteration ${iterationCount}: ${finalResult.questions.length} questions`,
          );
          break;
        }

        // If agent claims completed but not all tasks are done, continue loop
        if (finalResult.status === 'completed' && !allTasksCompleted) {
          console.log(
            `Agent claimed completion but missing tasks: ${expectedTaskIds.filter(id => !completedTaskIds.includes(id)).join(', ')}`,
          );
          // Continue to next iteration
        }
      }

      if (iterationCount >= maxIterations && !allTasksCompleted) {
        finalResult.error = `Maximum iterations (${maxIterations}) reached but not all tasks completed`;
        finalResult.status = 'in_progress';
      }

      if (!finalResult) {
        throw new Error('No result received from agent execution');
      }

      // If the agent needs clarification, suspend the workflow
      if (finalResult.status === 'needs_clarification' && finalResult.questions && finalResult.questions.length > 0) {
        console.log(`Agent needs clarification: ${finalResult.questions.length} questions`);

        await suspend({
          questions: finalResult.questions,
          currentProgress: finalResult.progress,
          completedTasks: finalResult.completedTasks || [],
          message: finalResult.message,
        });

        // This return won't be reached due to suspension, but TypeScript needs it
        return {
          success: false,
          completedTasks: finalResult.completedTasks || [],
          filesModified: finalResult.filesModified || [],
          validationResults: {
            passed: false,
            errors: [],
            warnings: ['Workflow suspended for user clarification'],
          },
          message: 'Workflow suspended for user clarification',
        };
      }

      // Final validation after loop completion
      const tasksCompleted = completedTaskIds.length;
      const tasksExpected = expectedTaskIds.length;

      // Determine success based on loop results
      const success = allTasksCompleted && !finalResult.error;
      const message = success
        ? `Successfully completed workflow ${action} - all ${tasksExpected} tasks completed after ${iterationCount} iteration(s): ${finalResult.message}`
        : `Workflow execution finished with issues after ${iterationCount} iteration(s): ${finalResult.message}. Completed: ${tasksCompleted}/${tasksExpected} tasks`;

      console.log(message);

      // Build validation results with task completion details
      const missingTasks = expectedTaskIds.filter(taskId => !completedTaskIds.includes(taskId));
      const validationErrors = [];

      if (finalResult.error) {
        validationErrors.push(finalResult.error);
      }

      if (!allTasksCompleted) {
        validationErrors.push(
          `Incomplete tasks: ${missingTasks.join(', ')} (${tasksCompleted}/${tasksExpected} completed)`,
        );
      }

      return {
        success,
        completedTasks: finalResult.completedTasks || [],
        filesModified: finalResult.filesModified || [],
        validationResults: {
          passed: success,
          errors: validationErrors,
          warnings: allTasksCompleted ? [] : [`Missing ${missingTasks.length} tasks: ${missingTasks.join(', ')}`],
        },
        message,
        error: finalResult.error,
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
      allPreviousQuestions: [],
      allPreviousAnswers: {},
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
      projectPath: initData.projectPath || process.cwd(),
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
