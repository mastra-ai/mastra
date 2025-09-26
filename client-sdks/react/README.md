> This package is still under active development, things might break

# Quick start

```sh
$ pnpm add @mastra/react
```

```tsx
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
  const { setMessages, messages, streamVNext, network, isRunning, cancelRun } = useMastraChat<ThreadMessageLike>({
    agentId: 'chefModelV2Agent',
  });

  const startStreaming = (input: string) => {
    // messages object is dynamically populated from here
    return streamVNext({
      coreUserMessages: [{ role: 'user', content: input }],
      onChunk: toAssistantUIMessage,
    });
  };

  return (
    <div>
      {messages.map(message => (
        <DoYourThing message={message} />
      ))}
    </div>
  );
}
```
