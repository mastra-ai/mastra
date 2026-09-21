// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createPropertyInputSchema = z.object({
  objectType: z
    .enum(['contacts', 'companies', 'deals', 'products', 'tickets', 'line_items'])
    .describe('The CRM object type for which the property will be created. Example: "contacts"'),
  name: z
    .string()
    .describe(
      'The internal name of the property (lowercase, alphanumeric and underscores only). Example: "favorite_food"',
    ),
  label: z.string().describe('The display name of the property as shown in HubSpot. Example: "Favorite Food"'),
  type: z
    .enum(['string', 'number', 'bool', 'enumeration', 'datetime', 'date', 'phone_number'])
    .describe('The data type of the property. Example: "string"'),
  fieldType: z
    .enum([
      'text',
      'textarea',
      'number',
      'date',
      'select',
      'checkbox',
      'radio',
      'booleancheckbox',
      'file',
      'calculation_equation',
      'calculation_rollup',
      'calculation_score',
      'calculation_date',
    ])
    .describe('The field type determines the input widget shown in HubSpot. Example: "text"'),
  groupName: z
    .string()
    .optional()
    .describe(
      'The property group the property belongs to. Defaults to "contactinformation". Example: "contactinformation"',
    ),
  description: z.string().optional().describe('A description of the property. Example: "The users favorite food"'),
  displayOrder: z.number().int().optional().describe('The order the property appears in its group. Example: 1'),
  options: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
        displayOrder: z.number().int().optional(),
        hidden: z.boolean().optional(),
      }),
    )
    .optional()
    .describe(
      'Required for enumeration field types (select, checkbox, radio). Array of option objects with label and value.',
    ),
});

export const createPropertyOutputSchema = z.object({
  name: z.string(),
  label: z.string(),
  type: z.string(),
  fieldType: z.string(),
  groupName: z.string(),
  description: z.string().optional(),
  displayOrder: z.number().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  archived: z.boolean(),
  archivedAt: z.string().optional(),
  options: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
        displayOrder: z.number().optional(),
        hidden: z.boolean(),
      }),
    )
    .optional(),
});

export function createPropertyTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_create_property',
    description: 'Create a custom CRM property for a specified HubSpot object type',
    inputSchema: createPropertyInputSchema,
    outputSchema: createPropertyOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createPropertyOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.hubspot.com/docs/api-reference/crm-properties-v3/properties/post-crm-v3-properties-objectType
      const response = await platformProxy.post({
        endpoint: `/crm/v3/properties/${input.objectType}`,
        data: {
          name: input.name,
          label: input.label,
          type: input.type,
          fieldType: input.fieldType,
          groupName: input.groupName ?? 'contactinformation',
          ...(input.description && { description: input.description }),
          ...(input.displayOrder !== undefined && { displayOrder: input.displayOrder }),
          ...(input.options &&
            input.options.length > 0 && {
              options: input.options.map(opt => ({
                label: opt.label,
                value: opt.value,
                ...(opt.displayOrder !== undefined && { displayOrder: opt.displayOrder }),
                ...(opt.hidden !== undefined && { hidden: opt.hidden }),
              })),
            }),
        },
        retries: 3,
      });

      const data = response.data;

      return {
        name: data.name,
        label: data.label,
        type: data.type,
        fieldType: data.fieldType,
        groupName: data.groupName,
        description: data.description ?? undefined,
        displayOrder: data.displayOrder ?? undefined,
        createdAt: data.createdAt ?? undefined,
        updatedAt: data.updatedAt ?? undefined,
        archived: data.archived ?? false,
        archivedAt: data.archivedAt ?? undefined,
        ...(data.options &&
          data.options.length > 0 && {
            options: data.options.map(
              (opt: { label: string; value: string; displayOrder?: number; hidden?: boolean }) => ({
                label: opt.label,
                value: opt.value,
                displayOrder: opt.displayOrder ?? undefined,
                hidden: opt.hidden ?? false,
              }),
            ),
          }),
      };
    },
  });
}
