import type { AgentCard, Message, Task, TaskArtifactUpdateEvent, TaskStatusUpdateEvent } from '@a2a-js/sdk-v0_3';

export type A2AStreamEventData = Message | Task | TaskStatusUpdateEvent | TaskArtifactUpdateEvent;

export type SendMessageInput = {
  prompt: string;
  data?: Record<string, unknown>;
  contextId?: string;
  taskId?: string;
};

export interface A2AProtocolCompat {
  readonly headers: Record<string, string>;
  readonly methods: {
    readonly sendMessage: string;
    readonly streamMessage: string;
    readonly getTask: string;
    readonly resubscribeTask: string;
  };
  decodeAgentCard(value: unknown): AgentCard;
  createSendMessageParams(input: SendMessageInput): Record<string, unknown>;
  decodeSendMessageResult(value: unknown): Message | Task;
  createGetTaskParams(taskId: string): Record<string, unknown>;
  decodeGetTaskResult(value: unknown): Task;
  createResubscribeParams(taskId: string): Record<string, unknown>;
  decodeStreamResult(value: unknown): A2AStreamEventData;
}
