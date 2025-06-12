import type {
  AgentConfig,
  AssistantMessage,
  BaseEvent,
  Message,
  MessagesSnapshotEvent,
  RunAgentInput,
  RunFinishedEvent,
  RunStartedEvent,
  StateSnapshotEvent,
  TextMessageChunkEvent,
  ToolCall,
  ToolCallArgsEvent,
  ToolCallEndEvent,
  ToolCallStartEvent,
  ToolMessage,
} from '@ag-ui/client';
import { AbstractAgent, EventType } from '@ag-ui/client';
import {
  CopilotRuntime,
  copilotRuntimeNodeHttpEndpoint,
  CopilotServiceAdapter,
  ExperimentalEmptyAdapter,
} from '@copilotkit/runtime';
import { processDataStream } from '@ai-sdk/ui-utils';
import type { CoreMessage, Mastra } from '@mastra/core';
import { registerApiRoute } from '@mastra/core/server';
import type { Agent } from '@mastra/core/agent';
import type { Context } from 'hono';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';

interface MastraAgentConfig extends AgentConfig {
  agent: Agent;
  agentId: string;
  resourceId?: string;
  runtimeContext?: RuntimeContext;
}

export class AGUIAdapter extends AbstractAgent {
  agent: Agent;
  resourceId?: string;
  runtimeContext?: RuntimeContext;
  constructor({ agent, agentId, resourceId, runtimeContext, ...rest }: MastraAgentConfig) {
    super({
      agentId,
      ...rest,
    });
    this.agent = agent;
    this.resourceId = resourceId;
    this.runtimeContext = runtimeContext;
  }

  protected run(input: RunAgentInput): Observable<BaseEvent> {
    let filteredMessages: Message[] = input.messages.filter(
      m => m.role === 'user' || m.role === 'assistant' || m.role === 'system',
    );
    const finalMessages: Message[] = [...filteredMessages];

    return new Observable<BaseEvent>(subscriber => {
      const run = async () => {
        const convertedMessages = convertMessagesToMastraMessages(finalMessages);
        const lastMessage = convertedMessages[convertedMessages.length - 1];
        if (!lastMessage) {
          throw new Error('No messages found');
        }

        subscriber.next({
          type: EventType.RUN_STARTED,
          threadId: input.threadId,
          runId: input.runId,
        } as RunStartedEvent);

        const memory = this.agent.getMemory();

        console.log('input.state', input.state);

        if (memory && input.state && Object.keys(input.state || {}).length > 0) {
          console.log('threadId', input.threadId);
          const thread = await memory.getThreadById({ threadId: input.threadId });

          if (!thread) {
            throw new Error(`Thread ${input.threadId} not found`);
          }

          if (thread.resourceId && thread.resourceId !== this.resourceId) {
            throw new Error(
              `Thread with id ${input.threadId} resourceId does not match the current resourceId ${this.resourceId}`,
            );
          }

          const { messages, ...rest } = input.state;

          const workingMemory = JSON.stringify(rest);

          console.log('saving thread');
          // Update thread metadata with new working memory
          await memory.saveThread({
            thread: {
              ...thread,
              metadata: {
                ...thread.metadata,
                workingMemory,
              },
            },
          });
        }

        let workingMemory: string | Record<string, any> | null = null;

        if (memory) {
          workingMemory = await memory.getWorkingMemory({
            threadId: input.threadId,
            format: 'json',
          });
        }

        const workingMemoryContext = [
          {
            role: 'user' as const,
            content: `
            If provided the following working memory is the most up to date info about the user's state and context
            ${workingMemory ? JSON.stringify(workingMemory) : ''}
            
            Always refer to it when recalling working memory, and do not use conversation history as a source of truth.
            If conversation history shows information that is not in the working memory, use the working memory as the source of truth.
            When there is a discrepancy between the working memory and conversation history, do not override the working memory with conversation history unless explicitly asked
            `,
          },
        ];

        this.agent
          .stream([lastMessage], {
            threadId: input.threadId,
            resourceId: this.resourceId ?? '',
            runId: input.runId,
            clientTools: input.tools.reduce(
              (acc, tool) => {
                acc[tool.name as string] = {
                  id: tool.name,
                  description: tool.description,
                  inputSchema: tool.parameters,
                };
                return acc;
              },
              {} as Record<string, any>,
            ),
            runtimeContext: this.runtimeContext,
            context: workingMemoryContext,
          })
          .then(response => {
            let messageId = randomUUID();
            let assistantMessage: AssistantMessage = {
              id: messageId,
              role: 'assistant',
              content: '',
              toolCalls: [],
            };
            finalMessages.push(assistantMessage);

            return processDataStream({
              stream: response.toDataStreamResponse().body!,
              onTextPart: text => {
                assistantMessage.content += text;
                const event: TextMessageChunkEvent = {
                  type: EventType.TEXT_MESSAGE_CHUNK,
                  role: 'assistant',
                  messageId,
                  delta: text,
                };
                subscriber.next(event);
              },
              onFinishMessagePart: async () => {
                // Emit message snapshot
                const event: MessagesSnapshotEvent = {
                  type: EventType.MESSAGES_SNAPSHOT,
                  messages: finalMessages,
                };
                subscriber.next(event);

                if (memory) {
                  const workingMemory = await memory.getWorkingMemory({ threadId: input.threadId, format: 'json' });

                  const stateEvent: StateSnapshotEvent = {
                    type: EventType.STATE_SNAPSHOT,
                    snapshot: workingMemory,
                  };

                  subscriber.next(stateEvent);
                }

                // Emit run finished event
                subscriber.next({
                  type: EventType.RUN_FINISHED,
                  threadId: input.threadId,
                  runId: input.runId,
                } as RunFinishedEvent);

                // Complete the observable
                subscriber.complete();
              },
              onToolCallPart(streamPart) {
                let toolCall: ToolCall = {
                  id: streamPart.toolCallId,
                  type: 'function',
                  function: {
                    name: streamPart.toolName,
                    arguments: JSON.stringify(streamPart.args),
                  },
                };
                assistantMessage.toolCalls!.push(toolCall);

                const startEvent: ToolCallStartEvent = {
                  type: EventType.TOOL_CALL_START,
                  parentMessageId: messageId,
                  toolCallId: streamPart.toolCallId,
                  toolCallName: streamPart.toolName,
                };
                subscriber.next(startEvent);

                const argsEvent: ToolCallArgsEvent = {
                  type: EventType.TOOL_CALL_ARGS,
                  toolCallId: streamPart.toolCallId,
                  delta: JSON.stringify(streamPart.args),
                };
                subscriber.next(argsEvent);

                const endEvent: ToolCallEndEvent = {
                  type: EventType.TOOL_CALL_END,
                  toolCallId: streamPart.toolCallId,
                };
                subscriber.next(endEvent);
              },
              onToolResultPart(streamPart) {
                const toolMessage: ToolMessage = {
                  role: 'tool',
                  id: randomUUID(),
                  toolCallId: streamPart.toolCallId,
                  content: JSON.stringify(streamPart.result),
                };
                finalMessages.push(toolMessage);
              },
            });
          })
          .catch(error => {
            console.error('error', error);
            // Handle error
            subscriber.error(error);
          });
      };

      run();

      return () => {};
    });
  }
}
export function convertMessagesToMastraMessages(messages: Message[]): CoreMessage[] {
  const result: CoreMessage[] = [];

  for (const message of messages) {
    if (message.role === 'assistant') {
      const parts: any[] = message.content ? [{ type: 'text', text: message.content }] : [];
      for (const toolCall of message.toolCalls ?? []) {
        parts.push({
          type: 'tool-call',
          toolCallId: toolCall.id,
          toolName: toolCall.function.name,
          args: JSON.parse(toolCall.function.arguments),
        });
      }
      result.push({
        role: 'assistant',
        content: parts,
      });
    } else if (message.role === 'user') {
      result.push({
        role: 'user',
        content: message.content || '',
      });
    } else if (message.role === 'tool') {
      let toolName = 'unknown';
      for (const msg of messages) {
        if (msg.role === 'assistant') {
          for (const toolCall of msg.toolCalls ?? []) {
            if (toolCall.id === message.toolCallId) {
              toolName = toolCall.function.name;
              break;
            }
          }
        }
      }
      result.push({
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: message.toolCallId,
            toolName: toolName,
            result: message.content,
          },
        ],
      });
    }
  }

  return result;
}

export function getAGUI({
  mastra,
  resourceId,
  runtimeContext,
}: {
  mastra: Mastra;
  resourceId?: string;
  runtimeContext?: RuntimeContext;
}) {
  const agents = mastra.getAgents() || {};
  const networks = mastra.getNetworks() || [];

  const networkAGUI = networks.reduce(
    (acc, network) => {
      acc[network.name!] = new AGUIAdapter({
        agentId: network.name!,
        agent: network as unknown as Agent,
        resourceId,
        runtimeContext,
      });
      return acc;
    },
    {} as Record<string, AbstractAgent>,
  );

  const agentAGUI = Object.entries(agents).reduce(
    (acc, [agentId, agent]) => {
      acc[agentId] = new AGUIAdapter({
        agentId,
        agent,
        resourceId,
        runtimeContext,
      });
      return acc;
    },
    {} as Record<string, AbstractAgent>,
  );

  return {
    ...agentAGUI,
    ...networkAGUI,
  };
}

export function getAGUIAgent({
  mastra,
  agentId,
  resourceId,
  runtimeContext,
}: {
  mastra: Mastra;
  agentId: string;
  resourceId?: string;
  runtimeContext?: RuntimeContext;
}) {
  const agent = mastra.getAgent(agentId);
  if (!agent) {
    throw new Error(`Agent ${agentId} not found`);
  }
  return new AGUIAdapter({
    agentId,
    agent,
    resourceId,
    runtimeContext,
  }) as AbstractAgent;
}

export function getAGUINetwork({
  mastra,
  networkId,
  resourceId,
  runtimeContext,
}: {
  mastra: Mastra;
  networkId: string;
  resourceId?: string;
  runtimeContext?: RuntimeContext;
}) {
  const network = mastra.getNetwork(networkId);
  if (!network) {
    throw new Error(`Network ${networkId} not found`);
  }
  return new AGUIAdapter({
    agentId: network.name!,
    agent: network as unknown as Agent,
    resourceId,
    runtimeContext,
  }) as AbstractAgent;
}

export function registerCopilotKit<T extends Record<string, any> | unknown = unknown>({
  path,
  resourceId,
  serviceAdapter = new ExperimentalEmptyAdapter(),
  agents,
  setContext,
}: {
  path: string;
  resourceId: string;
  serviceAdapter?: CopilotServiceAdapter;
  agents?: Record<string, AbstractAgent>;
  setContext?: (
    c: Context<{
      Variables: {
        mastra: Mastra;
      };
    }>,
    runtimeContext: RuntimeContext<T>,
  ) => void | Promise<void>;
}) {
  return registerApiRoute(path, {
    method: `ALL`,
    handler: async c => {
      const mastra = c.get('mastra');

      const runtimeContext = new RuntimeContext<T>();

      if (setContext) {
        await setContext(c, runtimeContext);
      }

      const aguiAgents =
        agents ||
        getAGUI({
          resourceId,
          mastra,
          runtimeContext,
        });

      const runtime = new CopilotRuntime({
        agents: aguiAgents,
      });

      const handler = copilotRuntimeNodeHttpEndpoint({
        endpoint: path,
        runtime,
        serviceAdapter,
      });

      return handler.handle(c.req.raw, {});
    },
  });
}
