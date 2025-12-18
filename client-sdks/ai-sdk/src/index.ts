export { chatRoute, handleChatStream } from './chat-route';
export type { chatRouteOptions, ChatStreamHandlerParams, ChatStreamHandlerOptions } from './chat-route';
export { workflowRoute, handleWorkflowStream } from './workflow-route';
export type { WorkflowRouteOptions, WorkflowStreamHandlerParams, WorkflowStreamHandlerOptions } from './workflow-route';
export type { WorkflowDataPart } from './transformers';
export { networkRoute, handleNetworkStream } from './network-route';
export type { NetworkRouteOptions, NetworkStreamHandlerParams, NetworkStreamHandlerOptions } from './network-route';
export type { NetworkDataPart } from './transformers';
export type { AgentDataPart } from './transformers';

export { toAISdkV5Stream as toAISdkStream } from './convert-streams';

// Middleware for wrapping models with Mastra processors
export { withMastra } from './middleware';
export type { WithMastraOptions, WithMastraMemoryOptions, WithMastraSemanticRecallOptions } from './middleware';

// ToolLoopAgent wrapper (AI SDK v6+)
// Re-exported from @mastra/core for convenience
export { toolLoopAgentToMastraAgent } from '@mastra/core/tool-loop-agent';

// Deprecated exports
export { toAISdkFormat } from './to-ai-sdk-format';
