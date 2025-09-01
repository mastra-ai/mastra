/**
 * Prompts and instructions for task planning workflow
 */

export interface TaskPlanningPrompts {
  planningAgent: {
    instructions: (context: { storedQAPairs: any[] }) => string;
    refinementPrompt: (context: {
      action: string;
      workflowName?: string;
      description?: string;
      requirements?: string;
      discoveredWorkflows: any[];
      projectStructure: any;
      research: any;
      storedQAPairs: any[];
      hasTaskFeedback: boolean;
      userAnswers?: any;
    }) => string;
    initialPrompt: (context: {
      action: string;
      workflowName?: string;
      description?: string;
      requirements?: string;
      discoveredWorkflows: any[];
      projectStructure: any;
      research: any;
    }) => string;
  };
  taskApproval: {
    message: (questionsCount: number) => string;
    approvalMessage: (tasksCount: number) => string;
  };
}

export const taskPlanningPrompts: TaskPlanningPrompts = {
  planningAgent: {
    instructions:
      context => `You are a Mastra workflow planning expert. Your task is to create a detailed, executable task plan.

PLANNING RESPONSIBILITIES:
1. **Analyze Requirements**: Review the user's description and requirements thoroughly
2. **Identify Decision Points**: Find any choices that require user input (email providers, databases, APIs, etc.)
3. **Create Specific Tasks**: Generate concrete, actionable tasks with clear implementation notes
4. **Ask Clarifying Questions**: If any decisions are unclear, formulate specific questions for the user 
- do not ask about package managers
- Assume the user is going to use zod for validation
- You do not need to ask questions if you have none
- NEVER ask questions that have already been answered before
5. **Incorporate Feedback**: Use any previous answers or feedback to refine the plan

${
  context.storedQAPairs.length > 0
    ? `PREVIOUS QUESTION-ANSWER PAIRS (${context.storedQAPairs.length} total):\n${context.storedQAPairs
        .map(
          (pair, index) =>
            `${index + 1}. Q: ${pair.question.question}\n   A: ${pair.answer || 'NOT ANSWERED YET'}\n   Type: ${pair.question.type}\n   Asked: ${pair.askedAt}\n   ${pair.answer ? `Answered: ${pair.answeredAt}` : ''}`,
        )
        .join('\n\n')}\n\nIMPORTANT: DO NOT ASK ANY QUESTIONS THAT HAVE ALREADY BEEN ASKED!`
    : ''
}

Based on the context and any user answers, create or refine the task plan.`,

    refinementPrompt: context => `Refine the existing task plan based on all user answers collected so far. 

ANSWERED QUESTIONS AND RESPONSES:
${context.storedQAPairs
  .filter(pair => pair.answer)
  .map(
    (pair, index) =>
      `${index + 1}. Q: ${pair.question.question}\n   A: ${pair.answer}\n   Context: ${pair.question.context || 'None'}`,
  )
  .join('\n\n')}

REQUIREMENTS:
- Action: ${context.action}
- Workflow Name: ${context.workflowName || 'To be determined'}
- Description: ${context.description || 'Not specified'}
- Requirements: ${context.requirements || 'Not specified'}

PROJECT CONTEXT:
- Discovered Workflows: ${JSON.stringify(context.discoveredWorkflows, null, 2)}
- Project Structure: ${JSON.stringify(context.projectStructure, null, 2)}
- Research: ${JSON.stringify(context.research, null, 2)}

${context.hasTaskFeedback ? `\nUSER FEEDBACK ON PREVIOUS TASK LIST:\n${context.userAnswers?.taskFeedback}\n\nPLEASE INCORPORATE THIS FEEDBACK INTO THE REFINED TASK LIST.` : ''}

Refine the task list and determine if any additional questions are needed.`,

    initialPrompt: context => `Create an initial task plan for ${context.action}ing a Mastra workflow.

REQUIREMENTS:
- Action: ${context.action}
- Workflow Name: ${context.workflowName || 'To be determined'}
- Description: ${context.description || 'Not specified'}  
- Requirements: ${context.requirements || 'Not specified'}

PROJECT CONTEXT:
- Discovered Workflows: ${JSON.stringify(context.discoveredWorkflows, null, 2)}
- Project Structure: ${JSON.stringify(context.projectStructure, null, 2)}
- Research: ${JSON.stringify(context.research, null, 2)}

Create specific tasks and identify any questions that need user clarification.`,
  },

  taskApproval: {
    message: questionsCount => `Please answer ${questionsCount} question(s) to finalize the workflow plan:`,
    approvalMessage: tasksCount => `Please review and approve the ${tasksCount} task(s) for execution:`,
  },
};
