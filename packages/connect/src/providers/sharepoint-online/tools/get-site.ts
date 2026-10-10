// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getSiteInputSchema = z
  .object({
    siteId: z
      .string()
      .optional()
      .describe(
        'SharePoint site ID. Example: "contoso.sharepoint.com,2C712604-1370-44E7-A1F5-426573FDA80A,2D224884-BFCC-4BE3-A6D9-B8C87A8A1234"',
      ),
    hostname: z.string().optional().describe('SharePoint hostname. Example: "contoso.sharepoint.com"'),
    path: z.string().optional().describe('Server-relative URL path of the site. Example: "/sites/hr"'),
  })
  .refine(data => Boolean(data.siteId) || (Boolean(data.hostname) && Boolean(data.path)), {
    message: 'Either siteId or both hostname and path must be provided',
  });

const SiteCollectionSchema = z
  .object({
    hostname: z.string().optional(),
  })
  .optional();

const ProviderSiteSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    displayName: z.string().optional(),
    description: z.string().optional(),
    webUrl: z.string().optional(),
    createdDateTime: z.string().optional(),
    lastModifiedDateTime: z.string().optional(),
    siteCollection: SiteCollectionSchema,
    error: z
      .object({
        code: z.string(),
        message: z.string(),
      })
      .optional(),
  })
  .passthrough();

export const getSiteOutputSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    displayName: z.string().optional(),
    description: z.string().optional(),
    webUrl: z.string().optional(),
    createdDateTime: z.string().optional(),
    lastModifiedDateTime: z.string().optional(),
    siteCollection: SiteCollectionSchema,
  })
  .passthrough();

export function getSiteTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_get_site',
    description: 'Retrieve a SharePoint site by ID or path.',
    inputSchema: getSiteInputSchema,
    outputSchema: getSiteOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getSiteOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      let endpoint: string;
      if (input.siteId) {
        endpoint = `/v1.0/sites/${encodeURIComponent(input.siteId)}`;
      } else if (input.hostname && input.path) {
        endpoint = `/v1.0/sites/${encodeURIComponent(input.hostname)}:${encodeURIComponent(input.path)}`;
      } else {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'Either siteId or both hostname and path must be provided',
        });
      }

      // https://learn.microsoft.com/graph/api/site-get
      const response = await platformProxy.get({
        endpoint: endpoint,
        retries: 3,
      });

      const providerSite = ProviderSiteSchema.parse(response.data);

      if (providerSite.error) {
        throw new platformProxy.ActionError({
          type: 'provider_error',
          message: providerSite.error.message,
          code: providerSite.error.code,
        });
      }

      return getSiteOutputSchema.parse(providerSite);
    },
  });
}
