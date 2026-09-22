// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getProjectInputSchema = z.object({
  projectId: z
    .string()
    .describe('The unique identifier of the Linear project. Example: "7b277fbc-8b76-4cdc-ad25-cd735ca33d0c"'),
});

const ProviderLeadSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
});

const ProviderProjectSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional(),
  startedAt: z.string().nullable().optional(),
  canceledAt: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  lead: ProviderLeadSchema.nullable().optional(),
  progress: z.number().nullable().optional(),
});

export const getProjectOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  lead: z
    .object({
      id: z.string(),
      name: z.string().optional(),
      email: z.string().optional(),
    })
    .optional(),
  progress: z.number().optional(),
  startDate: z.string().optional(),
  targetDate: z.string().optional(),
  startedAt: z.string().optional(),
  canceledAt: z.string().optional(),
  completedAt: z.string().optional(),
});

export function getProjectTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_get_project',
    description: 'Retrieve a Linear project by project ID.',
    inputSchema: getProjectInputSchema,
    outputSchema: getProjectOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getProjectOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://linear.app/developers/graphql
        endpoint: '/graphql',
        data: {
          query: `
                    query Project($id: String!) {
                        project(id: $id) {
                            id
                            name
                            description
                            state
                            startDate
                            targetDate
                            startedAt
                            canceledAt
                            completedAt
                            lead {
                                id
                                name
                                email
                            }
                            progress
                        }
                    }
                `,
          variables: {
            id: input.projectId,
          },
        },
        retries: 3,
      });

      if (response.data?.errors && response.data.errors.length > 0) {
        throw new platformProxy.ActionError({
          type: 'graphql_error',
          message: response.data.errors[0].message,
        });
      }

      if (!response.data?.data?.project) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `Project with ID "${input.projectId}" not found.`,
        });
      }

      const project = ProviderProjectSchema.parse(response.data.data.project);

      return {
        id: project.id,
        ...(project.name != null && { name: project.name }),
        ...(project.description != null && { description: project.description }),
        ...(project.state != null && { status: project.state }),
        ...(project.lead != null && {
          lead: {
            id: project.lead.id,
            ...(project.lead.name != null && { name: project.lead.name }),
            ...(project.lead.email != null && { email: project.lead.email }),
          },
        }),
        ...(project.progress != null && { progress: project.progress }),
        ...(project.startDate != null && { startDate: project.startDate }),
        ...(project.targetDate != null && { targetDate: project.targetDate }),
        ...(project.startedAt != null && { startedAt: project.startedAt }),
        ...(project.canceledAt != null && { canceledAt: project.canceledAt }),
        ...(project.completedAt != null && { completedAt: project.completedAt }),
      };
    },
  });
}
