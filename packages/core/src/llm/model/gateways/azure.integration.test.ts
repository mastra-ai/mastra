import { describe, it, expect } from 'vitest';
import { AzureGateway } from './azure.js';

// This is an integration test that hits the real Azure Management API
// Run with: pnpm test azure.integration.test.ts

describe('AzureGateway - Real API Integration', () => {
  const gateway = new AzureGateway();

  // Check if required credentials are available
  const credentials = {
    AZURE_TENANT_ID: process.env.AZURE_TENANT_ID,
    AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET: process.env.AZURE_CLIENT_SECRET,
    AZURE_SUBSCRIPTION_ID: process.env.AZURE_SUBSCRIPTION_ID,
    AZURE_RESOURCE_GROUP: process.env.AZURE_RESOURCE_GROUP,
    AZURE_RESOURCE_NAME: process.env.AZURE_RESOURCE_NAME,
  };

  const hasCredentials =
    process.env.AZURE_TENANT_ID &&
    process.env.AZURE_CLIENT_ID &&
    process.env.AZURE_CLIENT_SECRET &&
    process.env.AZURE_SUBSCRIPTION_ID &&
    process.env.AZURE_RESOURCE_GROUP &&
    process.env.AZURE_RESOURCE_NAME;

  const skipMessage = hasCredentials
    ? undefined
    : `Skipping Azure integration tests - required credentials not found. Required credentials: ${Object.keys(credentials).join(', ')}`;

  it.skipIf(!hasCredentials)(
    'should fetch real deployments from Azure Management API and validate shape',
    async () => {
      const providers = await gateway.fetchProviders();

      // Basic structure validation
      expect(providers).toBeDefined();
      expect(typeof providers).toBe('object');
      expect(Object.keys(providers).length).toBeGreaterThan(0);

      console.log(`\nFetched ${Object.keys(providers).length} providers from Azure Management API`);
      console.log('Providers:', Object.keys(providers));

      // Azure gateway returns a single 'azure' provider with all deployments
      expect(Object.keys(providers)).toEqual(['azure']);
      expect(providers['azure']).toBeDefined();

      // Validate the azure provider has the expected shape
      const azureProvider = providers['azure'];

      // Check required fields
      expect(azureProvider.apiKeyEnvVar, 'Provider azure missing apiKeyEnvVar').toBeDefined();
      expect(azureProvider.apiKeyEnvVar).toBe('AZURE_API_KEY');

      expect(azureProvider.apiKeyHeader, 'Provider azure missing apiKeyHeader').toBeDefined();
      expect(azureProvider.apiKeyHeader).toBe('api-key');

      expect(azureProvider.name, 'Provider azure missing name').toBeDefined();
      expect(typeof azureProvider.name).toBe('string');
      expect(azureProvider.name).toBe('Azure OpenAI');

      expect(azureProvider.gateway, 'Provider azure missing gateway').toBeDefined();
      expect(azureProvider.gateway).toBe('azure');

      expect(azureProvider.docUrl, 'Provider azure missing docUrl').toBeDefined();
      expect(azureProvider.docUrl).toBe('https://learn.microsoft.com/en-us/azure/ai-services/openai/');

      expect(azureProvider.models, 'Provider azure missing models').toBeDefined();
      expect(Array.isArray(azureProvider.models)).toBe(true);

      // Note: We don't assert models.length > 0 because the resource might have no deployments
      // This is a valid state and shouldn't fail the test

      // If there are models, validate they are deployment names (not base model names)
      if (azureProvider.models.length > 0) {
        console.log(`\nFound ${azureProvider.models.length} deployments:`);
        console.log(azureProvider.models.join(', '));

        // Deployment names should be strings
        for (const model of azureProvider.models) {
          expect(typeof model).toBe('string');
          expect(model.length).toBeGreaterThan(0);
        }
      } else {
        console.log('\nNo deployments found (this is valid - resource may be empty)');
      }
    },
    30000,
  ); // 30 second timeout for real API call

  it.skipIf(!hasCredentials)(
    'should create language model with resolveLanguageModel',
    async () => {
      const hasApiKey = !!process.env.AZURE_API_KEY;

      if (hasApiKey) {
        // Fetch real deployments to get a valid deployment name
        const providers = await gateway.fetchProviders();
        const deployments = providers['azure'].models;

        if (deployments.length > 0) {
          // Use the first deployment name
          const deploymentName = deployments[0];

          const model = await gateway.resolveLanguageModel({
            modelId: deploymentName,
            providerId: 'azure',
            apiKey: process.env.AZURE_API_KEY!,
          });

          expect(model).toBeDefined();
          console.log(`\nSuccessfully created language model for deployment: ${deploymentName}`);
        } else {
          console.log('\nNo deployments available to test resolveLanguageModel');
        }
      } else {
        console.log('\nAZURE_API_KEY not set, skipping resolveLanguageModel test');
      }
    },
    30000,
  );

  if (!hasCredentials) {
    it('should skip all tests when credentials are missing', () => {
      console.log(`\n${skipMessage}`);
    });
  }
});
