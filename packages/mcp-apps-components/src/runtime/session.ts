import type { Transport } from '@modelcontextprotocol/client';
import type { App, McpUiTheme } from '@modelcontextprotocol/ext-apps';
import type { ParsedToolResult } from './parse';

export type McpAppState<Input> =
  | { status: 'waiting' }
  | { status: 'ready'; input: Input }
  | { status: 'failed'; message: string };

export type McpAppSession<Input> = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => McpAppState<Input>;
  connect: (transport?: Transport) => Promise<void>;
};

// playground-ui themes are dark by default and switch on `html.light`.
function applyTheme(theme: McpUiTheme | undefined) {
  if (theme) document.documentElement.classList.toggle('light', theme === 'light');
}

function errorText(content: ReadonlyArray<{ type: string; text?: unknown }>) {
  const text = content.find(block => block.type === 'text' && typeof block.text === 'string')?.text;
  return typeof text === 'string' ? text : undefined;
}

/**
 * Tracks what an MCP App shows: waiting for the tool result, ready with its parsed input, or
 * failed. Listeners are attached before `connect`, since the host sends the tool result once,
 * right after the handshake.
 */
export function createMcpAppSession<Input>(
  app: App,
  parse: (structuredContent: unknown) => ParsedToolResult<Input>,
): McpAppSession<Input> {
  let state: McpAppState<Input> = { status: 'waiting' };
  const listeners = new Set<() => void>();
  const setState = (next: McpAppState<Input>) => {
    state = next;
    for (const listener of listeners) listener();
  };

  app.addEventListener('toolresult', result => {
    if (result.isError) {
      setState({ status: 'failed', message: errorText(result.content) ?? 'The tool call failed.' });
      return;
    }
    const parsed = parse(result.structuredContent);
    setState(parsed.success ? { status: 'ready', input: parsed.input } : { status: 'failed', message: parsed.message });
  });
  app.addEventListener('toolcancelled', () => {
    setState({ status: 'failed', message: 'The tool call was cancelled.' });
  });
  app.addEventListener('hostcontextchanged', context => applyTheme(context.theme));

  return {
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => state,
    connect: async transport => {
      try {
        await app.connect(transport);
      } catch (error) {
        const reason = error instanceof Error ? ` ${error.message}` : '';
        setState({ status: 'failed', message: `Couldn't connect to the host.${reason}` });
        return;
      }
      applyTheme(app.getHostContext()?.theme);
    },
  };
}
