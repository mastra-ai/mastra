/**
 * Tool execution proxy for integration providers
 *
 * This module provides functions to execute tools from external providers (Composio, Arcade)
 * by proxying execution requests to their respective APIs.
 */

import type { IntegrationProviderType } from './providers/types';

/**
 * Result of a tool execution
 */
export interface ToolExecutionResult {
  /**
   * Whether the tool execution was successful
   */
  success: boolean;

  /**
   * The output data from the tool execution
   */
  output?: unknown;

  /**
   * Error information if execution failed
   */
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };

  /**
   * Execution metadata
   */
  metadata?: {
    executionId?: string;
    duration?: number;
    finishedAt?: string;
    status?: string;
  };
}

/**
 * Parameters for executing a Composio tool
 */
interface ExecuteComposioToolParams {
  /**
   * The tool action slug (e.g., "GITHUB_CREATE_ISSUE")
   */
  toolSlug: string;

  /**
   * Input parameters for the tool
   */
  input: Record<string, unknown>;

  /**
   * Optional connected account ID for authentication
   */
  connectedAccountId?: string;

  /**
   * Optional user ID for multi-user scenarios
   */
  userId?: string;

  /**
   * Composio API key (defaults to COMPOSIO_API_KEY env var)
   */
  apiKey?: string;
}

/**
 * Parameters for executing an Arcade tool
 */
interface ExecuteArcadeToolParams {
  /**
   * The tool name/slug
   */
  toolName: string;

  /**
   * Input parameters for the tool
   */
  input: Record<string, unknown>;

  /**
   * User ID for authentication context (required when using API keys)
   */
  userId?: string;

  /**
   * Optional tool version
   */
  toolVersion?: string;

  /**
   * Arcade API key (defaults to ARCADE_API_KEY env var)
   */
  apiKey?: string;
}

/**
 * Composio API response types
 */
interface ComposioExecuteResponse {
  executionDetails?: {
    executed?: boolean;
    response?: unknown;
  };
  successfull?: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Arcade API response types
 */
interface ArcadeExecuteResponse {
  success: boolean;
  output?: {
    value?: unknown;
    error?: {
      message: string;
      type?: string;
    };
    logs?: string[];
  };
  execution_id?: string;
  status?: string;
  duration?: number;
  finished_at?: string;
}

/**
 * Execute a Composio tool via their V3 API
 *
 * @param params - Execution parameters
 * @returns Tool execution result
 *
 * @example
 * ```typescript
 * const result = await executeComposioTool({
 *   toolSlug: 'GITHUB_CREATE_ISSUE',
 *   input: {
 *     owner: 'myorg',
 *     repo: 'myrepo',
 *     title: 'Bug report',
 *     body: 'Found a bug...'
 *   },
 *   connectedAccountId: 'conn_123'
 * });
 * ```
 */
export async function executeComposioTool(params: ExecuteComposioToolParams): Promise<ToolExecutionResult> {
  const { toolSlug, input, connectedAccountId, userId, apiKey } = params;

  const composioApiKey = apiKey || process.env.COMPOSIO_API_KEY;
  if (!composioApiKey) {
    return {
      success: false,
      error: {
        message: 'COMPOSIO_API_KEY is not configured',
        code: 'MISSING_API_KEY',
      },
    };
  }

  try {
    // Composio V3 API endpoint: POST /api/v3/tools/execute/:action
    const url = `https://backend.composio.dev/api/v3/tools/execute/${toolSlug}`;

    const requestBody: Record<string, unknown> = {
      input,
    };

    // Add optional parameters
    if (connectedAccountId) {
      requestBody.connected_account_id = connectedAccountId;
    }
    if (userId) {
      requestBody.user_id = userId;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': composioApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: {
          message: `Composio API error: ${response.status} ${response.statusText}`,
          code: `HTTP_${response.status}`,
          details: errorText,
        },
      };
    }

    const data = (await response.json()) as ComposioExecuteResponse;

    // Composio API response format may vary, handle multiple formats
    const executed = data.executionDetails?.executed ?? data.successfull ?? false;
    const output = data.executionDetails?.response ?? data.data;
    const error = data.error;

    if (!executed || error) {
      return {
        success: false,
        error: {
          message: error || 'Tool execution failed',
          code: 'EXECUTION_FAILED',
          details: data,
        },
        output,
      };
    }

    return {
      success: true,
      output,
      metadata: {
        status: 'completed',
      },
    };
  } catch (err) {
    return {
      success: false,
      error: {
        message: err instanceof Error ? err.message : 'Unknown error executing Composio tool',
        code: 'EXECUTION_ERROR',
        details: err,
      },
    };
  }
}

/**
 * Execute an Arcade tool via their API
 *
 * @param params - Execution parameters
 * @returns Tool execution result
 *
 * @example
 * ```typescript
 * const result = await executeArcadeTool({
 *   toolName: 'Google.ListEmails',
 *   input: { n_emails: 10 },
 *   userId: 'user@example.com'
 * });
 * ```
 */
export async function executeArcadeTool(params: ExecuteArcadeToolParams): Promise<ToolExecutionResult> {
  const { toolName, input, userId, toolVersion, apiKey } = params;

  const arcadeApiKey = apiKey || process.env.ARCADE_API_KEY;
  if (!arcadeApiKey) {
    return {
      success: false,
      error: {
        message: 'ARCADE_API_KEY is not configured',
        code: 'MISSING_API_KEY',
      },
    };
  }

  try {
    // Arcade API endpoint: POST /v1/tools/execute
    const url = 'https://api.arcade.dev/v1/tools/execute';

    const requestBody: Record<string, unknown> = {
      tool_name: toolName,
      input,
    };

    // Add optional parameters
    if (userId) {
      requestBody.user_id = userId;
    }
    if (toolVersion) {
      requestBody.tool_version = toolVersion;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${arcadeApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: {
          message: `Arcade API error: ${response.status} ${response.statusText}`,
          code: `HTTP_${response.status}`,
          details: errorText,
        },
      };
    }

    const data = (await response.json()) as ArcadeExecuteResponse;

    // Check for execution errors in the output
    if (!data.success || data.output?.error) {
      return {
        success: false,
        error: {
          message: data.output?.error?.message || 'Tool execution failed',
          code: data.output?.error?.type || 'EXECUTION_FAILED',
          details: data,
        },
        output: data.output?.value,
        metadata: {
          executionId: data.execution_id,
          duration: data.duration,
          finishedAt: data.finished_at,
          status: data.status,
        },
      };
    }

    return {
      success: true,
      output: data.output?.value,
      metadata: {
        executionId: data.execution_id,
        duration: data.duration,
        finishedAt: data.finished_at,
        status: data.status,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: {
        message: err instanceof Error ? err.message : 'Unknown error executing Arcade tool',
        code: 'EXECUTION_ERROR',
        details: err,
      },
    };
  }
}

/**
 * Execute a tool from any supported provider
 *
 * @param provider - The integration provider type
 * @param toolSlug - The tool identifier
 * @param input - Input parameters for the tool
 * @param options - Optional execution options (connectedAccountId, userId, etc.)
 * @returns Tool execution result
 *
 * @example
 * ```typescript
 * const result = await executeTool('composio', 'GITHUB_CREATE_ISSUE', {
 *   owner: 'myorg',
 *   repo: 'myrepo',
 *   title: 'Bug report'
 * }, {
 *   connectedAccountId: 'conn_123'
 * });
 * ```
 */
export async function executeTool(
  provider: IntegrationProviderType,
  toolSlug: string,
  input: Record<string, unknown>,
  options?: {
    connectedAccountId?: string;
    userId?: string;
    toolVersion?: string;
    apiKey?: string;
  },
): Promise<ToolExecutionResult> {
  switch (provider) {
    case 'composio':
      return executeComposioTool({
        toolSlug,
        input,
        connectedAccountId: options?.connectedAccountId,
        userId: options?.userId,
        apiKey: options?.apiKey,
      });

    case 'arcade':
      return executeArcadeTool({
        toolName: toolSlug,
        input,
        userId: options?.userId,
        toolVersion: options?.toolVersion,
        apiKey: options?.apiKey,
      });

    default:
      return {
        success: false,
        error: {
          message: `Unsupported provider: ${provider}`,
          code: 'UNSUPPORTED_PROVIDER',
        },
      };
  }
}
