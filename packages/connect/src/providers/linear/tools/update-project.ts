// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateProjectInputSchema = z.object({
  projectId: z.string().describe('The identifier of the project to update. Example: "project-uuid"'),
  name: z.string().optional().describe('The new name of the project.'),
  description: z.string().optional().describe('The new description of the project.'),
  status: z.string().optional().describe('The ID of the project status to set.'),
  targetDate: z
    .string()
    .optional()
    .describe('The planned target date of the project in ISO 8601 format. Example: "2025-12-31"'),
  leadId: z.string().optional().describe('The identifier of the project lead. Example: "user-uuid"'),
});

const ProviderStatusSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
});

const ProviderProjectSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  status: ProviderStatusSchema.nullable().optional(),
  targetDate: z.string().nullable().optional(),
  slugId: z.string().nullable().optional(),
  lead: z.object({ id: z.string() }).nullable().optional(),
  url: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
});

export const updateProjectOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  state: z.string().optional(),
  status: z
    .object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
    })
    .optional(),
  targetDate: z.string().optional(),
  slugId: z.string().optional(),
  leadId: z.string().optional(),
  url: z.string().optional(),
  updatedAt: z.string().optional(),
  createdAt: z.string().optional(),
});

const GraphQLResponseSchema = z.object({
  data: z
    .object({
      projectUpdate: z
        .object({
          success: z.boolean(),
          project: ProviderProjectSchema.nullable().optional(),
        })
        .optional(),
    })
    .optional(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

export function updateProjectTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_update_project',
    description: 'Update an existing Linear project.',
    inputSchema: updateProjectInputSchema,
    outputSchema: updateProjectOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateProjectOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const updateInput: Record<string, unknown> = {};
      if (input.name !== undefined) {
        updateInput['name'] = input.name;
      }
      if (input.description !== undefined) {
        updateInput['description'] = input.description;
      }
      if (input.status !== undefined) {
        updateInput['statusId'] = input.status;
      }
      if (input.targetDate !== undefined) {
        updateInput['targetDate'] = input.targetDate;
      }
      if (input.leadId !== undefined) {
        updateInput['leadId'] = input.leadId;
      }

      const response = await platformProxy.post({
        // https://linear.app/developers/graphql
        endpoint: '/graphql',
        data: {
          query: `
                    mutation ProjectUpdate($id: String!, $input: ProjectUpdateInput!) {
                        projectUpdate(id: $id, input: $input) {
                            success
                            project {
                                id
                                name
                                description
                                state
                                status {
                                    id
                                    name
                                    type
                                }
                                targetDate
                                slugId
                                lead {
                                    id
                                }
                                url
                                updatedAt
                                createdAt
                            }
                        }
                    }
                `,
          variables: {
            id: input.projectId,
            input: updateInput,
          },
        },
        retries: 3,
      });

      const parsedBody = GraphQLResponseSchema.parse(response.data);

      if (parsedBody.errors && parsedBody.errors.length > 0) {
        throw new platformProxy.ActionError({
          type: 'graphql_error',
          message: parsedBody.errors.map(e => e.message).join(', '),
        });
      }

      const payload = parsedBody.data?.projectUpdate;
      if (!payload || !payload.success || !payload.project) {
        throw new platformProxy.ActionError({
          type: 'update_failed',
          message: 'Failed to update project',
        });
      }

      const project = payload.project;

      return {
        id: project.id,
        name: project.name ?? '',
        ...(project.description != null && { description: project.description }),
        ...(project.state != null && { state: project.state }),
        ...(project.status != null && {
          status: {
            id: project.status.id,
            name: project.status.name,
            type: project.status.type,
          },
        }),
        ...(project.targetDate != null && { targetDate: project.targetDate }),
        ...(project.slugId != null && { slugId: project.slugId }),
        ...(project.lead != null && { leadId: project.lead.id }),
        ...(project.url != null && { url: project.url }),
        ...(project.updatedAt != null && { updatedAt: project.updatedAt }),
        ...(project.createdAt != null && { createdAt: project.createdAt }),
      };
    },
  });
}
