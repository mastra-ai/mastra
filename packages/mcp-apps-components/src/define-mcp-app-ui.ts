import type { z } from 'zod';
import { parseReads } from './reads';
import type { McpAppReads } from './reads';

/** What an MCP App's page and its host agree on. The page is built from it, and so is the server side. */
export interface McpAppContract<Input extends z.ZodObject = z.ZodObject, Reads extends McpAppReads = McpAppReads> {
  /** The `ui://` URI the page is served under. */
  uri: `ui://${string}`;
  name: string;
  description: string;
  /** The tool the page reads its data through. The name is built into the page. */
  dataTool: string;
  /** What the tool that opens the page returns as `structuredContent`. An object, as MCP requires. */
  input: Input;
  /** Every read the page makes, by name. */
  reads: Reads;
}

/**
 * An MCP App's UI: the iframe page and its contract with the host. Build an app from it with
 * `createMcpApp`.
 */
export interface McpAppUi<
  Input extends z.ZodObject = z.ZodObject,
  Reads extends McpAppReads = McpAppReads,
> extends McpAppContract<Input, Reads> {
  /**
   * The page, inline rather than as a file path: deployers bundle this package into the server
   * output, where no sibling HTML file exists (and Cloudflare has no filesystem at all).
   */
  html: string;
}

/** Declares an MCP App's UI. Throws if a request could match two of its reads. */
export function defineMcpAppUi<Input extends z.ZodObject, const Reads extends McpAppReads>(
  ui: McpAppUi<Input, Reads>,
): McpAppUi<Input, Reads> {
  parseReads(ui.reads);
  return ui;
}
