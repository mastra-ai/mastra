import { App } from '@modelcontextprotocol/ext-apps';
import type { ReactNode } from 'react';
import type { z } from 'zod';
import type { McpAppContract } from '../define-mcp-app-ui';
import type { McpAppReads } from '../reads';
import { MastraServerProvider } from './mastra-server-provider';
import { McpAppView } from './mcp-app-view';
import { parseStructuredContent } from './parse';
import { createMcpAppSession } from './session';
import type { McpAppSession } from './session';

/** An app's input may name the project its reads are for; the data tool passes it to `prepareRequest`. */
type McpAppInput = z.ZodType<{ projectId?: string }>;

export type McpAppConfig<Input extends McpAppInput, Reads extends McpAppReads> = {
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

/**
 * Everything an MCP App needs besides its own UI: tool result parsing, theme, loading/error
 * states, and playground-ui's data hooks reading through the contract's data tool.
 */
export function defineMcpApp<Input extends McpAppInput, Reads extends McpAppReads>({
  contract,
  loadingTitle,
  errorTitle,
  render,
}: McpAppConfig<Input, Reads>): McpAppDefinition<z.output<Input>> {
  const { name, input: schema } = contract;
  return {
    name,
    createSession: (app = new App({ name, version: '1.0.0' })) =>
      createMcpAppSession(app, structuredContent => parseStructuredContent(schema, structuredContent)),
    View: ({ session }) => (
      <McpAppView session={session} loadingTitle={loadingTitle} errorTitle={errorTitle}>
        {input => (
          <MastraServerProvider contract={contract} projectId={input.projectId}>
            {render(input)}
          </MastraServerProvider>
        )}
      </McpAppView>
    ),
  };
}
