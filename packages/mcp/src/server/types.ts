import type { Prompt, PromptMessage, Resource, ResourceTemplate } from '@modelcontextprotocol/sdk/types.js';

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

export type { Resource, ResourceTemplate };
