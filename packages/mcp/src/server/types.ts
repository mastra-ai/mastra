import type { InternalCoreTool } from '@mastra/core';
import type {
  ElicitRequest,
  ElicitResult,
  Prompt,
  PromptMessage,
  Resource,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/types.js';

export type MCPServerResourceContentCallback = ({
  uri,
}: {
  uri: string;
}) => Promise<MCPServerResourceContent | MCPServerResourceContent[]>;
export type MCPServerResourceContent = { text?: string } | { blob?: string };
export type MCPServerResources = {
  listResources: () => Promise<Resource[]>;
  getResourceContent: MCPServerResourceContentCallback;
  resourceTemplates?: () => Promise<ResourceTemplate[]>;
};

export type MCPServerPromptMessagesCallback = ({
  name,
  version,
  args,
}: {
  name: string;
  version?: string;
  args?: any;
}) => Promise<PromptMessage[]>;

export type MCPServerPrompts = {
  listPrompts: () => Promise<Prompt[]>;
  getPromptMessages?: MCPServerPromptMessagesCallback;
};

export type ElicitationActions = {
  sendRequest: (request: ElicitRequest['params']) => Promise<ElicitResult>;
};

export type MCPTool = {
  id?: InternalCoreTool['id'];
  description?: InternalCoreTool['description'];
  parameters: InternalCoreTool['parameters'];
  outputSchema?: InternalCoreTool['outputSchema'];
  // Patch type to include elicitation in execute options
  execute: (
    params: any,
    options: Parameters<NonNullable<InternalCoreTool['execute']>>[1] & { elicitation: ElicitationActions },
  ) => Promise<any>;
};

export type { Resource, ResourceTemplate };
