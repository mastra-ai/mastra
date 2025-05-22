import { z } from 'zod';
import { Agent } from '../../agent';
import type { DynamicArgument, MastraLanguageModel } from '../../agent';
import { MastraBase } from '../../base';
import { RegisteredLogger } from '../../logger';
import { RuntimeContext } from '../../runtime-context';
import { createWorkflow, type NewWorkflow, createStep } from '../../workflows/vNext';
import type { MastraMemory } from '../../memory';

interface NewAgentNetworkConfig {
  id: string;
  name: string;
  instructions: DynamicArgument<string>;
  model: DynamicArgument<MastraLanguageModel>;
  agents: DynamicArgument<Record<string, Agent>>;
  workflows?: DynamicArgument<Record<string, NewWorkflow>>;
  memory?: DynamicArgument<MastraMemory>;
}

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
  #memory?: DynamicArgument<MastraMemory>;

  constructor({ id, name, instructions, model, agents, memory }: NewAgentNetworkConfig) {
    super({
      component: RegisteredLogger.NETWORK,
      name: name || 'NewAgentNetwork',
    });

    this.id = id;
    this.name = name;
    this.#instructions = instructions;
    this.#model = model;
    this.#agents = agents;
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

    const agentList = Object.entries(agentsToUse)
      .map(([name, agent]) => {
        // Use agent name instead of description since description might not exist
        return ` - **${name}**: ${agent.description}`;
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
    const runtimeContextToUse = runtimeContext || new RuntimeContext();
    const agentsMap = await this.getAgents({ runtimeContext: runtimeContextToUse });
    const routingAgent = await this.getRoutingAgent({ runtimeContext: runtimeContextToUse });

    const routingStep = createStep({
      id: 'routing-step',
      inputSchema: z.object({
        task: z.string(),
        agentId: z.string().optional(),
        result: z.string().optional(),
      }),
      outputSchema: z.object({
        task: z.string(),
        agentId: z.string(),
        prompt: z.string(),
        result: z.string(),
        isComplete: z.boolean().optional(),
      }),
      execute: async ({ inputData }) => {
        console.dir({ inputData }, { depth: null });
        let completionResult;
        if (inputData?.agentId && inputData?.result) {
          // Check if the task is complete
          const completionPrompt = `
                        The agent ${inputData.agentId} has contributed to the task.
                        This is the result from the agent: ${inputData.result}

                        You need to evaluate that our task is complete. Pay very close attention to the SYSTEM INSTRUCTIONS for when the task is considered complete.
                        Original task: ${inputData.task}

                        {
                            "isComplete": boolean,
                            "finalResult": string
                        }
                    `;

          completionResult = await routingAgent.generate(completionPrompt, {
            output: z.object({
              isComplete: z.boolean(),
              finalResult: z.string(),
            }),
          });

          if (completionResult.object.isComplete) {
            return {
              task: inputData.task,
              agentId: inputData.agentId,
              prompt: '',
              result: completionResult.object.finalResult,
              isComplete: true,
            };
          }
        }

        console.log(
          'PROMPT',
          `
                    The user has given you the following task: 
                    ${inputData.task}
                    ${completionResult ? `\n\n${completionResult.object.finalResult}` : ''}

                    Please select the most appropriate agent to handle this task and the prompt to be sent to the agent.

                    {
                        "agentId": string,
                        "prompt": string,
                        "selectionReason": string
                    }
                    `,
        );

        const result = await routingAgent.generate(
          `
                    The user has given you the following task: 
                    ${inputData.task}
                    ${completionResult ? `\n\n${completionResult.object.finalResult}` : ''}

                    Please select the most appropriate agent to handle this task and the prompt to be sent to the agent.

                    {
                        "agentId": string,
                        "prompt": string,
                        "selectionReason": string
                    }
                    `,
          {
            output: z.object({
              agentId: z.string(),
              prompt: z.string(),
              selectionReason: z.string(),
            }),
          },
        );

        console.log('RESULT', result.object);

        return {
          task: inputData.task,
          result: '',
          agentId: result.object.agentId,
          prompt: result.object.prompt,
          isComplete: false,
        };
      },
    });

    const agentStep = createStep({
      id: 'agent-step',
      inputSchema: z.object({
        task: z.string(),
        agentId: z.string(),
        prompt: z.string(),
        result: z.string(),
        isComplete: z.boolean().optional(),
      }),
      outputSchema: z.object({
        task: z.string(),
        agentId: z.string(),
        result: z.string(),
        isComplete: z.boolean().optional(),
      }),
      execute: async ({ inputData }) => {
        const agentId = inputData.agentId;
        console.log('calling agent', agentId);

        const agent = agentsMap[agentId];

        if (!agent) {
          throw new Error(`Agent ${agentId} not found`);
        }

        const result = await agent.generate(inputData.prompt);

        return {
          task: inputData.task,
          agentId,
          result: result.text,
          isComplete: false,
        };
      },
    });

    const finishStep = createStep({
      id: 'finish-step',
      inputSchema: z.object({
        task: z.string(),
        agentId: z.string(),
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
        agentId: z.string().optional(),
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
        [async ({ inputData }) => !inputData.isComplete, agentStep],
        [async ({ inputData }) => inputData.isComplete, finishStep],
      ])
      .map({
        task: {
          step: [routingStep, agentStep],
          path: 'task',
        },
        isComplete: {
          step: [routingStep, finishStep],
          path: 'isComplete',
        },
        result: {
          step: [agentStep, finishStep],
          path: 'result',
        },
        agentId: {
          step: [routingStep, agentStep],
          path: 'agentId',
        },
      })
      .commit();

    const mainWorkflow = createWorkflow({
      id: 'Agent-Network-Main-Workflow',
      inputSchema: z.object({
        task: z.string(),
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
