import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Memory } from '../../../../memory/src';
import { Agent } from '../../agent';
import { createDurableAgent } from '../../agent/durable';
import { Mastra } from '../../mastra';
import { ToolSearchProcessor } from '../../processors/processors/tool-search';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { createTool } from '../../tools';
import { AgentController } from '../agent-controller';

afterEach(() => vi.restoreAllMocks());

function response(toolName?: string, input = '{}') {
  return {
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue({ type: 'stream-start', warnings: [] });
        if (toolName) {
          controller.enqueue({ type: 'tool-call', toolCallId: `${toolName}-call`, toolName, input });
        } else {
          controller.enqueue({ type: 'text-start', id: 'answer' });
          controller.enqueue({ type: 'text-delta', id: 'answer', delta: 'READY' });
          controller.enqueue({ type: 'text-end', id: 'answer' });
        }
        controller.enqueue({
          type: 'finish',
          finishReason: toolName ? 'tool-calls' : 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        });
        controller.close();
      },
    }),
  };
}

describe('deferred tools through a durable controller', () => {
  for (const scenario of [
    'plain',
    'approve',
    'decline',
    'invalid',
    'revoked',
    'removed',
    'metadata-denied',
    'tool-denied',
    'restart',
    'schema-changed',
    'approval-changed',
    'refinement-changed',
    'transform',
    'executor-denied',
  ] as const) {
    // Upstream currently transforms ordinary eager tool input twice after
    // approval too. Keep the correct assertion visible until that baseline
    // resume defect is repaired; deferred discovery must not normalize it away.
    const check = scenario === 'transform' ? it.fails : it;
    check(
      `${scenario} preserves native execution boundaries${scenario === 'transform' ? ' (known upstream resume failure)' : ''}`,
      async () => {
        const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network forbidden'));
        const id = randomUUID();
        let revoked = false;
        const executedDefinitions: number[] = [];
        const execute = vi.fn(async ({ count }: { count: number }) => ({ count }));
        const resolve = vi.fn(async () => {
          if (revoked && scenario === 'revoked') throw new Error('Connection revoked during approval');
          const minimum = revoked && scenario === 'refinement-changed' ? 10 : 1;
          const count =
            scenario === 'refinement-changed'
              ? z.number().refine(value => value >= minimum)
              : scenario === 'transform'
                ? z.number().transform(value => value + 1)
                : z
                    .number()
                    .int()
                    .min(revoked && scenario === 'schema-changed' ? 10 : 1);
          return createTool({
            id: 'remote',
            description: revoked && scenario === 'executor-denied' ? 'New permitted definition' : 'Read mailbox',
            requireApproval: !(revoked && scenario === 'approval-changed'),
            inputSchema: z.object({ count }),
            execute: async input => {
              executedDefinitions.push(minimum);
              return execute(input);
            },
          });
        });
        const metadata = vi.fn(async ({ requestContext }: { requestContext?: RequestContext }) => {
          expect(requestContext?.get('owner')).toBe('alice');
          if (revoked && scenario === 'removed') return {};
          return { remote: { id: 'remote', description: 'Read mailbox', resolve } };
        });
        const storage = new InMemoryStore();
        let modelCalls = 0;
        const resultsSeen: unknown[] = [];
        const createEngine = () => {
          const memory = new Memory({ storage, options: { generateTitle: false } });
          const processor = new ToolSearchProcessor({
            tools: {},
            deferredTools: metadata,
            deferredFilter: () => !(revoked && scenario === 'metadata-denied'),
            filter: ({ tool }) =>
              !(revoked && scenario === 'tool-denied') &&
              !(revoked && scenario === 'executor-denied' && tool.description === 'Read mailbox'),
            storage: 'context',
            search: { autoLoad: true, topK: 1 },
          });
          const agent = createDurableAgent({
            agent: new Agent({
              id,
              name: 'Deferred proof',
              instructions: 'Complete the request.',
              memory,
              inputProcessors: [processor],
              model: new MastraLanguageModelV2Mock({
                doStream: async options => {
                  resultsSeen.push(...options.prompt.filter(message => message.role === 'tool'));
                  const call = ++modelCalls;
                  if (call === 1) {
                    expect(metadata).not.toHaveBeenCalled();
                    expect(resolve).not.toHaveBeenCalled();
                    if (scenario !== 'plain') return response('search_tools', '{"query":"mailbox"}');
                  }
                  if (call === 2 && scenario !== 'plain') {
                    expect(options.tools?.find(tool => tool.name === 'remote')).toBeDefined();
                    return response('remote', scenario === 'invalid' ? '{"count":-1}' : '{"count":2}');
                  }
                  if (call === 4 && scenario === 'restart') {
                    expect(options.tools?.find(tool => tool.name === 'remote')).toBeDefined();
                  }
                  return response();
                },
              }),
            }),
          });
          const controller = new AgentController({
            id: `${id}-controller`,
            agent: agent as unknown as Agent,
            memory,
            storage,
            modes: [{ id: 'chat', name: 'Chat', default: true }],
          });
          const mastra = new Mastra({
            storage,
            agents: { agent },
            agentControllers: { controller },
            logger: false,
            workers: false,
            scheduler: { enabled: false },
            recovery: { durableAgents: 'off' },
          });
          return { controller, mastra };
        };
        let { controller, mastra } = createEngine();
        try {
          await controller.init();
          const session = await controller.createSession({
            id: `${id}-session`,
            ownerId: controller.id,
            resourceId: 'alice',
            threadId: `${id}-thread`,
          });
          let approvals = 0;
          const executionsAtApproval: number[] = [];
          const failures: unknown[] = [];
          await session.permissions.setForTool({ toolName: 'search_tools', policy: 'allow' });
          session.subscribe(event => {
            if (event.type === 'error') failures.push(event);
            if (event.type === 'tool_approval_required') {
              if (event.toolName === 'search_tools') {
                session.respondToToolApproval({ decision: 'approve', toolCallId: event.toolCallId });
                return;
              }
              approvals++;
              executionsAtApproval.push(execute.mock.calls.length);
              const revokeAtApproval = [
                'revoked',
                'removed',
                'metadata-denied',
                'tool-denied',
                'schema-changed',
                'approval-changed',
                'refinement-changed',
                'executor-denied',
              ].includes(scenario);
              if (revokeAtApproval) revoked = true;
              session.respondToToolApproval({
                decision:
                  scenario === 'approve' || scenario === 'restart' || scenario === 'transform' || revokeAtApproval
                    ? 'approve'
                    : 'decline',
                toolCallId: event.toolCallId,
              });
            }
          });
          await session.sendMessage({
            content: 'Complete the local proof.',
            requestContext: new RequestContext([['owner', 'alice']]),
          });
          expect(session.displayState.get().isRunning).toBe(false);
          expect(
            execute,
            JSON.stringify({
              failures,
              modelCalls,
              approvals,
              metadataCalls: metadata.mock.calls.length,
              resolveCalls: resolve.mock.calls.length,
              resultsSeen,
            }),
          ).toHaveBeenCalledTimes(['approve', 'restart', 'refinement-changed', 'transform'].includes(scenario) ? 1 : 0);
          if (scenario === 'refinement-changed') expect(executedDefinitions).toEqual([1]);
          if (scenario === 'transform') expect(execute.mock.calls[0][0]).toEqual({ count: 3 });
          expect(executionsAtApproval.every(count => count === 0)).toBe(true);
          if (scenario === 'approve') expect(execute.mock.calls[0][0]).toEqual({ count: 2 });
          if (scenario === 'plain') {
            expect(metadata).not.toHaveBeenCalled();
            expect(resolve).not.toHaveBeenCalled();
          }
          if (scenario === 'approve' || scenario === 'decline') expect(approvals).toBe(1);
          if (scenario === 'restart') {
            await mastra.shutdown();
            ({ controller, mastra } = createEngine());
            await controller.init();
            metadata.mockClear();
            resolve.mockClear();
            const restored = await controller.createSession({
              id: `${id}-restored`,
              ownerId: controller.id,
              resourceId: 'alice',
              threadId: `${id}-thread`,
            });
            await restored.sendMessage({
              content: 'Reply briefly.',
              requestContext: new RequestContext([['owner', 'alice']]),
            });
            expect(modelCalls).toBe(4);
            expect(metadata).toHaveBeenCalled();
            expect(resolve).toHaveBeenCalled();
            expect(execute).toHaveBeenCalledTimes(1);
            expect(restored.displayState.get().isRunning).toBe(false);
          }
          expect(network).not.toHaveBeenCalled();
        } finally {
          await mastra.shutdown();
        }
      },
      30_000,
    );
  }
});
