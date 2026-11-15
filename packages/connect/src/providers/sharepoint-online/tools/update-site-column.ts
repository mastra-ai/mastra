// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateSiteColumnInputSchema = z.object({
  siteId: z.string().describe('SharePoint site ID. Example: "hostname,guid1,guid2"'),
  columnId: z.string().describe('Column ID. Example: "973ae66e-25b9-4c4a-a79c-ff14439de0ea"'),
  displayName: z.string().optional(),
  description: z.string().optional(),
  hidden: z.boolean().optional(),
  indexed: z.boolean().optional(),
  required: z.boolean().optional(),
  enforceUniqueValues: z.boolean().optional(),
  readOnly: z.boolean().optional(),
  columnGroup: z.string().optional(),
  text: z
    .object({
      allowMultipleLines: z.boolean().optional(),
      appendChangesToExistingText: z.boolean().optional(),
      linesForEditing: z.number().optional(),
      maxLength: z.number().optional(),
    })
    .optional(),
  number: z
    .object({
      decimalPlaces: z.string().optional(),
      displayAs: z.string().optional(),
      maximum: z.number().optional(),
      minimum: z.number().optional(),
    })
    .optional(),
  choice: z
    .object({
      choices: z.array(z.string()).optional(),
      displayAs: z.string().optional(),
    })
    .optional(),
  dateTime: z
    .object({
      displayAs: z.string().optional(),
      format: z.string().optional(),
    })
    .optional(),
  personOrGroup: z
    .object({
      allowMultipleSelection: z.boolean().optional(),
      displayAs: z.string().optional(),
      chooseFromType: z.string().optional(),
    })
    .optional(),
  lookup: z
    .object({
      allowMultipleValues: z.boolean().optional(),
      allowUnlimitedLength: z.boolean().optional(),
      columnName: z.string().optional(),
      listId: z.string().optional(),
      primaryLookupColumnId: z.string().optional(),
    })
    .optional(),
});

const ProviderColumnSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string().optional(),
  description: z.string().optional(),
  hidden: z.boolean().optional(),
  indexed: z.boolean().optional(),
  required: z.boolean().optional(),
  enforceUniqueValues: z.boolean().optional(),
  readOnly: z.boolean().optional(),
  columnGroup: z.string().optional(),
  text: z
    .object({
      allowMultipleLines: z.boolean().optional(),
      appendChangesToExistingText: z.boolean().optional(),
      linesForEditing: z.number().optional(),
      maxLength: z.number().optional(),
    })
    .optional()
    .nullable(),
  number: z
    .object({
      decimalPlaces: z.string().optional(),
      displayAs: z.string().optional(),
      maximum: z.number().optional(),
      minimum: z.number().optional(),
    })
    .optional()
    .nullable(),
  choice: z
    .object({
      choices: z.array(z.string()).optional(),
      displayAs: z.string().optional(),
    })
    .optional()
    .nullable(),
  dateTime: z
    .object({
      displayAs: z.string().optional(),
      format: z.string().optional(),
    })
    .optional()
    .nullable(),
  personOrGroup: z
    .object({
      allowMultipleSelection: z.boolean().optional(),
      displayAs: z.string().optional(),
      chooseFromType: z.string().optional(),
    })
    .optional()
    .nullable(),
  lookup: z
    .object({
      allowMultipleValues: z.boolean().optional(),
      allowUnlimitedLength: z.boolean().optional(),
      columnName: z.string().optional(),
      listId: z.string().optional(),
      primaryLookupColumnId: z.string().optional(),
    })
    .optional()
    .nullable(),
});

export const updateSiteColumnOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string().optional(),
  description: z.string().optional(),
  hidden: z.boolean().optional(),
  indexed: z.boolean().optional(),
  required: z.boolean().optional(),
  enforceUniqueValues: z.boolean().optional(),
  readOnly: z.boolean().optional(),
  columnGroup: z.string().optional(),
  text: z
    .object({
      allowMultipleLines: z.boolean().optional(),
      appendChangesToExistingText: z.boolean().optional(),
      linesForEditing: z.number().optional(),
      maxLength: z.number().optional(),
    })
    .optional(),
  number: z
    .object({
      decimalPlaces: z.string().optional(),
      displayAs: z.string().optional(),
      maximum: z.number().optional(),
      minimum: z.number().optional(),
    })
    .optional(),
  choice: z
    .object({
      choices: z.array(z.string()).optional(),
      displayAs: z.string().optional(),
    })
    .optional(),
  dateTime: z
    .object({
      displayAs: z.string().optional(),
      format: z.string().optional(),
    })
    .optional(),
  personOrGroup: z
    .object({
      allowMultipleSelection: z.boolean().optional(),
      displayAs: z.string().optional(),
      chooseFromType: z.string().optional(),
    })
    .optional(),
  lookup: z
    .object({
      allowMultipleValues: z.boolean().optional(),
      allowUnlimitedLength: z.boolean().optional(),
      columnName: z.string().optional(),
      listId: z.string().optional(),
      primaryLookupColumnId: z.string().optional(),
    })
    .optional(),
});

export function updateSiteColumnTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_update_site_column',
    description: 'Update a site-level column definition.',
    inputSchema: updateSiteColumnInputSchema,
    outputSchema: updateSiteColumnOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateSiteColumnOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const body: Record<string, unknown> = {};
      if (input.displayName !== undefined) {
        body['displayName'] = input.displayName;
      }
      if (input.description !== undefined) {
        body['description'] = input.description;
      }
      if (input.hidden !== undefined) {
        body['hidden'] = input.hidden;
      }
      if (input.indexed !== undefined) {
        body['indexed'] = input.indexed;
      }
      if (input.required !== undefined) {
        body['required'] = input.required;
      }
      if (input.enforceUniqueValues !== undefined) {
        body['enforceUniqueValues'] = input.enforceUniqueValues;
      }
      if (input.readOnly !== undefined) {
        body['readOnly'] = input.readOnly;
      }
      if (input.columnGroup !== undefined) {
        body['columnGroup'] = input.columnGroup;
      }
      if (input.text !== undefined) {
        body['text'] = input.text;
      }
      if (input.number !== undefined) {
        body['number'] = input.number;
      }
      if (input.choice !== undefined) {
        body['choice'] = input.choice;
      }
      if (input.dateTime !== undefined) {
        body['dateTime'] = input.dateTime;
      }
      if (input.personOrGroup !== undefined) {
        body['personOrGroup'] = input.personOrGroup;
      }
      if (input.lookup !== undefined) {
        body['lookup'] = input.lookup;
      }

      // https://learn.microsoft.com/graph/api/columndefinition-update
      const response = await platformProxy.patch({
        endpoint: `/v1.0/sites/${encodeURIComponent(input.siteId)}/columns/${encodeURIComponent(input.columnId)}`,
        data: body,
        retries: 3,
      });

      const providerColumn = ProviderColumnSchema.parse(response.data);

      return {
        id: providerColumn.id,
        name: providerColumn.name,
        ...(providerColumn.displayName !== undefined && { displayName: providerColumn.displayName }),
        ...(providerColumn.description !== undefined && { description: providerColumn.description }),
        ...(providerColumn.hidden !== undefined && { hidden: providerColumn.hidden }),
        ...(providerColumn.indexed !== undefined && { indexed: providerColumn.indexed }),
        ...(providerColumn.required !== undefined && { required: providerColumn.required }),
        ...(providerColumn.enforceUniqueValues !== undefined && {
          enforceUniqueValues: providerColumn.enforceUniqueValues,
        }),
        ...(providerColumn.readOnly !== undefined && { readOnly: providerColumn.readOnly }),
        ...(providerColumn.columnGroup !== undefined && { columnGroup: providerColumn.columnGroup }),
        ...(providerColumn.text != null && { text: providerColumn.text }),
        ...(providerColumn.number != null && { number: providerColumn.number }),
        ...(providerColumn.choice != null && { choice: providerColumn.choice }),
        ...(providerColumn.dateTime != null && { dateTime: providerColumn.dateTime }),
        ...(providerColumn.personOrGroup != null && { personOrGroup: providerColumn.personOrGroup }),
        ...(providerColumn.lookup != null && { lookup: providerColumn.lookup }),
      };
    },
  });
}
