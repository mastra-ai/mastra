import type { ConnectTools } from './connect.js';

type ForeignToolsInput = Record<string, { id: string }>;
type ForeignDynamicTools = (context: {
  requestContext: unknown;
  mastra?: unknown;
}) => ForeignToolsInput | Promise<ForeignToolsInput>;

declare const connectTools: ConnectTools;

const compatibleDynamicTools: ForeignDynamicTools = connectTools;
void compatibleDynamicTools;
