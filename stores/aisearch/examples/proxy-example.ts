/**
 * Example: Using AzureAISearchVector with a custom proxy
 * 
 * This example demonstrates how to use clientOptions to configure
 * a custom proxy for Azure AI Search requests.
 */

import { AzureAISearchVector } from '../src/vector';
import type { PipelinePolicy } from '@azure/core-rest-pipeline';

/**
 * Create a custom proxy policy
 * This intercepts all requests and redirects them through a proxy server
 */
function createProxyPolicy(config: {
  proxyUrl: string;
  token: string;
  userId?: string;
  customHeaders?: Record<string, string>;
}): PipelinePolicy {
  return {
    name: 'CustomProxyPolicy',
    async sendRequest(request, next) {
      // Rewrite the URL to use the proxy
      const originalUrl = new URL(request.url);
      const proxyPath = `${originalUrl.pathname}${originalUrl.search}`;
      request.url = `${config.proxyUrl}${proxyPath}`;
      
      // Add authentication header
      request.headers.set('Authorization', `Bearer ${config.token}`);
      
      // Add optional user ID header
      if (config.userId) {
        request.headers.set('X-User-ID', config.userId);
      }
      
      // Add any custom headers
      if (config.customHeaders) {
        Object.entries(config.customHeaders).forEach(([key, value]) => {
          request.headers.set(key, value);
        });
      }
      
      console.log(`[Proxy] Redirecting: ${originalUrl.href} -> ${request.url}`);
      
      return next(request);
    }
  };
}

async function main() {
  // Configuration from environment variables
  const proxyUrl = process.env.PROXY_URL || 'https://my-proxy.example.com';
  const proxyToken = process.env.PROXY_TOKEN || 'your-jwt-token';
  const userId = process.env.USER_ID;

  // Create Azure AI Search instance with proxy configuration
  const vectorStore = new AzureAISearchVector({
    id: 'azure-search-proxy',
    endpoint: 'https://dummy.search.windows.net', // Will be replaced by proxy
    credential: 'dummy-key', // Not used when proxy handles auth
    clientOptions: {
      additionalPolicies: [
        {
          position: 'perCall',
          policy: createProxyPolicy({
            proxyUrl,
            token: proxyToken,
            userId,
            customHeaders: {
              'X-Custom-Header': 'example-value',
              'X-Request-Source': 'mastra-aisearch'
            }
          })
        }
      ],
      // Optional: Configure retry behavior
      retryOptions: {
        maxRetries: 3,
        retryDelayInMs: 1000
      }
    }
  });

  try {
    // Use the vector store normally - all requests go through the proxy
    console.log('Creating index through proxy...');
    await vectorStore.createIndex({
      indexName: 'test-index',
      dimension: 1536,
      metric: 'cosine'
    });

    console.log('Index created successfully through proxy!');

    // Query vectors through proxy
    const results = await vectorStore.query({
      indexName: 'test-index',
      queryVector: Array(1536).fill(0.1),
      topK: 5
    });

    console.log(`Found ${results.length} results through proxy`);

  } catch (error) {
    console.error('Error using proxy:', error);
  }
}

// Run example if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { createProxyPolicy };
