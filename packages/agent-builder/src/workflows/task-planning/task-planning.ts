import { Agent } from '@mastra/core/agent';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { resolveModel } from '../../utils';
import { PlanningIterationResultSchema } from '../shared/schema';
import { taskPlanningPrompts } from './prompts';
import {
  PlanningAgentOutputSchema,
  PlanningIterationInputSchema,
  PlanningIterationResumeSchema,
  PlanningIterationSuspendSchema,
  TaskApprovalOutputSchema,
  TaskApprovalResumeSchema,
  TaskApprovalSuspendSchema,
} from './schema';

// Planning iteration step (with questions and user answers)
const planningIterationStep = createStep({
  id: 'planning-iteration',
  description: 'Create or refine task plan with user input',
  inputSchema: PlanningIterationInputSchema,
  outputSchema: PlanningIterationResultSchema,
  suspendSchema: PlanningIterationSuspendSchema,
  resumeSchema: PlanningIterationResumeSchema,
  execute: async ({ inputData, resumeData, suspend, runtimeContext }) => {
    const {
      action,
      workflowName,
      description,
      requirements,
      discoveredWorkflows,
      projectStructure,
      research,
      userAnswers,
    } = inputData;

    console.log('Starting planning iteration...');

    // Get or initialize Q&A tracking in runtime context
    const qaKey = 'workflow-builder-qa';
    let storedQAPairs: Array<{
      question: any;
      answer: string | null;
      askedAt: string;
      answeredAt: string | null;
    }> = runtimeContext.get(qaKey) || [];

    // Process new answers from user input or resume data
    const newAnswers = { ...(userAnswers || {}), ...(resumeData?.answers || {}) };

    console.log('before', storedQAPairs);
    console.log('newAnswers', newAnswers);
    // Update existing Q&A pairs with new answers
    if (Object.keys(newAnswers).length > 0) {
      storedQAPairs = storedQAPairs.map(pair => {
        if (newAnswers[pair.question.id]) {
          return {
            ...pair,
            answer: newAnswers[pair.question.id] || null,
            answeredAt: new Date().toISOString(),
          };
        }
        return pair;
      });

      // Store updated pairs back to runtime context
      runtimeContext.set(qaKey, storedQAPairs);
    }

    console.log('after', storedQAPairs);

    console.log(
      `Current Q&A state: ${storedQAPairs.length} question-answer pairs, ${storedQAPairs.filter(p => p.answer).length} answered`,
    );

    try {
      // const filteredMcpTools = await initializeMcpTools();

      const planningAgent = new Agent({
        model: resolveModel(runtimeContext),
        instructions: taskPlanningPrompts.planningAgent.instructions({
          storedQAPairs,
        }),
        name: 'Workflow Planning Agent',
        // tools: filteredMcpTools,
      });

      // Check if we have user feedback from rejected task list in input data
      const hasTaskFeedback = Boolean(userAnswers && userAnswers.taskFeedback);

      const planningPrompt = storedQAPairs.some(pair => pair.answer)
        ? taskPlanningPrompts.planningAgent.refinementPrompt({
            action,
            workflowName,
            description,
            requirements,
            discoveredWorkflows,
            projectStructure,
            research,
            storedQAPairs,
            hasTaskFeedback,
            userAnswers,
          })
        : taskPlanningPrompts.planningAgent.initialPrompt({
            action,
            workflowName,
            description,
            requirements,
            discoveredWorkflows,
            projectStructure,
            research,
          });

      const result = await planningAgent.generateVNext(planningPrompt, {
        output: PlanningAgentOutputSchema,
        // maxSteps: 15,
      });

      const planResult = await result.object;
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

        console.log(planResult.questions);

        // Store new questions as Q&A pairs in runtime context
        const newQAPairs = planResult.questions.map((question: any) => ({
          question,
          answer: null,
          askedAt: new Date().toISOString(),
          answeredAt: null,
        }));

        storedQAPairs = [...storedQAPairs, ...newQAPairs];
        runtimeContext.set(qaKey, storedQAPairs);

        console.log(
          `Updated Q&A state: ${storedQAPairs.length} total question-answer pairs, ${storedQAPairs.filter(p => p.answer).length} answered`,
        );

        return suspend({
          questions: planResult.questions,
          message: taskPlanningPrompts.taskApproval.message(planResult.questions.length),
          currentPlan: {
            tasks: planResult.tasks,
            reasoning: planResult.reasoning,
          },
        });
      }

      // Plan is complete
      console.log(`Planning complete with ${planResult.tasks.length} tasks`);

      // Update runtime context with final state
      runtimeContext.set(qaKey, storedQAPairs);
      console.log(
        `Final Q&A state: ${storedQAPairs.length} total question-answer pairs, ${storedQAPairs.filter(p => p.answer).length} answered`,
      );

      return {
        tasks: planResult.tasks,
        success: true,
        questions: [],
        reasoning: planResult.reasoning,
        planComplete: true,
        message: `Successfully created ${planResult.tasks.length} tasks`,
        allPreviousQuestions: storedQAPairs.map(pair => pair.question),
        allPreviousAnswers: Object.fromEntries(
          storedQAPairs.filter(pair => pair.answer).map(pair => [pair.question.id, pair.answer]),
        ),
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
        error: error instanceof Error ? error.message : String(error),
        allPreviousQuestions: storedQAPairs.map(pair => pair.question),
        allPreviousAnswers: Object.fromEntries(
          storedQAPairs.filter(pair => pair.answer).map(pair => [pair.question.id, pair.answer]),
        ),
      };
    }
  },
});

// Task approval step
const taskApprovalStep = createStep({
  id: 'task-approval',
  description: 'Get user approval for the final task list',
  inputSchema: PlanningIterationResultSchema,
  outputSchema: TaskApprovalOutputSchema,
  suspendSchema: TaskApprovalSuspendSchema,
  resumeSchema: TaskApprovalResumeSchema,
  execute: async ({ inputData, resumeData, suspend }) => {
    const { tasks } = inputData;

    // If no resume data, suspend for user approval
    if (!resumeData?.approved && resumeData?.approved !== false) {
      console.log(`Requesting user approval for ${tasks.length} tasks`);

      const summary = `Task List for Approval:

${tasks.length} tasks planned:
${tasks.map((task, i) => `${i + 1}. [${task.priority.toUpperCase()}] ${task.content}${task.dependencies?.length ? ` (depends on: ${task.dependencies.join(', ')})` : ''}\n   Notes: ${task.notes || 'None'}`).join('\n')}`;

      return suspend({
        taskList: tasks,
        summary,
        message: taskPlanningPrompts.taskApproval.approvalMessage(tasks.length),
      });
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
  outputSchema: TaskApprovalOutputSchema,
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
