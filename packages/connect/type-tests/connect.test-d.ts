import type { ConnectTools } from '../src/connect.js';
import type { ToolsResolver } from '../src/tools.js';

type ForeignToolsInput = Record<string, { id: string }>;
type ForeignDynamicTools = (context: {
  requestContext: unknown;
  mastra?: unknown;
}) => ForeignToolsInput | Promise<ForeignToolsInput>;

// eslint-disable-next-line @typescript-eslint/no-deprecated
declare const connectTools: ConnectTools;
declare const toolsResolver: ToolsResolver;

const compatibleDeprecated: ForeignDynamicTools = connectTools;
const compatibleTools: ForeignDynamicTools = toolsResolver;
void compatibleDeprecated;
void compatibleTools;
