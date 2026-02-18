import { openai } from '@ai-sdk/openai';
import { tool } from 'ai';
import { z } from 'zod';
import { Agent } from '@mastra/core/agent';

/**
 * Request Context Demo Agent
 *
 * This agent demonstrates how requestContext can be used to dynamically configure
 * agent behavior based on different presets (development, production, staging, admin-user, guest-user).
 *
 * Try these presets from the dropdown in Mastra Studio:
 * - development: Uses dev API, debug mode enabled, verbose logging
 * - production: Uses prod API, minimal logging, optimized responses
 * - staging: Uses staging API, moderate logging
 * - admin-user: Full permissions, advanced tools enabled
 * - guest-user: Limited permissions, restricted features
 */

// Tool that simulates API calls with different endpoints
const apiRequestTool = tool({
  description: 'Makes an API request to fetch data. The endpoint varies based on the environment.',
  parameters: z.object({
    resource: z.string().describe('The resource to fetch (e.g., "users", "orders", "products")'),
  }),
  execute: async ({ resource }, { requestContext }) => {
    const apiEndpoint = requestContext?.get('apiEndpoint') || 'https://api.example.com';
    const environment = requestContext?.get('environment') || 'unknown';
    const userId = requestContext?.get('userId') || 'anonymous';

    // Simulate API response
    return {
      status: 'success',
      environment,
      endpoint: `${apiEndpoint}/${resource}`,
      data: {
        resource,
        requestedBy: userId,
        timestamp: new Date().toISOString(),
      },
    };
  },
});

// Tool that requires specific permissions
const adminActionTool = tool({
  description: 'Performs an admin action. Only available to users with admin permissions.',
  parameters: z.object({
    action: z.string().describe('The admin action to perform'),
  }),
  execute: async ({ action }, { requestContext }) => {
    const permissions = requestContext?.get('permissions') as string[] | undefined;
    const role = requestContext?.get('role') || 'guest';

    // Check if user has required permissions
    if (!permissions || !permissions.includes('manage')) {
      return {
        status: 'error',
        message: `Access denied. Current role: ${role}. This action requires 'manage' permission.`,
      };
    }

    return {
      status: 'success',
      message: `Admin action "${action}" completed successfully.`,
      role,
      permissions,
    };
  },
});

// Tool that uses analytics features
const analyticsTool = tool({
  description: 'Retrieves analytics data. Availability depends on feature flags.',
  parameters: z.object({
    metric: z.string().describe('The metric to analyze (e.g., "user_engagement", "revenue", "conversion")'),
  }),
  execute: async ({ metric }, { requestContext }) => {
    const features = requestContext?.get('features') as { analytics?: boolean; advancedTools?: boolean } | undefined;

    if (!features || !features.analytics) {
      return {
        status: 'unavailable',
        message: 'Analytics feature is not enabled for this user.',
      };
    }

    return {
      status: 'success',
      metric,
      data: {
        value: Math.floor(Math.random() * 1000),
        trend: '+12%',
        period: 'last 30 days',
      },
    };
  },
});

export const requestContextDemoAgent = new Agent({
  id: 'request-context-demo-agent',
  name: 'Request Context Demo Agent',
  description: 'Demonstrates dynamic behavior based on requestContext presets',

  // Dynamic instructions based on environment and role
  instructions: ({ requestContext }) => {
    const environment = requestContext.get('environment') || 'unknown';
    const role = requestContext.get('role') || 'user';
    const debugMode = requestContext.get('debugMode') || false;
    const logLevel = requestContext.get('logLevel') || 'info';

    let baseInstructions = `You are a helpful assistant configured for the ${environment} environment.`;

    // Add role-specific instructions
    if (role === 'admin') {
      baseInstructions += ' You have admin privileges and can perform administrative actions.';
    } else if (role === 'guest') {
      baseInstructions += ' You are in guest mode with limited permissions.';
    }

    // Add debug mode instructions
    if (debugMode) {
      baseInstructions += ' Debug mode is enabled - provide detailed explanations and verbose output.';
    }

    // Add logging instructions
    if (logLevel === 'debug') {
      baseInstructions += ' Log level is set to debug - include diagnostic information in responses.';
    } else if (logLevel === 'error') {
      baseInstructions += ' Log level is set to error - keep responses concise and only report critical issues.';
    }

    return baseInstructions;
  },

  // Dynamic model selection based on environment
  model: ({ requestContext }) => {
    const environment = requestContext.get('environment');

    // Use a faster model for development, more capable for production
    if (environment === 'production') {
      return openai('gpt-4o');
    }
    return openai('gpt-4o-mini');
  },

  // Dynamic tools based on permissions and features
  tools: ({ requestContext }) => {
    const permissions = requestContext.get('permissions') as string[] | undefined;
    const features = requestContext.get('features') as { analytics?: boolean; advancedTools?: boolean } | undefined;

    const tools: Record<string, any> = {
      apiRequestTool,
    };

    // Add admin tools if user has appropriate permissions
    if (permissions && permissions.includes('manage')) {
      tools.adminActionTool = adminActionTool;
    }

    // Add analytics tools if feature is enabled
    if (features && features.analytics) {
      tools.analyticsTool = analyticsTool;
    }

    // Add advanced tools if enabled
    if (features && features.advancedTools) {
      tools.web_search = openai.tools.webSearchPreview();
    }

    return tools;
  },
});
