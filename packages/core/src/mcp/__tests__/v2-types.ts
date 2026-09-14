import { z } from 'zod/v4';
import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { createTool } from '../../tools';
import type { MCPToolExecutionContext } from '../../tools';
import { createStep } from '../../workflows';
import type { MCPRequestContextV2 } from '../index';

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
        await host.suspend({ phase: 'confirm', amount });
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
    if (context.mcpv2) {
      const round = context.mcpv2;
      const version: '2026-07-28' = round.protocolVersion;
      void version;
      await round.log('info', 'charging', { amount });
      await round.progress({ progress: 1, total: 2 });
      const trace: unknown = round._meta?.traceparent;
      void trace;
      // @ts-expect-error suspend/resume are not nested under the request context
      round.suspend;
      // @ts-expect-error the v2 request context carries no raw input responses
      round.inputResponses;
      // @ts-expect-error the v2 request context carries no opaque request state
      round.requestState;
      // @ts-expect-error the v2 request context has no legacy push handle
      round.extra;
    }
    if (context.mcp) {
      // The `@mastra/mcp` 1.x context is untouched: no narrowing needed, no suspend.
      const legacy: MCPToolExecutionContext = context.mcp;
      legacy.extra.requestId;
      // @ts-expect-error legacy contexts cannot suspend
      context.mcp.suspend;
    }
    return { charged: context.suspendPayload?.amount ?? amount };
  },
});

new Mastra({ tools: { confirm } });
new Mastra().addTool(confirm);
new Agent({ id: 'agent', name: 'Agent', model: 'openai/gpt-5', instructions: '', tools: { confirm } });
createStep(confirm);

/** The 1.x and 2.x request facilities share signatures, so a tool using only log/progress needs no change. */
export async function sameLogAndProgressShape(legacy: MCPToolExecutionContext, current: MCPRequestContextV2) {
  const log: MCPRequestContextV2['log'] = legacy.log!;
  const progress: MCPRequestContextV2['progress'] = legacy.progress!;
  void log;
  void progress;
  await current.log('info', 'same shape', { ok: true });
  await current.progress({ progress: 1 });
}
