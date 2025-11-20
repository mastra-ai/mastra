import { describe, it, expect } from 'vitest';
import { AzureOpenAIGateway } from './azure.js';

// This is an integration test that hits the real Azure Management API
// Run with: pnpm test azure.integration.test.ts

describe('AzureOpenAIGateway - Real API Integration', () => {
  const gateway = new AzureOpenAIGateway();

  const credentials = {
    AZURE_TENANT_ID: process.env.AZURE_TENANT_ID,
    AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET: process.env.AZURE_CLIENT_SECRET,
    AZURE_SUBSCRIPTION_ID: process.env.AZURE_SUBSCRIPTION_ID,
    AZURE_RESOURCE_GROUP: process.env.AZURE_RESOURCE_GROUP,
    AZURE_RESOURCE_NAME: process.env.AZURE_RESOURCE_NAME,
    AZURE_API_KEY: process.env.AZURE_API_KEY,
  };

  const hasCredentials =
    process.env.AZURE_TENANT_ID &&
    process.env.AZURE_CLIENT_ID &&
    process.env.AZURE_CLIENT_SECRET &&
    process.env.AZURE_SUBSCRIPTION_ID &&
    process.env.AZURE_RESOURCE_GROUP &&
    process.env.AZURE_RESOURCE_NAME &&
    process.env.AZURE_API_KEY;

  const skipMessage = hasCredentials
    ? undefined
    : `Skipping Azure integration tests - required credentials not found. Required credentials: ${Object.keys(credentials).join(', ')}`;

  it.skipIf(!hasCredentials)(
    'should fetch real deployments from Azure Management API and validate shape',
    async () => {
      const providers = await gateway.fetchProviders();

      expect(providers).toBeDefined();
      expect(typeof providers).toBe('object');
      expect(Object.keys(providers).length).toBeGreaterThan(0);

      console.log(`\nFetched ${Object.keys(providers).length} providers from Azure Management API`);
      console.log('Providers:', Object.keys(providers));

      expect(Object.keys(providers)).toEqual(['azureopenai']);
      expect(providers['azureopenai']).toBeDefined();

      const azureProvider = providers['azureopenai'];

      expect(azureProvider.apiKeyEnvVar, 'Provider azureopenai missing apiKeyEnvVar').toBeDefined();
      expect(azureProvider.apiKeyEnvVar).toBe('AZURE_API_KEY');

      expect(azureProvider.apiKeyHeader, 'Provider azureopenai missing apiKeyHeader').toBeDefined();
      expect(azureProvider.apiKeyHeader).toBe('api-key');

      expect(azureProvider.name, 'Provider azureopenai missing name').toBeDefined();
      expect(typeof azureProvider.name).toBe('string');
      expect(azureProvider.name).toBe('Azure OpenAI');

      expect(azureProvider.gateway, 'Provider azureopenai missing gateway').toBeDefined();
      expect(azureProvider.gateway).toBe('azureopenai');

      expect(azureProvider.docUrl, 'Provider azureopenai missing docUrl').toBeDefined();
      expect(azureProvider.docUrl).toBe('https://learn.microsoft.com/en-us/azure/ai-services/openai/');

      expect(azureProvider.models, 'Provider azureopenai missing models').toBeDefined();
      expect(Array.isArray(azureProvider.models)).toBe(true);
      expect(azureProvider.models.length).toBeGreaterThan(0);

      // Note: We assert models.length > 0 because the resource must have at least one deployment to pass the test
    },
    30000,
  );

  it.skipIf(!hasCredentials)(
    'should create language model with resolveLanguageModel',
    async () => {
      const providers = await gateway.fetchProviders();
      const deployments = providers['azureopenai'].models;

      // Verify there is at least one deployment available
      expect(deployments.length).toBeGreaterThan(0);

      const deploymentName = deployments[0];
      const model = await gateway.resolveLanguageModel({
        modelId: deploymentName,
        providerId: 'azureopenai',
        apiKey: process.env.AZURE_API_KEY!,
      });

      expect(model).toBeDefined();

      console.log(`\n✅ Successfully created language model for deployment: ${deploymentName}`);
    },
    30000,
  );

  if (!hasCredentials) {
    it('should skip all tests when credentials are missing', () => {
      console.log(`\n${skipMessage}`);
    });
  }
});
