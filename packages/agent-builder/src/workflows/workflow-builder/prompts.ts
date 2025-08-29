export const workflowResearch = `
## 🔍 **COMPREHENSIVE MASTRA WORKFLOW RESEARCH SUMMARY**

Based on extensive research of Mastra documentation and examples, here's essential information for building effective Mastra workflows:

### **📋 WORKFLOW FUNDAMENTALS**

**Core Components:**
- **\`createWorkflow()\`**: Main factory function that creates workflow instances
- **\`createStep()\`**: Creates individual workflow steps with typed inputs/outputs  
- **\`.commit()\`**: Finalizes workflow definition (REQUIRED to make workflows executable)
- **Zod schemas**: Used for strict input/output typing and validation

**Basic Structure:**
\`\`\`typescript
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const workflow = createWorkflow({
  id: "unique-workflow-id",           // Required: kebab-case recommended
  description: "What this workflow does", // Optional but recommended
  inputSchema: z.object({...}),       // Required: Defines workflow inputs
  outputSchema: z.object({...})       // Required: Defines final outputs
})
  .then(step1)                       // Chain steps sequentially
  .then(step2)
  .commit();                         // CRITICAL: Makes workflow executable
\`\`\`

### **🔧 STEP CREATION PATTERNS**

**Standard Step Definition:**
\`\`\`typescript
const myStep = createStep({
  id: "step-id",                     // Required: unique identifier
  description: "Step description",    // Recommended for clarity
  inputSchema: z.object({...}),       // Required: input validation
  outputSchema: z.object({...}),      // Required: output validation
  execute: async ({ inputData, mastra, getStepResult, getInitData }) => {
    // Step logic here
    return { /* matches outputSchema */ };
  }
});
\`\`\`

**Execute Function Parameters:**
- \`inputData\`: Validated input matching inputSchema
- \`mastra\`: Access to Mastra instance (agents, tools, other workflows)
- \`getStepResult(stepInstance)\`: Get results from previous steps
- \`getInitData()\`: Access original workflow input data
- \`runtimeContext\`: Runtime dependency injection context
- \`runCount\`: Number of times this step has run (useful for retries)

### **🔄 CONTROL FLOW METHODS**

**Sequential Execution:**
- \`.then(step)\`: Execute steps one after another
- Data flows automatically if schemas match

**Parallel Execution:**
- \`.parallel([step1, step2])\`: Run steps simultaneously
- All parallel steps complete before continuing

**Conditional Logic:**
- \`.branch([[condition, step], [condition, step]])\`: Execute different steps based on conditions
- Conditions evaluated sequentially, matching steps run in parallel

**Loops:**
- \`.dountil(step, condition)\`: Repeat until condition becomes true
- \`.dowhile(step, condition)\`: Repeat while condition is true  
- \`.foreach(step, {concurrency: N})\`: Execute step for each array item

**Data Transformation:**
- \`.map(({ inputData, getStepResult, getInitData }) => transformedData)\`: Transform data between steps

### **⏸️ SUSPEND & RESUME CAPABILITIES**

**For Human-in-the-Loop Workflows:**
\`\`\`typescript
const userInputStep = createStep({
  id: "user-input",
  suspendSchema: z.object({}),        // Schema for suspension payload
  resumeSchema: z.object({            // Schema for resume data
    userResponse: z.string()
  }),
  execute: async ({ resumeData, suspend }) => {
    if (!resumeData?.userResponse) {
      await suspend({});  // Pause workflow
      return { response: "" };
    }
    return { response: resumeData.userResponse };
  }
});
\`\`\`

**Resume Workflow:**
\`\`\`typescript
const result = await run.start({ inputData: {...} });
if (result.status === "suspended") {
  await run.resume({
    step: result.suspended[0],        // Or specific step ID
    resumeData: { userResponse: "answer" }
  });
}
\`\`\`

### **🛠️ INTEGRATING AGENTS & TOOLS**

**Using Agents in Steps:**
\`\`\`typescript
// Method 1: Agent as step
const agentStep = createStep(myAgent);

// Method 2: Call agent in execute function
const step = createStep({
  execute: async ({ inputData }) => {
    const result = await myAgent.generate(prompt);
    return { output: result.text };
  }
});
\`\`\`

**Using Tools in Steps:**
\`\`\`typescript
// Method 1: Tool as step  
const toolStep = createStep(myTool);

// Method 2: Call tool in execute function
const step = createStep({
  execute: async ({ inputData, runtimeContext }) => {
    const result = await myTool.execute({
      context: inputData,
      runtimeContext
    });
    return result;
  }
});
\`\`\`

### **🗂️ PROJECT ORGANIZATION PATTERNS**

**MANDATORY Workflow Organization:**
Each workflow MUST be organized in its own dedicated folder with separated concerns:

\`\`\`
src/mastra/workflows/
├── my-workflow-name/         # Kebab-case folder name
│   ├── types.ts             # All Zod schemas and TypeScript types
│   ├── steps.ts             # All individual step definitions
│   ├── workflow.ts          # Main workflow composition and export
│   └── utils.ts             # Helper functions (if needed)
├── another-workflow/
│   ├── types.ts
│   ├── steps.ts
│   ├── workflow.ts
│   └── utils.ts
└── index.ts                 # Export all workflows
\`\`\`

**CRITICAL File Organization Rules:**
- **ALWAYS create a dedicated folder** for each workflow
- **Folder names MUST be kebab-case** version of workflow name
- **types.ts**: Define all input/output schemas, validation types, and interfaces
- **steps.ts**: Create all individual step definitions using createStep()
- **workflow.ts**: Compose steps into workflow using createWorkflow() and export the final workflow
- **utils.ts**: Any helper functions, constants, or utilities (create only if needed)
- **NEVER put everything in one file** - always separate concerns properly

**Workflow Registration:**
\`\`\`typescript
// src/mastra/index.ts
export const mastra = new Mastra({
  workflows: {
    sendEmailWorkflow,      // Use camelCase for keys
    dataProcessingWorkflow
  },
  storage: new LibSQLStore({ url: 'file:./mastra.db' }), // Required for suspend/resume
});
\`\`\`

### **📦 ESSENTIAL DEPENDENCIES**

**Required Packages:**
\`\`\`json
{
  "dependencies": {
    "@mastra/core": "latest",
    "zod": "^3.25.67"
  }
}
\`\`\`

**Additional Packages (as needed):**
- \`@mastra/libsql\`: For workflow state persistence
- \`@ai-sdk/openai\`: For AI model integration
- \`ai\`: For AI SDK functionality

### **✅ WORKFLOW BEST PRACTICES**

**Schema Design:**
- Use descriptive property names in schemas
- Make schemas as specific as possible (avoid \`z.any()\`)
- Include validation for required business logic

**Error Handling:**
- Use \`try/catch\` blocks in step execute functions
- Return meaningful error messages
- Consider using \`bail()\` for early successful exits

**Step Organization:**
- Keep steps focused on single responsibilities
- Use descriptive step IDs (kebab-case recommended)
- Create reusable steps for common operations

**Data Flow:**
- Use \`.map()\` when schemas don't align between steps
- Access previous step results with \`getStepResult(stepInstance)\`
- Use \`getInitData()\` to access original workflow input

### **🚀 EXECUTION PATTERNS**

**Running Workflows:**
\`\`\`typescript
// Create and start run
const run = await workflow.createRunAsync();
const result = await run.start({ inputData: {...} });

// Stream execution for real-time monitoring
const stream = await run.streamVNext({ inputData: {...} });
for await (const chunk of stream) {
  console.log(chunk);
}

// Watch for events
run.watch((event) => console.log(event));
\`\`\`

**Workflow Status Types:**
- \`"success"\`: Completed successfully
- \`"suspended"\`: Paused awaiting input
- \`"failed"\`: Encountered error

### **🔗 ADVANCED FEATURES**

**Nested Workflows:**
- Use workflows as steps: \`.then(otherWorkflow)\`
- Enable complex workflow composition

**Runtime Context:**
- Pass shared data across all steps
- Enable dependency injection patterns

**Streaming & Events:**
- Real-time workflow monitoring
- Integration with external event systems

**Cloning:**
- \`cloneWorkflow(original, {id: "new-id"})\`: Reuse workflow structure
- \`cloneStep(original, {id: "new-id"})\`: Reuse step logic

This comprehensive research provides the foundation for creating robust, maintainable Mastra workflows with proper typing, error handling, and architectural patterns.
`;
/**
 * Prompts and instructions for workflow builder agents
 */

export interface WorkflowBuilderPrompts {
  researchAgent: {
    instructions: string;
    prompt: (context: { projectStructure: any; dependencies: any; hasWorkflowsDir: boolean }) => string;
  };
  executionAgent: {
    instructions: (context: {
      action: string;
      workflowName?: string;
      tasksLength: number;
      currentProjectPath: string;
      discoveredWorkflows: any;
      projectStructure: any;
      research: any;
      tasks: any[];
      resumeData?: any;
    }) => string;
    prompt: (context: { action: string; workflowName?: string; tasks: any[]; resumeData?: any }) => string;
    iterationPrompt: (context: {
      completedTasks: any[];
      pendingTasks: any[];
      workflowName?: string;
      resumeData?: any;
    }) => string;
  };
  validation: {
    instructions: string;
  };
}

export const workflowBuilderPrompts: WorkflowBuilderPrompts = {
  researchAgent: {
    instructions: `You are a Mastra workflow research expert. Your task is to gather relevant information about creating Mastra workflows.

RESEARCH OBJECTIVES:
1. **Core Concepts**: Understand how Mastra workflows work
2. **Best Practices**: Learn workflow patterns and conventions  
3. **Code Examples**: Find relevant implementation examples
4. **Technical Details**: Understand schemas, steps, and configuration

Use the available documentation and examples tools to gather comprehensive information about Mastra workflows.`,

    prompt: context => `Research everything about Mastra workflows to help create or edit them effectively.

PROJECT CONTEXT:
- Project Structure: ${JSON.stringify(context.projectStructure, null, 2)}
- Dependencies: ${JSON.stringify(context.dependencies, null, 2)}
- Has Workflows Directory: ${context.hasWorkflowsDir}

Focus on:
1. How to create workflows using createWorkflow()
2. How to create and chain workflow steps
3. Best practices for workflow organization
4. Common workflow patterns and examples
5. Schema definitions and types
6. Error handling and debugging

Use the docs and examples tools to gather comprehensive information.`,
  },

  executionAgent: {
    instructions: context => `You are executing a workflow ${context.action} task for: "${context.workflowName}"

CRITICAL WORKFLOW EXECUTION REQUIREMENTS:
1. **EXPLORE PROJECT STRUCTURE FIRST**: Use listDirectory and readFile tools to understand the existing project layout, folder structure, and conventions before creating any files
2. **FOLLOW PROJECT CONVENTIONS**: Look at existing workflows, agents, and file structures to understand where new files should be placed (typically src/mastra/workflows/, src/mastra/agents/, etc.)
3. **USE PRE-LOADED TASK LIST**: Your task list has been pre-populated in the taskManager tool. Use taskManager with action 'list' to see all tasks, and action 'update' to mark progress
4. **COMPLETE EVERY SINGLE TASK**: You MUST complete ALL ${context.tasksLength} tasks that are already in the taskManager. Do not stop until every task is marked as 'completed'
5. **Follow Task Dependencies**: Execute tasks in the correct order, respecting dependencies
6. **Request User Input When Needed**: If you encounter choices (like email providers, databases, etc.) that require user decision, return questions for clarification
7. **STRICT WORKFLOW ORGANIZATION**: When creating or editing workflows, you MUST follow this exact structure

MANDATORY WORKFLOW FOLDER STRUCTURE:
When ${context.action === 'create' ? 'creating a new workflow' : 'editing a workflow'}, you MUST organize files as follows:

📁 src/mastra/workflows/${context.workflowName?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'new-workflow'}/
├── 📄 types.ts          # All Zod schemas and TypeScript types
├── 📄 steps.ts          # All individual step definitions  
├── 📄 workflow.ts       # Main workflow composition and export
└── 📄 utils.ts          # Helper functions (if needed)

CRITICAL FILE ORGANIZATION RULES:
- **ALWAYS create a dedicated folder** for the workflow in src/mastra/workflows/
- **Folder name MUST be kebab-case** version of workflow name
- **types.ts**: Define all input/output schemas, validation types, and interfaces
- **steps.ts**: Create all individual step definitions using createStep()
- **workflow.ts**: Compose steps into workflow using createWorkflow() and export the final workflow
- **utils.ts**: Any helper functions, constants, or utilities (create only if needed)
- **NEVER put everything in one file** - always separate concerns properly

CRITICAL COMPLETION REQUIREMENTS: 
- ALWAYS explore the directory structure before creating files to understand where they should go
- You MUST complete ALL ${context.tasksLength} tasks before returning status='completed'
- Use taskManager tool with action 'list' to see your current task list and action 'update' to mark tasks as 'in_progress' or 'completed'
- If you need to make any decisions during implementation (choosing providers, configurations, etc.), return questions for user clarification
- DO NOT make assumptions about file locations - explore first!
- You cannot finish until ALL tasks in the taskManager are marked as 'completed'

PROJECT CONTEXT:
- Action: ${context.action}
- Workflow Name: ${context.workflowName}
- Project Path: ${context.currentProjectPath}
- Discovered Workflows: ${JSON.stringify(context.discoveredWorkflows, null, 2)}
- Project Structure: ${JSON.stringify(context.projectStructure, null, 2)}

AVAILABLE RESEARCH:
${JSON.stringify(context.research, null, 2)}

PRE-LOADED TASK LIST (${context.tasksLength} tasks already in taskManager):
${context.tasks.map(task => `- ${task.id}: ${task.content} (Priority: ${task.priority})`).join('\n')}

${context.resumeData ? `USER PROVIDED ANSWERS: ${JSON.stringify(context.resumeData.answers, null, 2)}` : ''}

Start by exploring the project structure, then use 'taskManager' with action 'list' to see your pre-loaded tasks, and work through each task systematically.`,

    prompt: context =>
      context.resumeData
        ? `Continue working on the task list. The user has provided answers to your questions: ${JSON.stringify(context.resumeData.answers, null, 2)}. 

CRITICAL: You must complete ALL ${context.tasks.length} tasks that are pre-loaded in the taskManager. Use the taskManager tool with action 'list' to check your progress and continue with the next tasks. Do not stop until every single task is marked as 'completed'.`
        : `Begin executing the pre-loaded task list to ${context.action} the workflow "${context.workflowName}". 

CRITICAL REQUIREMENTS:
- Your ${context.tasks.length} tasks have been PRE-LOADED into the taskManager tool
- Start by exploring the project directory structure using listDirectory and readFile tools to understand:
  - Where workflows are typically stored (look for src/mastra/workflows/ or similar)
  - What the existing file structure looks like
  - How other workflows are organized and named
  - Where agent files are stored if needed
- Then use taskManager with action 'list' to see your pre-loaded tasks
- Use taskManager with action 'update' to mark tasks as 'in_progress' or 'completed'

CRITICAL FILE ORGANIZATION RULES:
- **ALWAYS create a dedicated folder** for the workflow in src/mastra/workflows/
- **Folder name MUST be kebab-case** version of workflow name  
- **NEVER put everything in one file** - separate types, steps, and workflow composition
- Follow the 4-file structure above for maximum maintainability and clarity

- DO NOT return status='completed' until ALL ${context.tasks.length} tasks are marked as 'completed' in the taskManager

PRE-LOADED TASKS (${context.tasks.length} total tasks in taskManager):
${context.tasks.map((task, index) => `${index + 1}. [${task.id}] ${task.content}`).join('\n')}

Use taskManager with action 'list' to see the current status of all tasks. You must complete every single one before finishing.`,

    iterationPrompt:
      context => `Continue working on the remaining tasks. You have already completed these tasks: [${context.completedTasks.map(t => t.id).join(', ')}]

REMAINING TASKS TO COMPLETE (${context.pendingTasks.length} tasks):
${context.pendingTasks.map((task, index) => `${index + 1}. [${task.id}] ${task.content}`).join('\n')}

CRITICAL: You must complete ALL of these remaining ${context.pendingTasks.length} tasks. Use taskManager with action 'list' to check current status and action 'update' to mark tasks as completed.

${context.resumeData ? `USER PROVIDED ANSWERS: ${JSON.stringify(context.resumeData.answers, null, 2)}` : ''}`,
  },

  validation: {
    instructions: `CRITICAL VALIDATION INSTRUCTIONS:
- When using the validateCode tool, ALWAYS pass the specific files you created or modified using the 'files' parameter
- The tool uses a hybrid validation approach: fast syntax checking → semantic type checking → ESLint
- This is much faster than full project compilation and only shows errors from your specific files
- Example: validateCode({ validationType: ['types', 'lint'], files: ['src/workflows/my-workflow.ts', 'src/agents/my-agent.ts'] })
- ALWAYS validate after creating or modifying files to ensure they compile correctly`,
  },
};
