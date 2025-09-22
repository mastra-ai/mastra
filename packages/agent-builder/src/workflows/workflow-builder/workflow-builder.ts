import { existsSync } from 'fs';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { Agent } from '@mastra/core/agent';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { stepCountIs } from 'ai';
import type { z } from 'zod';
import { AgentBuilder } from '../../agent';
import { AgentBuilderDefaults } from '../../defaults';
import { resolveModel } from '../../utils';
import { planningAndApprovalWorkflow } from '../task-planning/task-planning';
import { workflowBuilderPrompts, workflowResearch as research } from './prompts';
import {
  WorkflowBuilderInputSchema,
  WorkflowBuilderResultSchema,
  WorkflowDiscoveryResultSchema,
  ProjectDiscoveryResultSchema,
  WorkflowResearchResultSchema,
  TaskExecutionResultSchema,
  TaskExecutionInputSchema,
  TaskExecutionResumeSchema,
  TaskExecutionSuspendSchema,
  TaskExecutionIterationInputSchema,
} from './schema';
import type { DiscoveredWorkflowSchema } from './schema';
import { restrictedTaskManager } from './tools';

// Step 1: Always discover existing workflows
const workflowDiscoveryStep = createStep({
  id: 'workflow-discovery',
  description: 'Discover existing workflows in the project',
  inputSchema: WorkflowBuilderInputSchema,
  outputSchema: WorkflowDiscoveryResultSchema,
  execute: async ({ inputData, runtimeContext: _runtimeContext }) => {
    console.info('Starting workflow discovery...');
    const { projectPath = process.cwd() } = inputData;

    try {
      // Check if workflows directory exists
      const workflowsPath = join(projectPath, 'src/mastra/workflows');
      if (!existsSync(workflowsPath)) {
        console.info('No workflows directory found');
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

      console.info(`Discovered ${workflows.length} existing workflows`);
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
    console.info('Starting project discovery...');

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

      console.info('Project discovery completed');
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
    console.info('Starting workflow research...');

    try {
      // const filteredMcpTools = await initializeMcpTools();

      const model = await resolveModel({ runtimeContext });

      const researchAgent = new Agent({
        model,
        instructions: workflowBuilderPrompts.researchAgent.instructions,
        name: 'Workflow Research Agent',
        // tools: filteredMcpTools,
      });

      const researchPrompt = workflowBuilderPrompts.researchAgent.prompt({
        projectStructure: inputData.structure,
        dependencies: inputData.dependencies,
        hasWorkflowsDir: inputData.structure.hasWorkflowsDir,
      });

      const result = await researchAgent.generateVNext(researchPrompt, {
        output: WorkflowResearchResultSchema,
        // stopWhen: stepCountIs(10),
      });

      const researchResult = await result.object;
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

      console.info('Research completed successfully');
      return {
        success: true,
        documentation: {
          workflowPatterns: researchResult.documentation.workflowPatterns,
          stepExamples: researchResult.documentation.stepExamples,
          bestPractices: researchResult.documentation.bestPractices,
        },
        webResources: researchResult.webResources,
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
  inputSchema: TaskExecutionInputSchema,
  outputSchema: TaskExecutionResultSchema,
  suspendSchema: TaskExecutionSuspendSchema,
  resumeSchema: TaskExecutionResumeSchema,
  execute: async ({ inputData, resumeData, suspend, runtimeContext }) => {
    const {
      action,
      workflowName,
      description: _description,
      requirements: _requirements,
      tasks,
      discoveredWorkflows,
      projectStructure,
      research,
      projectPath,
    } = inputData;

    console.info(`Starting task execution for ${action}ing workflow: ${workflowName}`);
    console.info(`Executing ${tasks.length} tasks using AgentBuilder stream...`);

    try {
      const model = await resolveModel({ runtimeContext });
      const currentProjectPath = projectPath || process.cwd();

      // Pre-populate taskManager with the planned tasks
      console.info('Pre-populating taskManager with planned tasks...');
      const taskManagerContext = {
        action: 'create' as const,
        tasks: tasks.map(task => ({
          id: task.id,
          content: task.content,
          status: 'pending' as const,
          priority: task.priority,
          dependencies: task.dependencies,
          notes: task.notes,
        })),
      };

      const taskManagerResult = await AgentBuilderDefaults.manageTaskList(taskManagerContext);
      console.info(`Task manager initialized with ${taskManagerResult.tasks.length} tasks`);

      if (!taskManagerResult.success) {
        throw new Error(`Failed to initialize task manager: ${taskManagerResult.message}`);
      }

      const executionAgent = new AgentBuilder({
        projectPath: currentProjectPath,
        model,
        tools: {
          'task-manager': restrictedTaskManager,
        },
        instructions: `${workflowBuilderPrompts.executionAgent.instructions({
          action,
          workflowName,
          tasksLength: tasks.length,
          currentProjectPath,
          discoveredWorkflows,
          projectStructure,
          research,
          tasks,
          resumeData,
        })}

${workflowBuilderPrompts.validation.instructions}`,
      });

      const executionPrompt = workflowBuilderPrompts.executionAgent.prompt({
        action,
        workflowName,
        tasks,
        resumeData,
      });

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
      let allTasksCompleted = false;
      let iterationCount = 0;
      const maxIterations = 5;

      const expectedTaskIds = tasks.map(task => task.id);

      while (!allTasksCompleted && iterationCount < maxIterations) {
        iterationCount++;

        const currentTaskStatus = await AgentBuilderDefaults.manageTaskList({ action: 'list' });
        const completedTasks = currentTaskStatus.tasks.filter(task => task.status === 'completed');
        const pendingTasks = currentTaskStatus.tasks.filter(task => task.status !== 'completed');

        console.info(`\n=== EXECUTION ITERATION ${iterationCount} ===`);
        console.info(`Completed tasks: ${completedTasks.length}/${expectedTaskIds.length}`);
        console.info(`Remaining tasks: ${pendingTasks.map(t => t.id).join(', ')}`);

        // Check if all tasks are completed
        allTasksCompleted = pendingTasks.length === 0;

        if (allTasksCompleted) {
          console.info('All tasks completed! Breaking execution loop.');
          break;
        }

        // Create prompt for this iteration
        const iterationPrompt =
          iterationCount === 1
            ? executionPrompt
            : `${workflowBuilderPrompts.executionAgent.iterationPrompt({
                completedTasks,
                pendingTasks,
                workflowName,
                resumeData,
              })}

${workflowBuilderPrompts.validation.instructions}`;

        const stream = await executionAgent.streamVNext(iterationPrompt, {
          structuredOutput: {
            schema: TaskExecutionIterationInputSchema(tasks.length),
            model,
          },
          ...enhancedOptions,
        });

        let finalMessage = '';
        for await (const chunk of stream.fullStream) {
          if (chunk.type === 'text-delta') {
            finalMessage += chunk.payload.text;
          }

          if (chunk.type === 'step-finish') {
            console.info(finalMessage);
            finalMessage = '';
          }

          if (chunk.type === 'tool-result') {
            console.info(JSON.stringify(chunk, null, 2));
          }

          if (chunk.type === 'finish') {
            console.info(chunk);
          }
        }

        await stream.consumeStream();
        finalResult = await stream.object;

        console.info(`Iteration ${iterationCount} result:`, { finalResult });

        if (!finalResult) {
          throw new Error(`No result received from agent execution on iteration ${iterationCount}`);
        }

        const postIterationTaskStatus = await AgentBuilderDefaults.manageTaskList({ action: 'list' });
        const postCompletedTasks = postIterationTaskStatus.tasks.filter(task => task.status === 'completed');
        const postPendingTasks = postIterationTaskStatus.tasks.filter(task => task.status !== 'completed');

        allTasksCompleted = postPendingTasks.length === 0;

        console.info(
          `After iteration ${iterationCount}: ${postCompletedTasks.length}/${expectedTaskIds.length} tasks completed in taskManager`,
        );

        // If agent needs clarification, break out and suspend
        if (finalResult.status === 'needs_clarification' && finalResult.questions && finalResult.questions.length > 0) {
          console.info(
            `Agent needs clarification on iteration ${iterationCount}: ${finalResult.questions.length} questions`,
          );
          break;
        }

        // If agent claims completed but taskManager shows pending tasks, continue loop
        if (finalResult.status === 'completed' && !allTasksCompleted) {
          console.info(
            `Agent claimed completion but taskManager shows pending tasks: ${postPendingTasks.map(t => t.id).join(', ')}`,
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
        console.info(`Agent needs clarification: ${finalResult.questions.length} questions`);

        console.info('finalResult', JSON.stringify(finalResult, null, 2));
        return suspend({
          questions: finalResult.questions,
          currentProgress: finalResult.progress,
          completedTasks: finalResult.completedTasks || [],
          message: finalResult.message,
        });
      }

      const finalTaskStatus = await AgentBuilderDefaults.manageTaskList({ action: 'list' });
      const finalCompletedTasks = finalTaskStatus.tasks.filter(task => task.status === 'completed');
      const finalPendingTasks = finalTaskStatus.tasks.filter(task => task.status !== 'completed');

      const tasksCompleted = finalCompletedTasks.length;
      const tasksExpected = expectedTaskIds.length;
      const finalAllTasksCompleted = finalPendingTasks.length === 0;

      const success = finalAllTasksCompleted && !finalResult.error;
      const message = success
        ? `Successfully completed workflow ${action} - all ${tasksExpected} tasks completed after ${iterationCount} iteration(s): ${finalResult.message}`
        : `Workflow execution finished with issues after ${iterationCount} iteration(s): ${finalResult.message}. Completed: ${tasksCompleted}/${tasksExpected} tasks`;

      console.info(message);

      const missingTasks = finalPendingTasks.map(task => task.id);
      const validationErrors = [];

      if (finalResult.error) {
        validationErrors.push(finalResult.error);
      }

      if (!finalAllTasksCompleted) {
        validationErrors.push(
          `Incomplete tasks: ${missingTasks.join(', ')} (${tasksCompleted}/${tasksExpected} completed)`,
        );
      }

      return {
        success,
        completedTasks: finalCompletedTasks.map(task => task.id),
        filesModified: finalResult.filesModified || [],
        validationResults: {
          passed: success,
          errors: validationErrors,
          warnings: finalAllTasksCompleted ? [] : [`Missing ${missingTasks.length} tasks: ${missingTasks.join(', ')}`],
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
    // const researchResult = getStepResult(workflowResearchStep);

    return {
      action: initData.action,
      workflowName: initData.workflowName,
      description: initData.description,
      requirements: initData.requirements,
      discoveredWorkflows: discoveryResult.workflows,
      projectStructure: projectResult,
      // research: researchResult,
      research,

      userAnswers: undefined,
    };
  })
  // Step 4: Planning and Approval Sub-workflow (loops until approved)
  .dountil(planningAndApprovalWorkflow, async ({ inputData }) => {
    // Continue looping until user approves the task list
    console.info(`Sub-workflow check: approved=${inputData.approved}`);
    return inputData.approved === true;
  })
  // Map sub-workflow result to task execution input
  .map(async ({ getStepResult, getInitData }) => {
    const initData = getInitData();
    const discoveryResult = getStepResult(workflowDiscoveryStep);
    const projectResult = getStepResult(projectDiscoveryStep);
    // const researchResult = getStepResult(workflowResearchStep);
    const subWorkflowResult = getStepResult(planningAndApprovalWorkflow);

    return {
      action: initData.action,
      workflowName: initData.workflowName,
      description: initData.description,
      requirements: initData.requirements,
      tasks: subWorkflowResult.tasks,
      discoveredWorkflows: discoveryResult.workflows,
      projectStructure: projectResult,
      // research: researchResult,
      research,
      projectPath: initData.projectPath || process.cwd(),
    };
  })
  // Step 5: Execute the approved tasks
  .then(taskExecutionStep)
  .commit();
