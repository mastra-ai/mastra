import { randomUUID } from 'node:crypto';

import { Agent } from '@mastra/core/agent';
import type { InMemoryStore } from '@mastra/core/storage';

import { Memory } from '../../../index';

export type CacheUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
};

export function createOmTestMemory(store: InMemoryStore, observationalMemory: Record<string, unknown>) {
  return new Memory({
    storage: store,
    options: {
      observationalMemory,
    },
  });
}

export function createCacheControlledInstructions(content: string) {
  return {
    role: 'system' as const,
    content,
    providerOptions: {
      anthropic: {
        cacheControl: {
          type: 'ephemeral' as const,
        },
      },
    },
  };
}

export function createOmTestAgent({
  memory,
  model,
  instructions,
  cacheControlled = false,
}: {
  memory: Memory;
  model: string | Record<string, unknown>;
  instructions?: string;
  cacheControlled?: boolean;
}) {
  const baseInstructions = instructions ?? 'Be concise and accurate.';

  return new Agent({
    id: `cache-test-agent-${randomUUID()}`,
    name: 'OM Cache Test Agent',
    instructions: cacheControlled ? createCacheControlledInstructions(baseInstructions) : baseInstructions,
    model: model as any,
    memory,
  });
}

export function getCacheHitRatio(usage: Partial<CacheUsage> | undefined): number {
  const inputTokens = usage?.inputTokens ?? 0;
  const cachedInputTokens = usage?.cachedInputTokens ?? 0;

  if (inputTokens <= 0) return 0;
  return cachedInputTokens / inputTokens;
}

export function formatCacheRatio(usage: Partial<CacheUsage> | undefined): string {
  return `${(getCacheHitRatio(usage) * 100).toFixed(2)}%`;
}

export async function runStreamAndCollectUsage({
  agent,
  prompt,
  threadId,
  resourceId,
  maxSteps,
  onTextDelta,
  onStepFinish,
  onChunk,
}: {
  agent: Agent;
  prompt: string;
  threadId: string;
  resourceId: string;
  maxSteps?: number;
  onTextDelta?: (delta: string) => void;
  onStepFinish?: (step: {
    toolCallNames?: string[];
    toolResultNames?: string[];
    dataParts?: Array<{
      type: string;
      data?: unknown;
    }>;
  }) => void;
  onChunk?: (chunk: unknown) => void;
}): Promise<{ usage: CacheUsage; text: string }> {
  const streamOptions: Record<string, unknown> = {
    memory: {
      thread: threadId,
      resource: resourceId,
    },
    ...(maxSteps ? { maxSteps } : {}),
  };

  if (onStepFinish) {
    const getToolName = (
      item:
        | {
            payload?: {
              toolName?: string;
              toolCallId?: string;
              toolname?: string;
              name?: string;
            };
            toolName?: string;
            toolCallId?: string;
            toolname?: string;
            name?: string;
          }
        | undefined,
      fallback: string,
    ) => {
      if (!item) {
        return fallback;
      }

      const payload = item.payload ?? {};
      return (
        payload.toolName ??
        payload.toolname ??
        item.toolName ??
        item.toolname ??
        (item as { name?: string }).name ??
        (item as { payload?: { name?: string } }).payload?.name ??
        payload.toolCallId ??
        item.toolCallId ??
        fallback
      );
    };

    const collectDataParts = (value: unknown): Array<{ type: string; data?: unknown }> => {
      if (!value) {
        return [];
      }

      if (Array.isArray(value)) {
        return value.flatMap(item => collectDataParts(item));
      }

      if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;

        const type = obj.type;
        if (typeof type === 'string' && type.startsWith('data-om-')) {
          return [{ type, data: obj.data ?? (obj.payload as unknown) }];
        }

        if (Array.isArray(obj.parts)) {
          return collectDataParts(obj.parts);
        }

        if (Array.isArray(obj.content)) {
          return collectDataParts(obj.content);
        }

        if (Array.isArray(obj.uiMessages)) {
          return collectDataParts(obj.uiMessages);
        }
      }

      return [];
    };

    streamOptions.onStepFinish = (step: {
      content?: unknown;
      toolCalls?: Array<{
        payload?: { toolName?: string; toolCallId?: string; toolname?: string; name?: string };
        toolName?: string;
        toolCallId?: string;
        toolname?: string;
        name?: string;
      }>;
      toolResults?: Array<{
        payload?: { toolName?: string; toolCallId?: string; toolname?: string; name?: string };
        toolName?: string;
        toolCallId?: string;
        toolname?: string;
        name?: string;
      }>;
      response?: { uiMessages?: unknown };
      uiMessages?: unknown;
    }) => {
      const toolCallNames = (step.toolCalls ?? []).map(item => getToolName(item, 'unknown-tool-call'));
      const toolResultNames = (step.toolResults ?? []).map(item => getToolName(item, 'unknown-tool-result'));
      const dataParts = collectDataParts([
        ...(step.content ? [step.content] : []),
        ...(step.response?.uiMessages ? [step.response.uiMessages] : []),
        ...(step.uiMessages ? [step.uiMessages] : []),
      ]);

      onStepFinish({ toolCallNames, toolResultNames, dataParts });
    };
  }

  if (onChunk) {
    streamOptions.onChunk = onChunk;
  }

  const result = await agent.stream(prompt, streamOptions as any);

  let text = '';

  if (onTextDelta) {
    for await (const delta of result.textStream) {
      text += delta;
      onTextDelta(delta);
    }
  } else {
    await result.consumeStream();
    text = await result.text;
  }

  const usage = (await result.usage) as {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    reasoningTokens?: number;
    cachedInputTokens?: number;
  };

  return {
    usage: {
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      totalTokens: usage.totalTokens ?? 0,
      reasoningTokens: usage.reasoningTokens,
      cachedInputTokens: usage.cachedInputTokens,
    },
    text,
  };
}

type SeedConversationStore = {
  getStore(name: string): Promise<
    | {
        saveThread: (args: {
          thread: {
            id: string;
            title: string;
            resourceId: string;
            createdAt: Date;
            updatedAt: Date;
            metadata: unknown;
          };
        }) => Promise<unknown>;
        saveMessages: (args: {
          messages: {
            id?: string;
            threadId: string;
            role: 'user' | 'assistant';
            content: unknown;
            createdAt: Date;
            type: string;
          }[];
        }) => Promise<unknown>;
      }
    | undefined
  >;
};

export async function seedConversationTurns({
  store,
  threadId,
  resourceId,
  turns = 10,
}: {
  store: SeedConversationStore;
  threadId: string;
  resourceId: string;
  turns?: number;
}) {
  const memoryStore = await store.getStore('memory');
  if (!memoryStore) {
    throw new Error('Failed to acquire memory store for seeding');
  }

  await memoryStore.saveThread({
    thread: {
      id: threadId,
      title: 'OM Cache Seed Thread',
      resourceId,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {},
    },
  });

  const messages = Array.from({ length: turns * 2 }, (_, index) => {
    const isUser = index % 2 === 0;
    const turnNumber = Math.floor(index / 2) + 1;
    const createdAt = new Date(Date.now() - (turns * 2 - index) * 60_000);

    const content = isUser
      ? `Turn ${turnNumber}: I am doing a comprehensive deep research pass over Mastra docs, APIs, memory processors, workflows, tools, and runtime behavior. Please preserve every important detail and continue exploring edge cases, migration concerns, and implementation patterns.`
      : `Turn ${turnNumber}: Understood. I will keep researching Mastra architecture, prompt construction, observational memory flows, streaming usage metrics, and test harness behavior in depth, then summarize findings with precision.`;

    return {
      id: `${threadId}-seed-${index + 1}`,
      threadId,
      resourceId,
      role: isUser ? ('user' as const) : ('assistant' as const),
      type: 'text' as const,
      createdAt,
      content: {
        format: 2 as 2,
        parts: [{ type: 'text' as const, text: content }],
      },
    };
  });

  await memoryStore.saveMessages({ messages });

  return messages.map(message => message.id);
}

export async function seedActiveObservations({
  store,
  threadId,
  resourceId,
  activeObservations,
  observedMessageIds,
}: {
  store: InMemoryStore;
  threadId: string;
  resourceId: string;
  activeObservations: string;
  observedMessageIds: string[];
}) {
  const memoryStore = await store.getStore('memory');
  if (!memoryStore) {
    throw new Error('Failed to acquire memory store for OM seeding');
  }

  const record = await memoryStore.initializeObservationalMemory({
    threadId,
    resourceId,
    scope: 'thread',
    config: {
      observation: {
        messageTokens: 30_000,
        model: 'openai/gpt-4.1-mini',
      },
      reflection: {
        observationTokens: 40_000,
        model: 'openai/gpt-4.1-mini',
      },
    },
    observedTimezone: 'UTC',
  });

  await memoryStore.updateActiveObservations({
    id: record.id,
    observations: activeObservations,
    tokenCount: Math.max(1, activeObservations.length / 4),
    observedMessageIds,
    lastObservedAt: new Date(),
  });

  return record;
}

export function logUsage(label: string, usage: CacheUsage) {
  console.log(
    `[${label}] input=${usage.inputTokens} cachedInput=${usage.cachedInputTokens ?? 0} output=${usage.outputTokens} total=${usage.totalTokens} ratio=${formatCacheRatio(usage)}`,
  );
}
