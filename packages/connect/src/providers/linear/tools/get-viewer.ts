// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getViewerInputSchema = z.object({});

const ProviderOrganizationSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  urlKey: z.string().nullable().optional(),
});

const ProviderViewerSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  displayName: z.string().nullable().optional(),
  organization: ProviderOrganizationSchema.nullable().optional(),
});

export const getViewerOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  email: z.string().optional(),
  avatarUrl: z.string().optional(),
  displayName: z.string().optional(),
  organization: z
    .object({
      id: z.string(),
      name: z.string().optional(),
      urlKey: z.string().optional(),
    })
    .optional(),
});

export function getViewerTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_get_viewer',
    description: 'Retrieve the currently authenticated Linear user.',
    inputSchema: getViewerInputSchema,
    outputSchema: getViewerOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getViewerOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://linear.app/developers/graphql
        endpoint: '/graphql',
        data: {
          query: `
                    query {
                        viewer {
                            id
                            name
                            email
                            avatarUrl
                            displayName
                            organization {
                                id
                                name
                                urlKey
                            }
                        }
                    }
                `,
        },
        retries: 3,
      });

      const raw = response.data;
      if (!raw || typeof raw !== 'object') {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Unexpected response from Linear API',
        });
      }

      const responseShape = z
        .object({
          data: z
            .object({
              viewer: z.unknown(),
            })
            .optional(),
        })
        .parse(raw);

      const viewerData = responseShape.data?.viewer;
      if (!viewerData || typeof viewerData !== 'object') {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Viewer not found in response',
        });
      }

      const providerViewer = ProviderViewerSchema.parse(viewerData);

      return {
        id: providerViewer.id,
        ...(providerViewer.name != null && { name: providerViewer.name }),
        ...(providerViewer.email != null && { email: providerViewer.email }),
        ...(providerViewer.avatarUrl != null && { avatarUrl: providerViewer.avatarUrl }),
        ...(providerViewer.displayName != null && { displayName: providerViewer.displayName }),
        ...(providerViewer.organization != null && {
          organization: {
            id: providerViewer.organization.id,
            ...(providerViewer.organization.name != null && { name: providerViewer.organization.name }),
            ...(providerViewer.organization.urlKey != null && { urlKey: providerViewer.organization.urlKey }),
          },
        }),
      };
    },
  });
}
