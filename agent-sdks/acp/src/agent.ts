import { randomUUID } from 'node:crypto';
import { ReadableStream } from 'node:stream/web';

import type { ModelInfo, SessionUpdate } from '@agentclientprotocol/sdk';
import type {
  AgentGenerateOptions,
  AgentInstructions,
  AgentStreamOptions,
  MastraLanguageModel,
  SubAgent,
  SubAgentGenerateResult,
  SubAgentStreamResult,
} from '@mastra/core/agent';
import { MessageList, coreContentToString } from '@mastra/core/agent/message-list';
import type { MessageListInput } from '@mastra/core/agent/message-list';
import type { Mastra } from '@mastra/core/mastra';
import type { ChunkType } from '@mastra/core/stream';
import type { DynamicArgument } from '@mastra/core/types';

import { ACPConnection } from './connection';
import type { CreateACPToolOptions } from './types';

const CHUNK_FROM_AGENT = 'AGENT' as ChunkType['from'];
type AcpToolResult = Extract<NonNullable<SubAgentStreamResult['toolResults']>, unknown[]>[number];

const model = {
  modelId: 'acp-agent',
  provider: '@mastra/acp',
  specificationVersion: 'v3',
  supportedUrls: {},
  doGenerate: async () => ({
    stream: new ReadableStream({
      start: async controller => {
        controller.close();
      },
    }),
  }),
  doStream: async () => ({
    stream: new ReadableStream({
      start: async controller => {
        controller.close();
      },
    }),
  }),
} as const satisfies MastraLanguageModel;

export type AcpAgentOptions = CreateACPToolOptions & {
  name?: string;
};

export class AcpAgent<
  TId extends string = string,
  TRequestContext extends Record<string, any> | unknown = unknown,
> implements SubAgent<TId, TRequestContext> {
  readonly id: TId;
  readonly name: string;
  readonly connection: ACPConnection;
  readonly description: string;

  constructor(options: AcpAgentOptions) {
    this.id = options.id as TId;
    this.name = options.name ?? options.id;
    this.description = options.description;
    this.connection = new ACPConnection(options);
  }

  __registerMastra(_mastra: Mastra): void {}

  getDescription(): string {
    return this.description;
  }

  getModel(): ReturnType<SubAgent<TId, TRequestContext>['getModel']> {
    return model;
  }

  hasOwnMemory(): boolean {
    return false;
  }

  __setMemory(_memory: DynamicArgument<any, any>): void {}

  getMemory(): undefined {
    return undefined;
  }

  getInstructions(): string {
    return '';
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    return this.connection.getAvailableModels();
  }

  async setModel(modelId: string): Promise<void> {
    return this.connection.setModel(modelId);
  }

  async generate(messages: MessageListInput, options?: AgentGenerateOptions): Promise<SubAgentGenerateResult> {
    const prompt = this.getPrompt(messages, options?.instructions);
    const text = await this.connection.prompt(
      prompt,
      (options as { abortSignal?: AbortSignal } | undefined)?.abortSignal,
    );
    const messageList = this.createMessageList(messages, text);

    return {
      text,
      response: {
        dbMessages: messageList.get.response.db(),
      },
      toolResults: [],
      finishReason: 'stop',
      runId: options?.runId ?? randomUUID(),
    };
  }

  async resumeGenerate(): Promise<SubAgentGenerateResult> {
    throw new Error('AcpAgent does not support resuming suspended generate calls');
  }

  async resumeStream(): Promise<SubAgentStreamResult> {
    throw new Error('AcpAgent does not support resuming suspended stream calls');
  }

  async stream(messages: MessageListInput, options?: AgentStreamOptions): Promise<SubAgentStreamResult> {
    const runId = options?.runId ?? randomUUID();
    const prompt = this.getPrompt(messages, options?.instructions);
    const signal = (options as { abortSignal?: AbortSignal } | undefined)?.abortSignal;
    const messageList = new MessageList();
    messageList.add(messages, 'input');

    let resolveText!: (text: string) => void;
    let rejectText!: (error: unknown) => void;
    const textPromise = new Promise<string>((resolve, reject) => {
      resolveText = resolve;
      rejectText = reject;
    });

    const fullStream = new ReadableStream<ChunkType>({
      start: async controller => {
        const textId = randomUUID();
        const chunks: string[] = [];
        const toolNames = new Map<string, string>();
        const toolResults: AcpToolResult[] = [];

        try {
          controller.enqueue({ type: 'text-start', runId, from: CHUNK_FROM_AGENT, payload: { id: textId } });

          for await (const event of this.connection.promptStream(prompt, signal)) {
            if (event.type === 'text') {
              chunks.push(event.text);
              controller.enqueue({
                type: 'text-delta',
                runId,
                from: CHUNK_FROM_AGENT,
                payload: { id: textId, text: event.text },
              });
            } else if (event.type === 'session-update') {
              for (const chunk of getMastraChunksFromACPUpdate(event.update, runId, toolNames)) {
                if (chunk.type === 'tool-result') {
                  toolResults.push({ payload: chunk.payload });
                }
                controller.enqueue(chunk);
              }
            }
          }

          const text = chunks.join('');
          messageList.add([{ role: 'assistant', content: text }], 'response');

          controller.enqueue({ type: 'text-end', runId, from: CHUNK_FROM_AGENT, payload: { id: textId } });
          controller.enqueue(createFinishChunk('step-finish', runId));
          controller.enqueue(createFinishChunk('finish', runId));
          await options?.onFinish?.(createOnFinishResult({ text, runId, messageList, toolResults }) as any);
          resolveText(text);
          controller.close();
        } catch (error) {
          const text = chunks.join('');
          await options?.onFinish?.(createOnFinishResult({ text, runId, messageList, toolResults, error }) as any);
          rejectText(error);
          controller.error(error);
        }
      },
    });

    return {
      fullStream,
      text: textPromise,
      messageList,
      toolResults: [],
      runId,
    };
  }

  private getPrompt(messages: MessageListInput, instructions?: AgentInstructions): string {
    const prompt = extractText(messages);
    const instructionText = instructions ? extractInstructions(instructions) : '';

    if (!instructionText) {
      return prompt;
    }

    return `${instructionText}\n\n${prompt}`;
  }

  private createMessageList(messages: MessageListInput, text: string): MessageList {
    const messageList = new MessageList();
    messageList.add(messages, 'input');
    messageList.add([{ role: 'assistant', content: text }], 'response');
    return messageList;
  }
}

function extractText(messages: MessageListInput): string {
  if (typeof messages === 'string') {
    return messages;
  }

  if (Array.isArray(messages) && messages.every(message => typeof message === 'string')) {
    return messages.join('\n');
  }

  const messageList = new MessageList();
  messageList.add(messages, 'input');

  return messageList.get.all
    .core()
    .map(message => coreContentToString(message.content))
    .filter(Boolean)
    .join('\n');
}

function extractInstructions(instructions: AgentInstructions): string {
  if (typeof instructions === 'string') {
    return instructions;
  }

  if (Array.isArray(instructions)) {
    return instructions.map(instruction => extractInstructions(instruction)).join('\n');
  }

  return coreContentToString(instructions.content);
}

function getMastraChunksFromACPUpdate(
  update: SessionUpdate,
  runId: string,
  toolNames: Map<string, string>,
): ChunkType[] {
  switch (update.sessionUpdate) {
    case 'tool_call': {
      const toolName = getToolName(update, toolNames);
      toolNames.set(update.toolCallId, toolName);

      return [
        {
          type: 'tool-call',
          runId,
          from: CHUNK_FROM_AGENT,
          payload: {
            toolCallId: update.toolCallId,
            toolName,
            args: toRecord(update.rawInput),
          },
        },
      ];
    }
    case 'tool_call_update': {
      const toolName = getToolName(update, toolNames);

      if (update.status === 'completed' || update.status === 'failed') {
        return [
          {
            type: 'tool-result',
            runId,
            from: CHUNK_FROM_AGENT,
            payload: {
              toolCallId: update.toolCallId,
              toolName,
              result: update.rawOutput ?? update.content ?? { status: update.status, title: update.title },
              isError: update.status === 'failed',
            },
          },
        ];
      }

      return [
        {
          type: 'tool-call-delta',
          runId,
          from: CHUNK_FROM_AGENT,
          payload: {
            toolCallId: update.toolCallId,
            toolName,
            argsTextDelta: update.title ?? update.status ?? '',
          },
        },
      ];
    }
    default:
      return [];
  }
}

function getToolName(
  update: Extract<SessionUpdate, { sessionUpdate: 'tool_call' | 'tool_call_update' }>,
  toolNames: Map<string, string>,
): string {
  return update.title ?? toolNames.get(update.toolCallId) ?? update.kind ?? 'acp_tool';
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (value === undefined) {
    return {};
  }

  return { input: value };
}

function createOnFinishResult({
  text,
  runId,
  messageList,
  toolResults,
  error,
}: {
  text: string;
  runId: string;
  messageList: MessageList;
  toolResults: AcpToolResult[];
  error?: unknown;
}) {
  const usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

  return {
    text,
    finishReason: 'stop',
    usage,
    totalUsage: usage,
    warnings: [],
    response: {
      messages: messageList.get.response.aiV5.model(),
    },
    steps: [],
    toolResults,
    runId,
    ...(error === undefined ? {} : { error }),
  };
}

function createFinishChunk(type: 'step-finish' | 'finish', runId: string): ChunkType {
  return {
    type,
    runId,
    from: CHUNK_FROM_AGENT,
    payload: {
      id: randomUUID(),
      output: {
        steps: [],
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      },
      stepResult: {
        reason: 'stop',
        warnings: [],
        isContinued: false,
      },
      metadata: {},
      messages: { nonUser: [], all: [] },
    },
  } as unknown as ChunkType;
}
