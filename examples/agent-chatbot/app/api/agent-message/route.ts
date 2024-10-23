import { mastra } from '@/lib/mastra/framework'
import { openai } from '@ai-sdk/openai'
import { streamText, StreamData, StreamTextResult } from 'ai'

// Allow streaming responses up to 30 seconds
export const maxDuration = 30

export async function POST(req: Request) {
  // Extract the `messages` from the body of the request
  const { messages } = await req.json()

  // Create a new StreamData
  const data = new StreamData()

  // Call the language model
  const executor = await mastra.getAgent({
    agentId: 'asst_mFswl3bmGEsWJJxPMaT5mthN',
    connectionId: 'SYSTEM'
  })

  if (!executor) {
    return
  }

  if (typeof executor === 'function') {
    const result = (await executor({
      prompt: messages[0].content
    })) as StreamTextResult<{}>
    // Respond with the stream and additional StreamData
    return result.toDataStreamResponse({ data })
  }
}
