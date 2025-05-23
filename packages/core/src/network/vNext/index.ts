import { z } from 'zod';
import { Agent } from '../../agent';
import type { DynamicArgument, MastraLanguageModel } from '../../agent';
import { MastraBase } from '../../base';
import { RegisteredLogger } from '../../logger';
import { RuntimeContext } from '../../runtime-context';
import { createWorkflow, type Workflow, createStep } from '../../workflows';
import type { MastraMemory } from '../../memory';
import { randomUUID } from 'crypto';

interface NewAgentNetworkConfig {
  id: string;
  name: string;
  instructions: DynamicArgument<string>;
  model: DynamicArgument<MastraLanguageModel>;
  agents: DynamicArgument<Record<string, Agent>>;
  workflows?: DynamicArgument<Record<string, Workflow>>;
  memory?: DynamicArgument<MastraMemory>;
}

const RESOURCE_TYPES = z.enum(['agent', 'workflow', 'none']);

// getInstructions() {

//     return `

//             ## Available Specialized Agents
//             You can call these agents using the "transmit" tool:
//             ${agentList}

//             ## How to Use the "transmit" Tool

//             The "transmit" tool allows you to call one or more specialized agents.

//             ### Single Agent Call
//             To call a single agent, use this format:
//             \`\`\`json
//             {
//               "actions": [
//                 {
//                   "agent": "agent_name",
//                   "input": "detailed instructions for the agent"
//                 }
//               ]
//             }
//             \`\`\`

//             ### Multiple Parallel Agent Calls
//             To call multiple agents in parallel, use this format:
//             \`\`\`json
//             {
//               "actions": [
//                 {
//                   "agent": "first_agent_name",
//                   "input": "detailed instructions for the first agent"
//                 },
//                 {
//                   "agent": "second_agent_name",
//                   "input": "detailed instructions for the second agent"
//                 }
//               ]
//             }
//             \`\`\`

//             ## Context Sharing

//             When calling an agent, you can choose to include the output from previous agents in the context.
//             This allows the agent to take into account the results from previous steps.

//             To include context, add the "includeHistory" field to the action and set it to true:
//             \`\`\`json
//             {
//               "actions": [
//                 {
//                   "agent": "agent_name",
//                   "input": "detailed instructions for the agent",
//                   "includeHistory": true
//                 }
//               ]
//             }
//             \`\`\`

//             ## Best Practices
//             1. Break down complex tasks into smaller steps
//             2. Choose the most appropriate agent for each step
//             3. Provide clear, detailed instructions to each agent
//             4. Synthesize the results from multiple agents when needed
//             5. Provide a final summary or answer to the user

//             ## Workflow
//             1. Analyze the user's request
//             2. Identify which specialized agent(s) can help
//             3. Call the appropriate agent(s) using the transmit tool
//             4. Review the agent's response
//             5. Either call more agents or provide a final answer
//         `;
// }

export class NewAgentNetwork extends MastraBase {
  id: string;
  name: string;
  #instructions: DynamicArgument<string>;
  #model: DynamicArgument<MastraLanguageModel>;
  #agents: DynamicArgument<Record<string, Agent>>;
  #workflows: DynamicArgument<Record<string, Workflow>> | undefined;
  #memory?: DynamicArgument<MastraMemory>;

  constructor({ id, name, instructions, model, agents, workflows, memory }: NewAgentNetworkConfig) {
    super({
      component: RegisteredLogger.NETWORK,
      name: name || 'NewAgentNetwork',
    });

    this.id = id;
    this.name = name;
    this.#instructions = instructions;
    this.#model = model;
    this.#agents = agents;
    this.#workflows = workflows;
    this.#memory = memory;
  }

  async getAgents({ runtimeContext }: { runtimeContext?: RuntimeContext }) {
    let agentsToUse: Record<string, Agent>;

    if (typeof this.#agents === 'function') {
      agentsToUse = await this.#agents({ runtimeContext: runtimeContext || new RuntimeContext() });
    } else {
      agentsToUse = this.#agents;
    }

    return agentsToUse;
  }

  async getWorkflows({ runtimeContext }: { runtimeContext?: RuntimeContext }) {
    let workflowsToUse: Record<string, Workflow>;

    if (typeof this.#workflows === 'function') {
      workflowsToUse = await this.#workflows({ runtimeContext: runtimeContext || new RuntimeContext() });
    } else {
      workflowsToUse = this.#workflows || {};
    }

    return workflowsToUse;
  }

  async getMemory({ runtimeContext }: { runtimeContext?: RuntimeContext }) {
    let memoryToUse: MastraMemory;

    if (!this.#memory) {
      return;
    }

    if (typeof this.#memory === 'function') {
      memoryToUse = await this.#memory({ runtimeContext: runtimeContext || new RuntimeContext() });
    } else {
      memoryToUse = this.#memory;
    }

    return memoryToUse;
  }

  async getInstructions({ runtimeContext }: { runtimeContext?: RuntimeContext }) {
    let instructionsToUse = this.#instructions;

    if (typeof instructionsToUse === 'function') {
      instructionsToUse = await instructionsToUse({ runtimeContext: runtimeContext || new RuntimeContext() });
    }

    return instructionsToUse;
  }

  async getRoutingAgent({ runtimeContext }: { runtimeContext?: RuntimeContext }) {
    const instructionsToUse = await this.getInstructions({ runtimeContext: runtimeContext || new RuntimeContext() });
    const memoryToUse = await this.getMemory({ runtimeContext: runtimeContext || new RuntimeContext() });
    const agentsToUse = await this.getAgents({ runtimeContext: runtimeContext || new RuntimeContext() });
    const workflowsToUse = await this.getWorkflows({ runtimeContext: runtimeContext || new RuntimeContext() });

    const agentList = Object.entries(agentsToUse)
      .map(([name, agent]) => {
        // Use agent name instead of description since description might not exist
        return ` - **${name}**: ${agent.description}`;
      })
      .join('\n');

    const workflowList = Object.entries(workflowsToUse)
      .map(([name, workflow]) => {
        return ` - **${name}**: ${workflow.description}`;
      })
      .join('\n');

    const instructions = `
          You are a router in a network of specialized AI agents. 
          Your job is to decide which agent should handle each step of a task.

          If asking for completion of a task, make sure to follow system instructions closely.
            
          ## System Instructions
          ${instructionsToUse}

          ## Available Agents in Network
          ${agentList}

          ## Available Workflows in Network
          ${workflowList}
        `;

    return new Agent({
      name: 'routing-agent',
      instructions,
      model: this.#model,
      memory: memoryToUse,
    });
  }

  async generate(
    message: string,
    {
      runtimeContext,
    }: {
      runtimeContext?: RuntimeContext;
    },
  ) {
    const runId = randomUUID();

    const runtimeContextToUse = runtimeContext || new RuntimeContext();
    const agentsMap = await this.getAgents({ runtimeContext: runtimeContextToUse });
    const workflowsMap = await this.getWorkflows({ runtimeContext: runtimeContextToUse });
    const routingAgent = await this.getRoutingAgent({ runtimeContext: runtimeContextToUse });

    const routingStep = createStep({
      id: 'routing-step',
      inputSchema: z.object({
        task: z.string(),
        resourceId: z.string(),
        resourceType: RESOURCE_TYPES,
        result: z.string().optional(),
      }),
      outputSchema: z.object({
        task: z.string(),
        resourceId: z.string(),
        resourceType: RESOURCE_TYPES,
        prompt: z.string(),
        result: z.string(),
        isComplete: z.boolean().optional(),
      }),
      execute: async ({ inputData }) => {
        console.dir({ inputData }, { depth: null });
        let completionResult;
        if (inputData.resourceType !== 'none' && inputData?.result) {
          // Check if the task is complete
          const completionPrompt = `
                        The ${inputData.resourceType} ${inputData.resourceId} has contributed to the task.
                        This is the result from the agent: ${inputData.result}

                        You need to evaluate that our task is complete. Pay very close attention to the SYSTEM INSTRUCTIONS for when the task is considered complete. Only return true if the task is complete according to the system instructions. Pay close attention to the finalResult and completionReason.
                        Original task: ${inputData.task}

                        {
                            "isComplete": boolean,
                            "completionReason": string,
                            "finalResult": string
                        }
                    `;

          completionResult = await routingAgent.generate(completionPrompt, {
            output: z.object({
              isComplete: z.boolean(),
              finalResult: z.string(),
              completionReason: z.string(),
            }),
            threadId: runId,
            resourceId: this.name,
          });

          console.log('COMPLETION RESULT', completionResult.object);

          if (completionResult.object.isComplete) {
            return {
              task: inputData.task,
              resourceId: '',
              resourceType: 'none' as z.infer<typeof RESOURCE_TYPES>,
              prompt: '',
              result: completionResult.object.finalResult,
              isComplete: true,
            };
          }
        }

        const result = await routingAgent.generate(
          `
                    The user has given you the following task: 
                    ${inputData.task}
                    ${completionResult ? `\n\n${completionResult.object.finalResult}` : ''}

                    Please select the most appropriate agent to handle this task and the prompt to be sent to the agent.
                    If you are calling the same agent again, make sure to adjust the prompt to be more specific.

                    {
                        "resourceId": string,
                        "resourceType": "agent" | "workflow",
                        "prompt": string,
                        "selectionReason": string
                    }
                    `,
          {
            output: z.object({
              resourceId: z.string(),
              resourceType: RESOURCE_TYPES,
              prompt: z.string(),
              selectionReason: z.string(),
            }),
            threadId: runId,
            resourceId: this.name,
          },
        );

        console.log('RESULT', result.object);

        return {
          task: inputData.task,
          result: '',
          resourceId: result.object.resourceId,
          resourceType: result.object.resourceType,
          prompt: result.object.prompt,
          isComplete: false,
        };
      },
    });

    const agentStep = createStep({
      id: 'agent-step',
      inputSchema: z.object({
        task: z.string(),
        resourceId: z.string(),
        resourceType: RESOURCE_TYPES,
        prompt: z.string(),
        result: z.string(),
        isComplete: z.boolean().optional(),
      }),
      outputSchema: z.object({
        task: z.string(),
        resourceId: z.string(),
        resourceType: RESOURCE_TYPES,
        result: z.string(),
        isComplete: z.boolean().optional(),
      }),
      execute: async ({ inputData }) => {
        const agentId = inputData.resourceId;
        console.log('calling agent', agentId);

        const agent = agentsMap[inputData.resourceId];

        if (!agent) {
          throw new Error(`Agent ${agentId} not found`);
        }

        const result = await agent.generate(inputData.prompt, {
          threadId: runId,
          resourceId: this.name,
        });

        return {
          task: inputData.task,
          resourceId: inputData.resourceId,
          resourceType: inputData.resourceType,
          result: result.text,
          isComplete: false,
        };
      },
    });

    const workflowStep = createStep({
      id: 'workflow-step',
      inputSchema: z.object({
        task: z.string(),
        resourceId: z.string(),
        resourceType: RESOURCE_TYPES,
        prompt: z.string(),
        result: z.string(),
        isComplete: z.boolean().optional(),
      }),
      outputSchema: z.object({
        task: z.string(),
        resourceId: z.string(),
        resourceType: RESOURCE_TYPES,
        result: z.string(),
        isComplete: z.boolean().optional(),
      }),
      execute: async ({ inputData }) => {
        console.log('calling workflow', inputData.resourceId);
        const wf = workflowsMap[inputData.resourceId];

        if (!wf) {
          throw new Error(`Workflow ${inputData.resourceId} not found`);
        }

        const run = wf.createRun();
        const resp = await run.start({
          // TODO: this can't be task, it needs to be the input schema of the workflow
          inputData: {
            task: inputData.task,
          },
        });

        if (resp.status === 'failed') {
          throw resp.error;
        }

        if (resp.status === 'suspended') {
          throw new Error('Workflow suspended');
        }

        // TODO: this cant' be result.text
        return {
          result: resp?.result?.text || '',
          task: inputData.task,
          resourceId: inputData.resourceId,
          resourceType: inputData.resourceType,
          isComplete: false,
        };
      },
    });

    const finishStep = createStep({
      id: 'finish-step',
      inputSchema: z.object({
        task: z.string(),
        resourceId: z.string(),
        resourceType: RESOURCE_TYPES,
        prompt: z.string(),
        result: z.string(),
        isComplete: z.boolean().optional(),
      }),
      outputSchema: z.object({
        task: z.string(),
        result: z.string(),
        isComplete: z.boolean(),
      }),
      execute: async ({ inputData }) => {
        return {
          task: inputData.task,
          result: inputData.result,
          isComplete: !!inputData.isComplete,
        };
      },
    });

    const networkWorkflow = createWorkflow({
      id: 'Agent-Network-Outer-Workflow',
      inputSchema: z.object({
        task: z.string(),
        resourceId: z.string(),
        resourceType: RESOURCE_TYPES,
        result: z.string().optional(),
      }),
      outputSchema: z.object({
        result: z.string(),
        task: z.string(),
        isComplete: z.boolean().optional(),
      }),
    })
      .then(routingStep)
      .branch([
        [async ({ inputData }) => !inputData.isComplete && inputData.resourceType === 'agent', agentStep],
        [async ({ inputData }) => !inputData.isComplete && inputData.resourceType === 'workflow', workflowStep],
        [async ({ inputData }) => inputData.isComplete, finishStep],
      ])
      .map({
        task: {
          step: [routingStep, agentStep, workflowStep],
          path: 'task',
        },
        isComplete: {
          step: [routingStep, workflowStep, finishStep],
          path: 'isComplete',
        },
        result: {
          step: [agentStep, workflowStep, finishStep],
          path: 'result',
        },
        resourceId: {
          step: [routingStep, agentStep, workflowStep],
          path: 'resourceId',
        },
        resourceType: {
          step: [routingStep, agentStep, workflowStep],
          path: 'resourceType',
        },
      })
      .commit();

    const mainWorkflow = createWorkflow({
      id: 'Agent-Network-Main-Workflow',
      inputSchema: z.object({
        task: z.string(),
        resourceType: RESOURCE_TYPES,
      }),
      outputSchema: z.object({
        text: z.string(),
      }),
    })
      .dountil(networkWorkflow, async ({ inputData }) => {
        return inputData.isComplete;
      })
      .commit();

    const run = mainWorkflow.createRun();

    const result = await run.start({
      inputData: {
        task: message,
        resourceType: 'none',
      },
    });

    if (result.status === 'failed') {
      throw result.error;
    }

    if (result.status === 'suspended') {
      throw new Error('Workflow suspended');
    }

    return result.result;
  }
}
