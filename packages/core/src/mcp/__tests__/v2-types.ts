import { z } from 'zod/v4';
import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { createTool } from '../../tools';
import type { MCPToolExecutionContext } from '../../tools';
import { createStep } from '../../workflows';

/**
 * A tool that asks for confirmation is one ordinary `createTool`: the same
 * definition is resumable from an agent, a workflow and an MCP 2026-07-28 server.
 */
const confirm = createTool({
  id: 'confirm',
  description: 'Asks before acting',
  inputSchema: z.object({ amount: z.number() }),
  outputSchema: z.object({ charged: z.number() }),
  suspendSchema: z.object({ phase: z.literal('confirm'), amount: z.number() }),
  resumeSchema: z.object({ confirmed: z.boolean() }),
  execute: async ({ amount }, context) => {
    const host = context.agent ?? context.workflow;
    if (host) {
      if (!host.resumeData) {
        await host.suspend?.({ phase: 'confirm', amount });
        return;
      }
      const previous: number | undefined = host.suspendPayload?.amount;
      return { charged: previous ?? amount };
    }
    // Direct execution and MCP 2.x: suspend/resume live at the top level.
    if (!context.resumeData) {
      await context.suspend?.({ phase: 'confirm', amount });
      return;
    }
    const confirmed: boolean = context.resumeData.confirmed;
    void confirmed;
    // @ts-expect-error a suspend payload must match the suspend schema
    await context.suspend?.({ phase: 'other' });
    if (context.mcp) {
      // One `context.mcp` shape for 1.x and 2026-07-28 servers; no narrowing needed for the shared members.
      const mcp: MCPToolExecutionContext = context.mcp;
      const version: '2026-07-28' | undefined = mcp.protocolVersion;
      void version;
      await mcp.log?.('info', 'charging', { amount });
      await mcp.progress?.({ progress: 1, total: 2 });
      const trace: unknown = mcp.extra._meta?.traceparent;
      void trace;
      mcp.extra.requestId;
      mcp.extra.signal.aborted;
      // @ts-expect-error suspend/resume are not nested under mcp
      mcp.suspend;
      // @ts-expect-error raw input responses are not exposed to tools
      mcp.inputResponses;
      // @ts-expect-error opaque request state is not exposed to tools
      mcp.requestState;
    }
    return { charged: context.suspendPayload?.amount ?? amount };
  },
});

new Mastra({ tools: { confirm } });
new Mastra().addTool(confirm);
new Agent({ id: 'agent', name: 'Agent', model: 'openai/gpt-5', instructions: '', tools: { confirm } });
createStep(confirm);

/** A tool written against 1.x that only reads `extra` and logs still compiles unchanged. */
export async function legacyStyleTool(context: { mcp?: MCPToolExecutionContext }) {
  if (!context.mcp) return;
  await context.mcp.log?.('info', 'same shape', { requestId: context.mcp.extra.requestId });
  await context.mcp.progress?.({ progress: 1 });
  // Still typed (deprecated): a 2026-07-28 server throws from these at runtime.
  await context.mcp.elicitation.sendRequest({ message: 'x', requestedSchema: { type: 'object', properties: {} } });
}
