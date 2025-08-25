# @mastra/coralogix

Coralogix AI Observability exporter for Mastra using OpenTelemetry.

This package provides a custom OpenTelemetry span exporter that sends telemetry data to Coralogix using the proper OTLP protobuf format.

## Installation

```bash
npm install @mastra/coralogix
# or
pnpm add @mastra/coralogix
# or
yarn add @mastra/coralogix
```

## Usage

```typescript
import { Mastra } from '@mastra/core';
import { CoralogixExporter } from '@mastra/coralogix';

export const mastra = new Mastra({
  // ... other config
  telemetry: {
    serviceName: 'your-service-name',
    enabled: true,
    export: {
      type: 'custom',
      exporter: new CoralogixExporter({
        token: process.env.CX_TOKEN,
        endpoint: process.env.CX_ENDPOINT,
        applicationName: process.env.CX_APPLICATION_NAME,
        subsystemName: process.env.CX_SUBSYSTEM_NAME,
        debug: false, // Optional: enable debug logging
      }),
    },
  },
});
```

## Configuration

### Environment Variables

You can configure the exporter using environment variables:

- `CX_TOKEN`: Your Coralogix private key (required)
- `CX_ENDPOINT`: Coralogix traces endpoint (required)
- `CX_APPLICATION_NAME`: Application name in Coralogix (required)
- `CX_SUBSYSTEM_NAME`: Subsystem name in Coralogix (required)

### Constructor Options

- `token?: string` - Coralogix private key (overrides CX_TOKEN)
- `endpoint?: string` - Coralogix endpoint URL (overrides CX_ENDPOINT)
- `applicationName?: string` - Application name (overrides CX_APPLICATION_NAME)
- `subsystemName?: string` - Subsystem name (overrides CX_SUBSYSTEM_NAME)
- `debug?: boolean` - Enable debug logging (default: false)

## Coralogix Endpoints by Region

Choose the correct endpoint for your Coralogix region:

- **US1**: `https://ingress.coralogix.us/v1/traces`
- **US2**: `https://ingress.us2.coralogix.com/v1/traces`
- **EU1**: `https://ingress.coralogix.com/v1/traces`
- **EU2**: `https://ingress.eu2.coralogix.com/v1/traces`
- **AP1**: `https://ingress.app.coralogix.in/v1/traces`
- **AP2**: `https://ingress.coralogixsg.com/v1/traces`

## Features

- ✅ Uses proper OTLP protobuf format (not JSON)
- ✅ Proper error handling and retry logic
- ✅ Support for environment variable configuration
- ✅ Debug logging support
- ✅ Full OpenTelemetry SpanExporter interface compliance
