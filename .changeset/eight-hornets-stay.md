---
'@mastra/core': minor
---

Added Azure OpenAI Responses API and v1 routing controls.

Use `useResponsesAPI: true` to resolve Azure deployments through the Responses API with the Azure v1 route by default:

```ts
new AzureOpenAIGateway({
  resourceName: "my-openai-resource",
  apiKey: process.env.AZURE_API_KEY!,
  useResponsesAPI: true,
  deployments: ["my-gpt-5-4-deployment"],
})
```

When `useDeploymentBasedUrls: false` is used directly, the gateway now defaults `apiVersion` to `"v1"` to match the AI SDK Azure provider's v1 URL route. Passing `apiVersion: "v1"` by itself keeps the existing deployment-based URL default for compatibility.
