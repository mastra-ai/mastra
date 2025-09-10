# OpenAI-Compatible Models Example

This example demonstrates how to use OpenAI-compatible models in Mastra without requiring provider-specific packages.

## Features

- **Magic Strings**: Use `"provider/model"` format to automatically detect API keys from environment variables
- **Explicit Configuration**: Provide API keys and settings directly in the configuration
- **Custom URLs**: Connect to self-hosted or alternative endpoints
- **Streaming Support**: Full support for streaming responses

## Supported Providers

The following providers have built-in presets:

| Provider   | Environment Variable | Example Model                                          |
| ---------- | -------------------- | ------------------------------------------------------ |
| OpenAI     | `OPENAI_API_KEY`     | `openai/gpt-4o-mini`                                   |
| Anthropic  | `ANTHROPIC_API_KEY`  | `anthropic/claude-3-haiku-20240307`                    |
| Groq       | `GROQ_API_KEY`       | `groq/llama-3.3-70b-versatile`                         |
| Together   | `TOGETHER_API_KEY`   | `together/meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo` |
| Perplexity | `PERPLEXITY_API_KEY` | `perplexity/llama-3.1-sonar-small-128k-online`         |
| Mistral    | `MISTRAL_API_KEY`    | `mistral/open-mistral-7b`                              |
| DeepSeek   | `DEEPSEEK_API_KEY`   | `deepseek/deepseek-chat`                               |

## Usage Patterns

### 1. Magic String Pattern

The simplest way - just specify the model as `"provider/model"`:

```typescript
const agent = new Agent({
  name: 'my-agent',
  instructions: 'You are a helpful assistant.',
  model: 'groq/llama-3.3-70b-versatile', // Automatically uses GROQ_API_KEY
});
```

### 2. Configuration with API Key

Provide an explicit API key:

```typescript
const agent = new Agent({
  name: 'my-agent',
  instructions: 'You are a helpful assistant.',
  model: {
    id: 'openai/gpt-4o-mini',
    apiKey: 'your-api-key-here',
  },
});
```

### 3. Custom URL

Connect to any OpenAI-compatible endpoint:

```typescript
const agent = new Agent({
  name: 'my-agent',
  instructions: 'You are a helpful assistant.',
  model: {
    id: 'custom-model',
    url: 'https://your-endpoint.com/v1/chat/completions',
    apiKey: 'your-api-key',
    headers: {
      'X-Custom-Header': 'value',
    },
  },
});
```

## Running the Example

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Set up environment variables:

   ```bash
   export OPENAI_API_KEY=your-key
   export GROQ_API_KEY=your-key
   # ... other API keys
   ```

3. Run the example:
   ```bash
   pnpm start
   ```

## Benefits

- **No Provider Packages**: No need to install `@ai-sdk/openai`, `@ai-sdk/anthropic`, etc.
- **Unified Interface**: Same API for all providers
- **Easy Switching**: Change providers by just changing the model string
- **Custom Endpoints**: Support for self-hosted or alternative API endpoints
- **Type Safety**: Full TypeScript support with proper types
