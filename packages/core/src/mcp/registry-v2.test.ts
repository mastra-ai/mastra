import { tool } from '@internal/ai-sdk-v5';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Agent } from '../agent';
import type { ToolsInput } from '../agent';
import { Mastra } from '../mastra';
import { RequestContext } from '../request-context';
import { standardSchemaToJSONSchema } from '../schema';
import { createTool } from '../tools';
import type { InternalCoreTool, MCPToolExecutionContext } from '../tools';
import { makeCoreTool } from '../utils';
import { Workflow } from '../workflows';
import { MCPServerBase } from './index';
import type { MCPToolExecutionResultV2 } from './index';

class NativeServer extends MCPServerBase {
  override readonly mcpVersion = 2 as const;
  /** The protocol request the next `executeTool` runs in; a real server derives it from the wire. */
  currentRequest?: MCPToolExecutionContext;
  // Converts tools the way the 1.x package does, so `context.mcp` flows through CoreToolBuilder.
  convertTools(tools: ToolsInput) {
    const converted: Record<string, InternalCoreTool> = {};
    for (const [name, tool] of Object.entries(tools)) {
      converted[name] = makeCoreTool(tool, {
        name,
        requestContext: new RequestContext(),
        mastra: this.mastra,
        logger: this.logger,
      }) as InternalCoreTool;
    }
    return converted;
  }
  async executeTool(
    toolId: string,
    args: unknown,
    executionContext: Parameters<MCPServerBase['executeTool']>[2] = {},
  ): Promise<MCPToolExecutionResultV2> {
    const tool = this.convertedTools[toolId];
    if (!tool?.execute) throw new Error(`Tool ${toolId} not found`);
    let suspension: { payload: unknown } | undefined;
    const mcp = this.currentRequest ?? request();
    const output = await tool.execute(args, {
      // Same idiom as the 1.x package: an empty toolCallId keeps CoreToolBuilder on the MCP path.
      toolCallId: '',
      messages: [],
      requestContext: executionContext.requestContext,
      abortSignal: mcp.extra.signal,
      mcp,
      suspend: async (payload: unknown) => void (suspension = { payload }),
      resumeData: executionContext.resumeData,
      suspendPayload: executionContext.suspendPayload,
    });
    if (suspension) {
      const original = this.originalTools[toolId];
      const resumeSchema = original && 'resumeSchema' in original ? original.resumeSchema : undefined;
      return {
        status: 'suspended',
        suspendPayload: suspension.payload,
        resumeSchema: resumeSchema ? standardSchemaToJSONSchema(resumeSchema, { io: 'input' }) : undefined,
      };
    }
    return { status: 'completed', output };
  }
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

const unavailable = (feature: string) => async (): Promise<never> => {
  throw new Error(`${feature} is not available on a 2026-07-28 server`);
};

/** The `context.mcp` a 2026-07-28 server builds: same shape as 1.x, server-initiated requests throw. */
function request(overrides: Partial<MCPToolExecutionContext> = {}): MCPToolExecutionContext {
  const signal = new AbortController().signal;
  return {
    protocolVersion: '2026-07-28',
    extra: {
      signal,
      requestId: 'round',
      sendNotification: unavailable('extra.sendNotification'),
      sendRequest: unavailable('extra.sendRequest'),
      mcpReq: {
        id: 'round',
        method: 'tools/call',
        requestState: () => undefined,
        signal,
        send: unavailable('mcpReq.send'),
        notify: unavailable('mcpReq.notify'),
        log: unavailable('mcpReq.log'),
        elicitInput: unavailable('mcpReq.elicitInput'),
        requestSampling: unavailable('mcpReq.requestSampling'),
      },
    },
    elicitation: { sendRequest: unavailable('elicitation.sendRequest') },
    log: async () => {},
    progress: async () => {},
    ...overrides,
  };
}

function suspendingTool() {
  return createTool({
    id: 'confirm',
    description: 'Asks before acting',
    inputSchema: z.object({ amount: z.number() }),
    outputSchema: z.object({ charged: z.number() }),
    suspendSchema: z.object({ phase: z.literal('confirm'), amount: z.number() }),
    resumeSchema: z.object({ confirmed: z.boolean() }),
    execute: async ({ amount }, context) => {
      if (!context.resumeData) {
        await context.suspend?.({ phase: 'confirm', amount });
        return;
      }
      if (!context.resumeData.confirmed) throw new Error('declined');
      return { charged: context.suspendPayload?.amount ?? amount };
    },
  });
}

describe('MCP v1/v2 registry boundaries', () => {
  it('registers both families without changing legacy instances or tool identity', () => {
    const confirm = suspendingTool();
    const ordinary = createTool({ id: 'ordinary', description: 'Ordinary tool', execute: async () => 1 });
    const modern = new NativeServer({
      name: 'Modern',
      version: '2.0.0',
      tools: { confirm, ordinary },
      releaseDate: '2026-07-28',
    });
    const legacy = new LegacyServer({ name: 'Legacy', version: '1.0.0', tools: {} });
    const mastra = new Mastra({ mcpServers: { modern, legacy } });
    expect(mastra.getMCPServer('modern')).toBe(modern);
    expect(mastra.getMCPServer('legacy')).toBe(legacy);
    expect(mastra.listMCPServers()).toEqual({ modern, legacy });
    expect(Object.keys(modern.tools())).toEqual(['confirm', 'ordinary']);
    expect(mastra.getToolById('ordinary')).toBe(ordinary);
    // A tool that can suspend is an ordinary Mastra tool too: agents and workflows resume it.
    expect(mastra.getToolById('confirm')).toBe(confirm);
    expect(modern.getServerInfo().version_detail.release_date).toBe('2026-07-28');
    expect(modern.mcpVersion).toBe(2);
    expect(legacy.mcpVersion).toBeUndefined();
    expect('startSSE' in modern).toBe(false);
    expect('startHonoSSE' in modern).toBe(false);
  });

  it('keeps the 1.x registry contract: slugified id, agent/workflow registration, Mastra tools only', () => {
    const agent = new Agent({
      id: 'helper',
      name: 'helper',
      instructions: 'help',
      model: new MockLanguageModelV2({}),
    });
    const workflow = new Workflow({
      id: 'flow',
      inputSchema: z.object({ q: z.string() }),
      outputSchema: z.object({ q: z.string() }),
      steps: [],
    });
    const mastraTool = createTool({ id: 'ordinary', description: 'Ordinary tool', execute: async () => 1 });
    const vercelTool = tool({
      description: 'AI SDK shape',
      inputSchema: z.object({ q: z.string() }),
      execute: async () => 'ok',
    });
    const server = new NativeServer({
      id: 'Returns Desk v2',
      name: 'Returns',
      version: '2.0.0',
      tools: { mastraTool, vercelTool },
      agents: { helper: agent },
      workflows: { flow: workflow },
    });
    expect(server.id).toBe('returns-desk-v2');
    server.setId('ignored');
    expect(server.id).toBe('returns-desk-v2');

    const mastra = new Mastra({ mcpServers: { server } });
    expect(server.mastra).toBe(mastra);
    expect(mastra.getAgentById('helper')).toBe(agent);
    expect(mastra.getWorkflowById('flow')).toBe(workflow);
    expect(mastra.getToolById('ordinary')).toBe(mastraTool);
    expect(mastra.listTools()).not.toHaveProperty('vercelTool');
    expect(Object.keys(server.tools())).toEqual(['mastraTool', 'vercelTool']);
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

  it('passes auth, cancellation and the same context.mcp shape as 1.x to tools', async () => {
    const requestContext = new RequestContext();
    requestContext.set('tenant', 'north');
    const round = request();
    const execute = vi.fn(async (_input, received) => {
      expect(received.requestContext.get('tenant')).toBe('north');
      expect(received.abortSignal).toBe(round.extra.signal);
      expect(received.mcp).toBe(round);
      expect(received.mcp?.protocolVersion).toBe('2026-07-28');
      expect(received.mcp?.log).toBeTypeOf('function');
      expect(received.mcp?.progress).toBeTypeOf('function');
      // Server-initiated requests no longer exist: the 1.x members stay on the type but throw here.
      await expect(
        received.mcp!.elicitation.sendRequest({ message: 'x', requestedSchema: { type: 'object', properties: {} } }),
      ).rejects.toThrow('elicitation.sendRequest is not available on a 2026-07-28 server');
      await expect(received.mcp!.extra.sendRequest({ method: 'ping' })).rejects.toThrow('not available');
      // Suspend/resume is the top-level primitive, not something nested under mcp.
      expect(received.suspend).toBeTypeOf('function');
      expect(received.mcp).not.toHaveProperty('suspend');
      return 1;
    });
    const ordinary = createTool({ id: 'ordinary', description: 'Ordinary', execute });
    const server = new NativeServer({ name: 'Modern', version: '2', tools: { ordinary } });
    server.currentRequest = round;
    expect(await server.executeTool('ordinary', {}, { requestContext })).toEqual({
      status: 'completed',
      output: 1,
    });
    expect(execute).toHaveBeenCalledOnce();
  });

  it('reports a suspension with the payload and resume schema, then resumes with both', async () => {
    const confirm = suspendingTool();
    const server = new NativeServer({ name: 'Modern', version: '2', tools: { confirm } });

    const first = await server.executeTool('confirm', { amount: 990 });
    expect(first).toMatchObject({
      status: 'suspended',
      suspendPayload: { phase: 'confirm', amount: 990 },
      resumeSchema: { type: 'object', properties: { confirmed: { type: 'boolean' } } },
    });

    const resumed = await server.executeTool(
      'confirm',
      { amount: 990 },
      {
        resumeData: { confirmed: true },
        suspendPayload: { phase: 'confirm', amount: 990 },
      },
    );
    expect(resumed).toEqual({ status: 'completed', output: { charged: 990 } });

    await expect(server.executeTool('confirm', { amount: 990 }, { resumeData: { confirmed: false } })).rejects.toThrow(
      'declined',
    );
  });

  it('runs tools without a protocol request (REST route) and still surfaces suspension', async () => {
    const confirm = suspendingTool();
    const server = new NativeServer({ name: 'Modern', version: '2', tools: { confirm } });
    const result = await server.executeTool('confirm', { amount: 1 });
    expect(result.status).toBe('suspended');
  });

  it('validates the resume data and suspend payload against the declared schemas', async () => {
    const confirm = suspendingTool();
    const server = new NativeServer({ name: 'Modern', version: '2', tools: { confirm } });
    const invalidResume = await server.executeTool('confirm', { amount: 1 }, { resumeData: { confirmed: 'yes' } });
    expect(invalidResume.status).toBe('completed');
    expect((invalidResume as { output: { error: boolean } }).output).toMatchObject({ error: true });
  });
});
