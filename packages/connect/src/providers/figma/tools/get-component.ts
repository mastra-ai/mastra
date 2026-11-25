// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getComponentInputSchema = z.object({
  key: z.string().describe('The unique identifier of the component. Example: "abc123"'),
});

const UserSchema = z.object({
  id: z.string(),
  handle: z.string(),
  img_url: z.string(),
});

const ProviderFrameInfoSchema = z.object({
  nodeId: z.string().optional(),
  name: z.string().optional(),
  backgroundColor: z.string().optional(),
  pageId: z.string().optional(),
  pageName: z.string().optional(),
  containingStateGroup: z
    .object({
      nodeId: z.string().optional(),
      name: z.string().optional(),
    })
    .nullable()
    .optional(),
  containingComponentSet: z
    .object({
      nodeId: z.string().optional(),
      name: z.string().optional(),
    })
    .nullable()
    .optional(),
});

const ProviderComponentSchema = z.object({
  key: z.string(),
  file_key: z.string(),
  node_id: z.string(),
  thumbnail_url: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  user: UserSchema,
  containing_frame: ProviderFrameInfoSchema.optional(),
});

const ResponseSchema = z.object({
  status: z.number(),
  error: z.boolean(),
  meta: ProviderComponentSchema,
});

export const getComponentOutputSchema = z.object({
  key: z.string(),
  file_key: z.string(),
  node_id: z.string(),
  thumbnail_url: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  user: UserSchema,
  containing_frame: z
    .object({
      nodeId: z.string().optional(),
      name: z.string().optional(),
      backgroundColor: z.string().optional(),
      pageId: z.string().optional(),
      pageName: z.string().optional(),
      containingStateGroup: z
        .object({
          nodeId: z.string().optional(),
          name: z.string().optional(),
        })
        .optional(),
      containingComponentSet: z
        .object({
          nodeId: z.string().optional(),
          name: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

export function getComponentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'figma_get_component',
    description: 'Retrieve a single component from Figma.',
    inputSchema: getComponentInputSchema,
    outputSchema: getComponentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getComponentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://developers.figma.com/docs/rest-api/component-endpoints/
        endpoint: `v1/components/${encodeURIComponent(input.key)}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Component not found',
          key: input.key,
        });
      }

      const parsed = ResponseSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Unexpected response format from Figma API',
          key: input.key,
          details: parsed.error.issues,
        });
      }

      const meta = parsed.data.meta;

      return {
        key: meta.key,
        file_key: meta.file_key,
        node_id: meta.node_id,
        ...(meta.thumbnail_url !== undefined && { thumbnail_url: meta.thumbnail_url }),
        name: meta.name,
        ...(meta.description !== undefined && { description: meta.description }),
        created_at: meta.created_at,
        updated_at: meta.updated_at,
        user: meta.user,
        ...(meta.containing_frame !== undefined && {
          containing_frame: {
            ...(meta.containing_frame.nodeId !== undefined && { nodeId: meta.containing_frame.nodeId }),
            ...(meta.containing_frame.name !== undefined && { name: meta.containing_frame.name }),
            ...(meta.containing_frame.backgroundColor !== undefined && {
              backgroundColor: meta.containing_frame.backgroundColor,
            }),
            ...(meta.containing_frame.pageId !== undefined && { pageId: meta.containing_frame.pageId }),
            ...(meta.containing_frame.pageName !== undefined && { pageName: meta.containing_frame.pageName }),
            ...(meta.containing_frame.containingStateGroup != null && {
              containingStateGroup: meta.containing_frame.containingStateGroup,
            }),
            ...(meta.containing_frame.containingComponentSet != null && {
              containingComponentSet: meta.containing_frame.containingComponentSet,
            }),
          },
        }),
      };
    },
  });
}
