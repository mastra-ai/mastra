// Cross-platform UUID generation function
import { generateId } from 'ai';
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
import type { CoreMessage } from '@mastra/core';
import { Observable } from 'rxjs';
import type { Agent } from '../resources/agent';

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
        .stream({
          threadId: input.threadId,
          resourceId: this.resourceId ?? '',
          runId: input.runId,
          messages: convertedMessages,
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
          return response.processDataStream({
            onTextPart: text => {
              if (currentMessageId === undefined) {
                currentMessageId = generateUUID();
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
              const parentMessageId = currentMessageId || generateUUID();
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

/**
 * Generates a unique ID using Vercel AI SDK's generateId
 * This provides consistent ID generation across the Mastra ecosystem
 */
export function generateUUID(): string {
  // Use Vercel AI SDK's generateId for consistency
  return generateId();
}

  // Last resort fallback (less secure but works everywhere)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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
