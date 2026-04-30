---
'@mastra/core': minor
---

Added Microsoft Entra ID authentication support for Azure OpenAI gateways, so Azure deployments can call models without API keys when using Azure SDK credentials.

```ts
import { DefaultAzureCredential } from "@azure/identity";
import { AzureOpenAIGateway } from "@mastra/core/llm";

new AzureOpenAIGateway({
  resourceName: "my-openai-resource",
  authentication: {
    type: "entraId",
    credential: new DefaultAzureCredential(),
  },
});
```
