# @mastra/laminar

Laminar observability exporter for Mastra applications.

Exports Mastra spans to Laminar via OTLP/HTTP (protobuf) and supports sending scorer results to Laminar Evaluators.

## Installation

```bash
npm install @mastra/laminar
```

## Usage

### Zero-Config Setup

The exporter automatically reads credentials from environment variables:

```bash
# Required
LMNR_PROJECT_API_KEY=lmnr_...

# Optional
LMNR_BASE_URL=https://api.lmnr.ai
LAMINAR_ENDPOINT=https://api.lmnr.ai/v1/traces
```

```ts
import { LaminarExporter } from '@mastra/laminar';

const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      laminar: {
        serviceName: 'my-service',
        exporters: [new LaminarExporter()],
      },
    },
  },
});
```

### Explicit Configuration

```ts
import { LaminarExporter } from '@mastra/laminar';

const mastra = new Mastra({
  ...,
  observability: {
    configs: {
      laminar: {
        serviceName: 'my-service',
        exporters: [
          new LaminarExporter({
            apiKey: 'lmnr_...',
            baseUrl: 'https://api.lmnr.ai',
            endpoint: 'https://api.lmnr.ai/v1/traces', // Optional
            realtime: false, // Optional
          }),
        ],
      },
    },
  },
});
```

### Configuration Options

| Option          | Type                    | Description                                                                       |
| --------------- | ----------------------- | --------------------------------------------------------------------------------- |
| `apiKey`        | `string`                | Laminar project API key. Defaults to `LMNR_PROJECT_API_KEY` env var               |
| `baseUrl`       | `string`                | Laminar base URL. Defaults to `LMNR_BASE_URL` env var or `https://api.lmnr.ai`    |
| `endpoint`      | `string`                | OTLP/HTTP traces endpoint. Defaults to `LAMINAR_ENDPOINT` env var or `/v1/traces` |
| `headers`       | `Record<string,string>` | Additional OTLP headers                                                           |
| `realtime`      | `boolean`               | Flush after each span for immediate visibility. Defaults to `false`               |
| `disableBatch`  | `boolean`               | Disable batching (SimpleSpanProcessor). Defaults to `false`                       |
| `batchSize`     | `number`                | Max spans per batch (BatchSpanProcessor). Defaults to `512`                       |
| `timeoutMillis` | `number`                | OTLP export timeout (ms). Defaults to `30000`                                     |

## Notes

- The exporter sets Laminar-specific attributes (`lmnr.span.*`, `lmnr.association.properties.*`) so traces render correctly in Laminar.
