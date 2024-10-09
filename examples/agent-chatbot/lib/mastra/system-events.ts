import { z } from 'zod'

export const SEND_SLACK_MESSAGE = {
  type: 'SEND_SLACK_MESSAGE',
  label: 'Send message to slack',
  description: 'Send message to slack',
  schema: z.object({
    message: z.string(),
    channelId: z.string(),
  }),
  executor: async ({ data, ctx }: { data: { message: string, channelId: string }, ctx: any }) => {
    // @ts-ignore
    const { mastra } = await import('./framework')
    const integration = mastra.getIntegration('SLACK')

    const client = await integration.getApiClient(ctx);

    const response = await client.chatPostMessage({
      body: {
        channel: data.channelId,
        text: data.message,
      }
    })

    return response
  },
}