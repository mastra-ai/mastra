// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const figmaNodeId = (id: string) => id.replace(/-/g, ':');

export const getFileNodeInputSchema = z.object({
  file_key: z.string().describe('The Figma file key. Example: "UzYlOaPNPL2c7zmHCEljOs"'),
  node_id: z
    .string()
    .describe('The ID of the node to retrieve, as in "91:1". The "91-1" form from a Figma URL works too.'),
});

const ComponentSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string(),
  componentSetId: z.string().optional(),
  documentationLinks: z.array(z.object({ uri: z.string() })),
  remote: z.boolean(),
});

const ComponentSetSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string(),
  documentationLinks: z.array(z.object({ uri: z.string() })).optional(),
  remote: z.boolean().optional(),
});

const StyleSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string(),
  remote: z.boolean(),
  styleType: z.string(),
});

export const getFileNodeOutputSchema = z.object({
  document: z.record(z.string(), z.unknown()).describe('The requested node as a JSON object'),
  components: z.record(z.string(), ComponentSchema).describe('A mapping from component IDs to component metadata'),
  componentSets: z
    .record(z.string(), ComponentSetSchema)
    .describe('A mapping from component set IDs to component set metadata'),
  schemaVersion: z.number().describe('The version of the file schema that this file uses'),
  styles: z.record(z.string(), StyleSchema).describe('A mapping from style IDs to style metadata'),
});

export function getFileNodeTool(proxy: PlatformProxy) {
  return createTool({
    id: 'figma_get_file_node',
    description: 'Retrieve a single file node from Figma',
    inputSchema: getFileNodeInputSchema,
    outputSchema: getFileNodeOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getFileNodeOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://www.figma.com/developers/api#get-file-nodes-endpoint
        endpoint: `/v1/files/${encodeURIComponent(input.file_key)}/nodes`,
        params: {
          ids: figmaNodeId(input.node_id),
        },
        retries: 3,
      });

      const responseData = z
        .object({
          name: z.string(),
          role: z.string(),
          lastModified: z.string(),
          editorType: z.string(),
          thumbnailUrl: z.string(),
          version: z.string(),
          nodes: z.record(z.string(), z.unknown()),
        })
        .parse(response.data);

      const nodeEntry = responseData.nodes[figmaNodeId(input.node_id)];

      if (!nodeEntry) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `Node "${input.node_id}" not found in file "${input.file_key}"`,
        });
      }

      const validatedNodeEntry = z
        .object({
          document: z.record(z.string(), z.unknown()),
          components: z.record(z.string(), ComponentSchema).optional().default({}),
          componentSets: z.record(z.string(), ComponentSetSchema).optional().default({}),
          schemaVersion: z.number().optional().default(0),
          styles: z.record(z.string(), StyleSchema).optional().default({}),
        })
        .parse(nodeEntry);

      return {
        document: validatedNodeEntry.document,
        components: validatedNodeEntry.components,
        componentSets: validatedNodeEntry.componentSets,
        schemaVersion: validatedNodeEntry.schemaVersion,
        styles: validatedNodeEntry.styles,
      };
    },
  });
}
