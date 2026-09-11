// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listCyclesInputSchema = z.object({
  first: z.number().optional().describe('Number of cycles to return. Example: 10'),
  after: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
  filter: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Cycle filter object. Example: { team: { id: { eq: "team-id" } } }'),
  orderBy: z.string().optional().describe('Order by field. Example: "updatedAt" or "createdAt"'),
});

const TeamSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
});

const ProviderCycleSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  number: z.number().nullable().optional(),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
  team: TeamSchema.nullable().optional(),
});

const PageInfoSchema = z.object({
  hasNextPage: z.boolean(),
  endCursor: z.string().nullable().optional(),
});

const ProviderCyclesResponseSchema = z.object({
  data: z.object({
    cycles: z.object({
      nodes: z.array(z.unknown()),
      pageInfo: PageInfoSchema,
    }),
  }),
});

const OutputCycleSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  number: z.number().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  completedAt: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  team: TeamSchema.optional(),
});

export const listCyclesOutputSchema = z.object({
  nodes: z.array(OutputCycleSchema),
  pageInfo: PageInfoSchema,
});

export function listCyclesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_list_cycles',
    description: 'List Linear cycles with filtering and pagination.',
    inputSchema: listCyclesInputSchema,
    outputSchema: listCyclesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listCyclesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const query = `
            query Cycles($first: Int, $after: String, $filter: CycleFilter, $orderBy: PaginationOrderBy) {
                cycles(first: $first, after: $after, filter: $filter, orderBy: $orderBy) {
                    nodes {
                        id
                        name
                        number
                        startsAt
                        endsAt
                        completedAt
                        createdAt
                        updatedAt
                        team {
                            id
                            name
                        }
                    }
                    pageInfo {
                        hasNextPage
                        endCursor
                    }
                }
            }
        `;

      const variables: Record<string, unknown> = {};
      if (input.first !== undefined) {
        variables['first'] = input.first;
      }
      if (input.after !== undefined) {
        variables['after'] = input.after;
      }
      if (input.filter !== undefined) {
        variables['filter'] = input.filter;
      }
      if (input.orderBy !== undefined) {
        variables['orderBy'] = input.orderBy;
      }

      const response = await platformProxy.post({
        // https://linear.app/developers/graphql
        endpoint: '/graphql',
        data: {
          query,
          variables,
        },
        retries: 3,
      });

      const parsed = ProviderCyclesResponseSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Unexpected response structure from Linear API',
          details: parsed.error.message,
        });
      }

      const cyclesData = parsed.data.data.cycles;
      const nodes = cyclesData.nodes;
      const pageInfo = cyclesData.pageInfo;

      const mappedNodes = nodes
        .map(node => {
          const parsedNode = ProviderCycleSchema.safeParse(node);
          if (!parsedNode.success) {
            return null;
          }

          const cycle = parsedNode.data;
          return {
            id: cycle.id,
            ...(cycle.name !== undefined && cycle.name !== null && { name: cycle.name }),
            ...(cycle.number !== undefined && cycle.number !== null && { number: cycle.number }),
            ...(cycle.startsAt !== undefined && cycle.startsAt !== null && { startsAt: cycle.startsAt }),
            ...(cycle.endsAt !== undefined && cycle.endsAt !== null && { endsAt: cycle.endsAt }),
            ...(cycle.completedAt !== undefined && cycle.completedAt !== null && { completedAt: cycle.completedAt }),
            ...(cycle.createdAt !== undefined && cycle.createdAt !== null && { createdAt: cycle.createdAt }),
            ...(cycle.updatedAt !== undefined && cycle.updatedAt !== null && { updatedAt: cycle.updatedAt }),
            ...(cycle.team !== undefined &&
              cycle.team !== null && {
                team: {
                  id: cycle.team.id,
                  ...(cycle.team.name !== undefined && cycle.team.name !== null && { name: cycle.team.name }),
                },
              }),
          };
        })
        .filter(item => item !== null);

      return {
        nodes: mappedNodes,
        pageInfo: {
          hasNextPage: pageInfo.hasNextPage,
          endCursor: pageInfo.endCursor ?? null,
        },
      };
    },
  });
}
