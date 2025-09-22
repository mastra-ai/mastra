import { ExternalAgent, MessageList, type AgentExecutionOptions, type MastraGenerateResult } from "@mastra/core/agent";
import type z from "zod";
import type { createAgent } from "langchain";
import type { MessageListInput } from "@mastra/core/agent/message-list";

// TypeScript interfaces for LangChain tools
interface LangChainTool {
    name: string;
    description: string;
    schema: z.ZodObject<any>;
    func: (input: any) => Promise<any> | any;
}

interface LangChainAgentType {
    name?: string; // Agent name
    options?: {
        tools?: LangChainTool[];
        model?: string; // Model string like "openai:gpt-4o-mini"
        prompt?: string; // Instructions/prompt for the agent
    };
    invoke: (input: any) => Promise<any>;
}

/**
 * Convert external agent result to MastraGenerateResult format
 */
export function convertExternalAgentResult(externalResult: any): MastraGenerateResult {
    const messages = externalResult.messages || [];

    // Extract the final text response
    let text = '';
    const lastAIMessage = messages.filter((msg: any) => msg.constructor?.name === 'AIMessage').pop();
    if (lastAIMessage?.content) {
        text = lastAIMessage.content;
    }

    // Extract usage information from the last message with usage data
    let usage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
    };

    for (const message of messages) {
        if (message.response_metadata?.usage) {
            const messageUsage = message.response_metadata.usage;
            usage = {
                promptTokens: messageUsage.prompt_tokens || 0,
                completionTokens: messageUsage.completion_tokens || 0,
                totalTokens: messageUsage.total_tokens || 0,
            };
        }
    }

    // Extract tool calls and results
    const toolCalls: any[] = [];
    const toolResults: any[] = [];

    for (const message of messages) {
        if (message.tool_calls?.length > 0) {
            toolCalls.push(...message.tool_calls.map((tc: any) => ({
                toolCallId: tc.id,
                toolName: tc.name,
                args: tc.args,
            })));
        }

        if (message.constructor?.name === 'ToolMessage') {
            toolResults.push({
                toolCallId: message.tool_call_id,
                toolName: message.name,
                result: message.content,
            });
        }
    }

    // Extract finish reason from the last AI message
    const finishReason = lastAIMessage?.response_metadata?.finish_reason || 'stop';

    // Convert messages to a format that matches Mastra's expected structure
    const convertedMessages = messages.map((msg: any) => {
        let role = 'user';
        if (msg.constructor?.name === 'AIMessage') role = 'assistant';
        else if (msg.constructor?.name === 'ToolMessage') role = 'tool';
        else if (msg.constructor?.name === 'HumanMessage') role = 'user';

        // Handle tool messages with proper Mastra format
        if (msg.constructor?.name === 'ToolMessage') {
            return {
                id: msg.id,
                role: 'tool',
                content: [
                    {
                        type: 'tool-result',
                        toolCallId: msg.tool_call_id,
                        toolName: msg.name,
                        result: msg.content,
                    }
                ],
            };
        }

        // Handle user messages - content should be array with text objects
        if (msg.constructor?.name === 'HumanMessage') {
            return {
                id: msg.id,
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: msg.content,
                    }
                ],
            };
        }

        // Handle assistant messages
        if (msg.constructor?.name === 'AIMessage') {
            const baseMessage = {
                id: msg.id,
                role: 'assistant',
            };

            // If assistant message has tool calls, format content as tool-call array
            if (msg.tool_calls?.length > 0) {
                return {
                    ...baseMessage,
                    content: msg.tool_calls.map((tc: any) => ({
                        type: 'tool-call',
                        toolCallId: tc.id,
                        toolName: tc.name,
                        args: tc.args,
                    })),
                };
            }

            // Regular assistant message with text content
            return {
                ...baseMessage,
                content: msg.content,
            };
        }

        // Fallback for any other message types
        return {
            id: msg.id,
            role,
            content: msg.content,
        };
    });

    return {
        text,
        usage,
        steps: [], // LangChain doesn't have steps concept, so empty array
        finishReason,
        warnings: [],
        providerMetadata: lastAIMessage?.response_metadata || {},
        request: {}, // We don't have access to the original request in this context
        reasoning: '',
        reasoningText: '',
        toolCalls,
        toolResults,
        sources: [],
        files: [],
        response: {
            messages: convertedMessages,
        },
        totalUsage: usage,
        object: undefined,
        error: undefined,
        tripwire: false,
        tripwireReason: '',
        traceId: undefined,
    };
}

/**
 * LangChain agent implementation that extends the core ExternalAgent
 */
class LangChainAgent extends ExternalAgent {
    private langchainAgent: LangChainAgentType;
    protected instructions: string;

    constructor(
        langchainAgent: LangChainAgentType,
        config: {
            name: string;
            instructions?: string;
        }
    ) {
        super({ name: config.name });
        this.langchainAgent = langchainAgent;

        // Use provided instructions or extract from LangChain agent's prompt
        this.instructions = config.instructions || langchainAgent.options?.prompt || '';
    }

    /**
     * Get the instructions for this agent
     */
    getInstructions() {
        return this.instructions || '';
    }

    async getTools() {
        const mastraTools: Record<string, any> = {};

        // Get tools from the LangChain agent
        const tools = this.langchainAgent.options?.tools || [];

        if (Array.isArray(tools)) {
            for (const tool of tools) {
                if (tool && tool.name) {
                    mastraTools[tool.name] = {
                        id: tool.name,
                        description: tool.description || '',
                        inputSchema: tool.schema, // Zod schema
                        execute: async (context: any) => {
                            // Call the LangChain tool function with the right format
                            return await tool.func(context.request);
                        }
                    };
                }
            }
        }

        return mastraTools;
    }

    /**
     * Parse model string from LangChain agent
     * Format: "provider:model-id" (e.g., "openai:gpt-4o-mini")
     */
    private parseModelString() {
        const modelString = this.langchainAgent.options?.model;
        if (!modelString || typeof modelString !== 'string') {
            return { provider: 'unknown', modelId: 'unknown' };
        }

        const parts = modelString.split(':');
        if (parts.length === 2) {
            return { provider: parts[0], modelId: parts[1] };
        }

        // If no colon, assume it's just a model ID and try to infer provider
        return { provider: 'unknown', modelId: modelString };
    }

    getLLM() {
        const { provider, modelId } = this.parseModelString();
        const modelString = this.langchainAgent.options?.model || 'unknown';

        console.warn(`LangChain agents manage their LLM internally. Please use the agent's generate() or stream() methods directly instead of accessing the LLM.`);

        return {
            getModel: () => {
                return {
                    provider,
                    modelId,
                    specificationVersion: 'v1' as const,
                    // Basic mock implementation
                    doGenerate: async () => { throw new Error('Use agent.generate() instead'); },
                    doStream: async () => { throw new Error('Use agent.stream() instead'); },
                };
            },
            getProvider: () => provider,
            getModelId: () => modelId,
            // Add some additional metadata that might be useful
            getModelString: () => modelString,
        };
    }

    async generate(prompt: MessageListInput, options?: AgentExecutionOptions): Promise<MastraGenerateResult<any>> {
        const messageList = new MessageList();
        messageList.add(prompt, 'user');

        // Execute the LangChain agent
        const messages = messageList.get.all.prompt() as any;
        const result = await this.langchainAgent.invoke({ messages });

        // Convert LangChain result to MastraGenerateResult
        return convertExternalAgentResult(result);
    }

    async *stream(prompt: MessageListInput, options?: AgentExecutionOptions): AsyncIterable<string> {
        // For now, we'll implement streaming by yielding the complete response
        // In the future, this could be enhanced to support actual streaming if the external agent supports it
        const response = await this.generate(prompt, options);

        // Simulate streaming by yielding chunks from the text
        const words = response.text.split(' ');
        for (const word of words) {
            yield word + ' ';
            // Small delay to simulate streaming
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }
}

/**
 * Convert a LangChain agent to be compatible with Mastra framework
 * 
 * @param langchainAgent - The LangChain agent to convert
 * @param config - Configuration for the Mastra agent wrapper
 * @returns A LangChain agent that extends ExternalAgent
 */
export function toMastraCompatible(
    config: {
        name?: string;
        agent: ReturnType<typeof createAgent>;
        instructions?: string;
    }
): ExternalAgent {
    const langchainAgent = config.agent as LangChainAgentType;

    // Use provided name, or extract from LangChain agent, or default to 'langchain-agent'
    const agentName = config.name || langchainAgent.name || 'langchain-agent';

    return new LangChainAgent(langchainAgent, {
        name: agentName,
        instructions: config.instructions,
    });
}