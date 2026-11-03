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

function firstText(content: ReadonlyArray<{ type: string; text?: unknown }>) {
  const text = content.find(block => block.type === 'text' && typeof block.text === 'string')?.text;
  return typeof text === 'string' ? text : undefined;
}

// Some hosts forward only `content`; by MCP convention a tool with an output schema also
// serializes its structured output as JSON in the first text block.
function structuredOutput(result: {
  structuredContent?: unknown;
  content: ReadonlyArray<{ type: string; text?: unknown }>;
}) {
  if (result.structuredContent !== undefined) return result.structuredContent;
  const text = firstText(result.content);
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
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
      setState({ status: 'failed', message: firstText(result.content) ?? 'The tool call failed.' });
      return;
    }
    const parsed = parse(structuredOutput(result));
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
