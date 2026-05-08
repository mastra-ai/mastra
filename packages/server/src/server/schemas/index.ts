// Route contract utility types for type inference
export type {
  InferPathParams,
  InferQueryParams,
  InferBody,
  InferResponse,
  RouteMap,
  RouteContract,
} from './route-contracts';

// Re-export only the type-level route types (no runtime import of handler graph)
export type { ServerRoutes, ServerRoute } from '../server-adapter/routes';

// Re-export all Zod schemas for direct use.
// Some modules have naming conflicts — those are handled with explicit named re-exports.

// Modules with no conflicts (export * is safe)
export * from './agent-builder';
export * from './agent-versions';
export * from './agents';
export * from './auth';
export * from './common';
export * from './conversations';
export * from './datasets';
export * from './default-options';
export * from './logs';
export * from './mcp-client-versions';
export * from './memory';
export * from './memory-config';
export * from './processor-providers';
export * from './prompt-block-versions';
export * from './responses';
export * from './rule-group';
export * from './scorer-versions';
export * from './scores';
export * from './stored-agents';
export * from './stored-mcp-clients';
export * from './stored-prompt-blocks';
export * from './stored-scorers';
export * from './stored-skills';
export * from './stored-workspaces';
export * from './system';
export * from './tool-providers';
export * from './vectors';
export * from './version-common';
export * from './workspace';

// Modules with naming conflicts — re-export with prefixed names to avoid ambiguity.
// Conflicts:
//   a2a.ts: agentExecutionBodySchema (also in agents.ts)
//   mcp.ts: executeToolBodySchema, executeToolResponseSchema (also in agents.ts)
//   processors.ts: serializedProcessorSchema (also in agents.ts)

export {
  a2aAgentIdPathParams,
  a2aTaskPathParams,
  messageSendBodySchema,
  taskQueryBodySchema,
  agentExecutionBodySchema as a2aAgentExecutionBodySchema,
  agentCardResponseSchema,
  taskResponseSchema,
  agentExecutionResponseSchema,
} from './a2a';

export {
  mcpServerIdPathParams,
  mcpServerDetailPathParams,
  mcpServerToolPathParams,
  executeToolBodySchema as mcpExecuteToolBodySchema,
  listMcpServersQuerySchema,
  getMcpServerDetailQuerySchema,
  versionDetailSchema,
  serverInfoSchema,
  listMcpServersResponseSchema,
  serverDetailSchema,
  mcpToolInfoSchema,
  listMcpServerToolsResponseSchema,
  executeToolResponseSchema as mcpExecuteToolResponseSchema,
  jsonRpcErrorSchema,
} from './mcp';

export {
  processorIdPathParams,
  processorConfigurationSchema,
  serializedProcessorSchema as processorSerializedSchema,
  serializedProcessorDetailSchema,
  listProcessorsResponseSchema,
  executeProcessorBodySchema,
  executeProcessorResponseSchema,
} from './processors';
