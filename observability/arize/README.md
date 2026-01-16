# @mastra/arize - OpenTelemetry + OpenInference Tracing Exporter

Export Mastra traces to any OpenTelemetry observability platform that supports OpenInference, like [Arize AX](https://arize.com/generative-ai/), or [Phoenix](https://phoenix.arize.com/).

For more information on OpenInference, see the [OpenInference Semantic Conventions](https://github.com/Arize-ai/openinference/tree/main/spec) specification.

## Installation

```bash
npm install @mastra/arize
```

## Configuration

You can add `ArizeExporter` to your Mastra configuration to export traces to Arize AX or Phoenix, or any other OpenTelemetry compatible observability platform that supports OpenInference.

The exporter automatically reads credentials from environment variables, enabling zero-config setup.

### Phoenix (Zero-Config)

Set environment variables and use zero-config:

```bash
# Required - endpoint must end in /v1/traces
PHOENIX_ENDPOINT=http://localhost:6006/v1/traces

# Optional - for authenticated Phoenix instances
PHOENIX_API_KEY=your-api-key

# Optional - project name
PHOENIX_PROJECT_NAME=my-project
```

```typescript
import { ArizeExporter } from '@mastra/arize';
import { Mastra } from '@mastra/core/mastra';

const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      arize: {
        serviceName: 'my-service',
        exporters: [new ArizeExporter()],
      },
    },
  },
});
```

### Phoenix (Explicit Configuration)

```typescript
import { ArizeExporter } from '@mastra/arize';
import { Mastra } from '@mastra/core/mastra';

const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      arize: {
        serviceName: 'my-service',
        exporters: [
          new ArizeExporter({
            endpoint: 'http://localhost:6006/v1/traces',
            apiKey: 'your-api-key', // Optional
            projectName: 'my-project', // Optional
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

### Arize AX (Zero-Config)

Set environment variables and use zero-config:

```bash
# Required
ARIZE_SPACE_ID=your-space-id
ARIZE_API_KEY=your-api-key

# Optional
ARIZE_PROJECT_NAME=my-project
```

```typescript
import { ArizeExporter } from '@mastra/arize';
import { Mastra } from '@mastra/core/mastra';

const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      arize: {
        serviceName: 'my-service',
        exporters: [new ArizeExporter()],
      },
    },
  },
});
```

### Arize AX (Explicit Configuration)

```typescript
import { ArizeExporter } from '@mastra/arize';
import { Mastra } from '@mastra/core/mastra';

const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      arize: {
        serviceName: 'my-service',
        exporters: [
          new ArizeExporter({
            spaceId: 'your-space-id',
            apiKey: 'your-api-key',
            projectName: 'my-project', // Optional
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

### Custom metadata

Any custom span attributes that are not part of the standard Mastra/OpenInference fields are serialized into the OpenInference `metadata` payload and shown in Arize/Phoenix. An easy way to add them is through `tracingOptions.metadata`:

```ts
await agent.generate(input, {
  tracingOptions: {
    metadata: {
      companyId: 'acme-co',
    },
  },
});
```

## OpenInference Semantic Conventions

This exporter follows the [OpenInference Semantic Conventions](https://github.com/Arize-ai/openinference/tree/main/spec) for generative AI applications.

## License

Apache 2.0
