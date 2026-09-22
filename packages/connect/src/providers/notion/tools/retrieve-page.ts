// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const retrievePageInputSchema = z.object({
  page_id: z.string().describe('The ID of the page to retrieve. Example: "b55c9c91-384d-452b-81db-d1ef79372b75"'),
});

const ParentSchema = z
  .object({
    type: z.string(),
    database_id: z.string().optional(),
    page_id: z.string().optional(),
    workspace: z.boolean().optional(),
    block_id: z.string().optional(),
  })
  .passthrough();

const UserSchema = z
  .object({
    id: z.string(),
    object: z.string(),
  })
  .passthrough();

const IconSchema = z
  .union([
    z.object({
      type: z.literal('emoji'),
      emoji: z.string(),
    }),
    z.object({
      type: z.literal('external'),
      external: z.object({ url: z.string() }),
    }),
    z.object({
      type: z.literal('file'),
      file: z.object({ url: z.string(), expiry_time: z.string() }),
    }),
    z.object({
      type: z.literal('custom_emoji'),
      custom_emoji: z.object({ id: z.string(), name: z.string(), url: z.string() }),
    }),
    z.object({
      type: z.literal('icon'),
      icon: z.object({ name: z.string(), color: z.string() }),
    }),
  ])
  .nullable();

const CoverSchema = z
  .union([
    z.object({
      type: z.literal('external'),
      external: z.object({ url: z.string() }),
    }),
    z.object({
      type: z.literal('file'),
      file: z.object({ url: z.string(), expiry_time: z.string() }),
    }),
  ])
  .nullable();

const ProviderPageSchema = z
  .object({
    object: z.literal('page'),
    id: z.string(),
    created_time: z.string(),
    last_edited_time: z.string(),
    in_trash: z.boolean(),
    is_archived: z.boolean(),
    is_locked: z.boolean(),
    url: z.string(),
    public_url: z.string().nullable(),
    parent: ParentSchema,
    properties: z.object({}).passthrough(),
    icon: IconSchema,
    cover: CoverSchema,
    created_by: UserSchema,
    last_edited_by: UserSchema,
  })
  .passthrough();

export const retrievePageOutputSchema = z.object({
  id: z.string(),
  object: z.literal('page'),
  created_time: z.string(),
  last_edited_time: z.string(),
  in_trash: z.boolean(),
  is_archived: z.boolean(),
  is_locked: z.boolean(),
  url: z.string(),
  public_url: z.string().optional(),
  parent: ParentSchema,
  properties: z.object({}).passthrough(),
  icon: IconSchema,
  cover: CoverSchema,
  created_by: UserSchema,
  last_edited_by: UserSchema,
});

export function retrievePageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'notion_retrieve_page',
    description: 'Retrieve a Notion page and its property values.',
    inputSchema: retrievePageInputSchema,
    outputSchema: retrievePageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof retrievePageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.notion.com/reference/retrieve-a-page
      const response = await platformProxy.get({
        endpoint: `/v1/pages/${encodeURIComponent(input.page_id)}`,
        retries: 3,
      });

      if (response.status === 404) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Page not found',
          page_id: input.page_id,
        });
      }

      if (response.status === 403) {
        throw new platformProxy.ActionError({
          type: 'forbidden',
          message: 'Access to the page is restricted',
          page_id: input.page_id,
        });
      }

      if (response.status === 429) {
        throw new platformProxy.ActionError({
          type: 'rate_limited',
          message: 'API rate limit exceeded',
          retry_after: response.headers['retry-after'],
        });
      }

      const providerPage = ProviderPageSchema.parse(response.data);

      return {
        id: providerPage.id,
        object: providerPage.object,
        created_time: providerPage.created_time,
        last_edited_time: providerPage.last_edited_time,
        in_trash: providerPage.in_trash,
        is_archived: providerPage.is_archived,
        is_locked: providerPage.is_locked,
        url: providerPage.url,
        ...(providerPage.public_url !== null && { public_url: providerPage.public_url }),
        parent: providerPage.parent,
        properties: providerPage.properties,
        icon: providerPage.icon,
        cover: providerPage.cover,
        created_by: providerPage.created_by,
        last_edited_by: providerPage.last_edited_by,
      };
    },
  });
}
