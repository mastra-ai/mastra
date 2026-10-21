import { createOpenAI } from '@ai-sdk/openai-v5';
import type { ChatCompletionRequest, LLMock } from '@copilotkit/aimock';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import { createStep, createWorkflow } from '../../../../workflows';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  runLoopScenario,
  useLoopScenarioAimock,
} from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * Approval and suspension paths that go through workflows, subagents, the
 * generate() API, and text that straddles an approval boundary.
 *
 * Regression classes:
 * - Agent-level `requireToolApproval` gates workflow tools, and approving runs the workflow
 * - A subagent's own `defaultOptions.requireToolApproval` surfaces on the supervisor stream
 * - A subagent tool's `suspend()` surfaces as a suspended `agent-*` call and `resumeStream` resumes it
 * - A workflow step's `suspend()` surfaces as a suspended `workflow-*` call and `resumeStream` resumes it
 * - `autoResumeSuspendedTools` resumes a suspended workflow step from the next user message
 * - Text streamed before an approval and text after approving concatenate in the resumed output
 * - `generate()` reports `finishReason: 'suspended'` with the suspend payload, and `resumeGenerate` completes it
 */
const toolNames = (req: ChatCompletionRequest) => (req.tools ?? []).map(t => t.function?.name);
const lastIsToolResult = (req: ChatCompletionRequest) => req.messages.at(-1)?.role === 'tool';
const isSupervisor = (req: ChatCompletionRequest) => toolNames(req).includes('agent-userAgent');
const isSubagent = (req: ChatCompletionRequest) => toolNames(req).includes('findUserTool');

const USER = { name: 'Dero Israel', email: 'dero@mail.com' };

function makeWorkflow(mode: 'plain' | 'suspend-name' | 'suspend-age', runs: Array<Record<string, unknown>>) {
  const step = createStep({
    id: 'find-user-step',
    inputSchema: z.object({ name: z.string() }),
    outputSchema: z.object({ name: z.string(), email: z.string(), age: z.number().optional() }),
    suspendSchema: z.object({ message: z.string() }),
    resumeSchema: mode === 'suspend-age' ? z.object({ age: z.number() }) : z.object({ name: z.string() }),
    execute: async ({ inputData, resumeData, suspend }) => {
      if (mode === 'suspend-name' && !resumeData) {
        return suspend({ message: 'Please provide the name of the user' });
      }
      if (mode === 'suspend-age' && !resumeData) {
        return suspend({ message: 'Please provide the age of the user' });
      }
      const result =
        mode === 'suspend-name'
          ? { name: (resumeData as { name: string }).name, email: USER.email }
          : mode === 'suspend-age'
            ? { name: inputData.name, email: USER.email, age: (resumeData as { age: number }).age }
            : { name: inputData.name, email: USER.email };
      runs.push(result);
      return result;
    },
  });
  return createWorkflow({
    id: 'find-user-workflow',
    description: 'Returns the name and email of a user',
    inputSchema: z.object({ name: z.string() }),
    outputSchema: z.object({ name: z.string(), email: z.string(), age: z.number().optional() }),
  })
    .then(step)
    .commit();
}

function workflowCallThenText(llm: LLMock, args: Record<string, unknown>, text = 'Found Dero Israel.') {
  llm.on(
    { endpoint: 'chat', hasToolResult: false },
    { toolCalls: [{ id: 'call-wf-1', name: 'workflow-findUserWorkflow', arguments: args }] },
  );
  llm.on({ endpoint: 'chat', toolCallId: 'call-wf-1', hasToolResult: true }, { content: text });
}

async function drain(output: { fullStream: AsyncIterable<any> }) {
  const chunks: any[] = [];
  for await (const chunk of output.fullStream) chunks.push(chunk);
  return chunks;
}

describeForAllEngines('AIMock loop scenario: approval and suspension through workflows and subagents', engine => {
  const getMock = useLoopScenarioAimock();

  it('gates a workflow tool with agent-level requireToolApproval and runs it once approved', async () => {
    const runs: Array<Record<string, unknown>> = [];
    const shared = await createSharedAgent(getMock(), {
      workflows: { findUserWorkflow: makeWorkflow('plain', runs) },
      // The harness types defaultOptions narrowly; requireToolApproval is a valid agent default option.
      defaultOptions: { requireToolApproval: true } as Record<string, unknown>,
      engine,
    });

    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: shared,
      prompt: 'Find the user Dero Israel',
      collectChunks: true,
      fixtures: llm => workflowCallThenText(llm, { inputData: { name: USER.name } }),
    });

    const approval = chunks!.find(c => c.type === 'tool-call-approval');
    expect(approval?.payload.toolName).toBe('workflow-findUserWorkflow');
    expect(runs).toHaveLength(0);

    const resumed = await shared.agent.approveToolCall({
      runId: output.runId,
      toolCallId: approval!.payload.toolCallId,
    });
    await drain(resumed);

    const toolResult = (await resumed.toolResults).find((r: any) => r.payload.toolName === 'workflow-findUserWorkflow');
    expect((toolResult?.payload.result as any)?.result).toEqual(USER);
    expect(runs).toEqual([USER]);
    expect(await resumed.text).toBe('Found Dero Israel.');
  });

  it('resumes a workflow step that suspended mid-run via resumeStream()', async () => {
    const runs: Array<Record<string, unknown>> = [];
    const shared = await createSharedAgent(getMock(), {
      workflows: { findUserWorkflow: makeWorkflow('suspend-name', runs) },
      memory: new MockMemory(),
      engine,
    });

    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: shared,
      prompt: 'Find a user',
      collectChunks: true,
      fixtures: llm => workflowCallThenText(llm, { inputData: { name: 'unknown' } }),
    });

    const suspended = chunks!.find(c => c.type === 'tool-call-suspended');
    expect(suspended?.payload.toolName).toBe('workflow-findUserWorkflow');
    expect(suspended?.payload.suspendPayload).toEqual({ message: 'Please provide the name of the user' });
    expect(runs).toHaveLength(0);

    const resumed = await shared.agent.resumeStream({ name: USER.name }, { runId: output.runId });
    await drain(resumed);

    const toolResult = (await resumed.toolResults).find((r: any) => r.payload.toolName === 'workflow-findUserWorkflow');
    expect((toolResult?.payload.result as any)?.result).toEqual(USER);
    expect(runs).toEqual([USER]);
  });

  it('auto-resumes a suspended workflow step from the next message on the same thread', async () => {
    const runs: Array<Record<string, unknown>> = [];
    const memory = new MockMemory();
    const shared = await createSharedAgent(getMock(), {
      workflows: { findUserWorkflow: makeWorkflow('suspend-age', runs) },
      memory,
      defaultOptions: { autoResumeSuspendedTools: true },
      engine,
    });
    const threadId = globalThis.crypto.randomUUID();
    const resourceId = globalThis.crypto.randomUUID();

    const first = await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: shared,
      prompt: 'Find the user Dero Israel',
      memory,
      threadId,
      resourceId,
      collectChunks: true,
      fixtures: llm => workflowCallThenText(llm, { inputData: { name: USER.name } }),
    });
    expect(first.chunks!.find(c => c.type === 'tool-call-suspended')?.payload.toolName).toBe(
      'workflow-findUserWorkflow',
    );
    expect(runs).toHaveLength(0);

    getMock().clearFixtures();
    getMock().clearRequests();

    const second = await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: shared,
      prompt: 'He is 25 years old',
      memory,
      threadId,
      resourceId,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              {
                id: 'call-wf-2',
                name: 'workflow-findUserWorkflow',
                arguments: {
                  inputData: { name: USER.name },
                  suspendedToolCallId: 'call-wf-1',
                  resumeData: { age: 25 },
                },
              },
            ],
          },
        );
        llm.on({ endpoint: 'chat', toolCallId: 'call-wf-2', hasToolResult: true }, { content: 'Dero is 25.' });
      },
    });

    expect(JSON.stringify(second.requests[0]?.body?.messages)).toContain('suspended tools');
    expect(runs).toEqual([{ ...USER, age: 25 }]);
    expect(await second.output.text).toBe('Dero is 25.');
  });

  it("surfaces a subagent's own defaultOptions.requireToolApproval on the supervisor and runs the tool once approved", async () => {
    const mock = getMock();
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${mock.url.replace(/\/+$/, '')}/v1` });
    const lookups: string[] = [];
    const findUserTool = createTool({
      id: 'find-user',
      description: 'Finds a user by name',
      inputSchema: z.object({ name: z.string() }),
      execute: async ({ name }) => {
        lookups.push(name);
        return USER;
      },
    });
    const userAgent = new Agent({
      id: 'userAgent',
      name: 'User Agent',
      description: 'Looks up users',
      instructions: 'You look up users with findUserTool.',
      model: openai(SCENARIO_MODEL_ID),
      tools: { findUserTool },
      defaultOptions: { requireToolApproval: true },
    });
    const shared = await createSharedAgent(mock, { agents: { userAgent }, memory: new MockMemory(), engine });

    const { output, chunks } = await runLoopScenario({
      engine,
      llm: mock,
      sharedAgent: shared,
      prompt: 'Find the user Dero Israel',
      collectChunks: true,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', predicate: req => isSupervisor(req) && !lastIsToolResult(req) },
          { toolCalls: [{ id: 'call-sub-1', name: 'agent-userAgent', arguments: { prompt: 'Find Dero Israel' } }] },
        );
        llm.on(
          { endpoint: 'chat', predicate: req => isSubagent(req) && !lastIsToolResult(req) },
          { toolCalls: [{ id: 'call-find-1', name: 'findUserTool', arguments: { name: USER.name } }] },
        );
        llm.on(
          { endpoint: 'chat', predicate: req => isSubagent(req) && lastIsToolResult(req) },
          { content: 'Dero Israel, dero@mail.com' },
        );
        llm.on(
          { endpoint: 'chat', predicate: req => isSupervisor(req) && lastIsToolResult(req) },
          { content: 'Found Dero Israel.' },
        );
      },
    });

    const approval = chunks!.find(c => c.type === 'tool-call-approval');
    expect(approval, 'subagent approval reached the supervisor stream').toBeDefined();
    expect(lookups).toHaveLength(0);

    const resumed = await shared.agent.approveToolCall({
      runId: output.runId,
      toolCallId: approval!.payload.toolCallId,
    });
    await drain(resumed);

    expect(lookups).toEqual([USER.name]);
    const delegated = (await resumed.toolResults).find((r: any) => r.payload.toolName === 'agent-userAgent');
    expect((delegated?.payload.result as any)?.text).toBe('Dero Israel, dero@mail.com');
  });

  it('resumes a subagent tool that suspended mid-run via resumeStream() on the supervisor', async () => {
    const mock = getMock();
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${mock.url.replace(/\/+$/, '')}/v1` });
    const resumedNames: string[] = [];
    const findUserTool = createTool({
      id: 'find-user',
      description: 'Finds a user',
      inputSchema: z.object({ query: z.string() }),
      suspendSchema: z.object({ message: z.string() }),
      resumeSchema: z.object({ name: z.string() }),
      execute: async (_input, context) => {
        if (!context?.agent?.resumeData) {
          return context?.agent?.suspend({ message: 'Please provide the name of the user' });
        }
        resumedNames.push(context.agent.resumeData.name);
        return { name: context.agent.resumeData.name, email: USER.email };
      },
    });
    const userAgent = new Agent({
      id: 'userAgent',
      name: 'User Agent',
      description: 'Looks up users',
      instructions: 'You look up users with findUserTool.',
      model: openai(SCENARIO_MODEL_ID),
      tools: { findUserTool },
    });
    const shared = await createSharedAgent(mock, { agents: { userAgent }, memory: new MockMemory(), engine });

    const { output, chunks } = await runLoopScenario({
      engine,
      llm: mock,
      sharedAgent: shared,
      prompt: 'Find a user',
      collectChunks: true,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', predicate: req => isSupervisor(req) && !lastIsToolResult(req) },
          { toolCalls: [{ id: 'call-sub-1', name: 'agent-userAgent', arguments: { prompt: 'Find a user' } }] },
        );
        llm.on(
          { endpoint: 'chat', predicate: req => isSubagent(req) && !lastIsToolResult(req) },
          { toolCalls: [{ id: 'call-find-1', name: 'findUserTool', arguments: { query: 'a user' } }] },
        );
        llm.on(
          { endpoint: 'chat', predicate: req => isSubagent(req) && lastIsToolResult(req) },
          { content: 'Dero Israel, dero@mail.com' },
        );
        llm.on(
          { endpoint: 'chat', predicate: req => isSupervisor(req) && lastIsToolResult(req) },
          { content: 'Found Dero Israel.' },
        );
      },
    });

    expect(chunks!.find(c => c.type === 'tool-call-suspended')?.payload.toolName).toBe('agent-userAgent');
    expect(resumedNames).toHaveLength(0);

    const resumed = await shared.agent.resumeStream({ name: USER.name }, { runId: output.runId });
    await drain(resumed);

    expect(resumedNames).toEqual([USER.name]);
    const delegated = (await resumed.toolResults).find((r: any) => r.payload.toolName === 'agent-userAgent');
    expect((delegated?.payload.result as any)?.text).toBe('Dero Israel, dero@mail.com');
  });

  // Known gap (durable/evented): the resumed stream's `text` holds only the post-approval text,
  // and the suspended stream's `text` promise never settles. See #27504.
  const itFailsOnDurable = isDurableEngineVariant(engine) ? it.fails : it;

  itFailsOnDurable('concatenates text streamed before an approval with text streamed after approving', async () => {
    const lookups: string[] = [];
    const findUserTool = createTool({
      id: 'find-user',
      description: 'Finds a user by name',
      inputSchema: z.object({ name: z.string() }),
      execute: async ({ name }) => {
        lookups.push(name);
        return USER;
      },
    });
    const shared = await createSharedAgent(getMock(), { tools: { findUserTool }, engine });

    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      sharedAgent: shared,
      prompt: 'Find the user Dero Israel',
      requireToolApproval: true,
      collectChunks: true,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            content: 'Let me look that up. ',
            toolCalls: [{ id: 'call-find-1', name: 'findUserTool', arguments: { name: USER.name } }],
          },
        );
        llm.on({ endpoint: 'chat', toolCallId: 'call-find-1', hasToolResult: true }, { content: 'Found Dero Israel.' });
      },
    });

    const firstText = chunks!
      .filter(c => c.type === 'text-delta')
      .map(c => c.payload.text)
      .join('');
    expect(firstText).toBe('Let me look that up. ');
    const approval = chunks!.find(c => c.type === 'tool-call-approval');

    const resumed = await shared.agent.approveToolCall({
      runId: output.runId,
      toolCallId: approval!.payload.toolCallId,
    });
    await drain(resumed);

    expect(lookups).toEqual([USER.name]);
    expect(await resumed.steps).toHaveLength(2);
    expect(await resumed.text).toBe('Let me look that up. Found Dero Israel.');
  });
});

describeForAllEngines('AIMock loop scenario: generate() suspension and resumeGenerate()', engine => {
  const getMock = useLoopScenarioAimock();

  function makeSuspendingTool(resumed: string[]) {
    return createTool({
      id: 'find-user',
      description: 'Finds a user',
      inputSchema: z.object({ query: z.string() }),
      suspendSchema: z.object({ message: z.string() }),
      resumeSchema: z.object({ name: z.string() }),
      execute: async (_input, context) => {
        if (!context?.agent?.resumeData) {
          return context?.agent?.suspend({ message: 'Please provide the name of the user' });
        }
        resumed.push(context.agent.resumeData.name);
        return { name: context.agent.resumeData.name, email: USER.email };
      },
    });
  }

  it('reports a suspended tool from generate() and completes it with resumeGenerate()', async () => {
    const llm = getMock();
    const resumed: string[] = [];
    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'call-find-1', name: 'findUserTool', arguments: { query: 'a user' } }] },
    );
    llm.on({ endpoint: 'chat', toolCallId: 'call-find-1', hasToolResult: true }, { content: 'Found Dero Israel.' });
    const { agent } = await createSharedAgent(llm, {
      tools: { findUserTool: makeSuspendingTool(resumed) },
      memory: new MockMemory(),
      engine,
    });

    const output = await agent.generate('Find a user');
    expect(output.finishReason).toBe('suspended');
    expect(output.toolResults).toHaveLength(0);
    expect(output.suspendPayload).toMatchObject({
      toolName: 'findUserTool',
      suspendPayload: { message: 'Please provide the name of the user' },
    });

    const resumedOutput = await agent.resumeGenerate({ name: USER.name }, { runId: output.runId });
    expect(resumedOutput.suspendPayload).toBeUndefined();
    expect(resumed).toEqual([USER.name]);
    const toolResult = resumedOutput.toolResults.find((r: any) => r.payload.toolName === 'findUserTool');
    expect(toolResult?.payload.result).toEqual(USER);
    expect(resumedOutput.text).toBe('Found Dero Israel.');
  });

  it('reports a suspended workflow step from generate() and completes it with resumeGenerate()', async () => {
    const llm = getMock();
    const runs: Array<Record<string, unknown>> = [];
    workflowCallThenText(llm, { inputData: { name: 'unknown' } });
    const { agent } = await createSharedAgent(llm, {
      workflows: { findUserWorkflow: makeWorkflow('suspend-name', runs) },
      memory: new MockMemory(),
      engine,
    });

    const output = await agent.generate('Find a user');
    expect(output.finishReason).toBe('suspended');
    expect(output.toolResults).toHaveLength(0);
    expect(output.suspendPayload).toMatchObject({
      toolName: 'workflow-findUserWorkflow',
      suspendPayload: { message: 'Please provide the name of the user' },
    });

    const resumedOutput = await agent.resumeGenerate({ name: USER.name }, { runId: output.runId });
    expect(resumedOutput.suspendPayload).toBeUndefined();
    const toolResult = resumedOutput.toolResults.find((r: any) => r.payload.toolName === 'workflow-findUserWorkflow');
    expect((toolResult?.payload.result as any)?.result).toEqual(USER);
    expect(runs).toEqual([USER]);
  });

  it('auto-resumes a tool suspended by generate() from the next generate() on the same thread', async () => {
    const llm = getMock();
    const resumed: string[] = [];
    const memory = new MockMemory();
    const { agent } = await createSharedAgent(llm, {
      tools: { findUserTool: makeSuspendingTool(resumed) },
      memory,
      defaultOptions: { autoResumeSuspendedTools: true },
      engine,
    });
    const opts = { memory: { thread: globalThis.crypto.randomUUID(), resource: globalThis.crypto.randomUUID() } };

    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'call-find-1', name: 'findUserTool', arguments: { query: 'a user' } }] },
    );
    const first = await agent.generate('Find a user', opts);
    expect(first.finishReason).toBe('suspended');
    expect(resumed).toHaveLength(0);

    llm.clearFixtures();
    llm.clearRequests();
    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      {
        toolCalls: [
          { id: 'call-find-2', name: 'findUserTool', arguments: { query: 'a user', resumeData: { name: USER.name } } },
        ],
      },
    );
    llm.on({ endpoint: 'chat', toolCallId: 'call-find-2', hasToolResult: true }, { content: 'Found Dero Israel.' });

    const second = await agent.generate('The user is Dero Israel', opts);
    expect(JSON.stringify(llm.getRequests()[0]?.body?.messages)).toContain('suspended tools');
    expect(resumed).toEqual([USER.name]);
    expect(second.text).toBe('Found Dero Israel.');
  });

  it('auto-resumes a workflow step suspended by generate() from the next generate() on the same thread', async () => {
    const llm = getMock();
    const runs: Array<Record<string, unknown>> = [];
    const { agent } = await createSharedAgent(llm, {
      workflows: { findUserWorkflow: makeWorkflow('suspend-age', runs) },
      memory: new MockMemory(),
      defaultOptions: { autoResumeSuspendedTools: true },
      engine,
    });
    const opts = { memory: { thread: globalThis.crypto.randomUUID(), resource: globalThis.crypto.randomUUID() } };

    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      {
        toolCalls: [
          { id: 'call-wf-1', name: 'workflow-findUserWorkflow', arguments: { inputData: { name: USER.name } } },
        ],
      },
    );
    const first = await agent.generate('Find the user Dero Israel', opts);
    expect(first.finishReason).toBe('suspended');
    expect(first.suspendPayload).toMatchObject({
      toolName: 'workflow-findUserWorkflow',
      suspendPayload: { message: 'Please provide the age of the user' },
    });
    expect(runs).toHaveLength(0);

    llm.clearFixtures();
    llm.clearRequests();
    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      {
        toolCalls: [
          {
            id: 'call-wf-2',
            name: 'workflow-findUserWorkflow',
            arguments: { inputData: { name: USER.name }, suspendedToolCallId: 'call-wf-1', resumeData: { age: 25 } },
          },
        ],
      },
    );
    llm.on({ endpoint: 'chat', toolCallId: 'call-wf-2', hasToolResult: true }, { content: 'Dero is 25.' });

    const second = await agent.generate('He is 25 years old', opts);
    expect(JSON.stringify(llm.getRequests()[0]?.body?.messages)).toContain('suspended tools');
    expect(runs).toEqual([{ ...USER, age: 25 }]);
    expect(second.text).toBe('Dero is 25.');
  });
});
