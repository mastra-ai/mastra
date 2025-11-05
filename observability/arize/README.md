# @mastra/arize - OpenTelemetry + OpenInference Tracing Exporter

Export Mastra traces to any OpenTelemetry observability platform that supports OpenInference, like [Arize AX](https://arize.com/generative-ai/), or [Phoenix](https://phoenix.arize.com/).

For more information on OpenInference, see the [OpenInference Semantic Conventions](https://github.com/Arize-ai/openinference/tree/main/spec) specification.

## Installation

```bash
npm install @mastra/arize
```

## Configuration

You can add `ArizeExporter` to your Mastra configuration to export traces to Arize AX or Phoenix, or any other OpenTelemetry compatible observability platform that supports OpenInference.

### Phoenix

```typescript
import { ArizeExporter } from '@mastra/arize';
import { Mastra } from '@mastra/core/mastra';

// required, ends in /v1/traces
const ENDPOINT = process.env.PHOENIX_ENDPOINT!;
// optional if using unauthenticated Phoenix instance
const API_KEY = process.env.PHOENIX_API_KEY;
// optional, determines the project name in Phoenix
const PROJECT_NAME = process.env.PHOENIX_PROJECT_NAME || 'mastra-service';

const mastra = new Mastra({
  ...,
  observability: {
    // Enables ArizeExporter for tracing
    configs: {
      arize: {
        serviceName: PROJECT_NAME,
        exporters: [
          new ArizeExporter({
            endpoint: ENDPOINT,
            apiKey: API_KEY,
            projectName: PROJECT_NAME,
          }),
        ],
      },
    },
  },
});
```

> [!TIP]
> You can easily use this exporter with both [self-hosted Phoenix](https://docs.arize.com/phoenix/deployment), or, [Phoenix Cloud](https://app.phoenix.arize.com/login).
>
> To quickly verify functionality, you can try out a local in-memory Phoenix instance:
>
> ```bash
> docker run --pull=always -d --name arize-phoenix -p 6006:6006 -e PHOENIX_SQL_DATABASE_URL="sqlite:///:memory:" arizephoenix/phoenix:latest
> ```
>
> Configure your `ArizeExporter` endpoint to `http://localhost:6006/v1/traces` and run the default Mastra weather agent to see traces!

### Arize AX

```typescript
import { ArizeExporter } from '@mastra/arize';
import { Mastra } from '@mastra/core/mastra';

// required space destination for trace exports
const SPACE_ID = process.env.ARIZE_SPACE_ID!;
// Arize AX API key
const API_KEY = process.env.ARIZE_API_KEY!;
// optional, determines the project name in Arize AX
const PROJECT_NAME = process.env.ARIZE_PROJECT_NAME || 'mastra-service';

const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      arize: {
        serviceName: PROJECT_NAME,
        exporters: [
          new ArizeExporter({
            apiKey: process.env.ARIZE_API_KEY!,
            spaceId: SPACE_ID,
            projectName: PROJECT_NAME,
          }),
        ],
      },
    },
  },
});
```

> [!TIP]
> Need an Arize AX API key? [Get one here](https://app.arize.com/).

## Optional Configuration

You can configure the `ArizeExporter` to tweak the underlying OpenTelemetry `BatchSpanProcessor`, or add additional resource attributes to each span.

```typescript
import { ArizeExporter } from '@mastra/arize';
import { Mastra } from '@mastra/core/mastra';

const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      arize: {
        serviceName: 'mastra-service',
        exporters: [
          new ArizeExporter({
            // Required at runtime
            endpoint: 'https://your-collector.example.com/v1/traces',
            // Required if using authenticated endpoint
            apiKey: "your-api-key",
            // Optional headers to be added to each OTLP request, in addition to authentication headers
            headers: {
              'x-api-key': process.env.API_KEY,
            },
            // Optional log level for debugging the exporter
            logLevel: 'debug',
            // Optional batch size for the underlying BatchSpanProcessor, before spans are exported
            batchSize: 512,
            // Optional timeout for the underlying BatchSpanProcessor, before spans are exported
            timeout: 30000,
            // Optional resource attributes to be added to each span
            resourceAttributes: {
              'custom.attribute': 'value',
            },
          })
        ],
      },
    },
  },
});
```

## OpenInference Semantic Conventions

This exporter follows the [OpenInference Semantic Conventions](https://github.com/Arize-ai/openinference/tree/main/spec) for generative AI applications.

## License

Apache 2.0
