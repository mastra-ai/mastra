import type { ToolsResolver } from '../src/tools.js';

type ForeignToolsInput = Record<string, { id: string }>;
type ForeignDynamicTools = (context: {
  requestContext: unknown;
  mastra?: unknown;
}) => ForeignToolsInput | Promise<ForeignToolsInput>;

declare const toolsResolver: ToolsResolver;

const compatibleTools: ForeignDynamicTools = toolsResolver;
void compatibleTools;
