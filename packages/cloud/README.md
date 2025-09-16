# @mastra/cloud

The official integration package for Mastra Cloud services - seamlessly connect your Mastra applications with cloud-based capabilities and telemetry.

## Installation

```bash
npm install @mastra/cloud
# or
yarn add @mastra/cloud
# or
pnpm add @mastra/cloud
```

## Features

#### API Reference

##### `MastraCloudAITracingExporter`

A custom AI tracing exporter that sends AI span data to Mastra Cloud for observability and monitoring.

###### Constructor Options

- `accessToken` (required): Your Mastra Cloud access token
- `endpoint` (optional): Custom endpoint URL for sending AI tracing data (defaults to `https://api.mastra.ai/ai/spans/publish`)
- `maxBatchSize` (optional): Maximum number of spans to batch before sending (default: 1000)
- `maxBatchWaitMs` (optional): Maximum time to wait before sending a batch in milliseconds (default: 5000)
- `maxRetries` (optional): Maximum number of retry attempts for failed requests (default: 3)
- `logger` (optional): Logger instance compatible with the Mastra Logger interface

### Telemetry

The package currently provides OpenTelemetry integration with Mastra Cloud for instrumenting and collecting telemetry data from your applications.

```typescript
import { PinoLogger } from '@mastra/loggers';
import { MastraCloudExporter } from '@mastra/cloud';

// Initialize the exporter with your access token
const exporter = new MastraCloudExporter({
  accessToken: process.env.MASTRA_CLOUD_ACCESS_TOKEN, // Your Mastra Cloud access token
  logger: yourLoggerInstance, // Optional logger
  endpoint: 'https://mastra-cloud-endpoint.example.com', // Mastra cloud endpoint
});

// Use with Mastra instance
export const mastra = new Mastra({
  agents: { agent },
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  telemetry: {
    serviceName: 'My-Agent',
    enabled: true,
    sampling: {
      type: 'always_on',
    },
    export: {
      type: 'custom',
      exporter: new MastraCloudExporter({
        accessToken: process.env.MASTRA_CLOUD_ACCESS_TOKEN,
      }),
    },
  },
});
```

#### API Reference

##### `MastraCloudExporter`

A custom OpenTelemetry exporter that sends telemetry data to Mastra Cloud.

###### Constructor Options

- `accessToken` (required): Your Mastra Cloud access token
- `endpoint` (optional): Custom endpoint URL for sending telemetry data
- `logger` (optional): Logger instance compatible with the Mastra Logger interface

## Support

For questions, issues, or feature requests, please reach out through the official Mastra support channels.
