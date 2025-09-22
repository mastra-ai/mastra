import { run } from "@openai/agents";
import { ExternalAgent, MessageList, type AgentExecutionOptions, type MastraGenerateResult } from "@mastra/core/agent";
import type { MessageListInput } from "@mastra/core/agent/message-list";

export class OpenAI extends ExternalAgent {
    private agent: any; // OpenAI Agent type

    constructor({ name, agent }: { name: string, agent: any }) {
        super({ name: name || 'openai-agent' });
        this.agent = agent;
    }

    getInstructions() {
        return this.agent.instructions || this.agent.systemMessage || '';
    }

    async getTools() {
        const mastraTools: Record<string, any> = {};

        // Get tools from the OpenAI agent
        const tools = this.agent.tools || [];

        // Convert OpenAI agent tools to Mastra format
        for (const tool of tools) {
            if (tool && tool.name) {
                mastraTools[tool.name] = {
                    id: tool.name,
                    description: tool.description || '',
                    inputSchema: tool.parameters, // OpenAI uses 'parameters' which is typically a Zod schema
                    execute: async (context: any) => {
                        // Call the OpenAI tool function
                        return await tool.execute(context);
                    }
                };
            }
        }

        return mastraTools;
    }

    async getLLM() {
        // OpenAI agents typically don't expose the underlying model directly
        // but we can try to extract what we can
        const model = this.agent.model || this.agent.llm;

        return {
            getModel: () => {
                if (typeof model === 'string') {
                    return model;
                }
                return {
                    ...model,
                    specificationVersion: 'v1',
                };
            },
            getProvider: () => 'openai', // OpenAI agents use OpenAI by default
            getModelId: () => {
                if (typeof model === 'string') {
                    return model;
                }
                return model?.modelId || model?.model || 'gpt-4';
            },
        };
    }

    async generate(prompt: MessageListInput, options?: AgentExecutionOptions): Promise<MastraGenerateResult<any>> {
        // Create proper UserMessageItem format for OpenAI agents
        let userMessage: any;

        if (typeof prompt === 'string') {
            userMessage = {
                role: "user",
                content: prompt,
                type: "message"
            };
        } else if (Array.isArray(prompt)) {
            // Extract text from message array and create proper content structure
            const textContent = prompt.map(msg => {
                if (typeof msg === 'string') return msg;
                if (msg && typeof msg === 'object' && 'content' in msg) {
                    const msgContent = (msg as any).content;
                    if (typeof msgContent === 'string') return msgContent;
                    if (Array.isArray(msgContent)) {
                        return msgContent.map((c: any) => c.type === 'text' ? c.text : '').join('');
                    }
                }
                return '';
            }).join(' ');

            userMessage = {
                role: "user",
                content: textContent,
                type: "message"
            };
        } else {
            userMessage = {
                role: "user",
                content: String(prompt),
                type: "message"
            };
        }

        console.log('OpenAI agent input:', userMessage);

        // OpenAI agents run function expects agent and AgentInputItem format
        const result = await run(this.agent, [userMessage]);

        const currentStep = result.state._currentStep;
        console.log('OpenAI agent result:', currentStep?.type === 'next_step_final_output' ? currentStep.output : 'No output');

        return this.convertOpenAIResult(result);
    }

    /**
     * Convert OpenAI agent result to MastraGenerateResult format
     */
    private convertOpenAIResult(runResult: any): MastraGenerateResult<any> {
        // Extract text from the final output in the RunResult
        let text = '';
        const currentStep = runResult.state?._currentStep;
        if (currentStep?.type === 'next_step_final_output') {
            text = currentStep.output;
        } else if (runResult.state?._generatedItems?.length > 0) {
            const lastItem = runResult.state._generatedItems[runResult.state._generatedItems.length - 1];
            if (lastItem.content) {
                text = typeof lastItem.content === 'string' ? lastItem.content : lastItem.content.text || '';
            }
        }

        // Extract usage information from context
        let usage = {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
        };

        if (runResult.state?._context?.usage) {
            const contextUsage = runResult.state._context.usage;
            usage = {
                promptTokens: contextUsage.inputTokens || contextUsage.promptTokens || 0,
                completionTokens: contextUsage.outputTokens || contextUsage.completionTokens || 0,
                totalTokens: contextUsage.totalTokens || 0,
            };
        }

        // Extract tool calls and results from generated items
        const toolCalls: any[] = [];
        const toolResults: any[] = [];
        const convertedMessages = [];

        // Process generated items  
        const generatedItems = runResult.state?._generatedItems || [];
        for (const item of generatedItems) {
            if (item.type === 'tool_call_item') {
                // Tool call item
                const rawItem = item.rawItem;
                const toolCall = {
                    toolCallId: rawItem.callId,
                    toolName: rawItem.name,
                    args: JSON.parse(rawItem.arguments || '{}'),
                };
                toolCalls.push(toolCall);

                // Add tool call message
                convertedMessages.push({
                    id: rawItem.id || Math.random().toString(36),
                    role: 'assistant',
                    content: [{
                        type: 'tool-call',
                        toolCallId: rawItem.callId,
                        toolName: rawItem.name,
                        args: JSON.parse(rawItem.arguments || '{}'),
                    }],
                });
            } else if (item.type === 'tool_call_output_item') {
                // Tool call result item
                const rawItem = item.rawItem;
                const toolResult = {
                    toolCallId: rawItem.callId,
                    toolName: rawItem.name,
                    result: item.output || rawItem.output,
                };
                toolResults.push(toolResult);

                // Add tool result message
                convertedMessages.push({
                    id: Math.random().toString(36),
                    role: 'tool',
                    content: [{
                        type: 'tool-result',
                        toolCallId: rawItem.callId,
                        toolName: rawItem.name,
                        result: item.output || rawItem.output,
                    }],
                });
            } else if (item.type === 'message_output_item') {
                // Regular message item
                const rawItem = item.rawItem;
                if (rawItem.role === 'assistant') {
                    // Extract text from content array
                    let messageText = '';
                    if (rawItem.content && Array.isArray(rawItem.content)) {
                        const textContent = rawItem.content.find((c: any) => c.type === 'output_text');
                        messageText = textContent?.text || '';
                    }

                    convertedMessages.push({
                        id: rawItem.id || Math.random().toString(36),
                        role: 'assistant',
                        content: messageText,
                    });
                } else if (rawItem.role === 'user') {
                    convertedMessages.push({
                        id: rawItem.id || Math.random().toString(36),
                        role: 'user',
                        content: [{ type: 'text', text: rawItem.content || '' }],
                    });
                }
            }
        }

        // If we don't have messages from generated items, create them from original input and final output
        if (convertedMessages.length === 0) {
            // Add the original user input
            const originalInput = runResult.state?._originalInput?.[0];
            if (originalInput) {
                convertedMessages.push({
                    id: Math.random().toString(36),
                    role: 'user',
                    content: [{ type: 'text', text: originalInput.content || '' }],
                });
            }

            // Add the assistant response
            if (text) {
                convertedMessages.push({
                    id: Math.random().toString(36),
                    role: 'assistant',
                    content: text,
                });
            }
        }

        // Extract finish reason
        const finishReason = currentStep?.type === 'next_step_final_output' ? 'stop' : 'length';

        return {
            text,
            usage,
            steps: [], // OpenAI agents don't have Mastra-style steps
            finishReason,
            warnings: [],
            providerMetadata: {},
            request: {},
            reasoning: '',
            reasoningText: '',
            toolCalls,
            toolResults,
            sources: [],
            files: [],
            response: {
                messages: convertedMessages,
            },
            traceId: runResult.state?._trace?.traceId,
            totalUsage: usage,
            object: undefined,
            error: undefined,
            tripwire: false,
            tripwireReason: '',
        };
    }
}

/**
 * Convert an OpenAI agent to be compatible with Mastra framework
 * 
 * @param config - Configuration containing the OpenAI agent and optional name
 * @returns An OpenAI agent that extends ExternalAgent
 */
export function toMastraCompatibleOpenAI(
    config: {
        name?: string;
        agent: any; // OpenAI Agent type
        instructions?: string;
    }
): ExternalAgent {
    const openaiAgent = config.agent;

    // Use provided name, extract from OpenAI agent, or default to 'openai-agent'
    const agentName = config.name || openaiAgent.name || 'openai-agent';

    return new OpenAI({ name: agentName, agent: openaiAgent });
}
