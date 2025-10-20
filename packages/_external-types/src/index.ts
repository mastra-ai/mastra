export type { Tool, ToolExecutionOptions, Schema } from 'ai';
export type { Tool as ToolV5, ToolCallOptions, FlexibleSchema } from '@ai-sdk/provider-utils';

/**
 * Structural type to accept provider-defined tools from external packages.
 *
 * This is necessary due to TypeScript's module path discrimination combined with
 * version mismatches. Provider SDKs like `@ai-sdk/google` or `@ai-sdk/anthropic`
 * may depend on different versions of `@ai-sdk/provider-utils` than Mastra uses.
 * Even if the versions are identical, npm may install separate instances in
 * different node_modules paths, causing TypeScript to see them as different types
 * despite being structurally identical.
 *
 * This structural type allows Mastra to accept any object that looks like a tool,
 * regardless of which module path or version it came from.
 */
export type ProviderDefinedTool = {
  inputSchema?: any;
  parameters?: any;
  description?: string;
  [key: string]: any;
};

export default {};
