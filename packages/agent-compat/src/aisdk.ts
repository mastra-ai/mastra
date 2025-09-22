import { ExternalAgent, MessageList, type AgentExecutionOptions, type MastraGenerateResult } from "@mastra/core/agent";
import type { MessageListInput } from "@mastra/core/agent/message-list";
import type { Experimental_Agent as AISDKAgent, ToolSet } from "ai";

export class AISDK extends ExternalAgent {
    private agent: AISDKAgent<ToolSet, any, any>;
    constructor({ name, agent }: { name: string, agent: AISDKAgent<ToolSet, any, any> }) {
        super({ name: name || 'aisdk-agent' });
        this.agent = agent;
    }

    getInstructions() {
        return (this.agent as any).system || (this.agent as any).settings?.system || '';
    }

    async getTools() {
        const mastraTools: Record<string, any> = {};

        // Get tools from the AI SDK agent
        const tools = (this.agent as any).tools || (this.agent as any)?.settings?.tools || {};

        // Convert AI SDK tools to Mastra format
        for (const [toolName, tool] of Object.entries(tools)) {
            const aisdkTool = tool as any;
            if (aisdkTool) {
                mastraTools[toolName] = {
                    id: toolName,
                    description: aisdkTool.description,
                    inputSchema: aisdkTool.inputSchema, // Zod schema
                    execute: async (context: any) => {
                        // Call the AI SDK tool function with the right format
                        // AI SDK tools expect parameters directly, not wrapped in context.request
                        return await aisdkTool.execute(context);
                    }
                };
            }
        }

        console.log('getTools', mastraTools);

        return mastraTools;
    }

    async getLLM() {
        const model = (this.agent as any).model || (this.agent as any).settings?.model;

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
            getProvider: () => model?.provider,
            getModelId: () => model?.modelId,
        };
    }

    async generate(prompt: MessageListInput, options?: AgentExecutionOptions): Promise<MastraGenerateResult<any>> {
        const messageList = new MessageList();
        messageList.add(prompt, 'user');

        // Execute the AI SDK agent
        const messages = messageList.get.all.prompt() as any;

        const result = await this.agent.generate({
            prompt: messages,
        });

        console.log('generated result', result);

        return this.convertAISDKResult(result);
    }

    /**
     * Convert AI SDK generate result to MastraGenerateResult format
     */
    private convertAISDKResult(aisdkResult: any): MastraGenerateResult<any> {
        // AI SDK v5 returns DefaultGenerateTextResult with steps array
        const steps = aisdkResult.steps || [];
        const lastStep = steps[steps.length - 1];

        // Extract text from the last step's content
        let text = '';
        if (lastStep?.content) {
            const content = lastStep.content;
            if (Array.isArray(content)) {
                // Find text content in the array
                const textContent = content.find((c: any) => c.type === 'text');
                text = textContent?.text || '';
            } else if (typeof content === 'string') {
                text = content;
            }
        }

        // Extract usage from the last step or aggregate all steps
        let usage = {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
        };

        if (lastStep?.usage) {
            const stepUsage = lastStep.usage;
            usage = {
                promptTokens: stepUsage.promptTokens || 0,
                completionTokens: stepUsage.completionTokens || 0,
                totalTokens: stepUsage.totalTokens || 0,
            };
        }

        // Extract tool calls and results from all steps
        const toolCalls: any[] = [];
        const toolResults: any[] = [];

        for (const step of steps) {
            if (step.content && Array.isArray(step.content)) {
                for (const contentItem of step.content) {
                    if (contentItem.type === 'tool-call') {
                        toolCalls.push({
                            toolCallId: contentItem.toolCallId,
                            toolName: contentItem.toolName,
                            args: contentItem.args,
                        });
                    } else if (contentItem.type === 'tool-result') {
                        toolResults.push({
                            toolCallId: contentItem.toolCallId,
                            toolName: contentItem.toolName,
                            result: contentItem.result,
                        });
                    }
                }
            }
        }

        // Extract finish reason from the last step
        const finishReason = lastStep?.finishReason || 'stop';

        // Convert steps to Mastra message format
        const convertedMessages = [];

        for (const step of steps) {
            if (step.content && Array.isArray(step.content)) {
                for (const contentItem of step.content) {
                    if (contentItem.type === 'text') {
                        convertedMessages.push({
                            id: Math.random().toString(36),
                            role: 'assistant',
                            content: contentItem.text,
                        });
                    } else if (contentItem.type === 'tool-call') {
                        convertedMessages.push({
                            id: Math.random().toString(36),
                            role: 'assistant',
                            content: [contentItem],
                        });
                    } else if (contentItem.type === 'tool-result') {
                        convertedMessages.push({
                            id: Math.random().toString(36),
                            role: 'tool',
                            content: [contentItem],
                        });
                    }
                }
            }
        }

        return {
            text,
            usage,
            steps: [], // AI SDK doesn't have Mastra-style steps
            finishReason,
            warnings: lastStep?.warnings || [],
            providerMetadata: lastStep?.providerMetadata || {},
            request: lastStep?.request || {},
            reasoning: '',
            reasoningText: '',
            toolCalls,
            toolResults,
            sources: [],
            files: [],
            response: {
                messages: convertedMessages,
            },
            traceId: undefined,
            totalUsage: usage,
            object: aisdkResult.resolvedOutput,
            error: undefined,
            tripwire: false,
            tripwireReason: '',
        };
    }
}

/**
 * Convert an AI SDK agent to be compatible with Mastra framework
 * 
 * @param agent - The AI SDK agent to convert
 * @param config - Configuration for the Mastra agent wrapper
 * @returns An AI SDK agent that extends ExternalAgent
 */
export function toMastraCompatibleAISDK(
    config: {
        name?: string;
        agent: AISDKAgent<ToolSet, any, any>;
        instructions?: string;
    }
): ExternalAgent {
    const aisdkAgent = config.agent;

    // Use provided name, or extract from AI SDK agent, or default to 'aisdk-agent'
    const agentName = config.name || 'aisdk-agent';

    return new AISDK({ name: agentName, agent: aisdkAgent });
}
