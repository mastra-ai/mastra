// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createProjectInputSchema = z.object({
  name: z.string().describe('The name of the project.'),
  description: z.string().optional().describe('The description for the project.'),
  leadId: z.string().optional().describe('The identifier of the project lead.'),
  teamIds: z.array(z.string()).describe('The identifiers of the teams this project is associated with.'),
  targetDate: z.string().optional().describe('The planned target date of the project in ISO date format.'),
  startDate: z.string().optional().describe('The planned start date of the project in ISO date format.'),
  status: z
    .string()
    .optional()
    .describe('The state of the project (e.g. planned, started, paused, completed, canceled).'),
});

const ProviderProjectStatusSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const ProviderUserSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const ProviderProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  slugId: z.string().nullable(),
  url: z.string().nullable(),
  state: z.string().nullable(),
  status: ProviderProjectStatusSchema.nullable(),
  lead: ProviderUserSchema.nullable(),
  teams: z
    .object({
      nodes: z.array(z.object({ id: z.string(), name: z.string() })),
    })
    .nullable(),
  startDate: z.string().nullable(),
  targetDate: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

const ProviderPayloadSchema = z.object({
  data: z
    .object({
      projectCreate: z
        .object({
          success: z.boolean(),
          project: ProviderProjectSchema.nullable(),
        })
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
  errors: z
    .array(
      z.object({
        message: z.string(),
        path: z.array(z.string().or(z.number())).optional(),
      }),
    )
    .optional(),
});

export const createProjectOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  slugId: z.string().optional(),
  url: z.string().optional(),
  state: z.string().optional(),
  status: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
  lead: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
  teamIds: z.array(z.string()).optional(),
  startDate: z.string().optional(),
  targetDate: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export function createProjectTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_create_project',
    description: 'Create a Linear project.',
    inputSchema: createProjectInputSchema,
    outputSchema: createProjectOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createProjectOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const mutation = `
            mutation CreateProject($input: ProjectCreateInput!) {
                projectCreate(input: $input) {
                    success
                    project {
                        id
                        name
                        description
                        slugId
                        url
                        state
                        status {
                            id
                            name
                        }
                        lead {
                            id
                            name
                        }
                        teams {
                            nodes {
                                id
                                name
                            }
                        }
                        startDate
                        targetDate
                        createdAt
                        updatedAt
                    }
                }
            }
        `;

      const variables: Record<string, unknown> = {
        name: input.name,
        teamIds: input.teamIds,
      };

      if (input.description !== undefined) {
        variables['description'] = input.description;
      }
      if (input.leadId !== undefined) {
        variables['leadId'] = input.leadId;
      }
      if (input.targetDate !== undefined) {
        variables['targetDate'] = input.targetDate;
      }
      if (input.startDate !== undefined) {
        variables['startDate'] = input.startDate;
      }
      if (input.status !== undefined) {
        variables['state'] = input.status;
      }

      // https://linear.app/developers/graphql
      const response = await platformProxy.post({
        endpoint: '/graphql',
        data: {
          query: mutation,
          variables: {
            input: variables,
          },
        },
        retries: 10,
      });

      const parsed = ProviderPayloadSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Failed to parse project creation response.',
          details: parsed.error.message,
        });
      }

      if (parsed.data.errors && parsed.data.errors.length > 0) {
        const errorMessages = parsed.data.errors.map(err => err.message).join('; ');
        throw new platformProxy.ActionError({
          type: 'graphql_error',
          message: errorMessages,
        });
      }

      const payload = parsed.data.data?.projectCreate;
      if (!payload || !payload.success || !payload.project) {
        throw new platformProxy.ActionError({
          type: 'creation_failed',
          message: 'Project creation was not successful or project data is missing.',
        });
      }

      const project = payload.project;

      return {
        id: project.id,
        name: project.name,
        ...(project.description != null && { description: project.description }),
        ...(project.slugId != null && { slugId: project.slugId }),
        ...(project.url != null && { url: project.url }),
        ...(project.state != null && { state: project.state }),
        ...(project.status != null && {
          status: {
            id: project.status.id,
            name: project.status.name,
          },
        }),
        ...(project.lead != null && {
          lead: {
            id: project.lead.id,
            name: project.lead.name,
          },
        }),
        ...(project.teams != null && {
          teamIds: project.teams.nodes.map(team => team.id),
        }),
        ...(project.startDate != null && { startDate: project.startDate }),
        ...(project.targetDate != null && { targetDate: project.targetDate }),
        ...(project.createdAt != null && { createdAt: project.createdAt }),
        ...(project.updatedAt != null && { updatedAt: project.updatedAt }),
      };
    },
  });
}
