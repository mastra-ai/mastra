// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const figmaNodeId = (id: string) => id.replace(/-/g, ':');

export const renderImagesInputSchema = z.object({
  file_key: z.string().describe('The file key to render images from. Example: "UzYlOaPNPL2c7zmHCEljOs"'),
  node_ids: z
    .array(z.string())
    .nonempty()
    .describe(
      'Node IDs to render. The response keys each image by its node id in colon form, as in "91:1". The "91-1" form from a Figma URL works too.',
    ),
  scale: z
    .number()
    .min(0.01, { message: 'Scale must be at least 0.01' })
    .max(4, { message: 'Scale must be at most 4' })
    .optional()
    .describe('Image scaling factor between 0.01 and 4.'),
  format: z.enum(['jpg', 'png', 'svg', 'pdf']).optional().describe('Image output format. Defaults to png.'),
  svg_outline_text: z
    .boolean()
    .optional()
    .describe('Whether text elements are rendered as outlines in SVGs. Defaults to true.'),
  svg_include_id: z
    .boolean()
    .optional()
    .describe('Whether to include id attributes for all SVG elements. Defaults to false.'),
  svg_include_node_id: z
    .boolean()
    .optional()
    .describe('Whether to include node id attributes for all SVG elements. Defaults to false.'),
  svg_simplify_stroke: z
    .boolean()
    .optional()
    .describe('Whether to simplify inside/outside strokes in SVGs. Defaults to true.'),
  contents_only: z
    .boolean()
    .optional()
    .describe('Whether content that overlaps the node should be excluded. Defaults to true.'),
  use_absolute_bounds: z
    .boolean()
    .optional()
    .describe('Use full dimensions of the node regardless of cropping. Defaults to false.'),
  version: z.string().optional().describe('A specific version ID to use. Omit for the current version.'),
});

const ProviderResponseSchema = z.object({
  err: z.string().nullable().optional(),
  images: z.record(z.string(), z.string().nullable()).optional(),
});

export const renderImagesOutputSchema = z.object({
  images: z.record(z.string(), z.string().nullable()),
  err: z.string().optional(),
});

export function renderImagesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'figma_render_images',
    description: 'Render images for Figma file nodes.',
    inputSchema: renderImagesInputSchema,
    outputSchema: renderImagesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof renderImagesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number> = {
        ids: input.node_ids.map(figmaNodeId).join(','),
      };

      if (input.scale !== undefined) {
        params['scale'] = input.scale;
      }
      if (input.format !== undefined) {
        params['format'] = input.format;
      }
      if (input.svg_outline_text !== undefined) {
        params['svg_outline_text'] = String(input.svg_outline_text);
      }
      if (input.svg_include_id !== undefined) {
        params['svg_include_id'] = String(input.svg_include_id);
      }
      if (input.svg_include_node_id !== undefined) {
        params['svg_include_node_id'] = String(input.svg_include_node_id);
      }
      if (input.svg_simplify_stroke !== undefined) {
        params['svg_simplify_stroke'] = String(input.svg_simplify_stroke);
      }
      if (input.contents_only !== undefined) {
        params['contents_only'] = String(input.contents_only);
      }
      if (input.use_absolute_bounds !== undefined) {
        params['use_absolute_bounds'] = String(input.use_absolute_bounds);
      }
      if (input.version !== undefined) {
        params['version'] = input.version;
      }

      const response = await platformProxy.get({
        // https://www.figma.com/developers/api#get-images-endpoint
        endpoint: `/v1/images/${encodeURIComponent(input.file_key)}`,
        params: params,
        retries: 3,
      });

      const providerData = ProviderResponseSchema.parse(response.data);

      const images = providerData.images ?? {};
      const err = providerData.err ?? undefined;

      return {
        images: images,
        ...(err !== undefined && { err: err }),
      };
    },
  });
}
