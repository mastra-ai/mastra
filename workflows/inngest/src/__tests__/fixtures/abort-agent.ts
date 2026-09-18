import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { DefaultStorage } from '@mastra/libsql';
import { Inngest } from 'inngest';

import { createInngestAgent } from '../../durable-agent';
import { createInngestDurableAgenticWorkflow } from '../../durable-agent/create-inngest-agentic-workflow';

/**
 * Mock model that streams slowly and honours `abortSignal`, mirroring real AI SDK
 * provider behaviour. The slow drip keeps the run reliably mid-generation when a
 * cross-process abort request lands. If the abort never arrives (the #22543
 * regression), the stream finishes naturally with finishReason 'stop' — giving the
 * test a deterministic failure instead of a hang.
 */
function slowAbortableModel(): any {
  return {
    specificationVersion: 'v2',
    provider: 'mock',
    modelId: 'durable-abort-model',
    supportedUrls: {},
    async doGenerate() {
      return {
        content: [{ type: 'text', text: 'ok' }],
        finishReason: 'stop',
        usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
        warnings: [],
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
    async doStream({ abortSignal }: { abortSignal?: AbortSignal }) {
      if (abortSignal?.aborted) {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        throw err;
      }
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({
              type: 'response-metadata',
              id: 'durable-abort-response',
              modelId: 'durable-abort-model',
              timestamp: new Date(0),
            });
            controller.enqueue({ type: 'text-start', id: 'text-1' });
            let count = 0;
            const timer = setInterval(() => {
              count += 1;
              if (count > 120) {
                clearInterval(timer);
                controller.enqueue({ type: 'text-end', id: 'text-1' });
                controller.enqueue({
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
                });
                controller.close();
                return;
              }
              try {
                controller.enqueue({ type: 'text-delta', id: 'text-1', delta: `chunk-${count} ` });
              } catch {
                clearInterval(timer);
              }
            }, 250);
            abortSignal?.addEventListener(
              'abort',
              () => {
                clearInterval(timer);
                const err = new Error('Aborted');
                err.name = 'AbortError';
                try {
                  controller.error(err);
                } catch {
                  // Stream already closed.
                }
              },
              { once: true },
            );
          },
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  };
}

export function buildAbortAgent({
  dbUrl,
  agentId,
  inngestPort,
}: {
  dbUrl: string;
  agentId: string;
  inngestPort: number;
}) {
  const inngest = new Inngest({ id: 'durable-abort-test', baseUrl: `http://localhost:${inngestPort}` });
  const storage = new DefaultStorage({ id: `durable-abort-${agentId}`, url: dbUrl });

  const agent = new Agent({
    id: agentId,
    name: 'Durable Abort Agent',
    instructions: 'Count slowly.',
    model: slowAbortableModel(),
  });

  const durableAgent = createInngestAgent({ agent, inngest });
  const workflow = createInngestDurableAgenticWorkflow({ inngest });
  const mastra = new Mastra({
    storage,
    agents: { [agentId]: durableAgent } as any,
    workflows: { [workflow.id]: workflow } as any,
  });

  return { durableAgent, inngest, mastra };
}
