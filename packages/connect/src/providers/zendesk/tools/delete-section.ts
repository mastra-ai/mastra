// Hand-written Mastra addition — not generated from NangoHQ/integration-templates.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';
import { zendeskId } from '../article.js';

export const deleteSectionInputSchema = z.object({
  section_id: zendeskId('Help Center section'),
});

export const deleteSectionOutputSchema = z.object({
  success: z.literal(true),
  section_id: z.number(),
});

export function deleteSectionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'zendesk_delete_section',
    description: 'Delete a Help Center section and every article and subsection in it. This cannot be undone.',
    inputSchema: deleteSectionInputSchema,
    outputSchema: deleteSectionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteSectionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developer.zendesk.com/api-reference/help_center/help-center-api/sections/#delete-section
      await platformProxy.delete({
        endpoint: `/api/v2/help_center/sections/${input.section_id}`,
        retries: 1,
      });
      return { success: true, section_id: input.section_id };
    },
  });
}
