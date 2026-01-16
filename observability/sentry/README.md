# @mastra/sentry

Sentry AI Observability exporter for Mastra applications.

## Installation

```bash
npm install @mastra/sentry
```

## Usage

### Zero-Config Setup

The exporter automatically reads credentials from environment variables:

```bash
# Required
SENTRY_DSN=https://...@...sentry.io/...

# Optional
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=1.0.0
```

```typescript
import { SentryExporter } from '@mastra/sentry';

const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      sentry: {
        serviceName: 'my-service',
        exporters: [new SentryExporter()],
      },
    },
  },
});
```

### Explicit Configuration

You can also pass credentials directly:

```typescript
import { SentryExporter } from '@mastra/sentry';

const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      sentry: {
        serviceName: 'my-service',
        exporters: [
          new SentryExporter({
            dsn: 'https://...@...sentry.io/...',
            environment: 'production', // Optional - deployment environment
            tracesSampleRate: 1.0, // Optional - send 100% of transactions to Sentry
            release: '1.0.0', // Optional - version of your code deployed
          }),
        ],
      },
    },
  },
});
```

### Configuration Options

| Option             | Type     | Description                                                                                                                             |
| ------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `dsn`              | `string` | Data Source Name - tells the SDK where to send events. Defaults to `SENTRY_DSN` env var                                                 |
| `environment`      | `string` | Deployment environment (enables filtering issues and alerts by environment). Defaults to `SENTRY_ENVIRONMENT` env var or `'production'` |
| `tracesSampleRate` | `number` | Percentage of transactions sent to Sentry (0.0 = 0%, 1.0 = 100%). Defaults to `1.0`                                                     |
| `release`          | `string` | Version of your code deployed (helps identify regressions and track deployments). Defaults to `SENTRY_RELEASE` env var                  |
| `options`          | `object` | Additional Sentry SDK options (integrations, beforeSend, etc.)                                                                          |

## Features

### Tracing

- **Automatic span mapping**: Root spans create Sentry traces, child spans nest properly
- **OpenTelemetry semantic conventions**: Uses standard GenAI semantic conventions for AI spans
- **Model generation support**: `MODEL_GENERATION` spans include token usage, model parameters, and streaming info
- **Tool call tracking**: `TOOL_CALL` and `MCP_TOOL_CALL` spans track tool executions
- **Workflow support**: `WORKFLOW_RUN` and `WORKFLOW_STEP` spans track workflow execution
- **Error tracking**: Automatic error status and exception capture
- **Hierarchical traces**: Maintains parent-child relationships

### Span Types Mapping

| Mastra SpanType             | Sentry Operation       | Span Name Pattern       | Notes                                                   |
| --------------------------- | ---------------------- | ----------------------- | ------------------------------------------------------- |
| `AGENT_RUN`                 | `gen_ai.invoke_agent`  | `invoke_agent {agent}`  | Accumulates tokens from the child MODEL_GENERATION span |
| `MODEL_GENERATION`          | `gen_ai.chat`          | `chat {model} [stream]` | Contains aggregated streaming data                      |
| `MODEL_STEP`                | _(skipped)_            | -                       | Skipped to simplify trace hierarchy                     |
| `MODEL_CHUNK`               | _(skipped)_            | -                       | Too granular; data aggregated in MODEL_GENERATION       |
| `TOOL_CALL`                 | `gen_ai.execute_tool`  | `execute_tool {tool}`   |                                                         |
| `MCP_TOOL_CALL`             | `gen_ai.execute_tool`  | `execute_tool {tool}`   |                                                         |
| `WORKFLOW_RUN`              | `workflow.run`         | `workflow`              |                                                         |
| `WORKFLOW_STEP`             | `workflow.step`        | `step`                  |                                                         |
| `WORKFLOW_CONDITIONAL`      | `workflow.conditional` | `step`                  |                                                         |
| `WORKFLOW_CONDITIONAL_EVAL` | `workflow.conditional` | `step`                  |                                                         |
| `WORKFLOW_PARALLEL`         | `workflow.parallel`    | `step`                  |                                                         |
| `WORKFLOW_LOOP`             | `workflow.loop`        | `step`                  |                                                         |
| `WORKFLOW_SLEEP`            | `workflow.sleep`       | `step`                  |                                                         |
| `WORKFLOW_WAIT_EVENT`       | `workflow.wait`        | `step`                  |                                                         |
| `PROCESSOR_RUN`             | `ai.processor`         | `step`                  |                                                         |
| `GENERIC`                   | `ai.span`              | `span`                  |                                                         |

### Semantic Attributes

**Common attributes (all spans):**

- `sentry.origin`: `auto.ai.mastra` (identifies spans from Mastra)
- `ai.span.type`: Mastra span type (e.g., `model_generation`, `tool_call`)

**For `MODEL_GENERATION` and `MODEL_STEP` spans:**

- `gen_ai.operation.name`: `chat`
- `gen_ai.system`: Model provider (e.g., `openai`, `anthropic`)
- `gen_ai.request.model`: Model identifier (e.g., `gpt-4`)
- `gen_ai.request.messages`: Input messages/prompts (JSON)
- `gen_ai.response.text`: Output text response
- `gen_ai.usage.input_tokens`: Input token count
- `gen_ai.usage.output_tokens`: Output token count
- `gen_ai.usage.cache_read_input_tokens`: Cached input tokens
- `gen_ai.usage.cache_write_input_tokens`: Cache write tokens
- `gen_ai.usage.reasoning_tokens`: Reasoning tokens (for models like o1)
- `gen_ai.request.temperature`: Temperature parameter
- `gen_ai.request.max_tokens`: Max tokens parameter
- `gen_ai.request.top_p`, `top_k`, `frequency_penalty`, `presence_penalty`: Other parameters
- `gen_ai.request.stream`: Whether streaming was requested
- `gen_ai.response.streaming`: Whether response was streamed
- `gen_ai.response.tool_calls`: Tool calls made during generation (JSON array)
- `gen_ai.completion_start_time`: Time first token arrived (for TTFT calculation)

**For `TOOL_CALL` spans:**

- `gen_ai.operation.name`: `ai.toolCall`
- `gen_ai.tool.name`: Tool identifier
- `gen_ai.tool.type`: `function`
- `gen_ai.tool.call.id`: Tool call ID
- `gen_ai.tool.input`: Tool input (JSON)
- `gen_ai.tool.output`: Tool output (JSON)
- `gen_ai.tool.description`: Tool description
- `tool.success`: Whether the tool call succeeded

**For `AGENT_RUN` spans:**

- `gen_ai.operation.name`: `invoke_agent`
- `gen_ai.agent.name`: Agent identifier
- `gen_ai.pipeline.name`: Agent name (for Sentry AI view)
- `gen_ai.agent.instructions`: Agent instructions
- `gen_ai.agent.prompt`: Agent prompt
- `gen_ai.request.messages`: Input message (normalized)
- `gen_ai.request.available_tools`: Available tools (JSON array)
- `gen_ai.response.model`: Model from the child MODEL_GENERATION span
- `gen_ai.response.text`: Output text from the child MODEL_GENERATION span
- `gen_ai.usage.input_tokens`: Input tokens from the child MODEL_GENERATION span
- `gen_ai.usage.output_tokens`: Output tokens from the child MODEL_GENERATION span
- `gen_ai.usage.total_tokens`: Total tokens from the child MODEL_GENERATION span
- `gen_ai.usage.cache_read_input_tokens`: Cached input tokens from the child MODEL_GENERATION span
- `gen_ai.usage.cache_write_input_tokens`: Cache write tokens from the child MODEL_GENERATION span
- `gen_ai.usage.reasoning_tokens`: Reasoning tokens from the child MODEL_GENERATION span
- `agent.max_steps`: Maximum steps allowed
- `agent.available_tools`: Available tools (comma-separated)

## Example

```typescript
import { Mastra } from '@mastra/core';
import { SentryExporter } from '@mastra/sentry';
import { Agent } from '@mastra/core';
import { openai } from '@ai-sdk/openai';

const mastra = new Mastra({
  observability: {
    configs: {
      sentry: {
        serviceName: 'my-ai-app',
        exporters: [
          new SentryExporter({
            dsn: process.env.SENTRY_DSN,
            environment: process.env.NODE_ENV,
            tracesSampleRate: 0.1, // Send 10% of transactions to Sentry (recommended for high-load backends)
          }),
        ],
      },
    },
  },
});

const agent = new Agent({
  name: 'customer-support',
  instructions: 'Help customers with their questions',
  model: openai('gpt-4'),
  mastra,
});

// All agent executions will be traced in Sentry
const result = await agent.generate('How do I reset my password?');
```

## Troubleshooting

### Spans not appearing in Sentry

1. Verify your DSN is correct
2. Check the `tracesSampleRate` - set to `1.0` for testing
3. Ensure you're using Sentry SDK v10.32.1 or higher
4. Check console for any Sentry initialization errors

### High volume / cost

Adjust the `tracesSampleRate` to send fewer transactions to Sentry:

```typescript
new SentryExporter({
  tracesSampleRate: 0.1, // Send only 10% of transactions (recommended for high-load applications)
});
```

**Note:** To disable tracing entirely, don't set `tracesSampleRate` at all rather than setting it to `0`.
