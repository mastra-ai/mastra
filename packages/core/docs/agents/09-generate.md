> Documentation for the `Agent.generate()` method in Mastra agents, which enables non-streaming generation of responses with enhanced capabilities.

# Agent.generate()

The `.generate()` method enables non-streaming response generation from an agent, with enhanced capabilities and flexible output formats. It accepts messages and optional generation options, supporting both Mastra’s native format and AI SDK v5 compatibility.

## Usage example

```typescript
// Default Mastra format
const mastraResult = await agent.generate('message for agent');

// AI SDK v5 compatible format
const aiSdkResult = await agent.generate('message for agent', {
  format: 'aisdk',
});

// With model settings (e.g., limiting output tokens)
const limitedResult = await agent.generate('Write a short poem about coding', {
  modelSettings: {
    maxOutputTokens: 50,
    temperature: 0.7,
  },
});
```

> **Note:**

**Model Compatibility**: This method is designed for V2 models. V1 models should use the [`.generateLegacy()`](./generateLegacy) method. The framework automatically detects your model version and will throw an error if there's a mismatch.

## Parameters

### Options

## Returns
