'use client'

import { useChat } from 'ai/react'
import { useState } from 'react'

export default function IndexPage() {
  const [toolCall, setToolCall] = useState()

  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/agent-message',
    onToolCall: ({ toolCall }) => {
      if (toolCall.toolName === 'answer') {
        return setToolCall(undefined)
      }

      setToolCall(toolCall as any)
    }
  })

  const toolReads: Record<string, any> = {
    get_teams_from_vector_teams: 'Searching NFL teams...',
    get_scores_for_nfl_matchups: 'Searching NFL scores...',
    get_sports_news: 'Searching sports news...',
    get_athletes_for_nfl_team: 'Searching NFL athletes...',
    report_answers_to_slack: 'Reporting answers to Slack...'
  }

  console.log(messages)
  return (
    <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch text-black">
      {messages.length > 0
        ? messages.map((m, index) => {
            if (
              m.role === 'assistant' &&
              m.toolInvocations?.find(({ toolName }) => toolName === 'answer')
            ) {
              const invocation = m.toolInvocations.find(
                ({ toolName }) => toolName === 'answer'
              )
              return (
                <div key={m.id} className="whitespace-pre-wrap">
                  {'AI: '}
                  {invocation?.args?.answer}
                </div>
              )
            } else if (m.role === 'user') {
              return (
                <>
                  <div key={m.id} className="whitespace-pre-wrap">
                    {m.role === 'user' ? 'User: ' : 'AI: '}
                    {m.content}
                  </div>
                  {index === messages.length - 2 &&
                    toolCall &&
                    (toolReads[(toolCall as any)?.toolName] ||
                      (toolCall as any)?.toolName)}
                </>
              )
            } else {
              null
            }
          })
        : null}

      <form onSubmit={handleSubmit}>
        <input
          className="fixed bottom-0 w-full max-w-md p-2 mb-8 border border-gray-300 rounded shadow-xl text-black"
          value={input}
          placeholder="Say something..."
          onChange={handleInputChange}
        />
      </form>
    </div>
  )
}
