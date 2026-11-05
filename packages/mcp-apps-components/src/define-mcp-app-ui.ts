import type { z } from 'zod';
import { parseReads } from './reads';
import type { McpAppReads } from './reads';

/**
 * An MCP App's UI: the iframe page and its contract with the host. Build an app from it with
 * `createMcpApp`.
 */
export interface McpAppUi<Input extends z.ZodType = z.ZodType, Reads extends McpAppReads = McpAppReads> {
  /** The `ui://` URI the page is served under. */
  uri: `ui://${string}`;
  name: string;
  description: string;
  /**
   * The page, inline rather than as a file path: deployers bundle this package into the server
   * output, where no sibling HTML file exists (and Cloudflare has no filesystem at all).
   */
  html: string;
  /** The tool the page reads its data through. The name is built into the page. */
  dataTool: string;
  /** What the tool that opens the page returns as `structuredContent`. */
  input: Input;
  /** Every read the page makes, by name. */
  reads: Reads;
}

/** Declares an MCP App's UI. Throws if a request could match two of its reads. */
export function defineMcpAppUi<Input extends z.ZodType, const Reads extends McpAppReads>(
  ui: McpAppUi<Input, Reads>,
): McpAppUi<Input, Reads> {
  parseReads(ui.reads);
  return ui;
}
