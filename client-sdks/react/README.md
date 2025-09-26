> This package is still under active development, things might break

# Quick start

```sh
$ pnpm add @mastra/react
```

```tsx
import { toStreamAssistantUIMessage , useAgent, MastraReactProvider } from '@mastra/react'

// App.tsx
export default function App() {
  return (
    <MastraReactProvider baseUrl="http://localhost:4111">
      <YourComponent />
    </MastraReactProvider>
  );
}

// YourComponent.tsx
export default function YourComponent() {
  const [setMessages, messages] = useState<ThreadMessageLike[]>([]);

  const { streamVNext, network, isRunning, cancelRun } = useAgent({
    agentId: 'chefModelV2Agent',
  });

  const startStreaming = (input: string) => {
    // messages object is dynamically populated from here
    return streamVNext({
      coreUserMessages: [{ role: 'user', content: input }],
      onChunk: ({ chunk }) => {
        setMessages(currentConversation => toStreamAssistantUIMessage({ chunk, conversation: currentConversation }));
      },
    });
  };

  return <div>...</div>
}
```
