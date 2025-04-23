import {
  AbstractAgent,
  AgentConfig,
  BaseEvent,
  EventType,
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
} from "@agentwire/client";

import { MastraClient } from "@mastra/client-js";
import { CoreMessage, ToolAction } from "@mastra/core";
import { Observable } from "rxjs";
import { v4 as uuidv4 } from "uuid";

interface MastraAgentConfig extends AgentConfig {
  mastraClient?: MastraClient;
  agentId: string;
  resourceId?: string;
}

type MastraMessageContent =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "tool-call";
      toolCallId: string;
      toolName: string;
      args: Record<string, unknown>;
    };

export class MastraDocsAgent extends AbstractAgent {
  mastraClient: MastraClient;
  resourceId?: string;
  constructor(config: MastraAgentConfig) {
    super(config);
    this.resourceId = config.resourceId;

    this.mastraClient =
      config?.mastraClient ??
      new MastraClient({
        baseUrl: process.env.MASTRA_AGENT_URL ?? "",
        // how do headers work?
        // headers: {}
      });
  }

  protected run(input: RunAgentInput): Observable<BaseEvent> {
    const agent = this.mastraClient.getAgent(this.agentId!);

    return new Observable<BaseEvent>((subscriber) => {
      const convertedMessages = convertMessagesToMastraMessages(input.messages);
      // Emit run started event
      subscriber.next({
        type: EventType.RUN_STARTED,
        threadId: input.threadId,
        runId: input.runId,
      } as RunStartedEvent);

      agent
        .stream({
          threadId: input.threadId,
          resourceId: this.resourceId,
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
            {} as Record<string, ToolAction>,
          ),
        })
        .then((response) => {
          let currentMessageId: string | undefined = undefined;

          response.processDataStream({
            onTextPart: (text) => {
              if (currentMessageId === undefined) {
                currentMessageId = uuidv4();

                const message: TextMessageStartEvent = {
                  type: EventType.TEXT_MESSAGE_START,
                  messageId: currentMessageId,
                  role: "assistant",
                };
                subscriber.next(message);
              }

              const message: TextMessageContentEvent = {
                type: EventType.TEXT_MESSAGE_CONTENT,
                messageId: currentMessageId,
                delta: text,
              };
              subscriber.next(message);
            },
            onFinishMessagePart: (message) => {
              console.log("onFinishMessagePart", message);
              if (currentMessageId !== undefined) {
                const message: TextMessageEndEvent = {
                  type: EventType.TEXT_MESSAGE_END,
                  messageId: currentMessageId,
                };
                subscriber.next(message);
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
              subscriber.next({
                type: EventType.TOOL_CALL_START,
                toolCallId: streamPart.toolCallId,
                toolCallName: streamPart.toolName,
              } as ToolCallStartEvent);

              subscriber.next({
                type: EventType.TOOL_CALL_ARGS,
                toolCallId: streamPart.toolCallId,
                delta: JSON.stringify(streamPart.args),
              } as ToolCallArgsEvent);

              subscriber.next({
                type: EventType.TOOL_CALL_END,
                toolCallId: streamPart.toolCallId,
              } as ToolCallEndEvent);
            },
            onToolCallDeltaPart(streamPart) {
              console.log("onToolCallDeltaPart", streamPart);
            },
            onToolCallStreamingStartPart(streamPart) {
              console.log("onToolCallStreamingStartPart", streamPart);
            },
            onToolResultPart(streamPart) {
              console.log("onToolResultPart", streamPart);
            },
          });
        })
        .catch((error) => {
          console.log("error", error);
          // Handle error
          subscriber.error(error);
        });

      // Return unsubscribe function
      return () => {
        // Cleanup logic if needed
      };
    });
  }
}

function convertMessagesToMastraMessages(messages: Message[]): CoreMessage[] {
  const result: CoreMessage[] = [];

  for (const message of messages) {
    if (message.role === "assistant") {
      const parts: MastraMessageContent[] = message.content
        ? [{ type: "text", text: message.content }]
        : [];
      for (const toolCall of message.toolCalls ?? []) {
        parts.push({
          type: "tool-call",
          toolCallId: toolCall.id,
          toolName: toolCall.function.name,
          args: JSON.parse(toolCall.function.arguments),
        });
      }
      result.push({
        role: "assistant",
        content: parts,
      });
    } else if (message.role === "user") {
      result.push({
        role: "user",
        content: message.content || "",
      });
    } else if (message.role === "tool") {
      result.push({
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: message.toolCallId,
            toolName: "unknown",
            result: message.content,
          },
        ],
      });
    }
  }

  return result;
}
