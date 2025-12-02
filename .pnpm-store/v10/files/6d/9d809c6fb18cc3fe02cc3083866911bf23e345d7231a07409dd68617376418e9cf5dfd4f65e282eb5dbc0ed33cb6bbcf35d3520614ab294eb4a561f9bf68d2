# @inngest/ai

AI adapter package for Inngest, providing type-safe interfaces to various AI providers including OpenAI, Anthropic, Gemini, Grok, and Azure OpenAI.

## Installation

```bash
npm install @inngest/ai
```

## Usage

```typescript
import { openai, anthropic, gemini } from "@inngest/ai/models";

// Use with Inngest step.ai
const result = await step.ai.infer("Analyze this data", {
  model: openai({ model: "gpt-4" }),
  body: {
    messages: [{ role: "user", content: "What is machine learning?" }],
  },
});
```

## Development

### Running Tests

This package includes comprehensive smoke tests that verify our type definitions work correctly with real AI provider APIs.

#### Unit Tests

Run the standard unit tests (when they exist):

```bash
pnpm test
```

#### Smoke Tests

Smoke tests make actual API calls to AI providers to ensure our type definitions are accurate and complete. **Note: These tests will consume API credits and should only be run when needed.**

##### Setup

1. Copy the environment example file:

   ```bash
   cp .env.example .env
   ```

2. Add your API keys to `.env`:

   ```bash
   # Required for Gemini smoke tests
   GEMINI_API_KEY=your_gemini_api_key_here

   # Optional: Other providers for future smoke tests
   OPENAI_API_KEY=your_openai_api_key_here
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   # ... see .env.example for full list
   ```

##### Running Smoke Tests

```bash
# Run all smoke tests (requires API keys)
pnpm test:smoke

# Run smoke tests in watch mode for development
pnpm test:smoke:watch
```

##### What Smoke Tests Cover

The smoke tests verify:

- **Basic text generation** - Simple prompts and responses
- **Thinking features** - Gemini's reasoning capabilities with thinking budgets
- **Structured output** - JSON schema validation and response formatting
- **Parameter validation** - Temperature, token limits, stop sequences, etc.
- **Error handling** - Invalid API keys and malformed requests
- **Token usage tracking** - Usage metadata accuracy and completeness
- **Advanced features** - Multi-candidate generation, sampling parameters

##### Cost Considerations

- Smoke tests are designed to use minimal tokens while thoroughly testing functionality
- Most tests use small `maxOutputTokens` limits (50-400 tokens)
- Thinking tests may use more tokens due to internal reasoning

### Architecture

This package provides:

- **Type-safe adapters** for each AI provider's API format
- **Model creators** that handle authentication and configuration
- **Comprehensive TypeScript definitions** with extensive JSDoc documentation
- **Developer-friendly interfaces** with usage examples and best practices

### Contributing

When adding new AI providers or updating existing ones:

1. Add comprehensive type definitions with JSDoc documentation
2. Include usage examples for complex features
3. Add smoke tests to verify real-world functionality
4. Update this README with any new setup requirements

### Supported Providers

- **OpenAI** - GPT models and embeddings
- **Anthropic** - Claude models
- **Google Gemini** - Gemini models with thinking features
- **Grok** - Grok models (OpenAI-compatible)
- **Azure OpenAI** - Azure-hosted OpenAI models
