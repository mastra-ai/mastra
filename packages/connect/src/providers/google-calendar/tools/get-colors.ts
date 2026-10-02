// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getColorsInputSchema = z.object({}).describe('No input required.');

const ColorDefinitionSchema = z.object({
  background: z.string().describe('The background color associated with this color definition.'),
  foreground: z.string().describe('The foreground color that can be used to write on top of the background color.'),
});

export const getColorsOutputSchema = z
  .object({
    kind: z.string().optional().describe('Type of the resource, typically "calendar#colors".'),
    updated: z.string().optional().describe('Last modification time of the color palette as an RFC3339 timestamp.'),
    calendar: z
      .record(z.string(), ColorDefinitionSchema)
      .optional()
      .describe('A global palette of calendar colors, mapping from the color ID to its definition.'),
    event: z
      .record(z.string(), ColorDefinitionSchema)
      .optional()
      .describe('A global palette of event colors, mapping from the color ID to its definition.'),
  })
  .describe('Available calendar and event color definitions.');

export function getColorsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_get_colors',
    description: 'Return available calendar and event color definitions',
    inputSchema: getColorsInputSchema,
    outputSchema: getColorsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getColorsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://developers.google.com/workspace/calendar/api/v3/reference/colors/get
        endpoint: '/calendar/v3/colors',
        retries: 3,
      });

      const colors = getColorsOutputSchema.parse(response.data);

      return colors;
    },
  });
}
