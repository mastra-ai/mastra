---
title: "AI Tracing "
description: "Set up AI tracing for Mastra applications"
---

# AI Tracing

AI Tracing provides specialized monitoring and debugging for the AI-related operations in your application. When enabled, Mastra automatically creates traces for agent runs, LLM generations, tool calls, and workflow steps with AI-specific context and metadata.

Unlike traditional application tracing, AI Tracing focuses specifically on understanding your AI pipeline — capturing token usage, model parameters, tool execution details, and conversation flows. This makes it easier to debug issues, optimize performance, and understand how your AI systems behave in production.

## How It Works

AI Traces are created by:

- **Configure exporters** → send trace data to observability platforms
- **Set sampling strategies** → control which traces are collected
- **Run agents and workflows** → Mastra auto-instruments them with AI Tracing

## Configuration

### Basic Config

```ts filename="src/mastra/index.ts" showLineNumbers copy
export const mastra = new Mastra({
  // ... other config
  observability: {
    default: { enabled: true }, // Enables DefaultExporter and CloudExporter
  },
  storage: new LibSQLStore({
    url: "file:./mastra.db", // Storage is required for tracing
  }),
});
```

When enabled, the default configuration automatically includes:
- **Service Name**: `"mastra"`
- **Sampling**: `"always"`- Sample (100% of traces)
- **Exporters**:
  - `DefaultExporter` - Persists traces to your configured storage
  - `CloudExporter` - Sends traces to Mastra Cloud (requires `MASTRA_CLOUD_ACCESS_TOKEN`)
- **Processors**: `SensitiveDataFilter` - Automatically redacts sensitive fields

### Expanded Basic Config

This default configuration is a minimal helper that equates to this more verbose configuration:

```ts filename="src/mastra/index.ts" showLineNumbers copy
import { CloudExporter, DefaultExporter, SensitiveDataFilter } from '@mastra/core/ai-tracing';

export const mastra = new Mastra({
  // ... other config
  observability: {
    configs: {
      default: {
        serviceName: "mastra",
        sampling: { type: 'always' },
        processors: [
          new SensitiveDataFilter(),
        ],
        exporters: [
          new CloudExporter(),
          new DefaultExporter(),
        ],
      }
    }
  },
  storage: new LibSQLStore({
    url: "file:./mastra.db", // Storage is required for tracing
  }),
});
```


## Exporters

Exporters determine where your AI trace data is sent and how it's stored. Choosing the right exporters allows you to integrate with your existing observability stack, comply with data residency requirements, and optimize for cost and performance. You can use multiple exporters simultaneously to send the same trace data to different destinations — for example, storing detailed traces locally for debugging while sending sampled data to a cloud provider for production monitoring.

### Internal Exporters

Mastra provides two built-in exporters that work out of the box:

- **[Default](/docs/observability/ai-tracing/exporters/default)** - Persists traces to local storage for viewing in the Playground
- **[Cloud](/docs/observability/ai-tracing/exporters/cloud)** - Sends traces to Mastra Cloud for production monitoring and collaboration

### External Exporters

In addition to the internal exporters, Mastra supports integration with popular observability platforms. These exporters allow you to leverage your existing monitoring infrastructure and take advantage of platform-specific features like alerting, dashboards, and correlation with other application metrics.

- **[Braintrust](/docs/observability/ai-tracing/exporters/braintrust)** - Exports traces to Braintrust's eval and observability platform
- **[Langfuse](/docs/observability/ai-tracing/exporters/langfuse)** - Sends traces to the Langfuse open-source LLM engineering platform
- **[LangSmith](/docs/observability/ai-tracing/exporters/langsmith)** - Pushes traces into LangSmith’s observability and evaluation toolkit
- **[OpenTelemetry](/docs/observability/ai-tracing/exporters/otel)** - Deliver traces to any OpenTelemetry-compatible observability system
  - Supports: Dash0, Laminar, New Relic, SigNoz, Traceloop, Zipkin, and others!

- **Arize** - Coming soon!

## Sampling Strategies

Sampling allows you to control which traces are collected, helping you balance between observability needs and resource costs. In production environments with high traffic, collecting every trace can be expensive and unnecessary. Sampling strategies let you capture a representative subset of traces while ensuring you don't miss critical information about errors or important operations.

Mastra supports four sampling strategies:

### Always Sample
Collects 100% of traces. Best for development, debugging, or low-traffic scenarios where you need complete visibility.

```ts
sampling: { type: 'always' }
```

### Never Sample
Disables tracing entirely. Useful for specific environments where tracing adds no value or when you need to temporarily disable tracing without removing configuration.

```ts
sampling: { type: 'never' }
```

### Ratio-Based Sampling
Randomly samples a percentage of traces. Ideal for production environments where you want statistical insights without the cost of full tracing. The probability value ranges from 0 (no traces) to 1 (all traces).

```ts
sampling: {
  type: 'ratio',
  probability: 0.1  // Sample 10% of traces
}
```

### Custom Sampling
Implements your own sampling logic based on runtime context, metadata, or business rules. Perfect for complex scenarios like sampling based on user tier, request type, or error conditions.

```ts
sampling: {
  type: 'custom',
  sampler: (options) => {
    // Sample premium users at higher rate
    if (options?.metadata?.userTier === 'premium') {
      return Math.random() < 0.5; // 50% sampling
    }

    // Default 1% sampling for others
    return Math.random() < 0.01;
  }
}
```

### Complete Example

```ts filename="src/mastra/index.ts" showLineNumbers copy
export const mastra = new Mastra({
  observability: {
    configs: {
      "10_percent": {
        serviceName: 'my-service',
        // Sample 10% of traces
        sampling: {
          type: 'ratio',
          probability: 0.1
        },
        exporters: [new DefaultExporter()],
      }
    },
  },
});
```

## Multi-Config Setup

Complex applications often require different tracing configurations for different scenarios. You might want detailed traces with full sampling during development, sampled traces sent to external providers in production, and specialized configurations for specific features or customer segments. The `configSelector` function enables dynamic configuration selection at runtime, allowing you to route traces based on request context, environment variables, feature flags, or any custom logic.

This approach is particularly valuable when:
- Running A/B tests with different observability requirements
- Providing enhanced debugging for specific customers or support cases
- Gradually rolling out new tracing providers without affecting existing monitoring
- Optimizing costs by using different sampling rates for different request types
- Maintaining separate trace streams for compliance or data residency requirements

:::info

Note that only a single config can be used for a specific execution. But a single config can send data to multiple exporters simultaneously.

:::

### Dynamic Configuration Selection

Use `configSelector` to choose the appropriate tracing configuration based on runtime context:

```ts filename="src/mastra/index.ts" showLineNumbers copy
export const mastra = new Mastra({
  observability: {
    default: { enabled: true }, // Provides 'default' instance
    configs: {
      langfuse: {
        serviceName: 'langfuse-service',
        exporters: [langfuseExporter],
      },
      braintrust: {
        serviceName: 'braintrust-service',
        exporters: [braintrustExporter],
      },
      debug: {
        serviceName: 'debug-service',
        sampling: { type: 'always' },
        exporters: [new DefaultExporter()],
      },
    },
    configSelector: (context, availableTracers) => {
      // Use debug config for support requests
      if (context.runtimeContext?.get('supportMode')) {
        return 'debug';
      }

      // Route specific customers to different providers
      const customerId = context.runtimeContext?.get('customerId');
      if (customerId && premiumCustomers.includes(customerId)) {
        return 'braintrust';
      }

      // Route specific requests to langfuse
      if (context.runtimeContext?.get('useExternalTracing')) {
        return 'langfuse';
      }

      return 'default';
    },
  },
});
```

### Environment-Based Configuration

A common pattern is to select configurations based on deployment environment:

```ts filename="src/mastra/index.ts" showLineNumbers copy
export const mastra = new Mastra({
  observability: {
    configs: {
      development: {
        serviceName: 'my-service-dev',
        sampling: { type: 'always' },
        exporters: [new DefaultExporter()],
      },
      staging: {
        serviceName: 'my-service-staging',
        sampling: { type: 'ratio', probability: 0.5 },
        exporters: [langfuseExporter],
      },
      production: {
        serviceName: 'my-service-prod',
        sampling: { type: 'ratio', probability: 0.01 },
        exporters: [cloudExporter, langfuseExporter],
      },
    },
    configSelector: (context, availableTracers) => {
      const env = process.env.NODE_ENV || 'development';
      return env;
    },
  },
});
```

### Common Configuration Patterns & Troubleshooting

#### Default Config Takes Priority

When you have both the default config enabled and custom configs defined, **the default config will always be used** unless you explicitly select a different config:

```ts filename="src/mastra/index.ts" showLineNumbers copy
export const mastra = new Mastra({
  observability: {
    default: { enabled: true }, // This will always be used!
    configs: {
      langfuse: {
        serviceName: 'my-service',
        exporters: [langfuseExporter], // This won't be reached
      },
    },
  },
});
```

**Solutions:**

1. **Disable the default** and use only custom configs:
```ts
observability: {
  // comment out or remove this line to disable the default config
  // default: { enabled: true },
  configs: {
    langfuse: { /* ... */ }
  }
}
```

2. **Use a configSelector** to choose between configs:
```ts
observability: {
  default: { enabled: true },
  configs: {
    langfuse: { /* ... */ }
  },
  configSelector: (context, availableConfigs) => {
    // Logic to choose between 'default' and 'langfuse'
    return useExternalTracing ? 'langfuse' : 'default';
  }
}
```

#### Maintaining Playground and Cloud Access

When creating a custom config with external exporters, you might lose access to Mastra Playground and Cloud. To maintain access while adding external exporters, include the default exporters in your custom config:

```ts filename="src/mastra/index.ts" showLineNumbers copy
import { DefaultExporter, CloudExporter } from '@mastra/core/ai-tracing';
import { LangfuseExporter } from '@mastra/langfuse';

export const mastra = new Mastra({
  observability: {
    default: { enabled: false }, // Disable default to use custom
    configs: {
      production: {
        serviceName: 'my-service',
        exporters: [
          new LangfuseExporter(), // External exporter
          new DefaultExporter(),  // Keep Playground access
          new CloudExporter(),    // Keep Cloud access
        ],
      },
    },
  },
});
```

This configuration sends traces to all three destinations simultaneously:
- **Langfuse** for external observability
- **DefaultExporter** for local Playground access
- **CloudExporter** for Mastra Cloud dashboard

:::info

Remember: A single trace can be sent to multiple exporters. You don't need separate configs for each exporter unless you want different sampling rates or processors.

:::

## Adding Custom Metadata

Custom metadata allows you to attach additional context to your traces, making it easier to debug issues and understand system behavior in production. Metadata can include business logic details, performance metrics, user context, or any information that helps you understand what happened during execution.

You can add metadata to any span using the tracing context:

```ts showLineNumbers copy
execute: async ({ inputData, tracingContext }) => {
  const startTime = Date.now();
  const response = await fetch(inputData.endpoint);

  // Add custom metadata to the current span
  tracingContext.currentSpan?.update({
    metadata: {
      apiStatusCode: response.status,
      endpoint: inputData.endpoint,
      responseTimeMs: Date.now() - startTime,
      userTier: inputData.userTier,
      region: process.env.AWS_REGION,
    }
  });

  return await response.json();
}
```

Metadata set here will be shown in all configured exporters.

## Creating Child Spans

Child spans allow you to track fine-grained operations within your workflow steps or tools. They provide visibility into sub-operations like database queries, API calls, file operations, or complex calculations. This hierarchical structure helps you identify performance bottlenecks and understand the exact sequence of operations.

Create child spans inside a tool call or workflow step to track specific operations:

```ts showLineNumbers copy
execute: async ({ input, tracingContext }) => {
  // Create another child span for the main database operation
  const querySpan = tracingContext.currentSpan?.createChildSpan({
    type: 'generic',
    name: 'database-query',
    input: { query: input.query },
    metadata: { database: 'production' },
  });

  try {
    const results = await db.query(input.query);
    querySpan?.end({
      output: results.data,
      metadata: {
        rowsReturned: results.length,
        queryTimeMs: results.executionTime,
        cacheHit: results.fromCache
      }
    });
    return results;
  } catch (error) {
    querySpan?.error({
      error,
      metadata: { retryable: isRetryableError(error) }
    });
    throw error;
  }
}
```

Child spans automatically inherit the trace context from their parent, maintaining the relationship hierarchy in your observability platform.

## Span Processors

Span processors allow you to transform, filter, or enrich trace data before it's exported. They act as a pipeline between span creation and export, enabling you to modify spans for security, compliance, or debugging purposes. Mastra includes built-in processors and supports custom implementations.

### Built-in Processors

* [Sensitive Data Filter](/docs/observability/ai-tracing/processors/sensitive-data-filter) redacts sensitive information. It is enabled in the default observability config.

### Creating Custom Processors

You can create custom span processors by implementing the `AISpanProcessor` interface. Here's a simple example that converts all input text in spans to lowercase:

```ts filename="src/processors/lowercase-input-processor.ts" showLineNumbers copy
import type { AISpanProcessor, AnyAISpan } from '@mastra/core/ai-tracing';

export class LowercaseInputProcessor implements AISpanProcessor {
  name = 'lowercase-processor';

  process(span: AnyAISpan): AnyAISpan {
    span.input = `${span.input}`.toLowerCase()
    return span;
  }

  async shutdown(): Promise<void> {
    // Cleanup if needed
  }
}

// Use the custom processor
export const mastra = new Mastra({
  observability: {
    configs: {
      development: {
        processors: [
          new LowercaseInputProcessor(),
          new SensitiveDataFilter(),
        ],
        exporters: [new DefaultExporter()],
      },
    },
  },
});
```

Processors are executed in the order they're defined, allowing you to chain multiple transformations. Common use cases for custom processors include:
- Adding environment-specific metadata
- Filtering out spans based on criteria
- Normalizing data formats
- Sampling high-volume traces
- Enriching spans with business context

## Retrieving Trace IDs

When you execute agents or workflows with tracing enabled, the response includes a `traceId` that you can use to look up the full trace in your observability platform. This is useful for debugging, customer support, or correlating traces with other events in your system.

### Agent Trace IDs

Both `generate` and `stream` methods return the trace ID in their response:

```ts showLineNumbers copy
// Using generate
const result = await agent.generate({
  messages: [{ role: 'user', content: 'Hello' }]
});

console.log('Trace ID:', result.traceId);

// Using stream
const streamResult = await agent.stream({
  messages: [{ role: 'user', content: 'Tell me a story' }]
});

console.log('Trace ID:', streamResult.traceId);
```

### Workflow Trace IDs

Workflow executions also return trace IDs:

```ts showLineNumbers copy
// Create a workflow run
const run = await mastra.getWorkflow('myWorkflow').createRunAsync();

// Start the workflow
const result = await run.start({
  inputData: { data: 'process this' }
});

console.log('Trace ID:', result.traceId);

// Or stream the workflow
const { stream, getWorkflowState } = run.stream({
  inputData: { data: 'process this' }
});

// Get the final state which includes the trace ID
const finalState = await getWorkflowState();
console.log('Trace ID:', finalState.traceId);
```

### Using Trace IDs

Once you have a trace ID, you can:

1. **Look up traces in Mastra Playground**: Navigate to the traces view and search by ID
2. **Query traces in external platforms**: Use the ID in Langfuse, Braintrust, or your observability platform
3. **Correlate with logs**: Include the trace ID in your application logs for cross-referencing
4. **Share for debugging**: Provide trace IDs to support teams or developers for investigation

The trace ID is only available when tracing is enabled. If tracing is disabled or sampling excludes the request, `traceId` will be `undefined`.

## What Gets Traced

Mastra automatically creates spans for:

### Agent Operations
- **Agent runs** - Complete execution with instructions and tools
- **LLM calls** - Model interactions with tokens and parameters
- **Tool executions** - Function calls with inputs and outputs
- **Memory operations** - Thread and semantic recall

### Workflow Operations
- **Workflow runs** - Full execution from start to finish
- **Individual steps** - Step processing with inputs/outputs
- **Control flow** - Conditionals, loops, parallel execution
- **Wait operations** - Delays and event waiting

## Viewing Traces

Traces are available in multiple locations:

- **Mastra Playground** - Local development environment
- **Mastra Cloud** - Production monitoring dashboard
- **Langfuse Dashboard** - When using Langfuse exporter
- **Braintrust Console** - When using Braintrust exporter

## See Also

### Examples
- [Basic AI Tracing Example](/examples/observability/basic-ai-tracing) - Working implementation

### Reference Documentation
- [Configuration API](/reference/observability/ai-tracing/configuration) - ObservabilityConfig details
- [AITracing Classes](/reference/observability/ai-tracing/ai-tracing) - Core classes and methods
- [Span Interfaces](/reference/observability/ai-tracing/span) - Span types and lifecycle
- [Type Definitions](/reference/observability/ai-tracing/interfaces) - Complete interface reference

### Exporters
- [DefaultExporter](/reference/observability/ai-tracing/exporters/default-exporter) - Storage persistence
- [CloudExporter](/reference/observability/ai-tracing/exporters/cloud-exporter) - Mastra Cloud integration
- [ConsoleExporter](/reference/observability/ai-tracing/exporters/console-exporter) - Debug output
- [Langfuse](/reference/observability/ai-tracing/exporters/langfuse) - Langfuse integration
- [Braintrust](/reference/observability/ai-tracing/exporters/braintrust) - Braintrust integration
- [OpenTelemetry](/reference/observability/ai-tracing/exporters/otel) - OTEL-compatible platforms

### Processors
- [Sensitive Data Filter](/docs/observability/ai-tracing/processors/sensitive-data-filter) - Data redaction
