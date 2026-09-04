import { describe, it, expect } from 'vitest';
import { MastraProvider } from '@composio/mastra';
import type { Tool } from '@mastra/core/tools';

/**
 * Regression tests for retaining Composio-supplied output schemas.
 *
 * `ComposioToolProvider` used to clear `outputSchema` on every resolved tool
 * because early `@composio/mastra` versions passed Composio's strict API
 * schemas straight through and real third-party responses failed validation.
 * Current `@composio/mastra` relaxes the schema (nullable fields, extra
 * properties allowed, `required` dropped) before converting it, so the schema
 * can be kept: lenient enough for real payloads, while still rejecting
 * structurally invalid output.
 *
 * These tests use the real `MastraProvider.wrapTool()` and the real
 * `Tool.execute()` validation pipeline — no mocks, no network.
 */

// A strict Composio-style tool definition: required fields everywhere,
// `additionalProperties: false`, non-nullable primitives.
const strictComposioTool = {
  slug: 'TEST_LIST_ITEMS',
  name: 'Test list items',
  description: 'Lists items',
  toolkit: { slug: 'test', name: 'Test' },
  inputParameters: {
    type: 'object',
    properties: { owner: { type: 'string' } },
    required: ['owner'],
    additionalProperties: false,
  },
  outputParameters: {
    type: 'object',
    additionalProperties: false,
    required: ['data', 'error', 'successful'],
    properties: {
      data: {
        type: 'object',
        additionalProperties: false,
        required: ['items'],
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'assignee'],
              properties: {
                name: { type: 'string' },
                assignee: { type: 'string' },
              },
            },
          },
        },
      },
      error: { type: 'string' },
      successful: { type: 'boolean' },
    },
  },
};

function wrapWithResponse(response: unknown): Tool<any, any> {
  const provider = new MastraProvider();
  return (
    provider as unknown as {
      wrapTool: (tool: unknown, exec: (...args: unknown[]) => Promise<unknown>) => Tool<any, any>;
    }
  ).wrapTool(strictComposioTool, async () => response);
}

describe('Composio output schema retention', () => {
  it('wrapTool supplies a Standard Schema outputSchema', () => {
    const tool = wrapWithResponse({});
    expect(tool.outputSchema).toBeDefined();
    expect(tool.outputSchema && '~standard' in tool.outputSchema).toBe(true);
  });

  it('accepts a realistic lenient success response (nulls, missing and extra fields)', async () => {
    const response = {
      data: {
        items: [
          // extra property + null for a "required" non-nullable field
          { name: 'one', assignee: null, extra_field: 42 },
          // missing "required" field entirely
          { name: 'two' },
        ],
      },
      error: null,
      successful: true,
      // extra top-level key real APIs sometimes add
      logId: 'log_123',
    };

    const tool = wrapWithResponse(response);
    const result = await tool.execute!({ owner: 'mastra-ai' }, undefined as never);

    expect(result).toEqual(response);
  });

  it('accepts the failure envelope', async () => {
    const response = { data: {}, error: 'boom', successful: false };

    const tool = wrapWithResponse(response);
    const result = await tool.execute!({ owner: 'mastra-ai' }, undefined as never);

    expect(result).toEqual(response);
  });

  it('rejects structurally invalid output', async () => {
    const tool = wrapWithResponse(42);
    const result = (await tool.execute!({ owner: 'mastra-ai' }, undefined as never)) as {
      error?: boolean;
      message?: string;
    };

    expect(result.error).toBe(true);
    expect(result.message).toContain('Tool output validation failed');
  });

  it('rejects wrongly typed envelope fields', async () => {
    const tool = wrapWithResponse({ data: 'not-an-object', error: 123, successful: 'yes' });
    const result = (await tool.execute!({ owner: 'mastra-ai' }, undefined as never)) as {
      error?: boolean;
      message?: string;
    };

    expect(result.error).toBe(true);
    expect(result.message).toContain('Tool output validation failed');
  });
});
