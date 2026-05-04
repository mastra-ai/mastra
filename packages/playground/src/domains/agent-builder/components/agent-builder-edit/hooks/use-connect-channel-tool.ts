import { createTool } from '@mastra/client-js';
import { useMemo } from 'react';
import { z } from 'zod-v4';

export const CONNECT_CHANNEL_TOOL_NAME = 'connectChannel';

export function useConnectChannelTool() {
  return useMemo(
    () =>
      createTool({
        id: CONNECT_CHANNEL_TOOL_NAME,
        description:
          'Surface an inline UI widget that lets the user connect this agent to a publishing channel (currently Slack). ' +
          'Call this after the agent has been saved when the user expresses intent to publish to or connect with Slack. ' +
          'The widget renders the same connect/disconnect controls as the top-level "Publish to…" action; ' +
          'do not attempt to perform the connection yourself — the user will click inside the rendered widget.',
        inputSchema: z.object({
          platform: z.enum(['slack']),
        }),
        outputSchema: z.object({ success: z.boolean() }),
        execute: async () => {
          return { success: true };
        },
      }),
    [],
  );
}
