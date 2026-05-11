import { randomUUID } from 'node:crypto';
import { ReadableStream } from 'node:stream/web';

import type {
  AgentGenerateOptions,
  AgentInstructions,
  AgentStreamOptions,
  SubAgent,
  SubAgentGenerateResult,
  SubAgentStreamResult,
} from '@mastra/core/agent';
import { MessageList, coreContentToString } from '@mastra/core/agent/message-list';
import type { MessageListInput } from '@mastra/core/agent/message-list';
import type { Mastra } from '@mastra/core/mastra';
import type { MastraMemory } from '@mastra/core/memory';
import type { ChunkType } from '@mastra/core/stream';
import type { DynamicArgument } from '@mastra/core/types';

import { ACPConnection } from './connection';
import type { CreateACPToolOptions } from './types';

const CHUNK_FROM_AGENT = 'AGENT' as ChunkType['from'];

const model = {
  modelId: 'acp-agent',
  provider: '@mastra/acp',
  specificationVersion: 'v2',
  version: 'v2',
} as const;

export type AcpAgentOptions = CreateACPToolOptions & {
  name?: string;
};

export class AcpAgent implements SubAgent {
  readonly id: string;
  readonly name: string;
  readonly connection: ACPConnection;
  readonly description: string;

  constructor(options: AcpAgentOptions) {
    this.id = options.id;
    this.name = options.name ?? options.id;
    this.description = options.description;
    this.connection = new ACPConnection(options);
  }

  __registerMastra(_mastra: Mastra): void {}

  getDescription(): string {
    return this.description;
  }

  getModel(): typeof model {
    return model;
  }

  getDefaultOptions(): undefined {
    return undefined;
  }

  hasOwnMemory(): boolean {
    return false;
  }

  __setMemory(_memory: DynamicArgument<MastraMemory>): void {}

  getMemory(): undefined {
    return undefined;
  }

  getInstructions(): string {
    return '';
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

        try {
          controller.enqueue({ type: 'text-start', runId, from: CHUNK_FROM_AGENT, payload: { id: textId } });

          for await (const chunk of this.connection.promptStream(prompt, signal)) {
            chunks.push(chunk);
            controller.enqueue({ type: 'text-delta', runId, from: CHUNK_FROM_AGENT, payload: { id: textId, text: chunk } });
          }

          const text = chunks.join('');
          messageList.add([{ role: 'assistant', content: text }], 'response');

          controller.enqueue({ type: 'text-end', runId, from: CHUNK_FROM_AGENT, payload: { id: textId } });
          controller.enqueue(createFinishChunk('step-finish', runId));
          controller.enqueue(createFinishChunk('finish', runId));
          resolveText(text);
          controller.close();
        } catch (error) {
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
