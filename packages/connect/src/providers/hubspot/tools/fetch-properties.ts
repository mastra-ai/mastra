// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const fetchPropertiesInputSchema = z.object({
  objectType: z
    .string()
    .describe(
      'The CRM object type to fetch properties for (e.g., contacts, companies, deals, tickets). Example: "companies"',
    ),
});

const PropertyOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
  displayOrder: z.number().optional(),
  hidden: z.boolean().optional(),
});

const PropertySchema = z.object({
  name: z.string().describe('Internal property name'),
  label: z.string().describe('Display name of the property'),
  type: z.string().describe('Data type (string, number, bool, datetime, enumeration, etc.)'),
  fieldType: z.string().describe('UI field type (text, select, checkbox, etc.)'),
  description: z.string().optional().describe('Property description'),
  groupName: z.string().optional().describe('Property group name'),
  readOnlyValue: z.boolean().describe('Whether the property is read-only'),
  hidden: z.boolean().describe('Whether the property is hidden'),
  archived: z.boolean().describe('Whether the property is archived'),
  options: z.array(PropertyOptionSchema).optional().describe('Available options for enumeration type properties'),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const fetchPropertiesOutputSchema = z.object({
  objectType: z.string().describe('The requested object type'),
  properties: z.array(PropertySchema).describe('List of property metadata for the object type'),
});

export function fetchPropertiesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_fetch_properties',
    description: 'List CRM property metadata for a specified HubSpot object type',
    inputSchema: fetchPropertiesInputSchema,
    outputSchema: fetchPropertiesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof fetchPropertiesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.hubspot.com/docs/api-reference/crm-properties-v3/guide
      const response = await platformProxy.get({
        endpoint: `/crm/v3/properties/${input.objectType}`,
        retries: 3,
      });

      if (!response.data?.results) {
        return {
          objectType: input.objectType,
          properties: [],
        };
      }

      const properties = response.data.results.map((prop: any) => ({
        name: prop.name,
        label: prop.label,
        type: prop.type,
        fieldType: prop.fieldType,
        description: prop.description ?? undefined,
        groupName: prop.groupName ?? undefined,
        readOnlyValue: prop.modificationMetadata?.readOnlyValue ?? false,
        hidden: prop.hidden ?? false,
        archived: prop.archived ?? false,
        options:
          prop.options?.map((opt: any) => ({
            label: opt.label,
            value: opt.value,
            displayOrder: opt.displayOrder,
            hidden: opt.hidden,
          })) ?? [],
        createdAt: prop.createdAt ?? undefined,
        updatedAt: prop.updatedAt ?? undefined,
      }));

      return {
        objectType: input.objectType,
        properties,
      };
    },
  });
}
