// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const figmaNodeId = (id: string) => id.replace(/-/g, ':');

export const listFileNodesInputSchema = z.object({
  file_key: z
    .string()
    .min(1)
    .describe('File to export JSON from. This can be a file key or branch key. Example: "UzYlOaPNPL2c7zmHCEljOs"'),
  ids: z
    .array(z.string().min(1))
    .min(1)
    .describe(
      'Node IDs to retrieve. The response keys each node by its colon form, as in "91:1". The "91-1" form from a Figma URL works too.',
    ),
  version: z
    .string()
    .optional()
    .describe('A specific version ID to get. Omitting this will get the current version of the file.'),
  depth: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Positive integer representing how deep into the node tree to traverse.'),
  geometry: z.string().optional().describe('Set to "paths" to export vector data.'),
  plugin_data: z.string().optional().describe('A comma separated list of plugin IDs and/or the string "shared".'),
});

const NodeEntrySchema = z
  .object({
    document: z.unknown().optional(),
    components: z.record(z.string(), z.unknown()).optional(),
    componentSets: z.record(z.string(), z.unknown()).optional(),
    schemaVersion: z.number().optional(),
    styles: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const listFileNodesOutputSchema = z.object({
  name: z.string().optional(),
  role: z.string().optional(),
  lastModified: z.string().optional(),
  editorType: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  version: z.string().optional(),
  err: z.string().optional(),
  nodes: z.record(z.string(), NodeEntrySchema.nullable()).optional(),
});

export function listFileNodesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'figma_list_file_nodes',
    description: 'List file nodes from Figma.',
    inputSchema: listFileNodesInputSchema,
    outputSchema: listFileNodesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listFileNodesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: {
        ids: string;
        version?: string;
        depth?: number;
        geometry?: string;
        plugin_data?: string;
      } = {
        ids: input.ids.map(figmaNodeId).join(','),
      };

      if (input.version !== undefined) {
        params['version'] = input.version;
      }
      if (input.depth !== undefined) {
        params['depth'] = input.depth;
      }
      if (input.geometry !== undefined) {
        params['geometry'] = input.geometry;
      }
      if (input.plugin_data !== undefined) {
        params['plugin_data'] = input.plugin_data;
      }

      // https://www.figma.com/developers/api#get-file-nodes-endpoint
      const response = await platformProxy.get({
        endpoint: `/v1/files/${encodeURIComponent(input.file_key)}/nodes`,
        params,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'empty_response',
          message: 'Received an empty response from the Figma API.',
        });
      }

      const parsed = listFileNodesOutputSchema.parse(response.data);
      return parsed;
    },
  });
}
