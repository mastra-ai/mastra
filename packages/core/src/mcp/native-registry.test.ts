import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../agent';
import { Mastra } from '../mastra';
import { RequestContext } from '../request-context';
import { createTool } from '../tools';
import { CoreToolBuilder } from '../tools/tool-builder/builder';
import { createStep } from '../workflows';
import { createStep as createEventedStep } from '../workflows/evented/workflow';
import { MCPServerBase, MCPServerBaseV2, createMCPTool, isMCPServerV2 } from './index';
import type { MCPToolExecutionContextV2 } from './index';

class NativeServer extends MCPServerBaseV2 {
  async startStdio() {}
  async startHTTP() {}
  async close() {}
  getServerInfo() {
    return {
      id: this.id,
      name: this.name,
      version_detail: { version: this.version, release_date: this.releaseDate, is_latest: this.isLatest },
    };
  }
  getServerDetail() {
    return this.getServerInfo();
  }
  getToolListInfo() {
    return { tools: Object.keys(this.tools()).map(name => ({ name, inputSchema: {} })) };
  }
  getToolInfo(name: string) {
    return this.getToolListInfo().tools.find(tool => tool.name === name);
  }
  async readResource() {
    return { contents: [] };
  }
  async listResources() {
    return { resources: [] };
  }
}

class LegacyServer extends MCPServerBase {
  convertTools() {
    return {};
  }
  async startStdio() {}
  async startHTTP() {}
  async startSSE() {}
  async startHonoSSE() {
    return undefined;
  }
  async close() {}
  getServerInfo() {
    return {
      id: this.id,
      name: this.name,
      version_detail: { version: this.version, release_date: this.releaseDate, is_latest: this.isLatest },
    };
  }
  getServerDetail() {
    return this.getServerInfo();
  }
  getToolListInfo() {
    return { tools: [] };
  }
  getToolInfo() {
    return undefined;
  }
  async executeTool() {
    return {};
  }
  async readResource() {
    return { contents: [] };
  }
  async listResources() {
    return { resources: [] };
  }
}

function context(): MCPToolExecutionContextV2 {
  return {
    requestContext: new RequestContext(),
    request: {
      protocolVersion: '2026-07-28',
      requestId: 'round',
      signal: new AbortController().signal,
      log: async () => {},
      progress: async () => {},
    },
  };
}

function nativeTool() {
  return createMCPTool({
    id: 'native',
    description: 'Protocol tool',
    inputSchema: z.object({}),
    outputSchema: z.number(),
    execute: () => ({ kind: 'input_required', result: { resultType: 'input_required', requestState: 'next' } }),
  });
}

describe('MCP v1/v2 registry boundaries', () => {
  it('registers both families without changing legacy instances or tool identity', () => {
    const native = nativeTool();
    const ordinary = createTool({ id: 'business', description: 'Ordinary tool', execute: async () => 1 });
    const modern = new NativeServer({
      name: 'Modern',
      version: '2.0.0',
      tools: { native, ordinary },
      releaseDate: '2026-07-28',
    });
    const legacy = new LegacyServer({ name: 'Legacy', version: '1.0.0', tools: {} });
    const mastra = new Mastra({ mcpServers: { modern, legacy } });
    expect(mastra.getMCPServer('modern')).toBe(modern);
    expect(mastra.getMCPServer('legacy')).toBe(legacy);
    expect(mastra.listMCPServers()).toEqual({ modern, legacy });
    expect(modern.tools().native).toBe(native);
    expect(modern.tools().ordinary).toBe(ordinary);
    expect(mastra.getToolById('business')).toBe(ordinary);
    expect(mastra.listTools()).not.toHaveProperty('native');
    expect(modern.getServerInfo().version_detail.release_date).toBe('2026-07-28');
    expect(isMCPServerV2(modern)).toBe(true);
    expect(isMCPServerV2(legacy)).toBe(false);
    expect('mcpVersion' in legacy).toBe(false);
    expect('startSSE' in modern).toBe(false);
    expect('startHonoSSE' in modern).toBe(false);
  });

  it('preserves duplicate-key behavior without registering the ignored server tools', () => {
    const first = new NativeServer({ name: 'First', version: '2.0.0', tools: {} });
    const ignored = new NativeServer({
      name: 'Ignored',
      version: '2.0.0',
      tools: { extra: createTool({ id: 'extra', description: 'Extra' }) },
    });
    const mastra = new Mastra({ mcpServers: { same: first } });
    mastra.addMCPServer(ignored, 'same');
    expect(mastra.getMCPServer('same')).toBe(first);
    expect(mastra.listTools()).not.toHaveProperty('extra');
  });

  it('resolves duplicate intrinsic IDs across families by version and release date', () => {
    const legacy = new LegacyServer({
      id: 'shared',
      name: 'Legacy',
      version: '1.0.0',
      releaseDate: '2025-11-25',
      tools: {},
    });
    const modern = new NativeServer({
      id: 'shared',
      name: 'Modern',
      version: '2.0.0',
      releaseDate: '2026-07-28',
      tools: {},
    });
    const mastra = new Mastra({ mcpServers: { old: legacy, current: modern } });
    expect(legacy.id).toBe('shared');
    expect(modern.id).toBe('shared');
    expect(mastra.getMCPServerById('shared', '1.0.0')).toBe(legacy);
    expect(mastra.getMCPServerById('shared', '2.0.0')).toBe(modern);
    expect(mastra.getMCPServerById('shared')).toBe(modern);
    expect(mastra.getMCPServerById('shared', 'missing')).toBeUndefined();
  });

  it('passes normal auth, cancellation and observability to ordinary tools without legacy MCP context', async () => {
    const ctx = context();
    ctx.requestContext.set('tenant', 'north');
    const execute = vi.fn(async (_input, received) => {
      expect(received).not.toHaveProperty('mcp');
      expect(received.requestContext).toBe(ctx.requestContext);
      expect(received.abortSignal).toBe(ctx.request.signal);
      expect(received.observe.span).toBeTypeOf('function');
      return 1;
    });
    const ordinary = createTool({ id: 'business', description: 'Ordinary', execute });
    const server = new NativeServer({ name: 'Modern', version: '2', tools: { ordinary, native: nativeTool() } });
    expect(await server.invokeTool('ordinary', {}, ctx)).toEqual({ kind: 'completed', value: 1 });
    expect(await server.invokeTool('native', {}, ctx)).toEqual({
      kind: 'input_required',
      result: { resultType: 'input_required', requestState: 'next' },
    });
    await expect(server.executeTool('native', {})).rejects.toThrow('require a protocol request context');
    expect(execute).toHaveBeenCalledOnce();
  });

  it('rejects native tools at public business-tool ingestion boundaries', async () => {
    const native = nativeTool();
    // @ts-expect-error deliberate invalid JavaScript caller
    expect(() => new Mastra({ tools: { native } })).toThrow('Native MCP tools');
    // @ts-expect-error deliberate invalid JavaScript caller
    expect(() => new Mastra().addTool(native)).toThrow('Native MCP tools');
    // @ts-expect-error deliberate invalid JavaScript caller
    expect(() => new Agent({ id: 'a', name: 'A', model: 'openai/gpt-5', instructions: '', tools: { native } })).toThrow(
      'Native MCP tools',
    );
    // @ts-expect-error deliberate invalid JavaScript caller
    const agent = new Agent({ id: 'a', name: 'A', model: 'openai/gpt-5', instructions: '', tools: () => ({ native }) });
    await expect(agent.listTools()).rejects.toThrow('Native MCP tools');
    // @ts-expect-error deliberate invalid JavaScript caller
    expect(() => createStep(native)).toThrow('Native MCP tools');
    // @ts-expect-error deliberate invalid JavaScript caller
    expect(() => createEventedStep(native)).toThrow('Native MCP tools');
    // @ts-expect-error deliberate invalid JavaScript caller
    expect(() => new LegacyServer({ name: 'Legacy', version: '1', tools: { native } })).toThrow(
      'require an MCP v2 server',
    );
    expect(
      () =>
        new CoreToolBuilder({
          originalTool: native,
          options: { name: 'native', requestContext: new RequestContext() },
        }),
    ).toThrow('Native MCP tools');
  });
});
