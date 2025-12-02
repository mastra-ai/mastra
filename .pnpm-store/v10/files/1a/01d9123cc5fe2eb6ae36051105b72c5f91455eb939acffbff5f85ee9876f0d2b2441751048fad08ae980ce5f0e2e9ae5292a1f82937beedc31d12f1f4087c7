## Assistant Frames

Assistant frames allow an iframe to provide model context (tools, instructions) to a parent window's assistant.

### Scope

Supported features are:

- ModelContextProvider API
- support for tools (defining tool name, description, parameters, execute)
- support for instructions (system instructions)

Out of scope for now:

- model configuration (temprature, etc.)
- ToolCallReader API (incremental reading support)

### API design

[SPEC_ModelContextRegistry](../registry/SPEC_ModelContextRegistry.md)

### Inside the iframe (provides context)

```typescript
// Add model context providers
const registry = new ModelContextRegistry();
AssistantFrameProvider.addModelContextProvider(registry);

// Add tools/instructions to registry
registry.addTool({
  toolName: "search",
  description: "Search the web",
  parameters: z.object({ query: z.string() }),
  execute: async (args) => {
    // Tool implementation runs in iframe
    return { results: ["..."] };
  },
});
```

### In the parent window (consumes context)

```typescript
// The parent window hosts the assistant that needs the context
const frameHost = new AssistantFrameHost(iframeWindow);

// Register with assistant runtime
const runtime = useAssistantRuntime();
runtime.registerModelContextProvider(frameHost);

// The assistant now has access to tools from the iframe
```

### Communication Channel Design

The communication between `AssistantFrameProvider` (iframe) and `AssistantFrameHost` (parent window) uses the `window.postMessage` API with a structured protocol. The iframe provides model context to the parent window's assistant.

#### ModelContextProvider API

AssistantFrameHost implements the ModelContextProvider API. It immediately subscribes to the iframe for updates. This is necssary because ModelContextProvider.getModelContext() is synchronous.

#### Message Channel

All messages are wrapped with a channel identifier to avoid conflicts with other postMessage usage:

```typescript
{
  channel: "assistant-ui-frame",
  message: FrameMessage
}
```

#### Message Types

1. **Context Discovery**
   - `model-context-request`: Parent (Host) requests current context from iframe (Provider)
   - `model-context-update`: Iframe pushes context changes to parent
2. **Tool Execution**
   - `tool-call`: Parent requests tool execution in iframe (where tools are defined)
   - `tool-result`: Iframe returns execution result or error to parent

#### Serialization

- **Tools**: Zod schemas are converted to JSON Schema format using `z.toJSONSchema()`
- **Parameters**: Tool parameters are serialized as JSON
- **System messages**: Passed as strings
- **Unsupported features**: Model config, call settings, and priority are not transmitted

#### Security Considerations

1. **Origin Validation**: Both sides can specify `targetOrigin` to restrict message sources
2. **Window Reference**: Host (parent) only accepts messages from the specific iframe window it's connected to
3. **Message Channel**: Using a unique channel identifier prevents cross-talk with other postMessage users

#### Connection Lifecycle

1. **Initialization**: Parent (Host) sends `model-context-request` to iframe on creation
2. **Updates**: Iframe (Provider) notifies parent whenever any registered ModelContextProvider changes

#### Error Handling

- Tool execution errors are serialized and sent back as error messages
- Connection failures (timeout, no response) are silently handled - the Host continues to work as an empty ModelContextProvider
- If the iframe doesn't register any providers, the AssistantFrameHost acts as a no-op empty ModelContextProvider returning `{}` from `getModelContext()`
