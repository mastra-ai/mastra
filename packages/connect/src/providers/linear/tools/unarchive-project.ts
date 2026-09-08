// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const unarchiveProjectInputSchema = z.object({
  projectId: z
    .string()
    .describe('The identifier of the project to restore. Example: "123e4567-e89b-12d3-a456-426614174000"'),
});

const ProviderProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  slugId: z.string(),
  state: z.string().optional(),
  archivedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  url: z.string().optional(),
});

const ProviderResponseSchema = z.object({
  data: z.object({
    projectUnarchive: z.object({
      success: z.boolean(),
      lastSyncId: z.number(),
      entity: ProviderProjectSchema.nullable(),
    }),
  }),
});

export const unarchiveProjectOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  slugId: z.string(),
  state: z.string().optional(),
  archivedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  url: z.string().optional(),
});

export function unarchiveProjectTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_unarchive_project',
    description: 'Restore an archived Linear project.',
    inputSchema: unarchiveProjectInputSchema,
    outputSchema: unarchiveProjectOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof unarchiveProjectOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://linear.app/developers/graphql
        endpoint: '/graphql',
        data: {
          query: `
                    mutation projectUnarchive($id: String!) {
                        projectUnarchive(id: $id) {
                            success
                            lastSyncId
                            entity {
                                id
                                name
                                slugId
                                state
                                archivedAt
                                createdAt
                                updatedAt
                                url
                            }
                        }
                    }
                `,
          variables: {
            id: input.projectId,
          },
        },
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);
      const project = providerResponse.data.projectUnarchive.entity;

      if (!project) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Project not found or was deleted',
          projectId: input.projectId,
        });
      }

      return {
        id: project.id,
        name: project.name,
        slugId: project.slugId,
        ...(project.state !== undefined && { state: project.state }),
        ...(project.archivedAt !== undefined && { archivedAt: project.archivedAt }),
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        ...(project.url !== undefined && { url: project.url }),
      };
    },
  });
}
