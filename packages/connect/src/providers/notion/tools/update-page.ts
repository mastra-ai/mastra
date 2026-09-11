// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'object' && value !== null) {
    const result: Record<string, unknown> = Object(value);
    return result;
  }
  return undefined;
}

export const updatePageInputSchema = z.object({
  page_id: z.string().describe('The ID of the page to update.'),
  properties: z
    .unknown()
    .optional()
    .describe('Property values to update. Each key is the property name and the value is the property value object.'),
  icon: z
    .unknown()
    .optional()
    .describe('The icon for the page. Can be an emoji, external file, uploaded file, custom emoji, or Notion icon.'),
  cover: z.unknown().optional().describe('The cover image for the page. Can be an external file or uploaded file.'),
  is_locked: z.boolean().optional().describe('Whether the page should be locked from editing in the Notion app UI.'),
  in_trash: z.boolean().optional().describe('Whether the page should be moved to trash (true) or restored (false).'),
  is_archived: z.boolean().optional().describe('Whether the page should be archived.'),
});

export const updatePageOutputSchema = z.object({
  id: z.string(),
  object: z.string().optional(),
  created_time: z.string().optional(),
  last_edited_time: z.string().optional(),
  in_trash: z.boolean().optional(),
  is_archived: z.boolean().optional(),
  is_locked: z.boolean().optional(),
  url: z.string().optional(),
  public_url: z.string().nullable().optional(),
  parent: z.unknown().optional(),
  properties: z.unknown().optional(),
  icon: z.unknown().optional(),
  cover: z.unknown().optional(),
  created_by: z.unknown().optional(),
  last_edited_by: z.unknown().optional(),
});

export function updatePageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'notion_update_page',
    description: 'Update page properties and other mutable page fields.',
    inputSchema: updatePageInputSchema,
    outputSchema: updatePageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updatePageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const requestBody: Record<string, unknown> = {};

      if (input['properties'] !== undefined) {
        requestBody['properties'] = input['properties'];
      }
      if (input['icon'] !== undefined) {
        requestBody['icon'] = input['icon'];
      }
      if (input['cover'] !== undefined) {
        requestBody['cover'] = input['cover'];
      }
      if (input['is_locked'] !== undefined) {
        requestBody['is_locked'] = input['is_locked'];
      }
      if (input['in_trash'] !== undefined) {
        requestBody['in_trash'] = input['in_trash'];
      }
      if (input['is_archived'] !== undefined) {
        requestBody['is_archived'] = input['is_archived'];
      }

      // https://developers.notion.com/reference/patch-page
      const response = await platformProxy.patch({
        endpoint: `/v1/pages/${encodeURIComponent(input.page_id)}`,
        data: requestBody,
        retries: 3,
      });

      const page = response.data;
      if (typeof page !== 'object' || page === null) {
        throw new Error('Invalid response from Notion API');
      }

      const pageObj = toRecord(page);
      if (pageObj === undefined) {
        throw new Error('Invalid response from Notion API');
      }
      const pageId = pageObj['id'];
      if (typeof pageId !== 'string') {
        throw new Error('Invalid page ID in response');
      }

      const createdByObj = toRecord(pageObj['created_by']);
      const lastEditedByObj = toRecord(pageObj['last_edited_by']);

      return {
        id: pageId,
        ...(pageObj['object'] !== undefined && { object: 'page' }),
        ...(pageObj['created_time'] !== undefined && { created_time: String(pageObj['created_time']) }),
        ...(pageObj['last_edited_time'] !== undefined && { last_edited_time: String(pageObj['last_edited_time']) }),
        ...(pageObj['in_trash'] !== undefined && { in_trash: Boolean(pageObj['in_trash']) }),
        ...(pageObj['is_archived'] !== undefined && { is_archived: Boolean(pageObj['is_archived']) }),
        ...(pageObj['is_locked'] !== undefined && { is_locked: Boolean(pageObj['is_locked']) }),
        ...(pageObj['url'] !== undefined && { url: String(pageObj['url']) }),
        ...(pageObj['public_url'] !== undefined &&
          typeof pageObj['public_url'] === 'string' && { public_url: pageObj['public_url'] }),
        ...(pageObj['parent'] !== undefined && { parent: pageObj['parent'] }),
        ...(pageObj['properties'] !== undefined && { properties: pageObj['properties'] }),
        ...(pageObj['icon'] !== undefined && { icon: pageObj['icon'] }),
        ...(pageObj['cover'] !== undefined && { cover: pageObj['cover'] }),
        created_by:
          createdByObj !== undefined
            ? { id: String(createdByObj['id'] || ''), object: createdByObj['object'] ? 'user' : undefined }
            : undefined,
        last_edited_by:
          lastEditedByObj !== undefined
            ? { id: String(lastEditedByObj['id'] || ''), object: lastEditedByObj['object'] ? 'user' : undefined }
            : undefined,
      };
    },
  });
}
