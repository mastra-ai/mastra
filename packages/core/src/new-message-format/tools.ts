import type { ToolSet } from '@internal/ai-v7';
import { tool } from '@internal/ai-v7';
import type { Mastra } from '../mastra';
import type { RequestContext } from '../request-context';
import { isVercelTool } from '../tools/toolchecks';

export type ToolAdapterContext = {
  agentId: string;
  requestContext: RequestContext;
  mastra?: Mastra;
};

const suspend = async () => {
  throw new Error('Tool suspension is not supported on action-native runs yet.');
};

/** Adapts Mastra tools (and pass-through AI SDK tools) to a v7 `ToolSet`. */
export function toV7Tools(tools: Record<string, any>, ctx: ToolAdapterContext): ToolSet {
  const out: ToolSet = {};
  for (const [name, t] of Object.entries(tools)) {
    if (isVercelTool(t)) {
      const vercel = t as { description?: string; inputSchema?: unknown; parameters?: unknown; execute?: Function };
      out[name] = tool({
        description: vercel.description,
        inputSchema: vercel.inputSchema ?? vercel.parameters,
        execute: vercel.execute
          ? (input: unknown, options: unknown) => vercel.execute!(input, options)
          : undefined,
      } as Parameters<typeof tool>[0]);
      continue;
    }
    const requireApproval = t.requireApproval;
    out[name] = tool({
      description: t.description,
      inputSchema: t.inputSchema,
      ...(requireApproval !== undefined
        ? {
            needsApproval:
              typeof requireApproval === 'function'
                ? (input: unknown) => requireApproval(input, { requestContext: ctx.requestContext.toJSON?.() })
                : requireApproval,
          }
        : {}),
      execute: t.execute
        ? async (input: unknown, { toolCallId, abortSignal }: { toolCallId: string; abortSignal?: AbortSignal }) =>
            t.execute(input, {
              mastra: ctx.mastra,
              requestContext: ctx.requestContext,
              abortSignal,
              agent: { agentId: ctx.agentId, toolCallId, messages: [], suspend },
            })
        : undefined,
    } as Parameters<typeof tool>[0]);
  }
  return out;
}
