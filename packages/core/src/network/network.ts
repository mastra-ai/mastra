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
import type { AgentGenerateOptions, AgentStreamOptions } from '../agent/types';
import { MastraBase } from '../base';
import { createTool } from '../tools';
import { NetworkState } from './state';
import type { NetworkConfig } from './types';
import type { Mastra } from '../mastra';

interface CurrentNetworkState {
  state: NetworkState;
  lastResult: string;
  callCount: number;
  input: string;
}

export class AgentNetwork extends MastraBase {
  state: NetworkState;
  agents: Agent[];
  model: LanguageModelV1;
  current_state?: CurrentNetworkState;
  instructions?: string;
  routingAgent: Agent;

  constructor(config: NetworkConfig) {
    super({ component: 'AGENT', name: 'NETWORK' });
    this.state = config.initialState || new NetworkState({});
    this.agents = config.agents;
    this.model = config.routingModel;
    this.instructions = config.instructions;

    this.routingAgent = new Agent({
      name: config.name,
      instructions: this.getInstructions(),
      model: this.model,
    });
  }

  setCurrentState(state: CurrentNetworkState) {
    this.current_state = state;
  }

  getState() {
    return this.current_state;
  }

  getInstructions() {
    const agentDescriptions = this.agents.map(agent => ({
      name: agent.name,
      description: agent.instructions,
    }));

    return `
            You are a router in a network of specialized agents. Your job is to decide which agent should handle the next step or if the task is complete.

            Available agents as tool calls:
            ${agentDescriptions.map(a => `- ${a.name.replace(/[^a-zA-Z0-9_-]/g, '_')}`).join('\n')}

            ${this.instructions}

            Based on the above information, decide which agent should be called next or if the task is complete.
            
            WORKFLOW:
            1. ALWAYS start by using the getNetworkState tool to check the current state of the network, including any previous agent results
            2. Assess the current state and determine if you need to call an agent or if the task is complete
            3. If you need to call an agent, execute the agent as a tool call with the appropriate message
               - Include relevant information from previous agent results in your message to the next agent
               - Make sure to pass along important context from the original query
            4. IMMEDIATELY after receiving the agent's response, use getNetworkState again to see the updated network state
               - This step is MANDATORY - you must check the state after EACH agent call
            5. Assess if the task is now complete or if another agent needs to be called
            6. If the task is complete, provide a final comprehensive answer based on all the information gathered from the agents
            7. If another agent is needed, execute that agent as a tool call
            
            IMPORTANT: You MUST call getNetworkState before and after EVERY agent call. This ensures each agent has access to the results of previous agents.
        `;
  }

  buildNetworkTools() {
    // Define the tool type for better type safety
    type AgentTool = ReturnType<typeof createTool>;

    // Create tools from agents with state tracking
    const agentAsTools = this.agents.reduce<Record<string, AgentTool>>(
      (memo, agent) => {
        // Sanitize agent name to ensure it only contains alphanumeric characters, underscores, and hyphens
        const agentId = agent.name.replace(/[^a-zA-Z0-9_-]/g, '_');

        memo[agentId] = createTool({
          id: agentId,
          description: `${agent.name}`,
          inputSchema: z.object({ message: z.string() }),
          outputSchema: z.object({ message: z.string() }),
          execute: async ({ context }) => {
            this.logger.info(`Executing agent [name=${agent.name}] [id=${agentId}] [context=${context.message}]`);

            // Prepare agent context with any relevant state information
            let agentContext = context.message;

            // If this isn't the first agent call, we might want to include previous results
            if (this.current_state && this.current_state.callCount > 0) {
              // Log that we're passing context from previous agents
              this.logger.debug(`Passing context from previous agents to ${agent.name}`);
            }

            // Generate response from the agent
            const startTime = Date.now();

            const result = await agent.generate(agentContext, {
              context: this.current_state?.lastResult
                ? [{ role: 'assistant', content: this.current_state?.lastResult }]
                : [],
            });

            const duration = Date.now() - startTime;

            // Update network state with this agent's result
            if (this.current_state) {
              this.current_state.lastResult = result.text;
              this.current_state.callCount += 1;

              // Store the result in the state object as well with a timestamp
              const timestamp = new Date().toISOString();
              this.current_state.state.set(agentId, {
                result: result.text,
                timestamp: timestamp,
                input: agentContext,
              });
              this.logger.debug(
                `Updated network state [agent=${agentId}] [callCount=${this.current_state.callCount}] [timestamp=${timestamp}]`,
              );
            }

            // Log a preview of the result
            const resultPreview = result.text.length > 100 ? `${result.text.substring(0, 100)}...` : result.text;
            this.logger.debug(
              `Agent response [name=${agent.name}] [duration=${duration}ms] [preview=${resultPreview}]`,
            );
            return { message: result.text };
          },
        });
        return memo;
      },
      {} as Record<string, AgentTool>,
    );

    // Create the router agent with the tools
    return {
      ...agentAsTools,
      getNetworkState: createTool({
        id: 'getNetworkState',
        description: 'Get the current state of the agent network, including previous agent results and call history',
        inputSchema: z.object({}),
        outputSchema: z.object({
          state: z.object({
            callCount: z.number(),
            lastResult: z.any(),
            input: z.string(),
            agentResults: z.record(z.string()),
            agentHistory: z.array(
              z.object({
                agent: z.string(),
                input: z.string(),
                result: z.string(),
                timestamp: z.string(),
              }),
            ),
            stateData: z.record(z.unknown()),
          }),
        }),
        execute: async () => {
          this.logger.info('Querying Network State');

          // Return the current network state in a structured format
          const stateObj = this.current_state?.state.toObject() || {};

          // Create a more structured representation of agent results
          const agentResults: Record<string, string> = {};
          const agentHistory: Array<{ agent: string; input: string; result: string; timestamp: string }> = [];

          // Group related agent data (results, timestamps, inputs)
          const agentIds = new Set<string>();

          // First, identify all unique agent IDs
          for (const key in stateObj) {
            agentIds.add(key);
          }

          // Then collect all data for each agent
          for (const agentId of agentIds) {
            const result = stateObj[`${agentId}`];

            if (result) {
              // Add to the results object
              agentResults[`${agentId}`] = result;

              // Add to the chronological history
              agentHistory.push({
                agent: agentId,
                input: result.input || '',
                result: result.result || '',
                timestamp: result.timestamp || new Date().toISOString(),
              });
            }
          }

          // Sort history by timestamp
          agentHistory.sort((a, b) => {
            return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          });

          const callCount = this.current_state?.callCount || 0;
          this.logger.info(
            `Network state retrieved [callCount=${callCount}] [agentCount=${agentIds.size}] [historyLength=${agentHistory.length}]`,
          );

          return {
            state: {
              callCount: this.current_state?.callCount || 0,
              lastResult: this.current_state?.lastResult || '',
              input: this.current_state?.input || '',
              agentResults,
              agentHistory,
              stateData: stateObj,
            },
          };
        },
      }),
    };
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
    try {
      // Initialize state if not already set
      if (!this.current_state) {
        this.setCurrentState({
          state: new NetworkState({}),
          lastResult: '',
          callCount: 0,
          input: typeof messages === 'string' ? messages : JSON.stringify(messages),
        });
      }

      const ops = {
        maxSteps: this.agents?.length * 10,
        ...args,
        toolsets: {
          routing: this.buildNetworkTools(),
        },
      };

      // Get response from router - pass options directly without modification
      const result = await this.routingAgent.generate(
        messages,
        ops as AgentGenerateOptions<Z> & { output?: never; experimental_output?: never },
      );

      // Update state with the result
      if (this.current_state) {
        this.current_state.lastResult = result.text;
        this.current_state.callCount += 1;
      }

      return result;
    } catch (e) {
      console.error(e);
      throw e;
    }
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
    try {
      // Initialize state if not already set
      if (!this.current_state) {
        this.setCurrentState({
          state: new NetworkState({}),
          lastResult: '',
          callCount: 0,
          input: typeof messages === 'string' ? messages : JSON.stringify(messages),
        });
      }

      const ops = {
        maxSteps: this.agents?.length * 10,
        ...args,
        toolsets: {
          routing: this.buildNetworkTools(),
        },
      };

      // Get streaming response from router - pass options directly without modification
      const streamResult = await this.routingAgent.stream(
        messages,
        ops as AgentStreamOptions<Z> & { output?: never; experimental_output?: never },
      );

      // Update state (note: we can't access the full text yet as it's streaming)
      if (this.current_state) {
        this.current_state.callCount += 1;
      }

      return streamResult;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  __registerMastra(p: Mastra) {
    this.routingAgent.__registerMastra(p);

    // Register primitives for each agent in the network
    for (const agent of this.agents) {
      if (typeof agent.__registerMastra === 'function') {
        agent.__registerMastra(p);
      }
    }
  }
}
