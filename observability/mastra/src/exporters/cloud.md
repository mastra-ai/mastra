### AI Tracing

Track and monitor AI operations and spans with the `CloudExporter`:

```typescript
import { CloudExporter } from '@mastra/core/ai-tracing';

// Initialize the AI tracing exporter
const cloudExporter = new CloudExporter({
  accessToken: process.env.MASTRA_CLOUD_ACCESS_TOKEN, // Your Mastra Cloud access token
  endpoint: 'https://api.mastra.ai/ai/spans/publish', // Optional: custom endpoint
  logger: yourLoggerInstance, // Optional logger
});

// Use with Mastra instance
export const mastra = new Mastra({
  agents: { agent },
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  observability: {
    configs: {
      cloud: {
        serviceName: 'service',
        exporters: [cloudExporter],
      },
    },
  },
});
```

**Required Environment Variable:**

- `MASTRA_CLOUD_ACCESS_TOKEN`: Your Mastra Cloud access token (generated from your Mastra Cloud project)
