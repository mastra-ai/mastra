---
"@mastra/core": patch
---

Add Azure OpenAI gateway

The Azure OpenAI gateway supports three configuration modes:

1. **Static deployments**: Provide deployment names from Azure Portal
2. **Dynamic discovery**: Query Azure Management API for available deployments
3. **Manual**: Specify deployment names when creating agents

**Usage**

```typescript
import { Mastra } from "@mastra/core";
import { AzureOpenAIGateway } from "@mastra/core/llm";

// Static mode (recommended)
export const mastra = new Mastra({
  gateways: [
    new AzureOpenAIGateway({
      resourceName: process.env.AZURE_RESOURCE_NAME!,
      apiKey: process.env.AZURE_API_KEY!,
      deployments: ["gpt-4-prod", "gpt-35-turbo-dev"],
    }),
  ],
});

// Dynamic discovery mode
export const mastra = new Mastra({
  gateways: [
    new AzureOpenAIGateway({
      resourceName: process.env.AZURE_RESOURCE_NAME!,
      apiKey: process.env.AZURE_API_KEY!,
      management: {
        tenantId: process.env.AZURE_TENANT_ID!,
        clientId: process.env.AZURE_CLIENT_ID!,
        clientSecret: process.env.AZURE_CLIENT_SECRET!,
        subscriptionId: process.env.AZURE_SUBSCRIPTION_ID!,
        resourceGroup: "my-resource-group",
      },
    }),
  ],
});

// Use Azure OpenAI models
const agent = new Agent({
  model: "azure-openai/gpt-4-deployment",
  instructions: "You are a helpful assistant"
});
```