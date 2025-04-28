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

### Telemetry

The package currently provides OpenTelemetry integration with Mastra Cloud for instrumenting and collecting telemetry data from your applications.

```typescript
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
  logger: createLogger({
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

## API Reference

### `MastraCloudExporter`

A custom OpenTelemetry exporter that sends telemetry data to Mastra Cloud.

#### Constructor Options

- `accessToken` (required): Your Mastra Cloud access token
- `endpoint` (optional): Custom endpoint URL for sending telemetry data
- `logger` (optional): Logger instance compatible with the Mastra Logger interface

## License

This package is covered by the license specified in the project repository.

## Support

For questions, issues, or feature requests, please reach out through the official Mastra support channels.
