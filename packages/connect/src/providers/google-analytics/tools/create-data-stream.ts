// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const DataStreamTypeSchema = z
  .enum(['DATA_STREAM_TYPE_UNSPECIFIED', 'WEB_DATA_STREAM', 'ANDROID_APP_DATA_STREAM', 'IOS_APP_DATA_STREAM'])
  .or(z.string());

const WebStreamDataInputSchema = z.object({
  default_uri: z.string().describe('Domain name of the web app being measured. Example: "https://www.example.com"'),
});

const AndroidAppStreamDataInputSchema = z.object({
  package_name: z.string().describe('The package name for the app being measured. Example: "com.example.myandroidapp"'),
});

const IosAppStreamDataInputSchema = z.object({
  bundle_id: z.string().describe('The Apple App Store Bundle ID for the app. Example: "com.example.myiosapp"'),
});

const CommonInputSchema = {
  property_id: z.string().describe('GA4 property numeric ID. Example: "1234"'),
  display_name: z.string().describe('Human-readable display name for the Data Stream.'),
};

export const createDataStreamInputSchema = z.discriminatedUnion('type', [
  z.object({
    ...CommonInputSchema,
    type: z.literal('WEB_DATA_STREAM'),
    web_stream_data: WebStreamDataInputSchema.describe(
      'Data specific to web streams. Required when type is WEB_DATA_STREAM.',
    ),
  }),
  z.object({
    ...CommonInputSchema,
    type: z.literal('ANDROID_APP_DATA_STREAM'),
    android_app_stream_data: AndroidAppStreamDataInputSchema.describe(
      'Data specific to Android app streams. Required when type is ANDROID_APP_DATA_STREAM.',
    ),
  }),
  z.object({
    ...CommonInputSchema,
    type: z.literal('IOS_APP_DATA_STREAM'),
    ios_app_stream_data: IosAppStreamDataInputSchema.describe(
      'Data specific to iOS app streams. Required when type is IOS_APP_DATA_STREAM.',
    ),
  }),
  z.object({
    ...CommonInputSchema,
    type: z.literal('DATA_STREAM_TYPE_UNSPECIFIED'),
  }),
]);

const WebStreamDataSchema = z.object({
  measurementId: z.string().optional(),
  firebaseAppId: z.string().optional(),
  defaultUri: z.string().optional(),
});

const AndroidAppStreamDataSchema = z.object({
  firebaseAppId: z.string().optional(),
  packageName: z.string().optional(),
});

const IosAppStreamDataSchema = z.object({
  firebaseAppId: z.string().optional(),
  bundleId: z.string().optional(),
});

const DataStreamSchema = z.object({
  name: z.string().optional(),
  type: DataStreamTypeSchema.optional(),
  displayName: z.string().optional(),
  createTime: z.string().optional(),
  updateTime: z.string().optional(),
  webStreamData: WebStreamDataSchema.optional(),
  androidAppStreamData: AndroidAppStreamDataSchema.optional(),
  iosAppStreamData: IosAppStreamDataSchema.optional(),
});

export const createDataStreamOutputSchema = z.object({
  name: z.string().optional(),
  type: DataStreamTypeSchema.optional(),
  displayName: z.string().optional(),
  createTime: z.string().optional(),
  updateTime: z.string().optional(),
  webStreamData: WebStreamDataSchema.optional(),
  androidAppStreamData: AndroidAppStreamDataSchema.optional(),
  iosAppStreamData: IosAppStreamDataSchema.optional(),
});

export function createDataStreamTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_analytics_create_data_stream',
    description: 'Create a data stream for a GA4 property.',
    inputSchema: createDataStreamInputSchema,
    outputSchema: createDataStreamOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createDataStreamOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      type DataStreamBody = {
        type: string;
        displayName: string;
        webStreamData?: { defaultUri: string };
        androidAppStreamData?: { packageName: string };
        iosAppStreamData?: { bundleId: string };
      };

      const body: DataStreamBody = {
        type: input.type,
        displayName: input.display_name,
      };

      if (input.type === 'WEB_DATA_STREAM') {
        body.webStreamData = {
          defaultUri: input.web_stream_data.default_uri,
        };
      } else if (input.type === 'ANDROID_APP_DATA_STREAM') {
        body.androidAppStreamData = {
          packageName: input.android_app_stream_data.package_name,
        };
      } else if (input.type === 'IOS_APP_DATA_STREAM') {
        body.iosAppStreamData = {
          bundleId: input.ios_app_stream_data.bundle_id,
        };
      }

      // https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/properties.dataStreams/create
      const response = await platformProxy.post({
        endpoint: `/v1beta/properties/${encodeURIComponent(input.property_id)}/dataStreams`,
        data: body,
        baseUrlOverride: 'https://analyticsadmin.googleapis.com',
        retries: 3,
      });

      const dataStream = DataStreamSchema.parse(response.data);

      return {
        ...(dataStream.name !== undefined && { name: dataStream.name }),
        ...(dataStream.type !== undefined && { type: dataStream.type }),
        ...(dataStream.displayName !== undefined && { displayName: dataStream.displayName }),
        ...(dataStream.createTime !== undefined && { createTime: dataStream.createTime }),
        ...(dataStream.updateTime !== undefined && { updateTime: dataStream.updateTime }),
        ...(dataStream.webStreamData !== undefined && { webStreamData: dataStream.webStreamData }),
        ...(dataStream.androidAppStreamData !== undefined && { androidAppStreamData: dataStream.androidAppStreamData }),
        ...(dataStream.iosAppStreamData !== undefined && { iosAppStreamData: dataStream.iosAppStreamData }),
      };
    },
  });
}
