import { describe, it, expect } from 'vitest';
import { AzureOpenAIGateway } from './azure.js';

// This is an integration test that hits the real Azure Management API
// Run with: pnpm test azure.integration.test.ts

describe('AzureOpenAIGateway - Real API Integration', () => {
  const hasManagementCreds =
    process.env.AZURE_TENANT_ID &&
    process.env.AZURE_CLIENT_ID &&
    process.env.AZURE_CLIENT_SECRET &&
    process.env.AZURE_SUBSCRIPTION_ID &&
    process.env.AZURE_RESOURCE_GROUP &&
    process.env.AZURE_RESOURCE_NAME &&
    process.env.AZURE_API_KEY;

  const skipMessage = hasManagementCreds
    ? undefined
    : 'Skipping Azure integration tests - required credentials not found. Required: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_SUBSCRIPTION_ID, AZURE_RESOURCE_GROUP, AZURE_RESOURCE_NAME, AZURE_API_KEY';

  it.skipIf(!hasManagementCreds)(
    'should fetch real deployments from Azure Management API with discovery mode',
    async () => {
      const gateway = new AzureOpenAIGateway({
        resourceName: process.env.AZURE_RESOURCE_NAME!,
        apiKey: process.env.AZURE_API_KEY!,
        management: {
          tenantId: process.env.AZURE_TENANT_ID!,
          clientId: process.env.AZURE_CLIENT_ID!,
          clientSecret: process.env.AZURE_CLIENT_SECRET!,
          subscriptionId: process.env.AZURE_SUBSCRIPTION_ID!,
          resourceGroup: process.env.AZURE_RESOURCE_GROUP!,
        },
      });

      const providers = await gateway.fetchProviders();

      expect(providers).toBeDefined();
      expect(typeof providers).toBe('object');
      expect(Object.keys(providers).length).toBeGreaterThan(0);

      console.log(`\nFetched ${Object.keys(providers).length} providers from Azure Management API`);
      console.log('Providers:', Object.keys(providers));

      expect(Object.keys(providers)).toEqual(['azure-openai']);
      expect(providers['azure-openai']).toBeDefined();

      const azureProvider = providers['azure-openai'];

      expect(azureProvider.apiKeyHeader, 'Provider azure-openai missing apiKeyHeader').toBeDefined();
      expect(azureProvider.apiKeyHeader).toBe('api-key');

      expect(azureProvider.name, 'Provider azure-openai missing name').toBeDefined();
      expect(typeof azureProvider.name).toBe('string');
      expect(azureProvider.name).toBe('Azure OpenAI');

      expect(azureProvider.gateway, 'Provider azure-openai missing gateway').toBeDefined();
      expect(azureProvider.gateway).toBe('azure-openai');

      expect(azureProvider.docUrl, 'Provider azure-openai missing docUrl').toBeDefined();
      expect(azureProvider.docUrl).toBe('https://learn.microsoft.com/en-us/azure/ai-services/openai/');

      expect(azureProvider.models, 'Provider azure-openai missing models').toBeDefined();
      expect(Array.isArray(azureProvider.models)).toBe(true);
      expect(azureProvider.models.length).toBeGreaterThan(0);
    },
    30000,
  );

  it.skipIf(!hasManagementCreds)(
    'should create language model with resolveLanguageModel',
    async () => {
      const gateway = new AzureOpenAIGateway({
        resourceName: process.env.AZURE_RESOURCE_NAME!,
        apiKey: process.env.AZURE_API_KEY!,
        management: {
          tenantId: process.env.AZURE_TENANT_ID!,
          clientId: process.env.AZURE_CLIENT_ID!,
          clientSecret: process.env.AZURE_CLIENT_SECRET!,
          subscriptionId: process.env.AZURE_SUBSCRIPTION_ID!,
          resourceGroup: process.env.AZURE_RESOURCE_GROUP!,
        },
      });

      const providers = await gateway.fetchProviders();
      const deployments = providers['azure-openai'].models;

      expect(deployments.length).toBeGreaterThan(0);

      const deploymentName = deployments[0];
      const model = await gateway.resolveLanguageModel({
        modelId: deploymentName,
        providerId: 'azure-openai',
        apiKey: process.env.AZURE_API_KEY!,
      });

      expect(model).toBeDefined();

      console.log(`\n✅ Successfully created language model for deployment: ${deploymentName}`);
    },
    30000,
  );

  if (!hasManagementCreds) {
    it('should skip all tests when credentials are missing', () => {
      console.log(`\n${skipMessage}`);
    });
  }
});
