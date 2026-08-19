import { RequestContext } from '@mastra/core/request-context';
import type { ToolExecutionContext } from '@mastra/core/tools';
import { Type } from 'typebox';
import { describe, expect, it, vi } from 'vitest';

import { MastraPiExtensionGeneration } from '../runtime.js';
import { adaptPiTools, PiToolExecutionError } from '../tool-adapter.js';

type ExecutableTool = {
  execute(input: unknown, context: ToolExecutionContext): Promise<unknown>;
};

function getTool(tools: ReturnType<typeof adaptPiTools>['tools'], name: string): ExecutableTool {
  const tool = tools[name];
  if (!tool || typeof tool.execute !== 'function') throw new Error(`Missing executable tool ${name}`);
  return tool as ExecutableTool;
}

function createContext(overrides: Partial<ToolExecutionContext> = {}): ToolExecutionContext {
  return {
    requestContext: new RequestContext(),
    observe: vi.fn(),
    agent: { toolCallId: 'call-1' },
    ...overrides,
  } as ToolExecutionContext;
}

function createGeneration(
  execute: (...args: unknown[]) => unknown,
  overrides: Record<string, unknown> = {},
): MastraPiExtensionGeneration {
  const generation = new MastraPiExtensionGeneration('tool-plugin', 'tool-extension', '/tmp/tool.ts');
  generation.createApi().registerTool({
    name: 'fixture_tool',
    label: 'Fixture tool',
    description: 'Runs a fixture',
    parameters: Type.Object({ value: Type.String() }, { additionalProperties: false }),
    execute,
    ...overrides,
  });
  generation.bind();
  return generation;
}

describe('Pi tool adapter', () => {
  it('passes validated args, tool call id, abort signal, progress, and a bounded context', async () => {
    const updates: unknown[] = [];
    const outputWriter = vi.fn(async chunk => updates.push(chunk));
    const abortController = new AbortController();
    const execute = vi.fn(async (_id, params, _signal, onUpdate, context) => {
      onUpdate({ content: [{ type: 'text', text: 'halfway' }], details: { percent: 50 } });
      return {
        content: [
          { type: 'text', text: `done:${params.value}` },
          { type: 'image', data: 'aGVsbG8=', mimeType: 'image/png' },
        ],
        details: { cwd: context.cwd, hasUI: context.hasUI },
        usage: { input: 1, output: 2 },
      };
    });
    const generation = createGeneration(execute);
    const { tools } = adaptPiTools(generation, { cwd: '/workspace' });

    await expect(
      getTool(tools, 'fixture_tool').execute(
        { value: 'ok' },
        createContext({
          abortSignal: abortController.signal,
          agent: { toolCallId: 'tool-call', outputWriter } as unknown as ToolExecutionContext['agent'],
        }),
      ),
    ).resolves.toEqual({
      content: [
        { type: 'text', text: 'done:ok' },
        { type: 'image', data: 'aGVsbG8=', mimeType: 'image/png' },
      ],
      details: { cwd: '/workspace', hasUI: false },
      usage: { input: 1, output: 2 },
      isError: false,
    });
    expect(execute).toHaveBeenCalledWith('tool-call', { value: 'ok' }, abortController.signal, expect.any(Function), {
      cwd: '/workspace',
      mode: 'print',
      hasUI: false,
    });
    expect(updates).toEqual([
      {
        type: 'data-mastracode-tool-progress',
        data: { toolCallId: 'tool-call', progress: { status: 'running', detail: 'halfway' } },
        transient: true,
      },
    ]);
  });

  it('ignores progress updates after tool settlement', async () => {
    let update: ((value: unknown) => void) | undefined;
    const generation = createGeneration(async (_id, _params, _signal, onUpdate) => {
      update = onUpdate as (value: unknown) => void;
      return { content: [{ type: 'text', text: 'done' }] };
    });
    const { tools } = adaptPiTools(generation, { cwd: '/workspace' });
    const outputWriter = vi.fn();

    await getTool(tools, 'fixture_tool').execute(
      { value: 'valid' },
      createContext({ agent: { toolCallId: 'late', outputWriter } as unknown as ToolExecutionContext['agent'] }),
    );
    update?.({ content: [{ type: 'text', text: 'too late' }] });

    expect(outputWriter).not.toHaveBeenCalled();
  });

  it('propagates cancellation through the Mastra abort signal', async () => {
    const abortController = new AbortController();
    const generation = createGeneration(
      (_id, _params, signal) =>
        new Promise((_resolve, reject) => {
          const abortSignal = signal as AbortSignal;
          if (abortSignal.aborted) {
            reject(abortSignal.reason);
            return;
          }
          abortSignal.addEventListener('abort', () => reject(abortSignal.reason), { once: true });
        }),
    );
    const { tools } = adaptPiTools(generation, { cwd: '/workspace' });
    const promise = getTool(tools, 'fixture_tool').execute(
      { value: 'valid' },
      createContext({ abortSignal: abortController.signal }),
    );

    abortController.abort(new Error('cancelled by host'));
    await expect(promise).rejects.toThrow('cancelled by host');
  });

  it('revalidates replaced arguments before Pi execution', async () => {
    const execute = vi.fn(async () => ({ content: [{ type: 'text', text: 'done' }] }));
    const generation = createGeneration(execute);
    const { tools } = adaptPiTools(generation, {
      cwd: '/workspace',
      replaceArguments: () => ({ value: 42 }),
    });

    await expect(getTool(tools, 'fixture_tool').execute({ value: 'valid' }, createContext())).rejects.toThrow(
      'invalid replacement arguments',
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it('revalidates tool_call handler mutations and honors blocking results', async () => {
    const execute = vi.fn(async () => ({ content: [{ type: 'text', text: 'done' }] }));
    const invalidGeneration = createGeneration(execute);
    invalidGeneration.createApi().on('tool_call', event => {
      (event as { input: { value: unknown } }).input.value = 42;
    });
    const invalidTools = adaptPiTools(invalidGeneration, { cwd: '/workspace' }).tools;

    await expect(getTool(invalidTools, 'fixture_tool').execute({ value: 'valid' }, createContext())).rejects.toThrow(
      'invalid replacement arguments',
    );
    expect(execute).not.toHaveBeenCalled();

    const blockedGeneration = createGeneration(execute);
    blockedGeneration.createApi().on('tool_call', () => ({ block: true, reason: 'blocked by policy' }));
    const blockedTools = adaptPiTools(blockedGeneration, { cwd: '/workspace' }).tools;

    await expect(getTool(blockedTools, 'fixture_tool').execute({ value: 'valid' }, createContext())).rejects.toThrow(
      'blocked by policy',
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it('applies chained tool_result transformations before returning to Mastra', async () => {
    const generation = createGeneration(async () => ({
      content: [{ type: 'text', text: 'original' }],
      details: { original: true },
    }));
    generation.createApi().on('tool_result', () => ({
      content: [{ type: 'text', text: 'transformed' }],
      details: { transformed: true },
      usage: { input: 1, output: 2 },
    }));
    const { tools } = adaptPiTools(generation, { cwd: '/workspace' });

    await expect(getTool(tools, 'fixture_tool').execute({ value: 'valid' }, createContext())).resolves.toEqual({
      content: [{ type: 'text', text: 'transformed' }],
      details: { transformed: true },
      usage: { input: 1, output: 2 },
      isError: false,
    });
  });

  it('keeps Pi error results as tool execution failures', async () => {
    const generation = createGeneration(async () => ({
      content: [{ type: 'text', text: 'permission denied' }],
      details: { code: 'denied' },
      isError: true,
    }));
    const { tools } = adaptPiTools(generation, { cwd: '/workspace' });

    const promise = getTool(tools, 'fixture_tool').execute({ value: 'valid' }, createContext());
    await expect(promise).rejects.toThrow(PiToolExecutionError);
    await expect(promise).rejects.toMatchObject({
      result: { content: [{ type: 'text', text: 'permission denied' }], details: { code: 'denied' }, isError: true },
    });
  });

  it('preserves and diagnoses Pi-only dynamic-tool and termination result hints', async () => {
    const generation = createGeneration(async () => ({
      content: [{ type: 'text', text: 'done' }],
      addedToolNames: ['dynamic_tool'],
      terminate: true,
    }));
    const { tools } = adaptPiTools(generation, { cwd: '/workspace' });

    await expect(getTool(tools, 'fixture_tool').execute({ value: 'valid' }, createContext())).resolves.toMatchObject({
      addedToolNames: ['dynamic_tool'],
      terminate: true,
    });
    expect(generation.compatibility.status).toBe('pi-partial');
    expect(generation.compatibility.diagnostics.map(diagnostic => diagnostic.capability)).toEqual([
      'tool:addedToolNames',
      'tool:terminate',
    ]);
  });

  it('rejects malformed result content', async () => {
    const generation = createGeneration(async () => ({ content: [{ type: 'audio', data: 'bytes' }] }));
    const { tools } = adaptPiTools(generation, { cwd: '/workspace' });

    await expect(getTool(tools, 'fixture_tool').execute({ value: 'valid' }, createContext())).rejects.toThrow(
      'unsupported content block 0',
    );
  });

  it('rejects execution through stale generation-owned tools', async () => {
    const execute = vi.fn(async () => ({ content: [{ type: 'text', text: 'done' }] }));
    const generation = createGeneration(execute);
    const { tools } = adaptPiTools(generation, { cwd: '/workspace' });
    await generation.invalidate();

    await expect(getTool(tools, 'fixture_tool').execute({ value: 'valid' }, createContext())).rejects.toThrow(
      'context is stale',
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it('records limitations for unsupported execution preparation and scheduling', () => {
    const generation = createGeneration(async () => ({ content: [{ type: 'text', text: 'done' }] }), {
      prepareArguments: (value: unknown) => value,
      constrainedSampling: { mode: 'grammar' },
      executionMode: 'sequential',
    });

    adaptPiTools(generation, { cwd: '/workspace' });

    expect(generation.compatibility.diagnostics.map(diagnostic => diagnostic.message)).toEqual([
      expect.stringContaining('prepareArguments'),
      expect.stringContaining('constrainedSampling'),
      expect.stringContaining('sequential execution'),
    ]);
    expect(generation.compatibility.status).toBe('pi-partial');
  });
});
