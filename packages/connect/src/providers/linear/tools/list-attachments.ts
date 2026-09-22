// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listAttachmentsInputSchema = z.object({
  first: z.number().optional().describe('The number of items to forward paginate. Defaults to 50.'),
  after: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
  filter: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Filter returned attachments using Linear AttachmentFilter fields.'),
  orderBy: z
    .enum(['createdAt', 'updatedAt'])
    .optional()
    .describe('By which field should the pagination order. Available options are createdAt (default) and updatedAt.'),
});

const PageInfoSchema = z.object({
  hasNextPage: z.boolean(),
  endCursor: z.string().nullable().optional(),
});

const AttachmentSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().nullable().optional(),
  title: z.string(),
  subtitle: z.string().nullable().optional(),
  url: z.string(),
  sourceType: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()),
  groupBySource: z.boolean(),
  bodyData: z.string().nullable().optional(),
  creator: z
    .object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    })
    .nullable()
    .optional(),
  externalUserCreator: z
    .object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    })
    .nullable()
    .optional(),
  issue: z.object({
    id: z.string(),
    identifier: z.string(),
    title: z.string(),
  }),
  originalIssue: z
    .object({
      id: z.string(),
      identifier: z.string(),
      title: z.string(),
    })
    .nullable()
    .optional(),
});

export const listAttachmentsOutputSchema = z.object({
  items: z.array(AttachmentSchema),
  pageInfo: PageInfoSchema,
  nextCursor: z.string().optional().describe('Cursor for the next page of results, if available.'),
});

export function listAttachmentsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_list_attachments',
    description: 'List Linear attachments with filtering and pagination.',
    inputSchema: listAttachmentsInputSchema,
    outputSchema: listAttachmentsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listAttachmentsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const query = `
            query Attachments($first: Int, $after: String, $filter: AttachmentFilter, $orderBy: PaginationOrderBy) {
                attachments(first: $first, after: $after, filter: $filter, orderBy: $orderBy) {
                    nodes {
                        id
                        createdAt
                        updatedAt
                        archivedAt
                        title
                        subtitle
                        url
                        sourceType
                        metadata
                        groupBySource
                        bodyData
                        creator {
                            id
                            name
                            email
                        }
                        externalUserCreator {
                            id
                            name
                            email
                        }
                        issue {
                            id
                            identifier
                            title
                        }
                        originalIssue {
                            id
                            identifier
                            title
                        }
                    }
                    pageInfo {
                        hasNextPage
                        endCursor
                    }
                }
            }
        `;

      // https://linear.app/developers/attachments
      const response = await platformProxy.post({
        endpoint: '/graphql',
        data: {
          query,
          variables: {
            ...(input.first !== undefined && { first: input.first }),
            ...(input.after !== undefined && { after: input.after }),
            ...(input.filter !== undefined && { filter: input.filter }),
            ...(input.orderBy !== undefined && { orderBy: input.orderBy }),
          },
        },
        retries: 3,
      });

      if (!response.data || typeof response.data !== 'object') {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Received invalid response from Linear API.',
        });
      }

      const responseData = response.data;
      const errors = 'errors' in responseData ? responseData.errors : undefined;

      if (errors) {
        throw new platformProxy.ActionError({
          type: 'graphql_error',
          message: 'Linear GraphQL API returned errors.',
          errors,
        });
      }

      const dataField = 'data' in responseData ? responseData.data : undefined;
      const attachmentsData =
        typeof dataField === 'object' && dataField !== null && 'attachments' in dataField
          ? dataField.attachments
          : undefined;

      if (!attachmentsData || typeof attachmentsData !== 'object') {
        throw new platformProxy.ActionError({
          type: 'missing_data',
          message: 'Missing attachments data in GraphQL response.',
        });
      }

      const nodes = 'nodes' in attachmentsData ? attachmentsData.nodes : undefined;
      const pageInfo = 'pageInfo' in attachmentsData ? attachmentsData.pageInfo : undefined;

      if (!Array.isArray(nodes)) {
        throw new platformProxy.ActionError({
          type: 'invalid_data',
          message: 'Attachments nodes is not an array.',
        });
      }

      if (!pageInfo || typeof pageInfo !== 'object') {
        throw new platformProxy.ActionError({
          type: 'invalid_data',
          message: 'Attachments pageInfo is missing or invalid.',
        });
      }

      const parsedPageInfo = PageInfoSchema.parse(pageInfo);
      const parsedItems = nodes.map(node => AttachmentSchema.parse(node));

      return {
        items: parsedItems,
        pageInfo: parsedPageInfo,
        ...(parsedPageInfo.endCursor != null && parsedPageInfo.hasNextPage && { nextCursor: parsedPageInfo.endCursor }),
      };
    },
  });
}
