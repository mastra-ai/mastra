# ModelContextRegistry

An imperative API for registering tools and instructions to a model context provider.

```typescript
const registry = new ModelContextRegistry();

const handle = registry.addTool({
  toolName: "search",
  description: "Search the web",
  parameters: z.object({ query: z.string() }),
  execute: async (args) => {
    return { results: ["..."] };
  },
});
```

## API

- addTool(tool: Tool & { toolName: string }): ModelContextRegistryToolHandle
- addInstruction(instruction: string): ModelContextRegistryInstructionHandle
- addProvider(provider: ModelContextProvider): ModelContextRegistryProviderHandle

## ModelContextRegistryToolHandle

- update(tool: Tool & { toolName: string }): void;
- remove(): void;

## ModelContextRegistryInstructionHandle

- update(instruction: string): void;
- remove(): void;

## ModelContextRegistryProviderHandle

- remove(): void;

## ModelContextProvider

The registry is a ModelContextProvider.
