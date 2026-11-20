import { applyDocumentTheme } from '@modelcontextprotocol/ext-apps';
import type { App, McpUiTheme } from '@modelcontextprotocol/ext-apps';

export function applyTheme(theme: McpUiTheme | undefined) {
  if (!theme) return;
  applyDocumentTheme(theme);
  document.documentElement.classList.toggle('light', theme === 'light');
}

/** A tool result's JSON: `structuredContent` when the tool declares an output schema, else its text block. */
export function readResult(result: {
  structuredContent?: unknown;
  content?: { type: string; text?: string }[];
}): unknown {
  if (result.structuredContent !== undefined) return result.structuredContent;
  const text = result.content?.find(block => block.type === 'text')?.text;
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** A tool ran and answered with an error, as opposed to the call itself failing (e.g. the tool isn't offered). */
export class ToolError extends Error {}

/** Calls a tool on the server that opened the app, through the host. Throws the tool's error text. */
export async function callTool(app: App, name: string, args: Record<string, unknown>): Promise<unknown> {
  const result = await app.callServerTool({ name, arguments: args });
  if (result.isError) {
    const text = result.content.find(block => block.type === 'text')?.text;
    throw new ToolError(text ?? `${name} failed.`);
  }
  return readResult(result);
}
