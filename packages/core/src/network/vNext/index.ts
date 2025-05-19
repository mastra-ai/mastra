import { z } from 'zod';
import { Agent } from '../../agent';
import type { DynamicArgument, MastraLanguageModel } from '../../agent';
import { MastraBase } from '../../base';
import { RegisteredLogger } from '../../logger';
import { RuntimeContext } from '../../runtime-context';
import { createWorkflow, type NewWorkflow, createStep } from '../../workflows/vNext';

interface NewAgentNetworkConfig {
  id: string;
  name: string;
  instructions: DynamicArgument<string>;
  model: DynamicArgument<MastraLanguageModel>;
  agents: DynamicArgument<Record<string, Agent>>;
  workflows?: DynamicArgument<Record<string, NewWorkflow>>;
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

  constructor({ id, name, instructions, model, agents }: NewAgentNetworkConfig) {
    super({
      component: RegisteredLogger.NETWORK,
      name: name || 'NewAgentNetwork',
    });

    this.id = id;
    this.name = name;
    this.#instructions = instructions;
    this.#model = model;
    this.#agents = agents;
  }

  async getRoutingAgent({ runtimeContext }: { runtimeContext?: RuntimeContext }) {
    let instructionsToUse = this.#instructions;

    if (typeof instructionsToUse === 'string') {
      instructionsToUse = instructionsToUse;
    } else {
      instructionsToUse = await instructionsToUse({ runtimeContext: runtimeContext || new RuntimeContext() });
    }

    let agentsToUse: Record<string, Agent>;

    if (typeof this.#agents === 'function') {
      agentsToUse = await this.#agents({ runtimeContext: runtimeContext || new RuntimeContext() });
    } else {
      agentsToUse = this.#agents;
    }

    const agentList = Object.entries(agentsToUse)
      .map(([name, agent]) => {
        // Use agent name instead of description since description might not exist
        return ` - **${name}**: ${agent.description}`;
      })
      .join('\n');

    const instructions = `
          You are a router in a network of specialized AI agents. 
          Your job is to decide which agent should handle each step of a task.
            
          ## System Instructions
          ${instructionsToUse}

          ## Available Agents in Network
          ${agentList}
        `;

    return new Agent({
      name: 'routing-agent',
      instructions,
      model: this.#model,
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
    const routingAgent = await this.getRoutingAgent({ runtimeContext: runtimeContext || new RuntimeContext() });

    const networkWorkflow = createWorkflow({
      id: 'Agent-Network-Outer-Workflow',
      inputSchema: z.object({
        message: z.string(),
      }),
      outputSchema: z.object({
        text: z.string(),
      }),
    });

    const routingStep = createStep({
      id: 'routing-step',
      inputSchema: z.object({
        message: z.string(),
      }),
      outputSchema: z.object({
        agentId: z.string(),
        prompt: z.string(),
      }),
      execute: async ({ inputData }) => {
        const result = await routingAgent.generate(
          `
                    The user has asked you to: 
                    ${inputData.message}

                    Please select the most appropriate agent to handle this task and the prompt to be sent to the agent.

                    {
                        "agentId": string,
                        "prompt": string
                    }
                    `,
          {
            output: z.object({
              agentId: z.string(),
              prompt: z.string(),
            }),
          },
        );

        return {
          agentId: result.object.agentId,
          prompt: result.object.prompt,
        };
      },
    });

    networkWorkflow.then(routingStep).commit();

    const run = networkWorkflow.createRun();

    const result = await run.start({
      inputData: {
        message,
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
