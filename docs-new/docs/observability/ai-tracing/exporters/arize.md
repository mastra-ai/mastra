---
title: "Arize"
description: "Send AI traces to Arize Phoenix or Arize AX using OpenTelemetry and OpenInference"
---

# Arize Exporter

[Arize](https://arize.com/) provides observability platforms for AI applications through [Phoenix](https://phoenix.arize.com/) (open-source) and [Arize AX](https://arize.com/generative-ai/) (enterprise). The Arize exporter sends AI traces using OpenTelemetry and [OpenInference](https://github.com/Arize-ai/openinference/tree/main/spec) semantic conventions, compatible with any OpenTelemetry platform that supports OpenInference.

## When to Use Arize

Arize is ideal when you need:

- **OpenInference standards** - Industry-standard semantic conventions for AI traces
- **Flexible deployment** - Self-hosted Phoenix or managed Arize AX
- **OpenTelemetry compatibility** - Works with any OTLP-compatible platform
- **Comprehensive AI observability** - LLM traces, embeddings, and retrieval analytics
- **Open-source option** - Full-featured local deployment with Phoenix

## Installation

```bash npm2yarn
npm install @mastra/arize
```

## Configuration

### Phoenix Setup

Phoenix is an open-source observability platform that can be self-hosted or used via Phoenix Cloud.

#### Prerequisites

1. **Phoenix Instance**: Deploy using Docker or sign up at [Phoenix Cloud](https://app.phoenix.arize.com/login)
2. **Endpoint**: Your Phoenix endpoint URL (ends in `/v1/traces`)
3. **API Key**: Optional for unauthenticated instances, required for Phoenix Cloud
4. **Environment Variables**: Set your configuration

```bash filename=".env"
PHOENIX_ENDPOINT=http://localhost:6006/v1/traces  # Or your Phoenix Cloud URL
PHOENIX_API_KEY=your-api-key  # Optional for local instances
PHOENIX_PROJECT_NAME=mastra-service  # Optional, defaults to 'mastra-service'
```

#### Basic Setup

```typescript filename="src/mastra/index.ts"
import { Mastra } from "@mastra/core";
import { ArizeExporter } from "@mastra/arize";

export const mastra = new Mastra({
  observability: {
    configs: {
      arize: {
        serviceName: process.env.PHOENIX_PROJECT_NAME || "mastra-service",
        exporters: [
          new ArizeExporter({
            endpoint: process.env.PHOENIX_ENDPOINT!,
            apiKey: process.env.PHOENIX_API_KEY,
            projectName: process.env.PHOENIX_PROJECT_NAME,
          }),
        ],
      },
    },
  },
});
```

:::info

**Quick Start with Docker**

Test locally with an in-memory Phoenix instance:

```bash
docker run --pull=always -d --name arize-phoenix -p 6006:6006 \
  -e PHOENIX_SQL_DATABASE_URL="sqlite:///:memory:" \
  arizephoenix/phoenix:latest
```

Set `PHOENIX_ENDPOINT=http://localhost:6006/v1/traces` and run your Mastra agent to see traces at [localhost:6006](http://localhost:6006).
:::

### Arize AX Setup

Arize AX is an enterprise observability platform with advanced features for production AI systems.

#### Prerequisites

1. **Arize AX Account**: Sign up at [app.arize.com](https://app.arize.com/)
2. **Space ID**: Your organization's space identifier
3. **API Key**: Generate in Arize AX settings
4. **Environment Variables**: Set your credentials

```bash filename=".env"
ARIZE_SPACE_ID=your-space-id
ARIZE_API_KEY=your-api-key
ARIZE_PROJECT_NAME=mastra-service  # Optional
```

#### Basic Setup

```typescript filename="src/mastra/index.ts"
import { Mastra } from "@mastra/core";
import { ArizeExporter } from "@mastra/arize";

export const mastra = new Mastra({
  observability: {
    configs: {
      arize: {
        serviceName: process.env.ARIZE_PROJECT_NAME || "mastra-service",
        exporters: [
          new ArizeExporter({
            apiKey: process.env.ARIZE_API_KEY!,
            spaceId: process.env.ARIZE_SPACE_ID!,
            projectName: process.env.ARIZE_PROJECT_NAME,
          }),
        ],
      },
    },
  },
});
```

## Configuration Options

The Arize exporter supports advanced configuration for fine-tuning OpenTelemetry behavior:

### Complete Configuration

```typescript
new ArizeExporter({
  // Phoenix Configuration
  endpoint: "https://your-collector.example.com/v1/traces", // Required for Phoenix

  // Arize AX Configuration
  spaceId: "your-space-id", // Required for Arize AX

  // Shared Configuration
  apiKey: "your-api-key", // Required for authenticated endpoints
  projectName: "mastra-service", // Optional project name

  // Optional OTLP settings
  headers: {
    "x-custom-header": "value", // Additional headers for OTLP requests
  },

  // Debug and performance tuning
  logLevel: "debug", // Logging: debug | info | warn | error
  batchSize: 512, // Batch size before exporting spans
  timeout: 30000, // Timeout in ms before exporting spans

  // Custom resource attributes
  resourceAttributes: {
    "deployment.environment": process.env.NODE_ENV,
    "service.version": process.env.APP_VERSION,
  },
});
```

### Batch Processing Options

Control how traces are batched and exported:

```typescript
new ArizeExporter({
  endpoint: process.env.PHOENIX_ENDPOINT!,
  apiKey: process.env.PHOENIX_API_KEY,

  // Batch processing configuration
  batchSize: 512, // Number of spans to batch (default: 512)
  timeout: 30000, // Max time in ms to wait before export (default: 30000)
});
```

### Resource Attributes

Add custom attributes to all exported spans:

```typescript
new ArizeExporter({
  endpoint: process.env.PHOENIX_ENDPOINT!,
  resourceAttributes: {
    "deployment.environment": process.env.NODE_ENV,
    "service.namespace": "production",
    "service.instance.id": process.env.HOSTNAME,
    "custom.attribute": "value",
  },
});
```

## OpenInference Semantic Conventions

This exporter implements the [OpenInference Semantic Conventions](https://github.com/Arize-ai/openinference/tree/main/spec) for generative AI applications, providing standardized trace structure across different observability platforms.

## Related

- [AI Tracing Overview](/docs/observability/ai-tracing/overview)
- [Phoenix Documentation](https://docs.arize.com/phoenix)
- [Arize AX Documentation](https://docs.arize.com/)
- [OpenInference Specification](https://github.com/Arize-ai/openinference/tree/main/spec)
