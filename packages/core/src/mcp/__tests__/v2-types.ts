import { z } from 'zod/v4';
import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { createTool } from '../../tools';
import type { MCPToolExecutionContext } from '../../tools';
import { createStep } from '../../workflows';
import type { MCPToolExecutionContextV2 } from '../index';

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
    if (context.mcpv2) {
      const round = context.mcpv2;
      const version: '2026-07-28' = round.protocolVersion;
      void version;
      await round.log('info', { amount });
      await round.progress(1, 2);
      const trace: unknown = round.metadata.traceparent;
      void trace;
      if (!round.resumeData) {
        await round.suspend({ phase: 'confirm', amount });
        return;
      }
      const confirmed: boolean = round.resumeData.confirmed;
      void confirmed;
      // @ts-expect-error a suspend payload must match the suspend schema
      await round.suspend({ phase: 'other' });
      // @ts-expect-error the v2 request context carries no raw input responses
      round.inputResponses;
      // @ts-expect-error the v2 request context carries no opaque request state
      round.requestState;
      // @ts-expect-error the v2 request context has no legacy push handle
      round.extra;
      return { charged: round.suspendPayload?.amount ?? amount };
    }
    if (context.mcp) {
      // The `@mastra/mcp` 1.x context is untouched: no narrowing needed, no suspend.
      const legacy: MCPToolExecutionContext = context.mcp;
      legacy.extra.requestId;
      // @ts-expect-error legacy contexts cannot suspend
      context.mcp.suspend;
    }
    return { charged: amount };
  },
});

new Mastra({ tools: { confirm } });
new Mastra().addTool(confirm);
new Agent({ id: 'agent', name: 'Agent', model: 'openai/gpt-5', instructions: '', tools: { confirm } });
createStep(confirm);

export function requestContextTypes(round: MCPToolExecutionContextV2<{ phase: 'confirm' }, { confirmed: boolean }>) {
  const payload: { phase: 'confirm' } | undefined = round.suspendPayload;
  void payload;
  // @ts-expect-error resume data is typed by the resume schema
  const wrong: string = round.resumeData;
  void wrong;
}
