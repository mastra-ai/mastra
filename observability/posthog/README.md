# @mastra/posthog

PostHog AI Observability exporter for Mastra applications.

## Installation

```bash
npm install @mastra/posthog
```

## Usage

```typescript
import { PosthogExporter } from '@mastra/posthog';

// Use with Mastra
const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      posthog: {
        serviceName: 'service',
        exporters: [
          new PosthogExporter({
            apiKey: process.env.POSTHOG_API_KEY,
            host: 'https://us.i.posthog.com', // optional, defaults to US region
          }),
        ],
      },
    },
  },
});
```

## Features

### AI Tracing

- **Event-based architecture**: Captures LLM calls and operations as PostHog events
- **LLM analytics**: Automatic tracking of token usage, latency, and costs
- **Streaming support**: Handles streaming LLM responses with MODEL_CHUNK events
- **Privacy mode**: Optional exclusion of input/output data for sensitive applications
- **Serverless optimized**: Auto-configures batching for serverless environments

### Supported Event Types

- `$ai_generation`: LLM model calls (MODEL_GENERATION, MODEL_STEP)
- `$ai_span`: Operations like tool calls, workflows, and streaming chunks
- Hierarchical traces with parent-child relationships via `$ai_parent_id`
- Session grouping with `$ai_session_id`

## Configuration

### Basic Configuration

```typescript
new PosthogExporter({
  apiKey: process.env.POSTHOG_API_KEY,
});
```

### Advanced Configuration

```typescript
new PosthogExporter({
  // Required
  apiKey: process.env.POSTHOG_API_KEY,

  // Optional: Region/Host
  host: 'https://eu.i.posthog.com', // EU region
  // or
  host: 'https://your-instance.com', // Self-hosted

  // Optional: Batching (defaults: flushAt=20, flushInterval=10000)
  flushAt: 20, // Batch size before auto-flush
  flushInterval: 10000, // Flush interval in milliseconds

  // Optional: Serverless mode (auto-configures smaller batches)
  serverless: true, // Sets flushAt=10, flushInterval=2000

  // Optional: User identification
  defaultDistinctId: 'anonymous', // Fallback if no userId in metadata

  // Optional: Privacy
  enablePrivacyMode: false, // Set to true to exclude input/output from LLM events
});
```

### Serverless Environments

When deploying to serverless environments (Lambda, Vercel Functions, etc.), enable serverless mode:

```typescript
new PosthogExporter({
  apiKey: process.env.POSTHOG_API_KEY,
  serverless: true, // Auto-configures for serverless
});
```

**Important**: Always call `await mastra.shutdown()` before your serverless function exits to flush remaining events.

### Privacy Mode

To exclude sensitive input/output data while still tracking token usage and latency:

```typescript
new PosthogExporter({
  apiKey: process.env.POSTHOG_API_KEY,
  enablePrivacyMode: true, // Excludes $ai_input and $ai_output_choices
});
```

Note: Privacy mode only applies to `$ai_generation` events. Span events (tool calls, etc.) still include input/output state.

## Metadata

Include metadata in your Mastra spans to enrich PostHog events:

```typescript
// User identification
{
  metadata: {
    userId: 'user-123',      // → distinctId in PostHog
    sessionId: 'session-abc', // → $ai_session_id for grouping

    // Custom properties (passed through to PostHog)
    environment: 'production',
    version: '1.0.0',
  }
}
```

## Cost Tracking

PostHog automatically calculates costs from:

- Model name + token counts (uses OpenRouter pricing data)
- Or you can send pre-calculated costs in span attributes

## Viewing Data in PostHog

1. Navigate to **Product Analytics** → **Events**
2. Filter for events starting with `$ai_`
3. Use the **AI Observability** dashboard (if available in your PostHog plan)
4. Query events by:
   - `$ai_trace_id`: Group all events in a trace
   - `$ai_session_id`: Group traces in a session
   - `$ai_model`: Filter by model (e.g., "gpt-4o")
   - `$ai_provider`: Filter by provider (e.g., "openai")

## Environment Variables

```bash
# Required
POSTHOG_API_KEY=phc_...

# Optional
POSTHOG_HOST=https://us.i.posthog.com  # or eu.i.posthog.com
```

## Links

- [PostHog LLM Analytics Documentation](https://posthog.com/docs/ai-engineering/langchain-integration)
- [Mastra Observability Documentation](https://mastra.ai/docs/observability)
