import type { ToolsResolver } from '../src/tools.js';

type ForeignToolsInput = Record<string, { id: string }>;
type ForeignDynamicTools = (context: {
  requestContext: unknown;
  mastra?: unknown;
}) => ForeignToolsInput | Promise<ForeignToolsInput>;

declare const toolsResolver: ToolsResolver;

const compatibleTools: ForeignDynamicTools = toolsResolver;
void compatibleTools;

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
