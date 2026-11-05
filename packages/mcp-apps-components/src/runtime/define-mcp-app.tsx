import { App } from '@modelcontextprotocol/ext-apps';
import type { ReactNode } from 'react';
import type { z } from 'zod';
import type { McpAppContract } from '../define-mcp-app-ui';
import { MCP_APP_CONTEXT_KEY } from '../reads';
import type { McpAppReads } from '../reads';
import { MastraServerProvider } from './mastra-server-provider';
import { McpAppView } from './mcp-app-view';
import { parseStructuredContent } from './parse';
import type { ParsedToolResult } from './parse';
import { createMcpAppSession } from './session';
import type { McpAppSession } from './session';

export type McpAppConfig<Input extends z.ZodObject, Reads extends McpAppReads> = {
  /** The app's contract. Its `input` validates the tool result before `render` sees it. */
  contract: McpAppContract<Input, Reads>;
  loadingTitle: string;
  errorTitle: string;
  render: (input: z.output<Input>) => ReactNode;
};

export type McpAppDefinition<Input> = {
  name: string;
  /** Starts listening to the host. Pass an `App` to drive it over another transport, as tests do. */
  createSession: (app?: App) => McpAppSession<Input>;
  View: (props: { session: McpAppSession<Input> }) => ReactNode;
};

/** The UI's input, and the context the opening tool returned, which each read sends back as is. */
type McpAppOpened<Input> = { input: Input; context: Record<string, unknown> };

function parseOpening<Input extends z.ZodObject>(
  schema: Input,
  structuredContent: unknown,
): ParsedToolResult<McpAppOpened<z.output<Input>>> {
  const parsed = parseStructuredContent(schema, structuredContent);
  if (!parsed.success) return parsed;
  // The input parsed as an object, so the tool result is one.
  const context = (structuredContent as Record<string, unknown>)[MCP_APP_CONTEXT_KEY] ?? {};
  if (typeof context !== 'object' || context === null || Array.isArray(context)) {
    return { success: false, message: `The tool result can't be shown: \`${MCP_APP_CONTEXT_KEY}\` must be an object.` };
  }
  return { success: true, input: { input: parsed.input, context: context as Record<string, unknown> } };
}

/**
 * Everything an MCP App needs besides its own UI: tool result parsing, theme, loading/error
 * states, and playground-ui's data hooks reading through the contract's data tool.
 */
export function defineMcpApp<Input extends z.ZodObject, Reads extends McpAppReads>({
  contract,
  loadingTitle,
  errorTitle,
  render,
}: McpAppConfig<Input, Reads>): McpAppDefinition<McpAppOpened<z.output<Input>>> {
  const { name, input: schema } = contract;
  return {
    name,
    createSession: (app = new App({ name, version: '1.0.0' })) =>
      createMcpAppSession(app, structuredContent => parseOpening(schema, structuredContent)),
    View: ({ session }) => (
      <McpAppView session={session} loadingTitle={loadingTitle} errorTitle={errorTitle}>
        {({ input, context }) => (
          <MastraServerProvider contract={contract} context={context}>
            {render(input)}
          </MastraServerProvider>
        )}
      </McpAppView>
    ),
  };
}
