import assert from 'node:assert/strict';
import { MCPServerBaseV2 } from '@mastra/core/mcp';
import type { MCPServerHTTPOptionsV2, MCPToolExecutionContextV2 } from '@mastra/core/mcp';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// Packed-declaration proof of the Segment 1 contract: an ordinary `createTool` that suspends is a
// v2 catalogue tool, an agent tool and a business-registry tool at once; there is no native family.
const confirmation = createTool({
  id: 'confirmation',
  description: 'Ask for confirmation',
  inputSchema: z.object({ amount: z.number() }),
  outputSchema: z.boolean(),
  suspendSchema: z.object({ phase: z.literal('confirm'), amount: z.number() }),
  resumeSchema: z.object({ confirmed: z.boolean() }),
  execute: async ({ amount }, context) => {
    const round = context.mcpv2;
    // @ts-expect-error the 1.x context is a different, unrelated shape
    round?.extra;
    if (!round?.resumeData) {
      await round?.suspend({ phase: 'confirm', amount });
      return;
    }
    assert.deepEqual(round.suspendPayload, { phase: 'confirm', amount });
    return round.resumeData.confirmed;
  },
});

class Fixture extends MCPServerBaseV2 {
  async startHTTP(_options: MCPServerHTTPOptionsV2) {}
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

const request = (): Omit<MCPToolExecutionContextV2, 'suspend'> => ({
  protocolVersion: '2026-07-28',
  requestId: 'first',
  signal: new AbortController().signal,
  metadata: {},
  log: async () => {},
  progress: async () => {},
});
const requestContext = new RequestContext();
const first = await server.executeTool('confirmation', { amount: 990 }, { requestContext, mcpv2: request() });
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
    mcpv2: {
      ...request(),
      requestId: 'second',
      resumeData: { confirmed: true },
      suspendPayload: { phase: 'confirm', amount: 990 },
    },
  },
);
assert.deepEqual(accepted, { status: 'completed', output: true });
console.log('PACKED CORE NATIVE PASS: createTool suspend/resume through a v2 catalogue, business registry shared');
