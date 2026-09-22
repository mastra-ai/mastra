// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

function stripNullProperties(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripNullProperties);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, nestedValue]) => nestedValue !== null)
        .map(([key, nestedValue]) => [key, stripNullProperties(nestedValue)]),
    );
  }

  return value;
}

export const setChannelTopicInputSchema = z.object({
  channel_id: z.string().describe('The ID of the channel to set the topic for. Example: "C12345678"'),
  topic: z
    .string()
    .describe(
      'The new topic string. Does not support formatting or linkification. Example: "Apply topically for best effects"',
    ),
});

export const setChannelTopicOutputSchema = z.object({
  ok: z.boolean(),
  channel: z.record(z.string(), z.any()),
  warning: z.string().optional(),
  response_metadata: z.record(z.string(), z.any()).optional(),
});

export function setChannelTopicTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_set_channel_topic',
    description: 'Set the topic of a channel',
    inputSchema: setChannelTopicInputSchema,
    outputSchema: setChannelTopicOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof setChannelTopicOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://api.slack.com/methods/conversations.setTopic
        endpoint: '/conversations.setTopic',
        data: {
          channel: input.channel_id,
          topic: input.topic,
        },
        retries: 3,
      });

      return setChannelTopicOutputSchema.parse({
        ...response.data,
        channel: stripNullProperties(response.data.channel),
        response_metadata: stripNullProperties(response.data.response_metadata),
      });
    },
  });
}
