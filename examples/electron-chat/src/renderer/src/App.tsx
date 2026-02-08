import { useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'

const MASTRA_URL = 'http://localhost:4111'

export default function App() {
  const [input, setInput] = useState('')

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: `${MASTRA_URL}/chat/weatherAgent`,
    }),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    sendMessage({ text: input })
    setInput('')
  }

  return (
    <div className="container">
      <h1>Mastra Chat</h1>
      <div className="messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role}`}>
            <span className="role">{message.role === 'user' ? 'You' : 'Agent'}</span>
            {message.parts.map((part, i) => {
              if (part.type === 'text') {
                return (
                  <p key={i} className="text">
                    {part.text}
                  </p>
                )
              }
              if (part.type?.startsWith('tool-')) {
                return (
                  <pre key={i} className="tool-output">
                    {JSON.stringify(part, null, 2)}
                  </pre>
                )
              }
              return null
            })}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="input-form">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about the weather..."
          disabled={status !== 'ready'}
        />
        <button type="submit" disabled={status !== 'ready'}>
          Send
        </button>
      </form>
    </div>
  )
}
