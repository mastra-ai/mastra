# Handling Memory in Frontend Applications

When building a frontend application that uses Mastra memory, it's important to only send the newest user message in each agent call. Mastra handles retrieving and injecting the necessary history. Sending the full history yourself will cause duplication.

Here's a simplified example of how to handle this in a React application:

```tsx
import { useState } from 'react'
import { memoryAgent } from './agents'

function ChatApp() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')

  const handleSendMessage = async () => {
    // Add user message to UI
    setMessages([...messages, { role: 'user', content: input }])

    // Only send the newest message to the agent
    const response = await memoryAgent.stream(input, {
      memory: {
        thread: 'conversation_456',
        resource: 'user_123',
      },
    })

    // Add agent response to UI
    setMessages([...messages, { role: 'assistant', content: response }])
    setInput('')
  }

  return (
    <div>
      {/* Display messages */}
      <div>
        {messages.map((msg, index) => (
          <div key={index}>
            <strong>{msg.role}:</strong> {msg.content}
          </div>
        ))}
      </div>

      {/* Input for new messages */}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
      />
      <button onClick={handleSendMessage}>Send</button>
    </div>
  )
}
```

This example demonstrates a common pattern for handling memory in a frontend application:

1. Store the conversation messages in the UI state for display purposes
2. When sending a message to the agent, only send the newest message
3. Pass the `resource` and `thread` IDs through the `memory` option with each agent call
4. Let Mastra handle retrieving and injecting the conversation history

This approach ensures that your agent has access to the conversation history without duplicating messages in the context window.

In the next step, we'll explore semantic recall, which allows your agent to remember information from older conversations that are no longer in the recent history.
