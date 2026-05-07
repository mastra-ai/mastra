/**
 * Test setup file for Vitest
 * Configures global test environment and utilities
 */

import { beforeAll, afterAll } from 'vitest';

// Global test configuration
beforeAll(() => {
  // Set test timeout to 30 seconds for integration tests
  process.env.VITEST_TEST_TIMEOUT = '30000';
});

afterAll(() => {
  // Cleanup if needed
});

// Helper to check if integration tests should run
export const shouldRunIntegrationTests = (): boolean => {
  return !!(
    process.env.AZURE_SEARCH_ENDPOINT && 
    process.env.AZURE_SEARCH_API_KEY
  );
};

// Helper to get test credentials
export const getTestCredentials = () => {
  if (!shouldRunIntegrationTests()) {
    throw new Error('Azure AI Search credentials not configured');
  }
  
  return {
    endpoint: process.env.AZURE_SEARCH_ENDPOINT!,
    apiKey: process.env.AZURE_SEARCH_API_KEY!,
    indexPrefix: process.env.AZURE_SEARCH_TEST_INDEX_PREFIX || 'test-mastra-',
  };
};