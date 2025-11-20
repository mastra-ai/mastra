---
"@mastra/core": minor
---

Add Azure OpenAI gateway with automatic deployment discovery

The Azure OpenAI gateway queries Azure's Management API to discover available model deployments at runtime. When Management API credentials are configured, deployments are automatically discovered and made available for IDE autocomplete in dev mode. The gateway gracefully falls back to basic functionality when credentials are missing.

Use Azure OpenAI models with the `azureopenai/<deployment-name>` format:

```typescript
const agent = new Agent({
  model: "azureopenai/gpt-4-deployment",
  instructions: "You are a helpful assistant"
});
```

Required environment variables:
- `AZURE_RESOURCE_NAME`: Your Azure OpenAI resource name
- `AZURE_API_KEY`: API key from Azure Portal

Optional Management API credentials for deployment discovery:
- `AZURE_TENANT_ID`: Azure AD tenant ID
- `AZURE_CLIENT_ID`: Service Principal client ID
- `AZURE_CLIENT_SECRET`: Service Principal secret
- `AZURE_SUBSCRIPTION_ID`: Azure subscription ID
- `AZURE_RESOURCE_GROUP`: Resource group name