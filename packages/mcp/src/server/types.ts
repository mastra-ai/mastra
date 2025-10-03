import type { InternalCoreTool } from '@mastra/core/tools';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type {
  ElicitRequest,
  ElicitResult,
  Prompt,
  PromptMessage,
  Resource,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/types.js';
import type { z } from 'zod';

export type MCPServerResourceContentCallback = ({
  uri,
  extra,
}: {
  uri: string;
  extra: MCPRequestHandlerExtra;
}) => Promise<MCPServerResourceContent | MCPServerResourceContent[]>;
export type MCPServerResourceContent = { text?: string } | { blob?: string };
export type MCPServerResources = {
  listResources: ({ extra }: { extra: MCPRequestHandlerExtra }) => Promise<Resource[]>;
  getResourceContent: MCPServerResourceContentCallback;
  resourceTemplates?: ({ extra }: { extra: MCPRequestHandlerExtra }) => Promise<ResourceTemplate[]>;
};

export type MCPServerPromptMessagesCallback = ({
  name,
  version,
  args,
  extra,
}: {
  name: string;
  version?: string;
  args?: any;
  extra: MCPRequestHandlerExtra;
}) => Promise<PromptMessage[]>;

export type MCPServerPrompts = {
  listPrompts: ({ extra }: { extra: MCPRequestHandlerExtra }) => Promise<Prompt[]>;
  getPromptMessages?: MCPServerPromptMessagesCallback;
};

export type ElicitationActions = {
  sendRequest: (request: ElicitRequest['params']) => Promise<ElicitResult>;
};

export type MCPRequestHandlerExtra = RequestHandlerExtra<any, any>;

export type MCPTool<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
> = {
  id?: InternalCoreTool['id'];
  description?: InternalCoreTool['description'];
  parameters: TSchemaIn extends z.ZodSchema ? z.infer<TSchemaIn> : any;
  outputSchema?: TSchemaOut extends z.ZodSchema ? z.infer<TSchemaOut> : any;
  execute: (
    params: { context: TSchemaIn extends z.ZodSchema ? z.infer<TSchemaIn> : any },
    options: Parameters<NonNullable<InternalCoreTool['execute']>>[1] & {
      elicitation: ElicitationActions;
      extra: MCPRequestHandlerExtra;
    },
  ) => Promise<any>;
};

export type { Resource, ResourceTemplate };
