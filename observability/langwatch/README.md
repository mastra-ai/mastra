# @mastra/langwatch

LangWatch observability exporter for [Mastra](https://mastra.ai). Sends traces to [LangWatch](https://langwatch.ai) via OTLP/HTTP (protobuf).

## Installation

```bash
npm install @mastra/langwatch
```

## Quick Start

Set your API key:

```bash
LANGWATCH_API_KEY=your-api-key
```

Then use the exporter:

```typescript
import { Mastra } from "@mastra/core";
import { Observability } from "@mastra/observability";
import { LangwatchExporter } from "@mastra/langwatch";

export const mastra = new Mastra({
  observability: new Observability({
    configs: {
      langwatch: {
        serviceName: "my-service",
        exporters: [new LangwatchExporter()],
      },
    },
  }),
});
```

## Configuration

| Option     | Env Variable         | Description                     |
| ---------- | -------------------- | ------------------------------- |
| `apiKey`   | `LANGWATCH_API_KEY`  | LangWatch API key (required)    |
| `endpoint` | `LANGWATCH_ENDPOINT` | Custom OTLP endpoint (optional) |

## License

Apache-2.0
