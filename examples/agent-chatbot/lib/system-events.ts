import { z } from 'zod'

export const REPORT_ANALYSIS_FOR_NFL_QUESTIONS = {
    type: 'REPORT_ANALYSIS_FOR_NFL_QUESTIONS',
    label: 'Triggers a workflow for questions asked to the bot',
    schema: z.object({
      message: z.string(),
    }),
    executor: async ({ ctx, data }) => {

        const { mastra } = await import('./framework')
        console.log(ctx, data)

      await mastra.triggerEvent({
        key: 'REPORT_ANSWERS',
        data,
        user: {
            connectionId: '1234',
        }
      })
      return { message: 'Reported' }
    },
  }

  export const SEND_SLACK_MESSAGE ={
    type: 'SEND_SLACK_MESSAGE',
    label: 'Send message to slack',
    description: 'Send message to slack',
    schema: z.object({
      message: z.string(),
      channelId: z.string(),
    }),
    executor: async ({ data, ctx }: { data: { message: string, channelId: string } }) => {
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