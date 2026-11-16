import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import type { ChunkType } from '../../../../stream/types';
import { createTool } from '../../../../tools';
import type { RequireToolApproval } from '../../../../tools';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  useLoopScenarioAimock,
} from '../aimock-scenario';

/**
 * A tool call that starts after another call of the same step was suspended and resumed.
 *
 * The model emits a call that suspends itself (`ask`) and an approval-gated call. Calls run one
 * at a time (a registered tool can suspend), so the gated call first starts inside the resumed
 * run. It must ask for its own approval whatever form the approval policy takes.
 */
describeForAllEngines('AIMock loop scenario: approval of a tool call started after a resume', engine => {
  const getMock = useLoopScenarioAimock();
  const isPlainLoop = !isDurableEngineVariant(engine);

  type Run = { output?: any; fullStream: AsyncIterable<ChunkType>; runId: string };

  function buildTools(log: string[], { deleteAllRequiresApproval = false } = {}) {
    return {
      ask: createTool({
        id: 'ask',
        description: 'Ask the user a question.',
        inputSchema: z.object({}),
        suspendSchema: z.object({ question: z.string() }),
        resumeSchema: z.object({ answer: z.string() }),
        execute: async (_input, { agent }) => {
          const answer = (agent?.resumeData as { answer?: string } | undefined)?.answer;
          if (!answer) return agent!.suspend({ question: 'Which files?' });
          return { answer };
        },
      }),
      delete_file: createTool({
        id: 'delete_file',
        description: 'Delete a file.',
        inputSchema: z.object({ path: z.string() }),
        execute: async () => {
          log.push('ran:delete_file');
          return { deleted: true };
        },
      }),
      delete_all: createTool({
        id: 'delete_all',
        description: 'Delete every file.',
        inputSchema: z.object({}),
        ...(deleteAllRequiresApproval ? { requireApproval: true } : {}),
        execute: async () => {
          log.push('ran:delete_all');
          return { count: 5 };
        },
      }),
      read_file: createTool({
        id: 'read_file',
        description: 'Read a file.',
        inputSchema: z.object({ path: z.string() }),
        execute: async () => {
          log.push('ran:read_file');
          return { content: 'hello' };
        },
      }),
      // Can suspend, so it is never started before the model finishes streaming.
      check_disk: createTool({
        id: 'check_disk',
        description: 'Check free disk space.',
        inputSchema: z.object({}),
        suspendSchema: z.object({ question: z.string() }),
        resumeSchema: z.object({ answer: z.string() }),
        execute: async () => {
          log.push('ran:check_disk');
          return { free: '10GB' };
        },
      }),
    };
  }

  /**
   * Streams the run and answers every pause: approvals are approved, suspensions resumed with
   * an answer. `log` records each pause next to the tool executions, in the order they happened.
   */
  async function drive({
    toolCalls,
    requireToolApproval,
    deleteAllRequiresApproval,
  }: {
    toolCalls: { id: string; name: string; arguments: Record<string, unknown> }[];
    requireToolApproval?: RequireToolApproval;
    deleteAllRequiresApproval?: boolean;
  }) {
    const llm = getMock();
    llm.on({ endpoint: 'chat', hasToolResult: false }, { toolCalls });
    llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'done' });

    const log: string[] = [];
    const { agent } = await createSharedAgent(llm, {
      engine,
      instructions: 'Use the tools.',
      tools: buildTools(log, { deleteAllRequiresApproval }),
    });
    const scenarioAgent = agent as any;

    let run: Run = await scenarioAgent.stream('Clean up my files.', {
      ...(requireToolApproval !== undefined ? { requireToolApproval } : {}),
    });
    const runId = run.runId;
    const answered = new Set<string>();
    for (let resumes = 0; resumes <= toolCalls.length * 2; resumes++) {
      let pause: { kind: 'approval' | 'suspended'; toolCallId: string } | undefined;
      for await (const chunk of run.fullStream) {
        if (chunk.type !== 'tool-call-approval' && chunk.type !== 'tool-call-suspended') continue;
        const kind = chunk.type === 'tool-call-approval' ? 'approval' : 'suspended';
        const toolCallId = (chunk.payload as { toolCallId: string }).toolCallId;
        if (answered.has(`${kind}:${toolCallId}`)) continue;
        log.push(`${kind}:${toolCallId}`);
        pause ??= { kind, toolCallId };
        // Durable streams stay open while the run is suspended.
        if (isDurableEngineVariant(engine)) break;
      }
      if (!pause) break;
      answered.add(`${pause.kind}:${pause.toolCallId}`);
      run =
        pause.kind === 'approval'
          ? await scenarioAgent.approveToolCall({ runId, toolCallId: pause.toolCallId })
          : await scenarioAgent.resumeStream({ answer: 'all of them' }, { runId, toolCallId: pause.toolCallId });
    }

    return { log, text: await (run.output ?? run).text };
  }

  const askThenDeleteAll = [
    { id: 'call_ask', name: 'ask', arguments: {} },
    { id: 'call_delete_all', name: 'delete_all', arguments: {} },
  ];

  it.each([
    { policy: 'a tool-level requireApproval', deleteAllRequiresApproval: true },
    { policy: 'requireToolApproval: true', requireToolApproval: true },
    {
      policy: 'a requireToolApproval function',
      requireToolApproval: ({ toolName }: { toolName: string }) => /^delete_/.test(toolName),
    },
  ])(
    'asks for approval of a call started after a resumed suspension, with $policy',
    async ({ deleteAllRequiresApproval, requireToolApproval }) => {
      const { log, text } = await drive({
        toolCalls: askThenDeleteAll,
        requireToolApproval: requireToolApproval as RequireToolApproval | undefined,
        deleteAllRequiresApproval,
      });

      // A boolean policy also gates `ask`, which is approved before it suspends.
      const askPauses =
        requireToolApproval === true ? ['approval:call_ask', 'suspended:call_ask'] : ['suspended:call_ask'];
      expect(log).toEqual([...askPauses, 'approval:call_delete_all', 'ran:delete_all']);
      expect(text).toBe('done');
    },
  );

  it('runs a call started after a resumed suspension without asking when no policy is set', async () => {
    const { log, text } = await drive({
      toolCalls: [
        { id: 'call_ask', name: 'ask', arguments: {} },
        { id: 'call_check', name: 'check_disk', arguments: {} },
      ],
    });

    expect(log).toEqual(['suspended:call_ask', 'ran:check_disk']);
    expect(text).toBe('done');
  });

  // The plain loop cannot keep a function policy across a resume: it stores only that a
  // policy was set, and gates every call that starts after the resume. Durable and evented
  // agents read the live function from the run registry in the same process.
  it(
    isPlainLoop
      ? 'asks again for a call started after a resume when the policy function is gone'
      : 'does not ask for a call started after a resume that the policy function does not match',
    async () => {
      const { log, text } = await drive({
        toolCalls: [
          { id: 'call_delete', name: 'delete_file', arguments: { path: 'a.txt' } },
          { id: 'call_read', name: 'read_file', arguments: { path: 'b.txt' } },
        ],
        requireToolApproval: ({ toolName }: { toolName: string }) => /^delete_/.test(toolName),
      });

      expect(log).toEqual(
        isPlainLoop
          ? ['approval:call_delete', 'ran:delete_file', 'approval:call_read', 'ran:read_file']
          : ['approval:call_delete', 'ran:delete_file', 'ran:read_file'],
      );
      expect(text).toBe('done');
    },
  );
});
