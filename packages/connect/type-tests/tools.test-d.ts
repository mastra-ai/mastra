import type { ToolsOptions, ToolsResolver } from '../src/tools.js';
import { tools } from '../src/tools.js';

type ForeignToolsInput = Record<string, { id: string }>;
type ForeignDynamicTools = (context: {
  requestContext: unknown;
  mastra?: unknown;
}) => ForeignToolsInput | Promise<ForeignToolsInput>;

declare const toolsResolver: ToolsResolver;

const compatibleTools: ForeignDynamicTools = toolsResolver;
void compatibleTools;

// resourceId accepts a static key or a (possibly async) per-resolution callback.
const staticScoped: ToolsOptions = { resourceId: 'end-user-1' };
const callbackScoped: ToolsOptions = {
  resourceId: ctx => (ctx?.requestContext as { userId?: string } | undefined)?.userId,
};
const asyncCallbackScoped: ToolsOptions = { resourceId: async () => undefined };
void staticScoped;
void callbackScoped;
void asyncCallbackScoped;
// @ts-expect-error — resourceId is a string or a callback, not a number.
const badScoped: ToolsOptions = { resourceId: 42 };
void badScoped;

// The per-request pattern type-checks against a dynamic tools argument: the
// resolver is thenable, so core's await of the returned value unwraps it.
const perRequest: ForeignDynamicTools = ctx =>
  tools({ resourceId: (ctx.requestContext as { userId?: string }).userId });
void perRequest;

// Awaiting the resolver yields the tool record.
declare const awaited: Awaited<ToolsResolver>;
const awaitedRecord: ForeignToolsInput = awaited;
void awaitedRecord;

// `.with()` returns a resolver that stays compatible with an agent's dynamic
// `tools` argument, for both static records and context-reading functions.
declare const localTool: { id: string };
const withStatic: ForeignDynamicTools = toolsResolver.with({ localTool });
const withFn: ForeignDynamicTools = toolsResolver.with(async ctx => {
  void ctx?.requestContext;
  return { localTool };
});
const chained: ForeignDynamicTools = toolsResolver.with({ localTool }).with({ localTool });
void withStatic;
void withFn;
void chained;
