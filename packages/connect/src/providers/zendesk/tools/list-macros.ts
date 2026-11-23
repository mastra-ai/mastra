// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listMacrosInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
  per_page: z.number().int().min(1).max(100).optional().describe('Number of records to return per page. Maximum 100.'),
  active: z.boolean().optional().describe('Filter by active macros if true or inactive macros if false'),
  access: z.enum(['personal', 'agents', 'shared', 'account']).optional().describe('Filter macros by access level'),
  category: z.number().int().optional().describe('Filter macros by category ID'),
  group_id: z.number().int().optional().describe('Filter macros by group ID'),
  only_viewable: z.boolean().optional().describe('If true, returns only macros that can be applied to tickets'),
  sort_by: z
    .enum(['alphabetical', 'created_at', 'updated_at'])
    .optional()
    .describe('Sort field. Defaults to alphabetical'),
  sort_order: z
    .enum(['asc', 'desc'])
    .optional()
    .describe('Sort order. Defaults to asc for alphabetical and position sort, desc for others'),
});

const MacroActionSchema = z.object({
  field: z.string(),
  value: z.unknown(),
});

const MacroRestrictionSchema = z
  .object({
    type: z.string().optional(),
    id: z.number().int().optional(),
    ids: z.array(z.number().int()).optional(),
  })
  .passthrough();

const ProviderMacroSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  raw_title: z.string().optional(),
  description: z.string().optional().nullable(),
  active: z.boolean().optional(),
  default: z.boolean().optional(),
  position: z.number().int().optional(),
  actions: z.array(MacroActionSchema).optional(),
  restriction: MacroRestrictionSchema.nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  url: z.string().optional(),
});

const ProviderResponseSchema = z.object({
  macros: z.array(ProviderMacroSchema),
  meta: z.object({ has_more: z.boolean().optional(), after_cursor: z.string().nullish() }).optional(),
  next_page: z.string().optional().nullable(),
  previous_page: z.string().optional().nullable(),
  count: z.number().int().optional(),
});

const MacroOutputSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  raw_title: z.string().optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
  default: z.boolean().optional(),
  position: z.number().int().optional(),
  actions: z.array(MacroActionSchema).optional(),
  restriction: MacroRestrictionSchema.optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  url: z.string().optional(),
});

export const listMacrosOutputSchema = z.object({
  macros: z.array(MacroOutputSchema),
  next_cursor: z.string().optional(),
});

export function listMacrosTool(proxy: PlatformProxy) {
  return createTool({
    id: 'zendesk_list_macros',
    description: 'List ticket macros available to the account',
    inputSchema: listMacrosInputSchema,
    outputSchema: listMacrosOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listMacrosOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number> = {};

      if (input.cursor) {
        params['page[after]'] = input.cursor;
      }
      params['page[size]'] = input.per_page ?? 100;
      if (input.active !== undefined) {
        params['active'] = String(input.active);
      }
      if (input.access !== undefined) {
        params['access'] = input.access;
      }
      if (input.category !== undefined) {
        params['category'] = input.category;
      }
      if (input.group_id !== undefined) {
        params['group_id'] = input.group_id;
      }
      if (input.only_viewable !== undefined) {
        params['only_viewable'] = String(input.only_viewable);
      }
      if (input.sort_by !== undefined || input.sort_order !== undefined) {
        const sortBy = input.sort_by ?? 'alphabetical';
        const sortOrder = input.sort_order ?? (sortBy === 'alphabetical' ? 'asc' : 'desc');
        params['sort'] = `${sortOrder === 'desc' ? '-' : ''}${sortBy}`;
      }

      const response = await platformProxy.get({
        // https://developer.zendesk.com/api-reference/ticketing/business-rules/macros/#list-macros
        endpoint: '/api/v2/macros.json',
        params,
        retries: 3,
      });

      const providerData = ProviderResponseSchema.parse(response.data);

      const macros = providerData.macros.map(macro => ({
        id: macro.id,
        title: macro.title,
        ...(macro.raw_title !== undefined && { raw_title: macro.raw_title }),
        ...(macro.description !== undefined && macro.description !== null && { description: macro.description }),
        ...(macro.active !== undefined && { active: macro.active }),
        ...(macro.default !== undefined && { default: macro.default }),
        ...(macro.position !== undefined && { position: macro.position }),
        ...(macro.actions !== undefined && { actions: macro.actions }),
        ...(macro.restriction !== undefined && macro.restriction !== null && { restriction: macro.restriction }),
        ...(macro.created_at !== undefined && { created_at: macro.created_at }),
        ...(macro.updated_at !== undefined && { updated_at: macro.updated_at }),
        ...(macro.url !== undefined && { url: macro.url }),
      }));

      const next_cursor =
        providerData.meta?.has_more && providerData.meta.after_cursor ? providerData.meta.after_cursor : undefined;

      return {
        macros,
        ...(next_cursor !== undefined && { next_cursor }),
      };
    },
  });
}
