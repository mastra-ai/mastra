import type {
  CoreMessage,
  GenerateObjectResult,
  GenerateTextResult,
  LanguageModelV1,
  StreamObjectResult,
  StreamTextResult,
} from 'ai';
import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod';
import type { ZodSchema } from 'zod';

import { Agent } from '../agent';
import type { AgentGenerateOptions, AgentStreamOptions } from '../agent';
import { MastraBase } from '../base';

import type { Container } from '../di';
import { RegisteredLogger } from '../logger';
import type { Mastra } from '../mastra';
import { createTool } from '../tools';
import type { ToolAction } from '../tools';
import type { AgentNetworkConfig } from './types';

export class AgentNetwork extends MastraBase {
  #instructions: string;
  #agents: Agent[];
  #model: LanguageModelV1;
  #routingAgent: Agent;
  #agentHistory: Record<
    string,
    Array<{
      input: string;
      output: string;
      timestamp: string;
    }>
  > = {};

  constructor(config: AgentNetworkConfig) {
    super({ component: RegisteredLogger.NETWORK, name: 'AgentNetwork' });

    this.#instructions = config.instructions;
    this.#agents = config.agents;
    this.#model = config.model;

    this.#routingAgent = new Agent({
      name: config.name,
      instructions: this.getInstructions(),
      model: this.#model,
      tools: this.getTools() as Record<string, ToolAction>,
    });
  }

  formatAgentId(name: string) {
    return name.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  getTools() {
    return {
      transmit: createTool({
        id: 'transmit',
        description: 'Call one or more specialized agents to handle specific tasks',
        inputSchema: z.object({
          actions: z.array(
            z.object({
              agent: z.string().describe('The name of the agent to call'),
              input: z.string().describe('The input to pass to the agent'),
              includeHistory: z
                .boolean()
                .optional()
                .describe('Whether to include previous agent outputs in the context'),
            }),
          ),
        }),
        execute: async ({ context, container }) => {
          try {
            // Extract the actions from the context
            const actions = context.actions;

            this.logger.debug(`Executing ${actions.length} specialized agents`);

            // Execute each agent in parallel and collect results
            const results = await Promise.all(
              actions.map(action =>
                this.executeAgent(
                  action.agent,
                  [{ role: 'user', content: action.input }],
                  action.includeHistory,
                  container,
                ),
              ),
            );

            this.logger.debug('Results:', { results });

            // Store the results in the agent history for future reference
            actions.forEach((action, index) => {
              this.#addToAgentHistory(action.agent, {
                input: action.input,
                output: results[index] || '', // Ensure output is always a string
              });
            });

            // Format the results with agent names for clarity
            return actions.map((action, index) => `[${action.agent}]: ${results[index]}`).join('\n\n');
          } catch (err) {
            // Properly type the error
            const error = err as Error;
            this.logger.error('Error in transmit tool:', { error });
            return `Error executing agents: ${error.message}`;
          }
        },
      }),
    } as const;
  }

  #addToAgentHistory(agentId: string, interaction: { input: string; output: string }) {
    if (!this.#agentHistory[agentId]) {
      this.#agentHistory[agentId] = [];
    }
    // Add timestamp to the interaction
    this.#agentHistory[agentId].push({
      ...interaction,
      timestamp: new Date().toISOString(),
    });
  }

  getAgentHistory(agentId: string) {
    return this.#agentHistory[agentId] || [];
  }

  #clearNetworkHistoryBeforeRun() {
    this.#agentHistory = {};
  }

  /**
   * Get the history of all agent interactions that have occurred in this network
   * @returns A record of agent interactions, keyed by agent ID
   */
  getAgentInteractionHistory() {
    return { ...this.#agentHistory };
  }

  /**
   * Get a summary of agent interactions in a more readable format, displayed chronologically
   * @returns A formatted string with all agent interactions in chronological order
   */
  getAgentInteractionSummary() {
    const history = this.#agentHistory;
    const agentIds = Object.keys(history);

    if (agentIds.length === 0) {
      return 'No agent interactions have occurred yet.';
    }

    // Collect all interactions with their agent IDs
    const allInteractions: Array<{
      agentId: string;
      interaction: { input: string; output: string; timestamp: string };
      index: number;
      // We'll use a global sequence number to track the true chronological order
      sequence: number;
    }> = [];

    // Track the global sequence of interactions
    let globalSequence = 0;

    // Gather all interactions with their source agent
    agentIds.forEach(agentId => {
      const interactions = history[agentId] || [];
      interactions.forEach((interaction, index) => {
        allInteractions.push({
          agentId,
          interaction,
          index,
          // Assign a sequence number based on when it was added to the history
          sequence: globalSequence++,
        });
      });
    });

    // Sort by timestamp for true chronological order
    allInteractions.sort((a, b) => {
      // Compare timestamps if available
      if (a.interaction.timestamp && b.interaction.timestamp) {
        return new Date(a.interaction.timestamp).getTime() - new Date(b.interaction.timestamp).getTime();
      }
      // Fall back to sequence number if timestamps aren't available
      return a.sequence - b.sequence;
    });

    // Format the chronological summary
    if (allInteractions.length === 0) {
      return 'No agent interactions have occurred yet.';
    }

    return (
      '# Chronological Agent Interactions\n\n' +
      allInteractions
        .map(
          (item, i) =>
            `## Step ${i + 1}: Agent ${item.agentId} at ${item.interaction.timestamp}\n` +
            `**Input:** ${item.interaction.input.substring(0, 100)}${item.interaction.input.length > 100 ? '...' : ''}\n\n` +
            `**Output:** ${item.interaction.output.substring(0, 100)}${item.interaction.output.length > 100 ? '...' : ''}`,
        )
        .join('\n\n')
    );
  }

  async executeAgent(agentId: string, input: CoreMessage[], includeHistory = false, container?: Container) {
    try {
      // Find the agent by its formatted ID
      const agent = this.#agents.find(agent => this.formatAgentId(agent.name) === agentId);

      if (!agent) {
        throw new Error(
          `Agent "${agentId}" not found. Available agents: ${this.#agents.map(a => this.formatAgentId(a.name)).join(', ')}`,
        );
      }

      // If requested, include relevant history from other agents
      let messagesWithContext = [...input];

      if (includeHistory) {
        // Get all agent histories
        const allHistory = Object.entries(this.#agentHistory);

        if (allHistory.length > 0) {
          // Add a system message with the context from other agents
          const contextMessage = {
            role: 'system' as const,
            content: `Previous agent interactions:\n\n${allHistory
              .map(([agentName, interactions]) => {
                return `## ${agentName}\n${interactions
                  .map(
                    (interaction, i) =>
                      `Interaction ${i + 1} (${interaction.timestamp || 'No timestamp'}):\n- Input: ${interaction.input}\n- Output: ${interaction.output}`,
                  )
                  .join('\n\n')}`;
              })
              .join('\n\n')}`,
          };

          // Add the context message before the user input
          messagesWithContext = [contextMessage, ...messagesWithContext];
        }
      }

      // Generate a response from the agent
      const result = await agent.generate(messagesWithContext, { container });

      return result.text;
    } catch (err) {
      // Properly type the error
      const error = err as Error;
      this.logger.error(`Error executing agent "${agentId}":`, { error });
      return `Unable to execute agent "${agentId}": ${error.message}`;
    }
  }

  getInstructions() {
    // Create a formatted list of available agents with their names
    const agentList = this.#agents
      .map(agent => {
        const id = this.formatAgentId(agent.name);
        // Use agent name instead of description since description might not exist
        return ` - **${id}**: ${agent.name}`;
      })
      .join('\n');

    return `
            You are a router in a network of specialized AI agents. 
            Your job is to decide which agent should handle each step of a task.
            
            ## System Instructions
            ${this.#instructions}
            
            ## Available Specialized Agents
            You can call these agents using the "transmit" tool:
            ${agentList}
            
            ## How to Use the "transmit" Tool
            
            The "transmit" tool allows you to call one or more specialized agents.
            
            ### Single Agent Call
            To call a single agent, use this format:
            \`\`\`json
            {
              "actions": [
                {
                  "agent": "agent_name",
                  "input": "detailed instructions for the agent"
                }
              ]
            }
            \`\`\`
            
            ### Multiple Parallel Agent Calls
            To call multiple agents in parallel, use this format:
            \`\`\`json
            {
              "actions": [
                {
                  "agent": "first_agent_name",
                  "input": "detailed instructions for the first agent"
                },
                {
                  "agent": "second_agent_name",
                  "input": "detailed instructions for the second agent"
                }
              ]
            }
            \`\`\`
            
            ## Context Sharing
            
            When calling an agent, you can choose to include the output from previous agents in the context.
            This allows the agent to take into account the results from previous steps.
            
            To include context, add the "includeHistory" field to the action and set it to true:
            \`\`\`json
            {
              "actions": [
                {
                  "agent": "agent_name",
                  "input": "detailed instructions for the agent",
                  "includeHistory": true
                }
              ]
            }
            \`\`\`
            
            ## Best Practices
            1. Break down complex tasks into smaller steps
            2. Choose the most appropriate agent for each step
            3. Provide clear, detailed instructions to each agent
            4. Synthesize the results from multiple agents when needed
            5. Provide a final summary or answer to the user
            
            ## Workflow
            1. Analyze the user's request
            2. Identify which specialized agent(s) can help
            3. Call the appropriate agent(s) using the transmit tool
            4. Review the agent's response
            5. Either call more agents or provide a final answer
        `;
  }

  getRoutingAgent() {
    return this.#routingAgent;
  }

  getAgents() {
    return this.#agents;
  }

  async generate<Z extends ZodSchema | JSONSchema7 | undefined = undefined>(
    messages: string | string[] | CoreMessage[],
    args?: AgentGenerateOptions<Z> & { output?: never; experimental_output?: never },
  ): Promise<GenerateTextResult<any, Z extends ZodSchema ? z.infer<Z> : unknown>>;

  async generate<Z extends ZodSchema | JSONSchema7 | undefined = undefined>(
    messages: string | string[] | CoreMessage[],
    args?: AgentGenerateOptions<Z> &
      ({ output: Z; experimental_output?: never } | { experimental_output: Z; output?: never }),
  ): Promise<GenerateObjectResult<Z extends ZodSchema ? z.infer<Z> : unknown>>;

  async generate<Z extends ZodSchema | JSONSchema7 | undefined = undefined>(
    messages: string | string[] | CoreMessage[],
    args?: AgentGenerateOptions<Z> &
      ({ output?: Z; experimental_output?: never } | { experimental_output?: Z; output?: never }),
  ): Promise<
    | GenerateTextResult<any, Z extends ZodSchema ? z.infer<Z> : unknown>
    | GenerateObjectResult<Z extends ZodSchema ? z.infer<Z> : unknown>
  > {
    this.#clearNetworkHistoryBeforeRun();
    this.logger.debug(`AgentNetwork: Starting generation with ${this.#agents.length} available agents`);

    const ops = {
      maxSteps: this.#agents?.length * 10, // Default to 10 steps per agent
      ...args,
    };

    // Log the start of the routing process
    this.logger.debug(`AgentNetwork: Routing with max steps: ${ops.maxSteps}`);

    // Generate a response using the routing agent
    const result = await this.#routingAgent.generate(
      messages,
      ops as AgentGenerateOptions<Z> & { output?: never; experimental_output?: never },
    );

    // Log completion
    this.logger.debug(`AgentNetwork: Generation complete with ${result.steps?.length || 0} steps`);

    return result;
  }

  async stream<Z extends ZodSchema | JSONSchema7 | undefined = undefined>(
    messages: string | string[] | CoreMessage[],
    args?: AgentStreamOptions<Z> & { output?: never; experimental_output?: never },
  ): Promise<StreamTextResult<any, Z extends ZodSchema ? z.infer<Z> : unknown>>;
  async stream<Z extends ZodSchema | JSONSchema7 | undefined = undefined>(
    messages: string | string[] | CoreMessage[],
    args?: AgentStreamOptions<Z> &
      ({ output: Z; experimental_output?: never } | { experimental_output: Z; output?: never }),
  ): Promise<StreamObjectResult<any, Z extends ZodSchema ? z.infer<Z> : unknown, any>>;
  async stream<Z extends ZodSchema | JSONSchema7 | undefined = undefined>(
    messages: string | string[] | CoreMessage[],
    args?: AgentStreamOptions<Z> &
      ({ output?: Z; experimental_output?: never } | { experimental_output?: Z; output?: never }),
  ): Promise<
    | StreamTextResult<any, Z extends ZodSchema ? z.infer<Z> : unknown>
    | StreamObjectResult<any, Z extends ZodSchema ? z.infer<Z> : unknown, any>
  > {
    this.#clearNetworkHistoryBeforeRun();
    this.logger.debug(`AgentNetwork: Starting generation with ${this.#agents.length} available agents`);

    const ops = {
      maxSteps: this.#agents?.length * 10, // Default to 10 steps per agent
      ...args,
    };

    // Log the start of the routing process
    this.logger.debug(`AgentNetwork: Routing with max steps: ${ops.maxSteps}`);

    // Generate a response using the routing agent
    const result = await this.#routingAgent.stream(
      messages,
      ops as AgentStreamOptions<Z> & { output?: never; experimental_output?: never },
    );

    return result;
  }

  __registerMastra(p: Mastra) {
    this.__setLogger(p.getLogger());
    this.#routingAgent.__registerMastra(p);
    // Register primitives for each agent in the network
    for (const agent of this.#agents) {
      if (typeof agent.__registerMastra === 'function') {
        agent.__registerMastra(p);
      }
    }
  }
}
