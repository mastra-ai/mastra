/**
 * Computer tool calls from one model step reach the computer in the order the model
 * emitted them, with default tool-call concurrency, through a real Agent.
 */
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../agent';
import { clearRunLeaseFence, setRunLeaseFence } from '../../../agent/run-lease-fence';
import { RequestContext } from '../../../request-context';
import { createTool } from '../../../tools';
import { delay } from '../../../utils';
import { WORKSPACE_TOOLS } from '../../constants';
import type { SandboxComputer, WorkspaceSandbox } from '../../sandbox';
import { Workspace } from '../../workspace';
import { DEFAULT_SCREENSHOT_AFTER_ACTION, DEFAULT_SCREENSHOT_DELAY_MS } from '../computer-helpers';
import { createWorkspaceTools } from '../tools';
import type { WorkspaceToolsConfig } from '../types';

const C = WORKSPACE_TOOLS.COMPUTER;
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

type Call = { id: string; tool: string; args: Record<string, unknown> };

/** A computer that records every action as it starts and as it ends. */
function recordingComputer(log: string[], actionDelayMs: Partial<Record<string, number>> = {}): SandboxComputer {
  const act =
    (name: string) =>
    async (..._args: unknown[]): Promise<any> => {
      log.push(name);
      await delay(actionDelayMs[name] ?? 0);
      log.push(`/${name}`);
      if (name === 'screenshot') return { data: PNG, mediaType: 'image/png' };
      if (name === 'getScreenSize') return { width: 1024, height: 768 };
      if (name === 'getCursorPosition') return { x: 0, y: 0 };
    };
  return {
    screenshot: act('screenshot'),
    leftClick: act('leftClick'),
    rightClick: act('rightClick'),
    doubleClick: act('doubleClick'),
    moveMouse: act('moveMouse'),
    drag: act('drag'),
    scroll: act('scroll'),
    type: act('type'),
    press: act('press'),
    getScreenSize: act('getScreenSize'),
    getCursorPosition: act('getCursorPosition'),
  };
}

/** Sandbox whose getInfo (awaited by every computer tool before acting) takes `delays[n]` ms on call n. */
function sandbox(computer: SandboxComputer, getInfoDelays: number[] = []): WorkspaceSandbox {
  let n = 0;
  return {
    id: 'sb',
    name: 'sb',
    provider: 'test',
    status: 'running',
    snapshot: async () => {},
    getInfo: async () => {
      await delay(getInfoDelays[n++] ?? 0);
      return { id: 'sb', name: 'sb', provider: 'test', status: 'running' as const, createdAt: new Date() };
    },
    executeCommand: async () => ({ success: true, exitCode: 0, stdout: '', stderr: '', executionTimeMs: 0 }),
    computer,
  };
}

function computerToolsConfig(screenshotAfterAction: boolean, screenshotDelayMs = 0): WorkspaceToolsConfig {
  const config: WorkspaceToolsConfig = {};
  for (const name of Object.values(C)) config[name] = { screenshotAfterAction, screenshotDelayMs };
  return config;
}

/** Model that emits `calls` in one step, then finishes with text. */
function model(calls: Call[]) {
  let step = 0;
  return new MockLanguageModelV2({
    doGenerate: async () => {
      const first = step++ === 0;
      return {
        content: first
          ? calls.map(c => ({
              type: 'tool-call' as const,
              toolCallType: 'function' as const,
              toolCallId: c.id,
              toolName: c.tool,
              input: JSON.stringify(c.args),
            }))
          : [{ type: 'text' as const, text: 'done' }],
        finishReason: first ? ('tool-calls' as const) : ('stop' as const),
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
    doStream: async () => {
      const first = step++ === 0;
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `r${step}`, modelId: 'mock', timestamp: new Date() },
          ...(first
            ? calls.map(c => ({
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: c.id,
                toolName: c.tool,
                input: JSON.stringify(c.args),
              }))
            : [
                { type: 'text-start', id: 't' },
                { type: 'text-delta', id: 't', delta: 'done' },
                { type: 'text-end', id: 't' },
              ]),
          {
            type: 'finish',
            finishReason: first ? 'tool-calls' : 'stop',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          },
        ] as any),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

const CLICK_TYPE_PRESS: Call[] = [
  { id: 'c1', tool: C.CLICK, args: { x: 10, y: 10 } },
  { id: 'c2', tool: C.TYPE, args: { text: 'hello' } },
  { id: 'c3', tool: C.PRESS_KEY, args: { key: 'Enter' } },
];

function agentWith(workspace: Workspace, calls: Call[], tools: Record<string, any> = {}) {
  return new Agent({
    id: 'computer-order',
    name: 'computer-order',
    instructions: 'Use the computer.',
    model: model(calls),
    workspace,
    tools,
  });
}

async function run(agent: Agent, mode: 'stream' | 'generate', options: Record<string, unknown> = {}) {
  // A non-empty request context exercises the builder's per-call context merge.
  const requestContext = new RequestContext([['tenant', 't1']]);
  if (mode === 'generate') return agent.generate('go', { maxSteps: 2, requestContext, ...options });
  const stream = await agent.stream('go', { maxSteps: 2, requestContext, ...options });
  await stream.consumeStream();
  return stream;
}

const actions = (log: string[]) => log.filter(e => !e.startsWith('/'));

describe('computer tool calls run in model order', () => {
  const fenced: Array<[string, () => Promise<void>]> = [];
  afterEach(() => {
    for (const [id, fence] of fenced.splice(0)) clearRunLeaseFence(id, fence);
  });

  for (const mode of ['stream', 'generate'] as const) {
    it(`orders click, type, press despite getInfo latency (${mode})`, async () => {
      const log: string[] = [];
      const workspace = new Workspace({
        sandbox: sandbox(recordingComputer(log), [300, 150, 0]),
        tools: computerToolsConfig(false),
      });
      await run(agentWith(workspace, CLICK_TYPE_PRESS), mode);
      expect(log).toEqual(['leftClick', '/leftClick', 'type', '/type', 'press', '/press']);
    });
  }

  it('orders calls delayed by the run lease check', async () => {
    const log: string[] = [];
    const workspace = new Workspace({ sandbox: sandbox(recordingComputer(log)), tools: computerToolsConfig(false) });
    const delays = [300, 150, 0];
    let n = 0;
    const fence = async () => {
      await delay(delays[n++] ?? 0);
    };
    setRunLeaseFence('order-lease-run', fence);
    fenced.push(['order-lease-run', fence]);
    await run(agentWith(workspace, CLICK_TYPE_PRESS), 'stream', { runId: 'order-lease-run' });
    expect(actions(log)).toEqual(['leftClick', 'type', 'press']);
  });

  it('runs computer-wait and the post-action screenshot before the next action', async () => {
    expect(DEFAULT_SCREENSHOT_AFTER_ACTION).toBe(true);
    expect(DEFAULT_SCREENSHOT_DELAY_MS).toBe(500);
    const log: string[] = [];
    const config = computerToolsConfig(true, 20);
    const workspace = new Workspace({ sandbox: sandbox(recordingComputer(log), [200, 0, 0]), tools: config });
    await run(
      agentWith(workspace, [
        { id: 'c1', tool: C.CLICK, args: { x: 1, y: 1 } },
        { id: 'c2', tool: C.WAIT, args: { seconds: 0.2 } },
        { id: 'c3', tool: C.TYPE, args: { text: 'x' } },
      ]),
      'stream',
    );
    // click + its screenshot, wait + its screenshot, then type + its screenshot.
    expect(actions(log)).toEqual(['leftClick', 'screenshot', 'screenshot', 'type', 'screenshot']);
    expect(log.indexOf('type')).toBeGreaterThan(log.lastIndexOf('/screenshot', log.indexOf('type')));
  });

  it('keeps non-computer tools concurrent with the ordered computer calls', async () => {
    const log: string[] = [];
    const slow = createTool({
      id: 'slow-lookup',
      description: 'slow',
      inputSchema: z.object({ q: z.string() }),
      execute: async () => {
        log.push('slow');
        await delay(300);
        log.push('/slow');
        return 'ok';
      },
    });
    const workspace = new Workspace({
      sandbox: sandbox(recordingComputer(log, { leftClick: 50, type: 50 })),
      tools: computerToolsConfig(false),
    });
    await run(
      agentWith(
        workspace,
        [
          { id: 'c1', tool: C.CLICK, args: { x: 1, y: 1 } },
          { id: 's1', tool: 'slow-lookup', args: { q: 'a' } },
          { id: 'c2', tool: C.TYPE, args: { text: 'x' } },
        ],
        { 'slow-lookup': slow },
      ),
      'stream',
    );
    // The plain tool overlaps the computer calls; the second computer call neither waits for it nor overlaps the first.
    expect(log.filter(e => e !== 'slow' && e !== '/slow')).toEqual(['leftClick', '/leftClick', 'type', '/type']);
    expect(log.indexOf('slow')).toBeLessThan(log.indexOf('/leftClick'));
    expect(log.indexOf('/type')).toBeLessThan(log.indexOf('/slow'));
  });

  it('a failing or invalid computer call releases its successors', async () => {
    const log: string[] = [];
    const computer = recordingComputer(log);
    computer.leftClick = async () => {
      log.push('leftClick');
      throw new Error('boom');
    };
    const workspace = new Workspace({ sandbox: sandbox(computer), tools: computerToolsConfig(false) });
    const result = await run(
      agentWith(workspace, [
        { id: 'c1', tool: C.CLICK, args: { x: 1, y: 1 } },
        { id: 'c2', tool: C.TYPE, args: { nope: true } },
        { id: 'c3', tool: C.PRESS_KEY, args: { key: 'Enter' } },
      ]),
      'generate',
    );
    expect(actions(log)).toEqual(['leftClick', 'press']);
    expect((result as any).text).toBe('done');
  }, 5000);

  it('an abort while calls are queued settles every call without running them', async () => {
    const log: string[] = [];
    const controller = new AbortController();
    const workspace = new Workspace({
      sandbox: sandbox(recordingComputer(log, { leftClick: 300 })),
      tools: computerToolsConfig(false),
    });
    setTimeout(() => controller.abort(), 100);
    const startedAt = Date.now();
    const stream = await agentWith(workspace, CLICK_TYPE_PRESS).stream('go', {
      maxSteps: 2,
      abortSignal: controller.signal,
    });
    const errors: string[] = [];
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-error') errors.push((chunk.payload as any).toolCallId);
    }
    // The run settles once the in-flight click returns; queued calls never wait out a gate.
    expect(Date.now() - startedAt).toBeLessThan(1500);
    await delay(300);
    expect(actions(log)).toEqual(['leftClick']);
    expect(errors).toEqual([]);
  }, 5000);

  it('an unknown tool before the computer calls neither blocks nor reorders them', async () => {
    const log: string[] = [];
    const workspace = new Workspace({
      sandbox: sandbox(recordingComputer(log), [0, 300, 150, 0]),
      tools: computerToolsConfig(false),
    });
    const result = await run(
      agentWith(workspace, [{ id: 'u1', tool: 'no_such_tool', args: {} }, ...CLICK_TYPE_PRESS]),
      'generate',
    );
    expect(actions(log)).toEqual(['leftClick', 'type', 'press']);
    expect((result as any).text).toBe('done');
  }, 5000);

  it('orders renamed computer tools', async () => {
    const log: string[] = [];
    const config = computerToolsConfig(false);
    config[C.CLICK] = { ...(config[C.CLICK] as object), name: 'click' };
    config[C.TYPE] = { ...(config[C.TYPE] as object), name: 'type_text' };
    const workspace = new Workspace({ sandbox: sandbox(recordingComputer(log), [300, 150, 0]), tools: config });
    await run(
      agentWith(workspace, [
        { id: 'c1', tool: 'click', args: { x: 1, y: 1 } },
        { id: 'c2', tool: 'type_text', args: { text: 'x' } },
        { id: 'c3', tool: C.PRESS_KEY, args: { key: 'Enter' } },
      ]),
      'stream',
    );
    expect(actions(log)).toEqual(['leftClick', 'type', 'press']);
  });
});

describe('computer tools carry the ordered marker', () => {
  it('marks every computer tool, including renamed ones, and nothing else', async () => {
    const workspace = new Workspace({
      sandbox: sandbox(recordingComputer([])),
      tools: { [C.CLICK]: { name: 'click' } },
    });
    const tools = await createWorkspaceTools(workspace);
    const computerNames = new Set<string>([...Object.values(C).filter(n => n !== C.CLICK), 'click']);
    for (const [name, tool] of Object.entries(tools)) {
      expect((tool as any).orderedToolGroup, name).toBe(computerNames.has(name) ? 'workspace-computer' : undefined);
    }
    expect(Object.keys(tools).filter(n => computerNames.has(n))).toHaveLength(11);
  });

  it('keeps the marker through the agent tool conversion', async () => {
    const workspace = new Workspace({ sandbox: sandbox(recordingComputer([])) });
    const agent = agentWith(workspace, []);
    let converted: Record<string, any> | undefined;
    await agent
      .stream('go', {
        maxSteps: 1,
        prepareStep: ({ tools }: any) => {
          converted = tools;
          return undefined;
        },
      } as any)
      .then(s => s.consumeStream());
    expect(converted?.[C.CLICK]?.orderedToolGroup).toBe('workspace-computer');
  });
});
