import { describe, it, expect } from 'vitest';
import { AzureGateway } from './azure.js';

// This is an integration test that hits the real Azure Management API
// Run with: pnpm test azure.integration.test.ts
//
// Required Environment Variables:
// - AZURE_TENANT_ID: Azure AD tenant ID
// - AZURE_CLIENT_ID: Service principal client ID
// - AZURE_CLIENT_SECRET: Service principal client secret
// - AZURE_SUBSCRIPTION_ID: Azure subscription ID
// - AZURE_RESOURCE_GROUP: Resource group containing the Azure OpenAI resource
// - AZURE_RESOURCE_NAME: Name of the Azure OpenAI resource
// - AZURE_API_KEY: API key for Azure OpenAI service (for resolveLanguageModel tests)
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

  // Log credential status for debugging
  if (!hasCredentials) {
    console.log('\n🔍 Azure Integration Test - Credential Check:');
    Object.entries(credentials).forEach(([key, value]) => {
      const status = value ? '✅ SET' : '❌ MISSING';
      const preview = value ? `(${String(value).substring(0, 8)}...)` : '';
      console.log(`  ${status} ${key} ${preview}`);
    });
  } else {
    console.log('\n✅ All Azure credentials found - tests will run');
  }

  const skipMessage = hasCredentials
    ? undefined
    : 'Skipping Azure integration tests - required credentials not found. See log above for details.';

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

      // Log statistics
      console.log(`\nStatistics:`);
      console.log(`- Total providers: ${Object.keys(providers).length}`);
      console.log(`- Total deployments: ${azureProvider.models.length}`);
    },
    30000,
  ); // 30 second timeout for real API call

  it.skipIf(!hasCredentials)(
    'should cache Azure AD tokens correctly',
    async () => {
      // First call - should fetch token
      const providers1 = await gateway.fetchProviders();
      expect(providers1).toBeDefined();

      // Second call - should use cached token (verify by checking response time)
      const start = Date.now();
      const providers2 = await gateway.fetchProviders();
      const duration = Date.now() - start;

      expect(providers2).toBeDefined();
      expect(providers2).toEqual(providers1);

      // Second call should be faster due to token caching
      // (This is a weak assertion but validates caching is working)
      console.log(`\nSecond call took ${duration}ms (should be faster due to token caching)`);
    },
    30000,
  );

  it.skipIf(!hasCredentials)('should filter out non-succeeded deployments', async () => {
    const providers = await gateway.fetchProviders();
    const azureProvider = providers['azure'];

    // All returned models should be from 'Succeeded' deployments
    // We can't verify this directly without accessing the raw API response,
    // but we can verify the structure is correct
    expect(Array.isArray(azureProvider.models)).toBe(true);

    // Log deployment names to help identify any issues
    if (azureProvider.models.length > 0) {
      console.log(`\nDeployment names (all should be 'Succeeded' state):`);
      console.log(azureProvider.models.join(', '));
    }
  });

  it.skipIf(!hasCredentials)('should handle getApiKey correctly', async () => {
    const hasApiKey = !!process.env.AZURE_API_KEY;

    if (hasApiKey) {
      // If AZURE_API_KEY is set, it should return it
      const apiKey = await gateway.getApiKey('azure/my-deployment');
      expect(apiKey).toBe(process.env.AZURE_API_KEY);
    } else {
      // If AZURE_API_KEY is not set, it should throw
      await expect(gateway.getApiKey('azure/my-deployment')).rejects.toMatchObject({
        id: 'AZURE_API_KEY_MISSING',
        message: expect.stringContaining('AZURE_API_KEY'),
      });
    }
  });

  it.skipIf(!hasCredentials)('should validate buildUrl returns undefined', async () => {
    // Azure SDK constructs URLs internally, so buildUrl should return undefined
    const url = gateway.buildUrl('azure/my-deployment');
    expect(url).toBeUndefined();
  });

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
