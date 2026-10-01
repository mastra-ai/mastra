// AUTO-GENERATED from arctic-char/integration-templates @ a1e633120274 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const insertTableInputSchema = z
  .object({
    documentId: z.string().describe('Google Docs document ID. Example: "1Kj3d86Z-Sfd56YP4dImQ-ggMRyP2QZ_BRO33zOO224c"'),
    rows: z.number().int().min(1).describe('Number of rows in the table. Example: 3'),
    columns: z.number().int().min(1).describe('Number of columns in the table. Example: 3'),
    location: z
      .object({
        index: z.number().int().min(1).describe('The insertion index in the document body.'),
        segmentId: z.string().optional().describe('The segment ID; empty string targets the body segment.'),
      })
      .optional(),
    endOfSegmentLocation: z
      .object({
        segmentId: z.string().optional().describe('The segment ID; empty string targets the body segment.'),
      })
      .optional(),
  })
  .refine(data => data.location !== undefined || data.endOfSegmentLocation !== undefined, {
    message: 'Either location or endOfSegmentLocation must be provided.',
  })
  .refine(data => !(data.location !== undefined && data.endOfSegmentLocation !== undefined), {
    message: 'Only one of location or endOfSegmentLocation may be provided, not both.',
  });

const TableStartLocationSchema = z.object({
  index: z.number().int(),
  segmentId: z.string().optional(),
});

export const insertTableOutputSchema = z.object({
  documentId: z.string(),
  rows: z.number().int(),
  columns: z.number().int(),
  tableStartLocation: TableStartLocationSchema.optional(),
});

const BatchUpdateResponseSchema = z.object({
  replies: z.array(
    z.object({
      insertTable: z
        .object({
          tableStartLocation: TableStartLocationSchema,
        })
        .optional(),
    }),
  ),
});

const DocumentSchema = z.object({
  body: z
    .object({
      content: z
        .array(
          z.object({
            startIndex: z.number().int().optional(),
            table: z.object({}).optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

export function insertTableTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_docs_insert_table',
    description: 'Insert a table with a given row and column count.',
    inputSchema: insertTableInputSchema,
    outputSchema: insertTableOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof insertTableOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const requestBody: Record<string, unknown> = {
        requests: [
          {
            insertTable: {
              rows: input.rows,
              columns: input.columns,
              ...(input.location !== undefined && {
                location: {
                  index: input.location.index,
                  ...(input.location.segmentId !== undefined && { segmentId: input.location.segmentId }),
                },
              }),
              ...(input.endOfSegmentLocation !== undefined && {
                endOfSegmentLocation: {
                  ...(input.endOfSegmentLocation.segmentId !== undefined && {
                    segmentId: input.endOfSegmentLocation.segmentId,
                  }),
                },
              }),
            },
          },
        ],
      };

      // https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
      const response = await platformProxy.post({
        endpoint: `/v1/documents/${encodeURIComponent(input.documentId)}:batchUpdate`,
        data: requestBody,
        retries: 3,
      });

      const batchResponse = BatchUpdateResponseSchema.parse(response.data);
      const insertTableReply = batchResponse.replies[0]?.insertTable;

      if (insertTableReply !== undefined) {
        return {
          documentId: input.documentId,
          rows: input.rows,
          columns: input.columns,
          tableStartLocation: {
            index: insertTableReply.tableStartLocation.index,
            ...(insertTableReply.tableStartLocation.segmentId !== undefined && {
              segmentId: insertTableReply.tableStartLocation.segmentId,
            }),
          },
        };
      }

      if (input.location !== undefined) {
        return {
          documentId: input.documentId,
          rows: input.rows,
          columns: input.columns,
          tableStartLocation: {
            index: input.location.index + 1,
            ...(input.location.segmentId !== undefined && { segmentId: input.location.segmentId }),
          },
        };
      }

      // endOfSegmentLocation with a non-body segmentId (headers/footers) is not supported
      // in the fallback path — only the body segment can be searched here.
      if (input.endOfSegmentLocation?.segmentId) {
        throw new platformProxy.ActionError({
          type: 'unsupported_operation',
          message:
            'Unable to determine table start location when inserting into a non-body segment via endOfSegmentLocation. Use a location with an explicit index instead.',
        });
      }

      // https://developers.google.com/docs/api/reference/rest/v1/documents/get
      const getResponse = await platformProxy.get({
        endpoint: `/v1/documents/${encodeURIComponent(input.documentId)}`,
        retries: 3,
      });

      const document = DocumentSchema.parse(getResponse.data);
      const tables: Array<{ startIndex: number }> = [];
      for (const item of document.body?.content ?? []) {
        if (item.table !== undefined && item.startIndex !== undefined) {
          tables.push({ startIndex: item.startIndex });
        }
      }
      const lastTable = tables[tables.length - 1];

      if (lastTable === undefined) {
        throw new platformProxy.ActionError({
          type: 'table_not_found',
          message: 'Unable to determine table start location after insertion.',
        });
      }

      return {
        documentId: input.documentId,
        rows: input.rows,
        columns: input.columns,
        tableStartLocation: {
          index: lastTable.startIndex,
          ...(input.endOfSegmentLocation?.segmentId !== undefined && {
            segmentId: input.endOfSegmentLocation.segmentId,
          }),
        },
      };
    },
  });
}
