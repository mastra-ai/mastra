import type {
  AgentConfig,
  BaseEvent,
  Message,
  RunAgentInput,
  RunFinishedEvent,
  RunStartedEvent,
  TextMessageContentEvent,
  TextMessageEndEvent,
  TextMessageStartEvent,
  ToolCallArgsEvent,
  ToolCallEndEvent,
  ToolCallStartEvent,
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
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';

interface MastraAgentConfig extends AgentConfig {
  agent: Agent;
  agentId: string;
  resourceId?: string;
}

export class AGUIAdapter extends AbstractAgent {
  agent: Agent;
  resourceId?: string;
  constructor({ agent, agentId, resourceId, ...rest }: MastraAgentConfig) {
    super({
      agentId,
      ...rest,
    });
    this.agent = agent;
    this.resourceId = resourceId;
  }

  protected run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable<BaseEvent>(subscriber => {
      const convertedMessages = convertMessagesToMastraMessages(input.messages);
      subscriber.next({
        type: EventType.RUN_STARTED,
        threadId: input.threadId,
        runId: input.runId,
      } as RunStartedEvent);

      this.agent
        .stream(convertedMessages, {
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
        })
        .then(response => {
          let currentMessageId: string | undefined = undefined;
          let isInTextMessage = false;

          return processDataStream({
            stream: response.toDataStreamResponse().body!,
            onTextPart: text => {
              if (currentMessageId === undefined) {
                currentMessageId = randomUUID();
                const message: TextMessageStartEvent = {
                  type: EventType.TEXT_MESSAGE_START,
                  messageId: currentMessageId,
                  role: 'assistant',
                };
                subscriber.next(message);
                isInTextMessage = true;
              }

              const message: TextMessageContentEvent = {
                type: EventType.TEXT_MESSAGE_CONTENT,
                messageId: currentMessageId,
                delta: text,
              };
              subscriber.next(message);
            },
            onFinishMessagePart: () => {
              if (currentMessageId !== undefined) {
                const message: TextMessageEndEvent = {
                  type: EventType.TEXT_MESSAGE_END,
                  messageId: currentMessageId,
                };
                subscriber.next(message);
                isInTextMessage = false;
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
              const parentMessageId = currentMessageId || randomUUID();
              if (isInTextMessage) {
                const message: TextMessageEndEvent = {
                  type: EventType.TEXT_MESSAGE_END,
                  messageId: parentMessageId,
                };
                subscriber.next(message);
                isInTextMessage = false;
              }

              subscriber.next({
                type: EventType.TOOL_CALL_START,
                toolCallId: streamPart.toolCallId,
                toolCallName: streamPart.toolName,
                parentMessageId,
              } as ToolCallStartEvent);

              subscriber.next({
                type: EventType.TOOL_CALL_ARGS,
                toolCallId: streamPart.toolCallId,
                delta: JSON.stringify(streamPart.args),
                parentMessageId,
              } as ToolCallArgsEvent);

              subscriber.next({
                type: EventType.TOOL_CALL_END,
                toolCallId: streamPart.toolCallId,
                parentMessageId,
              } as ToolCallEndEvent);
            },
          });
        })
        .catch(error => {
          console.error('error', error);
          // Handle error
          subscriber.error(error);
        });

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
      if (message.toolCalls?.length) {
        result.push({
          role: 'tool',
          content: message.toolCalls.map(toolCall => ({
            type: 'tool-result',
            toolCallId: toolCall.id,
            toolName: toolCall.function.name,
            result: JSON.parse(toolCall.function.arguments),
          })),
        });
      }
    } else if (message.role === 'user') {
      result.push({
        role: 'user',
        content: message.content || '',
      });
    } else if (message.role === 'tool') {
      result.push({
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: message.toolCallId,
            toolName: 'unknown',
            result: message.content,
          },
        ],
      });
    }
  }

  return result;
}

export function getAGUI({ mastra, resourceId }: { mastra: Mastra; resourceId?: string }) {
  const agents = mastra.getAgents() || {};
  const networks = mastra.getNetworks() || [];

  const networkAGUI = networks.reduce(
    (acc, network) => {
      acc[network.name!] = new AGUIAdapter({
        agentId: network.name!,
        agent: network as unknown as Agent,
        resourceId,
      });
      return acc;
    },
    {} as Record<string, AGUIAdapter>,
  );

  const agentAGUI = Object.entries(agents).reduce(
    (acc, [agentId, agent]) => {
      acc[agentId] = new AGUIAdapter({
        agentId,
        agent,
        resourceId,
      });
      return acc;
    },
    {} as Record<string, AGUIAdapter>,
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
}: {
  mastra: Mastra;
  agentId: string;
  resourceId?: string;
}) {
  const agent = mastra.getAgent(agentId);
  if (!agent) {
    throw new Error(`Agent ${agentId} not found`);
  }
  return new AGUIAdapter({
    agentId,
    agent,
    resourceId,
  });
}

export function getAGUINetwork({
  mastra,
  networkId,
  resourceId,
}: {
  mastra: Mastra;
  networkId: string;
  resourceId?: string;
}) {
  const network = mastra.getNetwork(networkId);
  if (!network) {
    throw new Error(`Network ${networkId} not found`);
  }
  return new AGUIAdapter({
    agentId: network.name!,
    agent: network as unknown as Agent,
    resourceId,
  });
}

export function registerCopilotKit({
  path,
  resourceId,
  serviceAdapter = new ExperimentalEmptyAdapter(),
  agents,
}: {
  path: string;
  resourceId: string;
  serviceAdapter?: CopilotServiceAdapter;
  agents?: Record<string, AGUIAdapter>;
}) {
  return registerApiRoute(path, {
    method: `ALL`,
    handler: async c => {
      const mastra = c.get('mastra');

      const aguiAgents =
        agents ||
        getAGUI({
          resourceId,
          mastra,
        });

      console.log('aguiAgents', aguiAgents);

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
