import type { GetToolResponse } from '@mastra/client-js';

/**
 * The built-in Ask User tool, as returned by `GET /api/tools`. Its intrinsic
 * `id` is always `ask_user`, regardless of the object key an agent registers it
 * under (e.g. `tools: { askUserTool }` → key `askUserTool`, id `ask_user`).
 */
export const askUserToolResponse: GetToolResponse = {
  id: 'ask_user',
  description: 'Ask the user a question and wait for their response.',
  inputSchema: '{"type":"object","properties":{"question":{"type":"string"}}}',
  outputSchema: '{"type":"object"}',
};

/** A generic tool whose id is not `ask_user`. */
export const genericToolResponse: GetToolResponse = {
  id: 'search_docs',
  description: 'Searches the docs.',
  inputSchema: '{"type":"object","properties":{"q":{"type":"string"}}}',
  outputSchema: '{"type":"object"}',
};

export const toolsResponse = (tools: Record<string, GetToolResponse>): Record<string, GetToolResponse> => tools;
