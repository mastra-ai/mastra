import type { ChatCompletionRequest, LLMock } from '@copilotkit/aimock';
import { it, expect, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import type { ChunkType } from '../../../../stream/types';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * A supervisor delegates to a subagent whose tool needs approval. The approval
 * request bubbles up to the user, who approves or declines it on the
 * supervisor. A decline (and its reason) must reach the subagent, which then
 * answers on its own; the tool must never run. Declining the supervisor's own
 * gate on the delegation call stays with the supervisor.
 */
const toolNames = (req: ChatCompletionRequest) => (req.tools ?? []).map(t => t.function?.name);
const isSupervisor = (req: ChatCompletionRequest) => toolNames(req).includes('agent-subAgent');
const isSubagent = (req: ChatCompletionRequest) => toolNames(req).includes('secretTool');
const lastIsToolResult = (req: ChatCompletionRequest) => req.messages.at(-1)?.role === 'tool';

const DECLINE_REASON = 'not allowed today';
const SUB_AGENT_ANSWER = 'Sub-agent handled it.';
const SUPERVISOR_ANSWER = 'Supervisor finished.';

type RunHandle = { fullStream: AsyncIterable<ChunkType>; runId: string };

describeForAllEngines(
  'AIMock loop scenario: subagent tool approval',
  engine => {
    const getMock = useLoopScenarioAimock();

    async function setup(mock: LLMock) {
      const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${mock.url.replace(/\/+$/, '')}/v1` });
      const executions = { count: 0 };
      const secretTool = createTool({
        id: 'secret-tool',
        description: 'Fetch a secret',
        inputSchema: z.object({ query: z.string() }),
        requireApproval: true,
        execute: async () => {
          executions.count++;
          return { secret: 'classified-42' };
        },
      });
      const subAgent = new Agent({
        id: 'subAgent',
        name: 'subAgent',
        description: 'Fetches secrets',
        instructions: 'Fetch secrets with secretTool.',
        model: openai(SCENARIO_MODEL_ID),
        tools: { secretTool },
      });
      const memory = new MockMemory();
      const shared = await createSharedAgent(mock, {
        instructions: 'Delegate to subAgent.',
        agents: { subAgent },
        memory,
        engine,
      });

      mock.on(
        { endpoint: 'chat', predicate: req => isSupervisor(req) && !lastIsToolResult(req) },
        { toolCalls: [{ id: 'call-sup-1', name: 'agent-subAgent', arguments: { prompt: 'fetch the secret' } }] },
      );
      mock.on(
        { endpoint: 'chat', predicate: req => isSubagent(req) && !lastIsToolResult(req) },
        { toolCalls: [{ id: 'call-sub-1', name: 'secretTool', arguments: { query: 'classified' } }] },
      );
      mock.on(
        { endpoint: 'chat', predicate: req => isSubagent(req) && lastIsToolResult(req) },
        { content: SUB_AGENT_ANSWER },
      );
      mock.on(
        { endpoint: 'chat', predicate: req => isSupervisor(req) && lastIsToolResult(req) },
        { content: SUPERVISOR_ANSWER },
      );

      return { agent: shared.agent, memory, executions };
    }

    async function runToApproval(mock: LLMock, { gateDelegation = false } = {}) {
      const { agent, memory, executions } = await setup(mock);
      const thread = `subagent-approval-${gateDelegation ? 'gate' : 'inner'}`;
      const resource = 'subagent-approval-user';
      const run = (await agent.stream('Get the secret', {
        memory: { thread, resource },
        maxSteps: 5,
        ...(gateDelegation ? { requireToolApproval: true } : {}),
      })) as unknown as RunHandle;

      let approval: { toolName: string } | undefined;
      for await (const chunk of run.fullStream) {
        if (chunk.type === 'tool-call-approval') {
          approval = chunk.payload as { toolName: string };
          // Durable streams stay open while suspended; stop at the approval.
          break;
        }
      }
      expect(approval, 'run paused for approval').toBeDefined();

      // The pending approval is saved on the thread once the run has suspended.
      const entry = await vi.waitFor(async () => {
        const { messages } = await memory.recall({ threadId: thread, resourceId: resource });
        const pending = [...messages].reverse().find((m: any) => m.content?.metadata?.pendingToolApprovals) as any;
        expect(pending).toBeDefined();
        return Object.values(pending.content.metadata.pendingToolApprovals)[0] as {
          runId: string;
          toolCallId: string;
          delegatedRunId?: string;
        };
      });

      return { agent, memory, executions, approval: approval!, entry, thread, resource };
    }

    async function drain(stream: AsyncIterable<ChunkType>) {
      const chunks: ChunkType[] = [];
      for await (const chunk of stream) chunks.push(chunk);
      const text = chunks
        .filter(c => c.type === 'text-delta')
        .map(c => (c.payload as { text: string }).text)
        .join('');
      return { chunks, types: chunks.map(c => c.type), text };
    }

    const subagentRequests = (mock: LLMock) =>
      mock.getRequests().filter(r => isSubagent(r.body as ChatCompletionRequest));

    it('forwards a declined subagent tool approval and its reason to the subagent', async () => {
      const mock = getMock();
      const { agent, executions, entry, thread, resource } = await runToApproval(mock);

      const resumed = (await agent.declineToolCall({
        runId: entry.runId,
        toolCallId: entry.toolCallId,
        reason: DECLINE_REASON,
        memory: { thread, resource },
      } as any)) as unknown as RunHandle;
      const { chunks, types, text } = await drain(resumed.fullStream);
      const label = `resumed chunks: ${types.join(', ')}`;

      expect(entry.delegatedRunId, 'pending approval belongs to the subagent run').toBeDefined();
      expect(executions.count).toBe(0);
      expect(types, label).not.toContain('error');
      expect(types, label).not.toContain('tool-error');
      expect(types, label).not.toContain('tool-call-approval');
      // Not denied locally on the supervisor's delegation call.
      expect(
        chunks.filter(c => c.type === 'tool-output-denied' && (c.payload as any).toolName === 'agent-subAgent'),
        label,
      ).toHaveLength(0);
      const resumedSub = subagentRequests(mock).find(r => lastIsToolResult(r.body as ChatCompletionRequest));
      expect(resumedSub, 'subagent resumed with a tool response').toBeDefined();
      expect(JSON.stringify(resumedSub!.body)).toContain(DECLINE_REASON);
      const delegated = chunks.find(c => c.type === 'tool-result' && (c.payload as any).toolName === 'agent-subAgent');
      expect((delegated?.payload as any)?.result?.text, label).toBe(SUB_AGENT_ANSWER);
      expect(text).toBe(SUPERVISOR_ANSWER);
    });

    it('runs the subagent tool once when the approval is granted', async () => {
      const mock = getMock();
      const { agent, executions, entry, thread, resource } = await runToApproval(mock);

      const resumed = (await agent.approveToolCall({
        runId: entry.runId,
        toolCallId: entry.toolCallId,
        memory: { thread, resource },
      } as any)) as unknown as RunHandle;
      const { types, text } = await drain(resumed.fullStream);

      expect(types, `resumed chunks: ${types.join(', ')}`).not.toContain('error');
      expect(executions.count).toBe(1);
      const resumedSub = subagentRequests(mock).find(r => lastIsToolResult(r.body as ChatCompletionRequest));
      expect(JSON.stringify(resumedSub?.body)).toContain('classified-42');
      expect(text).toBe(SUPERVISOR_ANSWER);
    });

    it("keeps a decline of the supervisor's own delegation gate on the supervisor", async () => {
      const mock = getMock();
      const { agent, executions, approval, entry, thread, resource } = await runToApproval(mock, {
        gateDelegation: true,
      });
      expect(approval.toolName).toBe('agent-subAgent');

      const resumed = (await agent.declineToolCall({
        runId: entry.runId,
        toolCallId: entry.toolCallId,
        reason: DECLINE_REASON,
        memory: { thread, resource },
      } as any)) as unknown as RunHandle;
      const { chunks, types } = await drain(resumed.fullStream);

      const label = `resumed chunks: ${types.join(', ')}`;
      expect(entry.delegatedRunId).toBeUndefined();
      const denied = chunks.find(c => c.type === 'tool-output-denied');
      expect((denied?.payload as any)?.toolName, label).toBe('agent-subAgent');
      expect((denied?.payload as any)?.approval, label).toMatchObject({ approved: false, reason: DECLINE_REASON });
      expect(subagentRequests(mock)).toHaveLength(0);
      expect(executions.count).toBe(0);
    });
  },
  { skip: ['fs'] },
);
