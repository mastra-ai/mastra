import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createTool } from '../../tools';
import type { ProcessInputStepArgs } from '../index';
import { ToolSearchProcessor } from './tool-search';

/**
 * Coverage for #14127: tools resolved per request (MCP tools needing the
 * caller's auth token, or any dynamic `tools` function) arrive on
 * `args.tools` and could not previously be searched.
 */
function tool(id: string, description: string) {
  return createTool({ id, description, inputSchema: z.object({}), execute: async () => ({}) });
}

function stepArgs(tools: Record<string, unknown>): ProcessInputStepArgs {
  const systemMessages: string[] = [];
  return {
    tools,
    messageList: { addSystem: (m: string) => systemMessages.push(m) },
  } as unknown as ProcessInputStepArgs;
}

/** The step result's tools, untyped for terse meta-tool invocation in tests. */
function toolsOf(result: unknown): Record<string, any> {
  return (result as { tools: Record<string, any> }).tools;
}

async function search(result: unknown, query: string) {
  return toolsOf(result).search_tools.execute({ query }, {});
}

async function load(result: unknown, toolName: string) {
  return toolsOf(result).load_tool.execute({ toolName }, {});
}

describe('ToolSearchProcessor includeResolvedTools', () => {
  const resolved = { fetch_invoice: tool('fetch_invoice', 'Fetch an invoice from the billing system') };

  it('makes request-resolved tools searchable and withholds them from the prompt', async () => {
    const processor = new ToolSearchProcessor({ tools: {}, includeResolvedTools: true });

    const result = await processor.processInputStep(stepArgs(resolved));

    expect(Object.keys(toolsOf(result))).not.toContain('fetch_invoice');

    const { results } = await search(result, 'invoice');
    expect(results.map((r: any) => r.name)).toContain('fetch_invoice');
  });

  it('exposes a resolved tool once loaded', async () => {
    const processor = new ToolSearchProcessor({ tools: {}, includeResolvedTools: true, storage: 'in-memory' });

    const first = await processor.processInputStep(stepArgs(resolved));
    expect((await load(first, 'fetch_invoice')).success).toBe(true);

    const second = await processor.processInputStep(stepArgs(resolved));
    expect(Object.keys(toolsOf(second))).toContain('fetch_invoice');
  });

  it('leaves resolved tools alone by default', async () => {
    const processor = new ToolSearchProcessor({ tools: {} });

    const result = await processor.processInputStep(stepArgs(resolved));

    expect(Object.keys(toolsOf(result))).toContain('fetch_invoice');
    const { results } = await search(result, 'invoice');
    expect(results).toEqual([]);
  });

  it('rebuilds a loaded resolved tool on the resume path', async () => {
    const processor = new ToolSearchProcessor({ tools: {}, includeResolvedTools: true, storage: 'in-memory' });

    const first = await processor.processInputStep(stepArgs(resolved));
    expect((await load(first, 'fetch_invoice')).success).toBe(true);

    // The approval-resume path re-enters without stepArgs, so the tools for the
    // resumed request have to be handed in for the executor to be rebuilt.
    const rebuilt = await processor.getLoadedToolsForRequestContext({ tools: resolved });

    expect(rebuilt.fetch_invoice).toBe(resolved.fetch_invoice);
  });

  it('uses the tool instance from the current request, not a cached one', async () => {
    const processor = new ToolSearchProcessor({ tools: {}, includeResolvedTools: true });

    const forUserA = { whoami: tool('whoami', 'Report the caller identity') };
    const forUserB = { whoami: tool('whoami', 'Report the caller identity') };

    const a = await processor.processInputStep(stepArgs(forUserA));
    await load(a, 'whoami');
    const b = await processor.processInputStep(stepArgs(forUserB));

    expect(toolsOf(b).whoami).toBe(forUserB.whoami);
  });
});
