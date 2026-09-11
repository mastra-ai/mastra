import { inputRequired } from '@modelcontextprotocol/server';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { RequestContext } from '../request-context';
import { createTool } from '../tools';
import { noopObserve } from '../tools/types';
import { createMCPTool, isMCPToolV2, parseMCPInputRequiredV2 } from './native-tool';
import type { MCPToolExecutionContextV2 } from './native-tool';

function context(): MCPToolExecutionContextV2 {
  return {
    requestContext: new RequestContext(),
    request: {
      protocolVersion: '2026-07-28',
      requestId: 'request-1',
      signal: new AbortController().signal,
      log: vi.fn(async () => {}),
      progress: vi.fn(async () => {}),
    },
  };
}

const form = inputRequired({
  inputRequests: {
    confirmation: {
      method: 'elicitation/create',
      params: {
        message: 'Confirm?',
        requestedSchema: { type: 'object', properties: { confirmed: { type: 'boolean' } } },
      },
    },
  },
  requestState: 'opaque',
});

describe('native MCP tool execution', () => {
  it('infers and validates completed output without changing the input or context', async () => {
    const ctx = context();
    const tool = createMCPTool({
      id: 'length',
      description: 'Measure input',
      inputSchema: z.object({ text: z.string() }),
      outputSchema: z.number(),
      execute: (input, received) => {
        expect(received).toBe(ctx);
        return { kind: 'completed', value: input.text.length };
      },
    });
    expect(await tool.invoke({ text: 'abc' }, ctx)).toEqual({ kind: 'completed', value: 3 });
    expect(isMCPToolV2(tool)).toBe(true);
    expect('execute' in tool).toBe(false);
    expect(isMCPToolV2({ id: tool.id })).toBe(false);
  });

  it('validates control but never applies business output schema to control', async () => {
    const validateOutput = vi.fn(() => true);
    const tool = createMCPTool({
      id: 'confirm',
      description: 'Ask for confirmation',
      inputSchema: z.object({}),
      outputSchema: z.number().refine(validateOutput),
      execute: () => ({ kind: 'input_required', result: form }),
    });
    expect(await tool.invoke({}, context())).toEqual({ kind: 'input_required', result: form });
    expect(validateOutput).not.toHaveBeenCalled();
  });

  it('validates input and trusted request context before running the handler', async () => {
    const execute = vi.fn(() => ({ kind: 'completed' as const, value: 1 }));
    const tool = createMCPTool({
      id: 'guard',
      description: 'Validate',
      inputSchema: z.object({ amount: z.number().positive() }),
      outputSchema: z.number(),
      requestContextSchema: z.object({ tenant: z.string() }),
      execute,
    });
    await expect(tool.invoke({ amount: -1 }, context())).rejects.toThrow('input validation');
    await expect(tool.invoke({ amount: 1 }, context())).rejects.toThrow('context');
    expect(execute).not.toHaveBeenCalled();
    const ctx = context();
    ctx.requestContext.set('tenant', 'north');
    expect(await tool.invoke({ amount: 1 }, ctx)).toEqual({ kind: 'completed', value: 1 });
  });

  it('rejects malformed runtime contexts and pre-aborted requests', async () => {
    const execute = vi.fn(() => ({ kind: 'completed' as const, value: 1 }));
    const tool = createMCPTool({
      id: 'guard',
      description: 'Validate',
      inputSchema: z.object({}),
      outputSchema: z.number(),
      execute,
    });
    // @ts-expect-error runtime boundary must reject missing native context
    await expect(tool.invoke({}, {})).rejects.toThrow();
    const ctx = context();
    await expect(
      tool.invoke({}, { ...ctx, request: { ...ctx.request, signal: AbortSignal.abort() } }),
    ).rejects.toThrow();
    // @ts-expect-error legacy context must also be rejected for JavaScript callers
    await expect(tool.invoke({}, { ...ctx, mcp: {} })).rejects.toThrow('Legacy MCP context');
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects malformed control before it can be serialized', async () => {
    const tool = createMCPTool({
      id: 'invalid',
      description: 'Invalid control',
      inputSchema: z.object({}),
      outputSchema: z.number(),
      // @ts-expect-error deliberately malformed embedded form request
      execute: () => ({
        kind: 'input_required',
        result: {
          resultType: 'input_required',
          inputRequests: { bad: { method: 'elicitation/create', params: { message: 'Invalid form' } } },
        },
      }),
    });
    await expect(tool.invoke({}, context())).rejects.toThrow('Invalid embedded input request');
  });

  it('accepts SDK-built URL requests without the removed elicitationId field', async () => {
    const result = inputRequired({
      inputRequests: {
        approval: inputRequired.elicitUrl({ message: 'Continue', url: 'https://example.com/continue' }),
      },
    });
    const tool = createMCPTool({
      id: 'url',
      description: 'URL interaction',
      inputSchema: z.object({}),
      outputSchema: z.number(),
      execute: () => ({ kind: 'input_required', result }),
    });
    expect(await tool.invoke({}, context())).toEqual({ kind: 'input_required', result });
  });

  it('rejects unsupported input variants and empty controls', async () => {
    const roots = createMCPTool({
      id: 'roots',
      description: 'Unsupported input',
      inputSchema: z.object({}),
      outputSchema: z.number(),
      execute: () => ({
        kind: 'input_required',
        result: inputRequired({ inputRequests: { roots: inputRequired.listRoots() } }),
      }),
    });
    await expect(roots.invoke({}, context())).rejects.toThrow('Unsupported embedded input request');
    const empty = createMCPTool({
      id: 'empty',
      description: 'Empty control',
      inputSchema: z.object({}),
      outputSchema: z.number(),
      execute: () => ({ kind: 'input_required', result: { resultType: 'input_required' } }),
    });
    await expect(empty.invoke({}, context())).rejects.toThrow('must contain input requests or request state');
  });

  it('validates standalone input-required controls with the same rules as tool outcomes', () => {
    const valid = inputRequired({
      inputRequests: { approval: inputRequired.elicitUrl({ message: 'Continue', url: 'https://example.com/go' }) },
    });
    expect(parseMCPInputRequiredV2(valid)).toBe(valid);
    expect(() => parseMCPInputRequiredV2({ resultType: 'input_required' })).toThrow(
      'must contain input requests or request state',
    );
    expect(() =>
      parseMCPInputRequiredV2(inputRequired({ inputRequests: { roots: inputRequired.listRoots() } })),
    ).toThrow('Unsupported embedded input request');
  });

  it('rejects invalid completed output and does not treat resultType business data as control', async () => {
    const tool = createMCPTool({
      id: 'invalid',
      description: 'Invalid output',
      inputSchema: z.object({}),
      outputSchema: z.number(),
      // @ts-expect-error deliberately invalid completed business result
      execute: () => ({ kind: 'completed', value: { resultType: 'input_required' } }),
    });
    await expect(tool.invoke({}, context())).rejects.toThrow('output validation');
    const ordinary = createTool({
      id: 'ordinary',
      description: 'Business data',
      inputSchema: z.object({}),
      outputSchema: z.object({ resultType: z.literal('complete') }),
      // @ts-expect-error deliberately invalid ordinary business output
      execute: async () => ({ resultType: 'input_required' }),
    });
    await expect(ordinary.execute?.({}, { observe: noopObserve })).resolves.toMatchObject({ error: true });
  });

  it('does not accumulate input responses or replay earlier handler stages', async () => {
    const seen: unknown[] = [];
    const tool = createMCPTool({
      id: 'rounds',
      description: 'Explicit phases',
      inputSchema: z.object({}),
      outputSchema: z.number(),
      execute: (_, ctx) => {
        seen.push(ctx.request.inputResponses);
        return ctx.request.requestState === 'finish'
          ? { kind: 'completed', value: 1 }
          : { kind: 'input_required', result: form };
      },
    });
    const ctx = context();
    await tool.invoke({}, ctx);
    await tool.invoke(
      {},
      {
        ...ctx,
        request: {
          ...ctx.request,
          requestState: 'finish',
          inputResponses: { confirmation: { action: 'accept', content: { confirmed: true } } },
        },
      },
    );
    expect(seen).toEqual([undefined, { confirmation: { action: 'accept', content: { confirmed: true } } }]);
  });
});
