import { createWorkflow, createStep, Agent } from '@mastra/core';
import { z } from 'zod';
import { PlanningIterationInputSchema, PlanningIterationResultSchema } from '../types';
import { resolveModel, initializeMcpTools } from '../utils';

// Planning iteration step (with questions and user answers)
const planningIterationStep = createStep({
  id: 'planning-iteration',
  description: 'Create or refine task plan with user input',
  inputSchema: PlanningIterationInputSchema,
  outputSchema: PlanningIterationResultSchema,
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
    message: z.string(),
    currentPlan: z.object({
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
      reasoning: z.string(),
    }),
  }),
  resumeSchema: z.object({
    answers: z.record(z.string()),
  }),
  execute: async ({ inputData, resumeData, suspend, runtimeContext }) => {
    const {
      action,
      workflowName,
      description,
      requirements,
      discoveredWorkflows,
      projectStructure,
      research,
      previousPlan,
      userAnswers,
    } = inputData;

    console.log('Starting planning iteration...');

    try {
      const filteredMcpTools = await initializeMcpTools();

      const planningAgent = new Agent({
        model: resolveModel(runtimeContext),
        instructions: `You are a Mastra workflow planning expert. Your task is to create a detailed, executable task plan.

PLANNING RESPONSIBILITIES:
1. **Analyze Requirements**: Review the user's description and requirements thoroughly
2. **Identify Decision Points**: Find any choices that require user input (email providers, databases, APIs, etc.)
3. **Create Specific Tasks**: Generate concrete, actionable tasks with clear implementation notes
4. **Ask Clarifying Questions**: If any decisions are unclear, formulate specific questions for the user 
- do not ask about package managers
- Assume the user is going to use zod for validation
- You do not need to ask questions if you have none
5. **Incorporate Feedback**: Use any previous answers or feedback to refine the plan

${previousPlan ? `PREVIOUS PLAN CONTEXT:\nTasks: ${JSON.stringify(previousPlan.tasks, null, 2)}\nQuestions: ${JSON.stringify(previousPlan.questions, null, 2)}\nReasoning: ${previousPlan.reasoning}` : ''}

${userAnswers ? `USER ANSWERS: ${JSON.stringify(userAnswers, null, 2)}` : ''}

Based on the context and any user answers, create or refine the task plan.`,
        name: 'Workflow Planning Agent',
        tools: filteredMcpTools,
      });

      // Use answers from resume data if available, otherwise use provided user answers
      const currentUserAnswers = resumeData?.answers || userAnswers;

      // Check if we have user feedback from rejected task list in input data
      const hasTaskFeedback = userAnswers && userAnswers.taskFeedback;

      const planningPrompt =
        previousPlan || currentUserAnswers
          ? `Refine the existing task plan based on the user's answers. 

USER'S ANSWERS: ${JSON.stringify(currentUserAnswers, null, 2)}

REQUIREMENTS:
- Action: ${action}
- Workflow Name: ${workflowName || 'To be determined'}
- Description: ${description || 'Not specified'}
- Requirements: ${requirements || 'Not specified'}

PROJECT CONTEXT:
- Discovered Workflows: ${JSON.stringify(discoveredWorkflows, null, 2)}
- Project Structure: ${JSON.stringify(projectStructure, null, 2)}
- Research: ${JSON.stringify(research, null, 2)}

${hasTaskFeedback ? `\nUSER FEEDBACK ON PREVIOUS TASK LIST:\n${userAnswers.taskFeedback}\n\nPLEASE INCORPORATE THIS FEEDBACK INTO THE REFINED TASK LIST.` : ''}

Refine the task list and determine if any additional questions are needed.`
          : `Create an initial task plan for ${action}ing a Mastra workflow.

REQUIREMENTS:
- Action: ${action}
- Workflow Name: ${workflowName || 'To be determined'}
- Description: ${description || 'Not specified'}  
- Requirements: ${requirements || 'Not specified'}

PROJECT CONTEXT:
- Discovered Workflows: ${JSON.stringify(discoveredWorkflows, null, 2)}
- Project Structure: ${JSON.stringify(projectStructure, null, 2)}
- Research: ${JSON.stringify(research, null, 2)}

Create specific tasks and identify any questions that need user clarification.`;

      const result = await planningAgent.generate(planningPrompt, {
        output: z.object({
          tasks: z.array(
            z.object({
              id: z.string().describe('Unique task ID using kebab-case'),
              content: z.string().describe('Specific, actionable task description'),
              status: z.enum(['pending', 'in_progress', 'completed', 'blocked']).default('pending'),
              priority: z.enum(['high', 'medium', 'low']).describe('Task priority'),
              dependencies: z.array(z.string()).optional().describe('IDs of tasks this depends on'),
              notes: z.string().describe('Detailed implementation notes and specifics'),
            }),
          ),
          questions: z
            .array(
              z.object({
                id: z.string().describe('Unique question ID'),
                question: z.string().describe('Clear, specific question for the user'),
                type: z.enum(['choice', 'text', 'boolean']).describe('Type of answer expected'),
                options: z.array(z.string()).optional().describe('Options for choice questions'),
                context: z.string().optional().describe('Additional context or explanation'),
              }),
            )
            .optional(),
          reasoning: z.string().describe('Explanation of the plan and any questions'),
          planComplete: z.boolean().describe('Whether the plan is ready for execution (no more questions)'),
        }),
        maxSteps: 15,
      });

      const planResult = result.object;
      if (!planResult) {
        return {
          tasks: [],
          success: false,
          questions: [],
          reasoning: 'Planning agent failed to generate a valid response',
          planComplete: false,
          message: 'Planning failed',
        };
      }

      // If we have questions and plan is not complete, suspend for user input
      if (planResult.questions && planResult.questions.length > 0 && !planResult.planComplete) {
        console.log(`Planning needs user clarification: ${planResult.questions.length} questions`);

        await suspend({
          questions: planResult.questions,
          message: `Please answer ${planResult.questions.length} question(s) to finalize the workflow plan:`,
          currentPlan: {
            tasks: planResult.tasks,
            reasoning: planResult.reasoning,
          },
        });

        return {
          tasks: planResult.tasks,
          success: false,
          questions: planResult.questions,
          reasoning: planResult.reasoning,
          planComplete: false,
          message: `Planning suspended for user clarification on ${planResult.questions.length} questions`,
        };
      }

      // Plan is complete
      console.log(`Planning complete with ${planResult.tasks.length} tasks`);
      return {
        tasks: planResult.tasks,
        success: true,
        questions: [],
        reasoning: planResult.reasoning,
        planComplete: true,
        message: `Successfully created ${planResult.tasks.length} tasks`,
      };
    } catch (error) {
      console.error('Planning iteration failed:', error);
      return {
        tasks: [],
        success: false,
        questions: [],
        reasoning: `Planning failed: ${error instanceof Error ? error.message : String(error)}`,
        planComplete: false,
        message: 'Planning iteration failed',
      };
    }
  },
});

// Task approval step
const taskApprovalStep = createStep({
  id: 'task-approval',
  description: 'Get user approval for the final task list',
  inputSchema: PlanningIterationResultSchema,
  outputSchema: z.object({
    approved: z.boolean(),
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
    message: z.string(),
    userFeedback: z.string().optional(),
  }),
  suspendSchema: z.object({
    taskList: z.array(
      z.object({
        id: z.string(),
        content: z.string(),
        priority: z.enum(['high', 'medium', 'low']),
        dependencies: z.array(z.string()).optional(),
        notes: z.string().optional(),
      }),
    ),
    summary: z.string(),
    message: z.string(),
  }),
  resumeSchema: z.object({
    approved: z.boolean(),
    modifications: z.string().optional(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    const { tasks } = inputData;

    // If no resume data, suspend for user approval
    if (!resumeData?.approved && resumeData?.approved !== false) {
      console.log(`Requesting user approval for ${tasks.length} tasks`);

      const summary = `Task List for Approval:

${tasks.length} tasks planned:
${tasks.map((task, i) => `${i + 1}. [${task.priority.toUpperCase()}] ${task.content}${task.dependencies?.length ? ` (depends on: ${task.dependencies.join(', ')})` : ''}\n   Notes: ${task.notes || 'None'}`).join('\n')}`;

      await suspend({
        taskList: tasks,
        summary,
        message: `Please review the task list above. Does this look good to proceed with implementation?`,
      });

      return {
        approved: false,
        tasks,
        message: 'Awaiting user approval of task list',
      };
    }

    // User responded
    if (resumeData.approved) {
      console.log('Task list approved by user');
      return {
        approved: true,
        tasks,
        message: 'Task list approved, ready for execution',
      };
    } else {
      console.log('Task list rejected by user');
      return {
        approved: false,
        tasks,
        message: 'Task list rejected',
        userFeedback: resumeData.modifications,
      };
    }
  },
});

// Sub-workflow: Planning and Approval Cycle
export const planningAndApprovalWorkflow = createWorkflow({
  id: 'planning-and-approval',
  description: 'Handle iterative planning with questions and task list approval',
  inputSchema: PlanningIterationInputSchema,
  outputSchema: z.object({
    approved: z.boolean(),
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
    message: z.string(),
    userFeedback: z.string().optional(),
  }),
  steps: [planningIterationStep, taskApprovalStep],
})
  // Step 1: Planning iteration (with questions suspension)
  .dountil(planningIterationStep, async ({ inputData }) => {
    console.log(`Sub-workflow planning check: planComplete=${inputData.planComplete}`);
    return inputData.planComplete === true;
  })
  // Map to approval step input format
  .map(async ({ inputData }) => {
    // After doUntil completes, inputData contains the final result
    return {
      tasks: inputData.tasks || [],
      success: inputData.success || false,
      questions: inputData.questions || [],
      reasoning: inputData.reasoning || '',
      planComplete: inputData.planComplete || false,
      message: inputData.message || '',
    };
  })
  // Step 2: Task list approval
  .then(taskApprovalStep)
  .commit();
