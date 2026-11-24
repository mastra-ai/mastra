import assert from 'node:assert/strict';
import { MCPServerBase } from '@mastra/core/mcp';
import type { MCPServerHTTPOptions, MCPToolExecutionResultV2 } from '@mastra/core/mcp';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { standardSchemaToJSONSchema } from '@mastra/core/schema';
import { createTool, isValidationError } from '@mastra/core/tools';
import type { ToolsInput } from '@mastra/core/agent';
import type { InternalCoreTool, MCPToolExecutionContext } from '@mastra/core/tools';
import { makeCoreTool } from '@mastra/core/utils';
import { z } from 'zod';

// Packed-declaration proof of the Segment 1 contract: an ordinary `createTool` that suspends is a
// v2 server tool, an agent tool and a Mastra-registered tool at once; there is no native family.
const confirmation = createTool({
  id: 'confirmation',
  description: 'Ask for confirmation',
  inputSchema: z.object({ amount: z.number() }),
  outputSchema: z.boolean(),
  suspendSchema: z.object({ phase: z.literal('confirm'), amount: z.number() }),
  resumeSchema: z.object({ confirmed: z.boolean() }),
  execute: async ({ amount }, context) => {
    // Same `context.mcp` shape as 1.x; the 2026-07-28 server marks it and log/progress work as before.
    assert.equal(context.mcp?.protocolVersion, '2026-07-28');
    await context.mcp?.log?.('info', 'confirming', { amount });
    await context.mcp?.progress?.({ progress: 1, total: 2 });
    // Server-initiated requests no longer exist: the deprecated members throw instead of hanging.
    await assert.rejects(
      context.mcp!.elicitation.sendRequest({ message: 'x', requestedSchema: { type: 'object', properties: {} } }),
      /elicitation\.sendRequest is not available on a 2026-07-28 server/,
    );
    // @ts-expect-error suspend/resume are top-level, not nested under mcp
    context.mcp?.suspend;
    if (!context.resumeData) {
      await context.suspend?.({ phase: 'confirm', amount });
      return;
    }
    assert.deepEqual(context.suspendPayload, { phase: 'confirm', amount });
    return context.resumeData.confirmed;
  },
});

const unavailable = (feature: string) => async (): Promise<never> => {
  throw new Error(`${feature} is not available on a 2026-07-28 server`);
};

/** The `context.mcp` a 2026-07-28 server builds: the 1.x shape, with server-initiated requests throwing. */
const request = (): MCPToolExecutionContext => {
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
  };
};

class Fixture extends MCPServerBase {
  override readonly mcpVersion = 2 as const;
  // Converts tools like the 1.x package does; `context.mcp` flows through CoreToolBuilder.
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
    const mcp = request();
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
    // Core reports invalid input/resume data as a validation-error output (the same
    // object agents see); a 2.x server rejects it like any other failed call.
    if (isValidationError(output)) throw new Error(output.message);
    return { status: 'completed', output };
  }
  async startHTTP(_options: MCPServerHTTPOptions) {}
  async startStdio() {}
  async close() {}
  getServerInfo() {
    return {
      id: this.id,
      name: this.name,
      version_detail: { version: this.version, release_date: '', is_latest: true },
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
  async readResource() {
    return { contents: [] };
  }
  async listResources() {
    return { resources: [] };
  }
}

const server = new Fixture({ id: 'fixture', name: 'Fixture', version: '2.0.0', tools: { confirmation } });
const mastra = new Mastra({ mcpServers: { fixture: server }, tools: { confirmation } });
assert.equal(mastra.getTool('confirmation'), confirmation);

const requestContext = new RequestContext();
const first = await server.executeTool('confirmation', { amount: 990 }, { requestContext });
assert.equal(first.status, 'suspended');
assert.ok(first.status === 'suspended');
assert.deepEqual(first.suspendPayload, { phase: 'confirm', amount: 990 });
assert.deepEqual(first.resumeSchema?.properties, { confirmed: { type: 'boolean' } });
assert.deepEqual(first.resumeSchema?.required, ['confirmed']);
const accepted = await server.executeTool(
  'confirmation',
  { amount: 990 },
  {
    requestContext,
    resumeData: { confirmed: true },
    suspendPayload: { phase: 'confirm', amount: 990 },
  },
);
assert.deepEqual(accepted, { status: 'completed', output: true });
console.log('PACKED CORE NATIVE PASS: createTool suspend/resume through a v2 server, Mastra tool registry shared');
