import { App } from '@modelcontextprotocol/ext-apps';
import type { ReactNode } from 'react';
import type { z } from 'zod';
import { McpAppView } from './mcp-app-view';
import { parseStructuredContent } from './parse';
import { createMcpAppSession } from './session';
import type { McpAppSession } from './session';

export type McpAppConfig<Schema extends z.ZodType> = {
  /** Reported to the host during the handshake. */
  name: string;
  /** Validates the tool result's `structuredContent` before `render` sees it. */
  schema: Schema;
  loadingTitle: string;
  errorTitle: string;
  render: (input: z.output<Schema>) => ReactNode;
};

export type McpAppDefinition<Input> = {
  name: string;
  /** Starts listening to the host. Pass an `App` to drive it over another transport, as tests do. */
  createSession: (app?: App) => McpAppSession<Input>;
  View: (props: { session: McpAppSession<Input> }) => ReactNode;
};

/** Everything an MCP App needs besides its own UI: tool result parsing, theme, and loading/error states. */
export function defineMcpApp<Schema extends z.ZodType>({
  name,
  schema,
  loadingTitle,
  errorTitle,
  render,
}: McpAppConfig<Schema>): McpAppDefinition<z.output<Schema>> {
  return {
    name,
    createSession: (app = new App({ name, version: '1.0.0' })) =>
      createMcpAppSession(app, structuredContent => parseStructuredContent(schema, structuredContent)),
    View: ({ session }) => (
      <McpAppView session={session} loadingTitle={loadingTitle} errorTitle={errorTitle}>
        {render}
      </McpAppView>
    ),
  };
}
